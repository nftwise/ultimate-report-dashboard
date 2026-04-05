import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendCronFailureAlert, saveCronStatus } from '@/lib/telegram';

export const maxDuration = 300;

const BATCH_SIZE = 3;
const DEFAULT_TIMEOUT_MS = 30000;
const SINGLE_CLIENT_TIMEOUT_MS = 60000;

const FB_API_VERSION = 'v19.0';
const FB_GRAPH_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

/**
 * GET /api/cron/sync-fb-ads
 * Daily cron: Sync Facebook Ads campaign metrics to fb_campaign_metrics table
 * Also rolls up aggregated totals into client_metrics_summary
 *
 * Supports:
 *   ?date=YYYY-MM-DD  — specific date (default: yesterday CA time)
 *   ?clientId=UUID    — single client
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // ── Date param ────────────────────────────────────────────
    const dateParam = request.nextUrl.searchParams.get('date');
    const targetDate = dateParam || (() => {
      const now = new Date();
      const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      caToday.setDate(caToday.getDate() - 1);
      return `${caToday.getFullYear()}-${String(caToday.getMonth() + 1).padStart(2, '0')}-${String(caToday.getDate()).padStart(2, '0')}`;
    })();

    const clientIdParam = request.nextUrl.searchParams.get('clientId');
    const timeoutMs = clientIdParam ? SINGLE_CLIENT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

    console.log(`[sync-fb-ads] Starting for ${targetDate}${clientIdParam ? ` (client: ${clientIdParam})` : ''}`);

    // ── Access token check ────────────────────────────────────
    const accessToken = process.env.FB_ADS_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ success: false, error: 'Missing FB_ADS_ACCESS_TOKEN' }, { status: 500 });
    }

    // ── Fetch clients with FB ad account config ───────────────
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
        return NextResponse.json(
          { success: false, error: `Client ${clientIdParam} not found or has no fb_ad_account_id` },
          { status: 404 }
        );
      }
    }

    console.log(`[sync-fb-ads] Processing ${clients.length} clients`);

    let totalRows = 0;
    const errors: string[] = [];

    // ── Process in batches ────────────────────────────────────
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

            // ── Build rows for fb_campaign_metrics ─────────────
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

            // ── Roll up aggregated totals into client_metrics_summary ──
            const totals = aggregateTotals(rows);
            const { error: summaryErr } = await supabaseAdmin
              .from('client_metrics_summary')
              .upsert(
                {
                  client_id: client.id,
                  date: targetDate,
                  period_type: 'daily',
                  fb_spend: totals.spend,
                  fb_leads: totals.leads,
                  fb_impressions: totals.impressions,
                  fb_clicks: totals.clicks,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'client_id,date' }
              );

            if (summaryErr) {
              // Columns may not exist yet — log but don't fail
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

    return NextResponse.json({
      success: true,
      date: targetDate,
      clients: clients.length,
      rows: totalRows,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    });
  } catch (err: any) {
    console.error('[sync-fb-ads] Fatal error:', err);
    sendCronFailureAlert('sync-fb-ads', 'unknown', [`Fatal: ${err.message}`]).catch(() => {});
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// =====================================================
// FACEBOOK MARKETING API HELPERS
// =====================================================

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

  // Handle pagination (shouldn't be needed for single day / campaign level, but be safe)
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

/**
 * Parse FB actions array to extract specific action counts.
 * Returns { leads, messages, calls }
 */
function parseActions(actions: any[] = []): { leads: number; messages: number; calls: number } {
  const find = (type: string) =>
    actions.find((a: any) => a.action_type === type);

  const leads = parseInt(find('lead')?.value || '0', 10);
  const messages = parseInt(
    find('onsite_conversion.messaging_conversation_started_7d')?.value || '0',
    10
  );
  // Some accounts use 'phone_call', others use 'omni_initiated_checkout' for calls
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
