import { supabaseAdmin } from '../src/lib/supabase';
import { sendCronFailureAlert, saveCronStatus } from '../src/lib/telegram';

const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf('--' + name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
};

const BATCH_SIZE = 3;
const DEFAULT_TIMEOUT_MS = 30000;
const SINGLE_CLIENT_TIMEOUT_MS = 60000;

const FB_API_VERSION = 'v19.0';
const FB_GRAPH_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

async function main() {
  const startTime = Date.now();

  try {
    const dateParam = ((process.env.DATE || getArg('date') || '').trim() || undefined);
    const targetDate = dateParam || (() => {
      const now = new Date();
      const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      caToday.setDate(caToday.getDate() - 1);
      return `${caToday.getFullYear()}-${String(caToday.getMonth() + 1).padStart(2, '0')}-${String(caToday.getDate()).padStart(2, '0')}`;
    })();

    const clientIdParam = process.env.CLIENT_ID || getArg('clientId');
    const timeoutMs = clientIdParam ? SINGLE_CLIENT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

    console.log(`[sync-fb-ads] Starting for ${targetDate}${clientIdParam ? ` (client: ${clientIdParam})` : ''}`);

    const accessToken = process.env.FB_ADS_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('Missing FB_ADS_ACCESS_TOKEN');
    }

    const { data: rawClients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('id, name, service_configs(fb_ad_account_id)')
      .eq('is_active', true);

    if (clientsError) throw new Error(`Failed to fetch clients: ${clientsError.message}`);

    let clients = (rawClients || [])
      .map((c: any) => {
        const cfg = Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs;
        return {
          id: c.id,
          name: c.name,
          fb_ad_account_id: cfg?.fb_ad_account_id || null,
        };
      })
      .filter((c: any) => c.fb_ad_account_id);

    if (clientIdParam) {
      clients = clients.filter((c: any) => c.id === clientIdParam);
      if (clients.length === 0) {
        throw new Error(`Client ${clientIdParam} not found or has no fb_ad_account_id`);
      }
    }

    console.log(`[sync-fb-ads] Processing ${clients.length} clients`);

    let totalRows = 0;
    const errors: string[] = [];

    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (client: any) => {
          try {
            const fetchWithRetry = async (fn: () => Promise<any[]>, label: string) => {
              try {
                return await fn();
              } catch (err: any) {
                console.log(`[sync-fb-ads] ${client.name} ${label} attempt 1 failed: ${err.message}, retrying...`);
                await new Promise(r => setTimeout(r, 2000));
                try {
                  return await fn();
                } catch (err2: any) {
                  console.log(`[sync-fb-ads] ${client.name} ${label} attempt 2 failed: ${err2.message}`);
                  errors.push(`${client.name} ${label}: ${err2.message}`);
                  return [];
                }
              }
            };

            const insights = await fetchWithRetry(
              () => fetchFBInsights(client.fb_ad_account_id, targetDate, accessToken, timeoutMs),
              'insights'
            );

            if (insights.length === 0) {
              console.log(`[sync-fb-ads] ${client.name}: no insights for ${targetDate}`);
              return;
            }

            const rows = insights.map((ins: any) => buildCampaignRow(ins, client.id, targetDate));

            const { error: upsertErr } = await supabaseAdmin
              .from('fb_campaign_metrics')
              .upsert(rows, { onConflict: 'client_id,date,campaign_id' });

            if (upsertErr) {
              console.error(`[sync-fb-ads] Upsert error ${client.name}:`, upsertErr.message);
              errors.push(`${client.name} upsert: ${upsertErr.message}`);
              return;
            }

            totalRows += rows.length;
            console.log(`[sync-fb-ads] ${client.name}: ${rows.length} campaign rows saved`);

            const ageGenderRows = await fetchWithRetry(
              () => fetchFBBreakdown(client.fb_ad_account_id, targetDate, accessToken, 'age,gender', timeoutMs),
              'age_gender'
            );
            if (ageGenderRows.length > 0) {
              await supabaseAdmin.from('fb_age_gender_metrics').upsert(
                ageGenderRows.map((r: any) => ({
                  client_id: client.id,
                  date: targetDate,
                  age: r.age || 'unknown',
                  gender: r.gender || 'unknown',
                  spend: parseFloat(r.spend || '0'),
                  impressions: parseInt(r.impressions || '0', 10),
                  clicks: parseInt(r.clicks || '0', 10),
                  leads: parseInt(r.actions?.find((a: any) => a.action_type === 'lead')?.value || '0', 10),
                })),
                { onConflict: 'client_id,date,age,gender' }
              );
            }

            const placementRows = await fetchWithRetry(
              () => fetchFBBreakdown(client.fb_ad_account_id, targetDate, accessToken, 'publisher_platform,platform_position', timeoutMs),
              'placement'
            );
            if (placementRows.length > 0) {
              await supabaseAdmin.from('fb_placement_metrics').upsert(
                placementRows.map((r: any) => ({
                  client_id: client.id,
                  date: targetDate,
                  platform: r.publisher_platform || 'unknown',
                  placement: r.platform_position || 'unknown',
                  spend: parseFloat(r.spend || '0'),
                  impressions: parseInt(r.impressions || '0', 10),
                  clicks: parseInt(r.clicks || '0', 10),
                  leads: parseInt(r.actions?.find((a: any) => a.action_type === 'lead')?.value || '0', 10),
                })),
                { onConflict: 'client_id,date,platform,placement' }
              );
            }

            const totals = aggregateTotals(rows);
            const { error: summaryErr } = await supabaseAdmin
              .from('client_metrics_summary')
              .update({
                fb_spend: totals.spend,
                fb_leads: totals.leads,
                fb_impressions: totals.impressions,
                fb_clicks: totals.clicks,
                updated_at: new Date().toISOString(),
              })
              .eq('client_id', client.id)
              .eq('date', targetDate)
              .eq('period_type', 'daily');

            if (summaryErr) {
              console.warn(`[sync-fb-ads] Summary rollup warning ${client.name}:`, summaryErr.message);
            }
          } catch (err: any) {
            errors.push(`${client.name}: ${err.message}`);
          }
        })
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-fb-ads] Done in ${duration}ms: ${totalRows} rows, ${errors.length} errors`);

    if (errors.length > 0) {
      sendCronFailureAlert('sync-fb-ads', targetDate, errors).catch(() => {});
    }

    saveCronStatus(supabaseAdmin, 'sync_fb_ads', {
      clients: clients.length,
      records: totalRows,
      errors,
      duration,
    }).catch(() => {});

    const result = {
      success: true,
      date: targetDate,
      clients: clients.length,
      rows: totalRows,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    };
    console.log(JSON.stringify(result));
    return result;
  } catch (err: any) {
    console.error('[sync-fb-ads] Fatal error:', err);
    sendCronFailureAlert('sync-fb-ads', 'unknown', [`Fatal: ${err.message}`]).catch(() => {});
    throw new Error(err.message);
  }
}

async function fetchFBInsights(
  adAccountId: string,
  date: string,
  accessToken: string,
  timeoutMs: number
): Promise<any[]> {
  const fields = [
    'campaign_id',
    'campaign_name',
    'adset_id',
    'adset_name',
    'spend',
    'impressions',
    'clicks',
    'reach',
    'actions',
    'cost_per_action_type',
  ].join(',');

  const params = new URLSearchParams({
    fields,
    level: 'campaign',
    time_increment: '1',
    time_range: JSON.stringify({ since: date, until: date }),
    access_token: accessToken,
    limit: '500',
  });

  const url = `${FB_GRAPH_BASE}/act_${adAccountId}/insights?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`FB API ${response.status}: ${body.slice(0, 200)}`);
  }

  const json = await response.json();

  if (json.error) {
    throw new Error(`FB API error: ${json.error.message}`);
  }

  const rows: any[] = json.data || [];

  let nextUrl = json.paging?.next;
  while (nextUrl) {
    const nextCtrl = new AbortController();
    const nextTimeout = setTimeout(() => nextCtrl.abort(), timeoutMs);
    const nextResp = await fetch(nextUrl, { signal: nextCtrl.signal });
    clearTimeout(nextTimeout);
    if (!nextResp.ok) break;
    const nextJson = await nextResp.json();
    rows.push(...(nextJson.data || []));
    nextUrl = nextJson.paging?.next;
  }

  return rows;
}

