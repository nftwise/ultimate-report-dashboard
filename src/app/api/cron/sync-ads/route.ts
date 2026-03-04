import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { JWT } from 'google-auth-library';

export const maxDuration = 300;

const BATCH_SIZE = 3;
const TIMEOUT_MS = 25000;

/**
 * GET /api/cron/sync-ads
 * Daily cron: Sync yesterday's Google Ads data to raw tables
 * Tables: ads_campaign_metrics, ads_ad_group_metrics, campaign_conversion_actions, campaign_search_terms
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const dateParam = request.nextUrl.searchParams.get('date');
    const targetDate = dateParam || (() => {
      // Use California timezone for "yesterday" calculation
      const now = new Date();
      const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      caToday.setDate(caToday.getDate() - 1);
      return `${caToday.getFullYear()}-${String(caToday.getMonth() + 1).padStart(2, '0')}-${String(caToday.getDate()).padStart(2, '0')}`;
    })();
    const gaqlDate = targetDate.replace(/-/g, '');
    const clientIdParam = request.nextUrl.searchParams.get('clientId');

    console.log(`[sync-ads] Starting for ${targetDate}${clientIdParam ? ` (client: ${clientIdParam})` : ''}`);

    // Get auth
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const mccId = process.env.GOOGLE_ADS_MCC_ID;

    if (!developerToken || !privateKey || !clientEmail) {
      return NextResponse.json({ success: false, error: 'Missing Google Ads credentials' }, { status: 500 });
    }

    const jwtClient = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/adwords'],
    });
    const tokens = await jwtClient.authorize();
    const accessToken = tokens.access_token!;

    // Fetch clients with Ads config
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('id, name, service_configs(gads_customer_id)')
      .eq('is_active', true);

    if (clientsError) throw new Error(`Failed to fetch clients: ${clientsError.message}`);

    let clientsWithAds = (clients || [])
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        customerId: (Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs)?.gads_customer_id?.replace(/-|\s/g, ''),
      }))
      .filter((c: any) => c.customerId);

    if (clientIdParam) {
      clientsWithAds = clientsWithAds.filter((c: any) => c.id === clientIdParam);
      if (clientsWithAds.length === 0) {
        return NextResponse.json({ success: false, error: `Client ${clientIdParam} not found or has no Ads config` }, { status: 404 });
      }
    }

    console.log(`[sync-ads] Processing ${clientsWithAds.length} clients`);

    let totalCampaigns = 0, totalAdGroups = 0, totalConversions = 0, totalSearchTerms = 0;
    const errors: string[] = [];
    const cleanMccId = mccId?.replace(/-|\s/g, '');

    // Process clients in batches
    for (let i = 0; i < clientsWithAds.length; i += BATCH_SIZE) {
      const batch = clientsWithAds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (client: any) => {
        try {
          const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': developerToken,
            'Content-Type': 'application/json',
          };
          if (cleanMccId) headers['login-customer-id'] = cleanMccId;

          const apiUrl = `https://googleads.googleapis.com/v20/customers/${client.customerId}/googleAds:searchStream`;

          const fetchWithRetry = async (fn: () => Promise<any[]>, label: string) => {
            try {
              return await fn();
            } catch (err: any) {
              console.log(`[sync-ads] ${client.name} ${label} attempt 1 failed: ${err.message}, retrying...`);
              try {
                await new Promise(r => setTimeout(r, 2000));
                return await fn();
              } catch (err2: any) {
                console.log(`[sync-ads] ${client.name} ${label} attempt 2 failed: ${err2.message}`);
                errors.push(`${client.name} ${label}: ${err2.message}`);
                return [];
              }
            }
          };

          // Fetch all 4 report types in parallel
          const [campaigns, adGroups, conversions, searchTerms] = await Promise.all([
            fetchWithRetry(() => fetchCampaignMetrics(apiUrl, headers, gaqlDate, client.id, targetDate), 'campaigns'),
            fetchWithRetry(() => fetchAdGroupMetrics(apiUrl, headers, gaqlDate, client.id, targetDate), 'adGroups'),
            fetchWithRetry(() => fetchConversionActions(apiUrl, headers, gaqlDate, client.id, targetDate), 'conversions'),
            fetchWithRetry(() => fetchSearchTerms(apiUrl, headers, gaqlDate, client.id, targetDate), 'searchTerms'),
          ]);

          // Upsert each table
          if (campaigns.length > 0) {
            const { error } = await supabaseAdmin.from('ads_campaign_metrics').upsert(campaigns, { onConflict: 'client_id,campaign_id,date' });
            if (error) console.log(`[sync-ads] Campaign upsert error ${client.name}:`, error.message);
          }
          if (adGroups.length > 0) {
            const { error } = await supabaseAdmin.from('ads_ad_group_metrics').upsert(adGroups, { onConflict: 'client_id,campaign_id,ad_group_id,date' });
            if (error) console.log(`[sync-ads] AdGroup upsert error ${client.name}:`, error.message);
          }
          if (conversions.length > 0) {
            const { error } = await supabaseAdmin.from('campaign_conversion_actions').upsert(conversions, { onConflict: 'client_id,campaign_id,date,conversion_action_name' });
            if (error) console.log(`[sync-ads] Conversion upsert error ${client.name}:`, error.message);
          }
          if (searchTerms.length > 0) {
            // Batch upsert search terms (can be large — 500 rows per batch)
            const UPSERT_BATCH = 500;
            for (let j = 0; j < searchTerms.length; j += UPSERT_BATCH) {
              const chunk = searchTerms.slice(j, j + UPSERT_BATCH);
              const { error } = await supabaseAdmin.from('campaign_search_terms').upsert(chunk, { onConflict: 'client_id,campaign_id,date,search_term' });
              if (error) { console.log(`[sync-ads] SearchTerm upsert error ${client.name} batch ${j}:`, error.message); break; }
            }
          }

          return { campaigns: campaigns.length, adGroups: adGroups.length, conversions: conversions.length, searchTerms: searchTerms.length };
        } catch (err: any) {
          errors.push(`${client.name}: ${err.message}`);
          return { campaigns: 0, adGroups: 0, conversions: 0, searchTerms: 0 };
        }
      }));

      results.forEach((r) => {
        totalCampaigns += r.campaigns;
        totalAdGroups += r.adGroups;
        totalConversions += r.conversions;
        totalSearchTerms += r.searchTerms;
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-ads] Done in ${duration}ms: ${totalCampaigns} campaigns, ${totalAdGroups} ad groups, ${totalConversions} conversions, ${totalSearchTerms} search terms`);

    return NextResponse.json({
      success: true,
      date: targetDate,
      clients: clientsWithAds.length,
      records: { campaigns: totalCampaigns, adGroups: totalAdGroups, conversions: totalConversions, searchTerms: totalSearchTerms },
      total: totalCampaigns + totalAdGroups + totalConversions + totalSearchTerms,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    });
  } catch (error: any) {
    console.error('[sync-ads] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =====================================================
// GOOGLE ADS API HELPERS
// =====================================================

async function executeGAQL(apiUrl: string, headers: Record<string, string>, query: string): Promise<any[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ads API ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const rows: any[] = [];
  for (const batch of data || []) {
    for (const result of batch.results || []) {
      rows.push(result);
    }
  }
  return rows;
}

async function fetchCampaignMetrics(apiUrl: string, headers: Record<string, string>, gaqlDate: string, clientId: string, date: string) {
  const query = `
    SELECT campaign.id, campaign.name, campaign.status,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
      metrics.conversions_value, metrics.ctr, metrics.average_cpc, metrics.cost_per_conversion,
      metrics.search_impression_share, metrics.search_budget_lost_impression_share,
      metrics.search_rank_lost_impression_share
    FROM campaign
    WHERE segments.date = '${gaqlDate}' AND campaign.status != 'REMOVED'
  `;

  const rows = await executeGAQL(apiUrl, headers, query);
  return rows.map((r: any) => {
    const m = r.metrics || {};
    const c = r.campaign || {};
    const costMicros = parseInt(m.costMicros || m.cost_micros || '0');
    return {
      client_id: clientId,
      date,
      campaign_id: c.id?.toString() || '',
      campaign_name: c.name || '',
      campaign_status: c.status || '',
      impressions: parseInt(m.impressions || '0'),
      clicks: parseInt(m.clicks || '0'),
      cost: Math.round(costMicros / 10000) / 100,
      conversions: parseFloat(m.conversions || '0'),
      conversion_value: parseFloat(m.conversionsValue || m.conversions_value || '0'),
      ctr: Math.round(parseFloat(m.ctr || '0') * 10000) / 100,
      cpc: Math.round(parseFloat(m.averageCpc || m.average_cpc || '0') / 10000) / 100,
      cpa: parseFloat(m.conversions || '0') > 0 ? Math.round(costMicros / parseFloat(m.conversions || '1') / 10000) / 100 : 0,
      search_impression_share: Math.round(parseFloat(m.searchImpressionShare || m.search_impression_share || '0') * 10000) / 100,
      search_lost_is_budget: Math.round(parseFloat(m.searchBudgetLostImpressionShare || m.search_budget_lost_impression_share || '0') * 10000) / 100,
      search_lost_is_rank: Math.round(parseFloat(m.searchRankLostImpressionShare || m.search_rank_lost_impression_share || '0') * 10000) / 100,
    };
  });
}

async function fetchAdGroupMetrics(apiUrl: string, headers: Record<string, string>, gaqlDate: string, clientId: string, date: string) {
  const query = `
    SELECT campaign.id, ad_group.id, ad_group.name,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
      metrics.ctr, metrics.average_cpc, metrics.cost_per_conversion
    FROM ad_group
    WHERE segments.date = '${gaqlDate}' AND campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'
  `;

  const rows = await executeGAQL(apiUrl, headers, query);
  return rows.map((r: any) => {
    const m = r.metrics || {};
    const costMicros = parseInt(m.costMicros || m.cost_micros || '0');
    return {
      client_id: clientId,
      date,
      campaign_id: r.campaign?.id?.toString() || '',
      ad_group_id: r.adGroup?.id?.toString() || r.ad_group?.id?.toString() || '',
      ad_group_name: r.adGroup?.name || r.ad_group?.name || '',
      impressions: parseInt(m.impressions || '0'),
      clicks: parseInt(m.clicks || '0'),
      cost: Math.round(costMicros / 10000) / 100,
      conversions: parseInt(m.conversions || '0'),
      ctr: Math.round(parseFloat(m.ctr || '0') * 10000) / 100,
      cpc: Math.round(parseFloat(m.averageCpc || m.average_cpc || '0') / 10000) / 100,
      cpa: parseFloat(m.conversions || '0') > 0 ? Math.round(costMicros / parseFloat(m.conversions || '1') / 10000) / 100 : 0,
    };
  });
}

async function fetchConversionActions(apiUrl: string, headers: Record<string, string>, gaqlDate: string, clientId: string, date: string) {
  const query = `
    SELECT campaign.id,
      segments.conversion_action_name,
      segments.conversion_action_category,
      metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date = '${gaqlDate}'
      AND campaign.status != 'REMOVED'
      AND metrics.conversions > 0
  `;

  const rows = await executeGAQL(apiUrl, headers, query);
  return rows.map((r: any) => {
    const m = r.metrics || {};
    const seg = r.segments || {};
    return {
      client_id: clientId,
      campaign_id: r.campaign?.id?.toString() || '',
      date,
      conversion_action_name: seg.conversionActionName || seg.conversion_action_name || 'Unknown',
      conversion_action_type: seg.conversionActionCategory || seg.conversion_action_category || '',
      conversions: parseFloat(m.conversions || '0'),
      conversion_value: parseFloat(m.conversionsValue || m.conversions_value || '0'),
      avg_conversion_lag_days: 0,
    };
  });
}

async function fetchSearchTerms(apiUrl: string, headers: Record<string, string>, gaqlDate: string, clientId: string, date: string) {
  const query = `
    SELECT campaign.id,
      search_term_view.search_term,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM search_term_view
    WHERE segments.date = '${gaqlDate}'
      AND campaign.status != 'REMOVED'
      AND (metrics.conversions > 0 OR metrics.clicks >= 3)
  `;

  const rows = await executeGAQL(apiUrl, headers, query);
  return rows.map((r: any) => {
    const m = r.metrics || {};
    const stv = r.searchTermView || r.search_term_view || {};
    const costMicros = parseInt(m.costMicros || m.cost_micros || '0');
    return {
      client_id: clientId,
      campaign_id: r.campaign?.id?.toString() || '',
      date,
      search_term: stv.searchTerm || stv.search_term || '',
      match_type: '',
      impressions: parseInt(m.impressions || '0'),
      clicks: parseInt(m.clicks || '0'),
      cost: Math.round(costMicros / 10000) / 100,
      conversions: parseFloat(m.conversions || '0'),
      is_irrelevant: false,
      wasted_spend: 0,
    };
  });
}
