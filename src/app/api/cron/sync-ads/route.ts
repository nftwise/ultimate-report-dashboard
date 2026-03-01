import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { JWT } from 'google-auth-library';

export const maxDuration = 300;

const BATCH_SIZE = 3;
const TIMEOUT_MS = 25000;

/**
 * GET /api/cron/sync-ads
 * Daily cron: Sync yesterday's Google Ads data to raw tables
 * Tables: ads_campaign_metrics, ads_ad_group_metrics, ads_keyword_metrics, google_ads_ad_performance
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
      const d = new Date(); d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();
    const gaqlDate = targetDate.replace(/-/g, '');

    console.log(`[sync-ads] Starting for ${targetDate}`);

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

    const clientsWithAds = (clients || [])
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        customerId: (Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs)?.gads_customer_id?.replace(/-|\s/g, ''),
      }))
      .filter((c: any) => c.customerId);

    console.log(`[sync-ads] Processing ${clientsWithAds.length} clients`);

    let totalCampaigns = 0, totalAdGroups = 0, totalKeywords = 0, totalAds = 0;
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

          // Fetch all 4 report types in parallel
          const [campaigns, adGroups, keywords, ads] = await Promise.all([
            fetchCampaignMetrics(apiUrl, headers, gaqlDate, client.id, targetDate).catch((e) => { console.log(`[sync-ads] Campaign error ${client.name}:`, e.message); return []; }),
            fetchAdGroupMetrics(apiUrl, headers, gaqlDate, client.id, targetDate).catch((e) => { console.log(`[sync-ads] AdGroup error ${client.name}:`, e.message); return []; }),
            fetchKeywordMetrics(apiUrl, headers, gaqlDate, client.id, targetDate).catch((e) => { console.log(`[sync-ads] Keyword error ${client.name}:`, e.message); return []; }),
            fetchAdPerformance(apiUrl, headers, gaqlDate, client.id, targetDate).catch((e) => { console.log(`[sync-ads] Ad error ${client.name}:`, e.message); return []; }),
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
          if (keywords.length > 0) {
            const { error } = await supabaseAdmin.from('ads_keyword_metrics').upsert(keywords, { onConflict: 'client_id,campaign_id,keyword,date' });
            if (error) console.log(`[sync-ads] Keyword upsert error ${client.name}:`, error.message);
          }
          if (ads.length > 0) {
            const { error } = await supabaseAdmin.from('google_ads_ad_performance').upsert(ads, { onConflict: 'client_id,ad_id,date' });
            if (error) console.log(`[sync-ads] Ad upsert error ${client.name}:`, error.message);
          }

          return { campaigns: campaigns.length, adGroups: adGroups.length, keywords: keywords.length, ads: ads.length };
        } catch (err: any) {
          errors.push(`${client.name}: ${err.message}`);
          return { campaigns: 0, adGroups: 0, keywords: 0, ads: 0 };
        }
      }));

      results.forEach((r) => {
        totalCampaigns += r.campaigns;
        totalAdGroups += r.adGroups;
        totalKeywords += r.keywords;
        totalAds += r.ads;
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-ads] Done in ${duration}ms: ${totalCampaigns} campaigns, ${totalAdGroups} ad groups, ${totalKeywords} keywords, ${totalAds} ads`);

    return NextResponse.json({
      success: true,
      date: targetDate,
      clients: clientsWithAds.length,
      records: { campaigns: totalCampaigns, adGroups: totalAdGroups, keywords: totalKeywords, ads: totalAds },
      total: totalCampaigns + totalAdGroups + totalKeywords + totalAds,
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

async function fetchKeywordMetrics(apiUrl: string, headers: Record<string, string>, gaqlDate: string, clientId: string, date: string) {
  const query = `
    SELECT campaign.id, ad_group.id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
      metrics.ctr, metrics.average_cpc, metrics.cost_per_conversion,
      ad_group_criterion.quality_info.quality_score
    FROM keyword_view
    WHERE segments.date = '${gaqlDate}' AND campaign.status != 'REMOVED'
  `;

  const rows = await executeGAQL(apiUrl, headers, query);
  return rows.map((r: any) => {
    const m = r.metrics || {};
    const kw = r.adGroupCriterion?.keyword || r.ad_group_criterion?.keyword || {};
    const qi = r.adGroupCriterion?.qualityInfo || r.ad_group_criterion?.quality_info || {};
    const costMicros = parseInt(m.costMicros || m.cost_micros || '0');
    return {
      client_id: clientId,
      date,
      campaign_id: r.campaign?.id?.toString() || '',
      ad_group_id: r.adGroup?.id?.toString() || r.ad_group?.id?.toString() || '',
      keyword: kw.text || '',
      match_type: kw.matchType || kw.match_type || '',
      impressions: parseInt(m.impressions || '0'),
      clicks: parseInt(m.clicks || '0'),
      cost: Math.round(costMicros / 10000) / 100,
      conversions: parseFloat(m.conversions || '0'),
      ctr: Math.round(parseFloat(m.ctr || '0') * 10000) / 100,
      cpc: Math.round(parseFloat(m.averageCpc || m.average_cpc || '0') / 10000) / 100,
      cpa: parseFloat(m.conversions || '0') > 0 ? Math.round(costMicros / parseFloat(m.conversions || '1') / 10000) / 100 : 0,
      quality_score: parseInt(qi.qualityScore || qi.quality_score || '0') || null,
    };
  });
}

async function fetchAdPerformance(apiUrl: string, headers: Record<string, string>, gaqlDate: string, clientId: string, date: string) {
  const query = `
    SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
      ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.ad.final_urls,
      ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.status, ad_group_ad.ad_strength,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
      metrics.ctr, metrics.average_cpc, metrics.cost_per_conversion
    FROM ad_group_ad
    WHERE segments.date = '${gaqlDate}' AND campaign.status != 'REMOVED' AND ad_group_ad.status != 'REMOVED'
  `;

  const rows = await executeGAQL(apiUrl, headers, query);
  return rows.map((r: any) => {
    const m = r.metrics || {};
    const ad = r.adGroupAd?.ad || r.ad_group_ad?.ad || {};
    const rsa = ad.responsiveSearchAd || ad.responsive_search_ad || {};
    const costMicros = parseInt(m.costMicros || m.cost_micros || '0');
    const clicks = parseInt(m.clicks || '0');
    const conversions = parseFloat(m.conversions || '0');

    return {
      client_id: clientId,
      date,
      campaign_id: r.campaign?.id?.toString() || '',
      campaign_name: r.campaign?.name || '',
      ad_group_id: r.adGroup?.id?.toString() || r.ad_group?.id?.toString() || '',
      ad_group_name: r.adGroup?.name || r.ad_group?.name || '',
      ad_id: ad.id?.toString() || '',
      ad_type: ad.type || '',
      headlines: (rsa.headlines || []).map((h: any) => h.text).filter(Boolean),
      descriptions: (rsa.descriptions || []).map((d: any) => d.text).filter(Boolean),
      final_url: (ad.finalUrls || ad.final_urls || [])[0] || '',
      ad_status: r.adGroupAd?.status || r.ad_group_ad?.status || '',
      ad_strength: r.adGroupAd?.adStrength || r.ad_group_ad?.ad_strength || '',
      impressions: parseInt(m.impressions || '0'),
      clicks,
      ctr: Math.round(parseFloat(m.ctr || '0') * 10000) / 100,
      cost: Math.round(costMicros / 10000) / 100,
      average_cpc: clicks > 0 ? Math.round(costMicros / clicks / 10000) / 100 : 0,
      conversions,
      conversion_rate: clicks > 0 ? Math.round((conversions / clicks) * 10000) / 100 : 0,
      cost_per_conversion: conversions > 0 ? Math.round(costMicros / conversions / 10000) / 100 : 0,
    };
  });
}