async function fetchFBBreakdown(
  adAccountId: string,
  date: string,
  accessToken: string,
  breakdowns: string,
  timeoutMs: number
): Promise<any[]> {
  const params = new URLSearchParams({
    fields: 'spend,impressions,clicks,actions',
    level: 'account',
    breakdowns,
    time_range: JSON.stringify({ since: date, until: date }),
    access_token: accessToken,
    limit: '500',
  });

  const url = `${FB_GRAPH_BASE}/act_${adAccountId}/insights?${params.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
  if (!response.ok) return [];
  const json = await response.json();
  if (json.error) return [];
  return json.data || [];
}

function parseActions(actions: any[] = []): { leads: number; messages: number; calls: number } {
  const find = (type: string) =>
    actions.find((a: any) => a.action_type === type);

  const leads = parseInt(find('lead')?.value || '0', 10);
  const messages = parseInt(
    find('onsite_conversion.messaging_conversation_started_7d')?.value || '0',
    10
  );
  const calls =
    parseInt(find('phone_call')?.value || '0', 10) ||
    parseInt(find('omni_initiated_checkout')?.value || '0', 10);

  return { leads, messages, calls };
}

function buildCampaignRow(ins: any, clientId: string, date: string) {
  const spend = parseFloat(ins.spend || '0');
  const impressions = parseInt(ins.impressions || '0', 10);
  const clicks = parseInt(ins.clicks || '0', 10);
  const reach = parseInt(ins.reach || '0', 10);

  const { leads, messages, calls } = parseActions(ins.actions);

  const cpl = leads > 0 ? spend / leads : 0;
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;

  return {
    client_id: clientId,
    date,
    campaign_id: ins.campaign_id || '',
    campaign_name: ins.campaign_name || '',
    adset_id: ins.adset_id || null,
    adset_name: ins.adset_name || null,
    spend,
    impressions,
    clicks,
    reach,
    leads,
    messages,
    calls,
    cpl: Math.round(cpl * 100) / 100,
    ctr: Math.round(ctr * 10000) / 10000,
    cpc: Math.round(cpc * 100) / 100,
  };
}

function aggregateTotals(rows: ReturnType<typeof buildCampaignRow>[]) {
  return rows.reduce(
    (acc, r) => ({
      spend: acc.spend + r.spend,
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      leads: acc.leads + r.leads,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0 }
  );
}

main().then(r => { console.log(JSON.stringify(r)); process.exit(0); }).catch(e => { console.error('FAILED:', e.message); process.exit(1); });
