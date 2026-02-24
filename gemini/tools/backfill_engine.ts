import { createClient } from '@supabase/supabase-js';
import { GoogleAdsServiceAccountConnector } from '../../src/lib/google-ads-service-account';
import { GoogleAnalyticsConnector } from '../../src/lib/google-analytics';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MCC_ID = process.env.GOOGLE_ADS_MCC_ID || '8432700368';

/**
 * Helper: Fetch GBP Phone Calls using OAuth
 */
async function fetchGBPPhoneCalls(locationId: string, dateStr: string): Promise<number> {
  // 1. Get Token from Supabase system_settings
  const { data: setting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'gbp_agency_master')
    .single();

  let tokens = setting?.value;
  if (typeof tokens === 'string') {
    try {
      tokens = JSON.parse(tokens);
    } catch (e) {
      console.error(`[GBP] Failed to parse tokens from DB:`, e);
      tokens = null;
    }
  }

  // 2. Fallback to local .oauth-tokens if not in DB
  if (!tokens) {
    const tokenPath = path.join(process.cwd(), '.oauth-tokens', 'agency-gbp-master.json');
    if (fs.existsSync(tokenPath)) {
      tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    }
  }

  if (!tokens) {
    console.warn(`[GBP] No OAuth tokens found for location ${locationId}`);
    return 0;
  }

  // 3. Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date
  });

  const { token } = await oauth2Client.getAccessToken();
  if (!token) throw new Error('Failed to refresh GBP access token');

  // 4. Normalize locationId
  let normalizedId = locationId;
  if (!locationId.startsWith('locations/') && !locationId.startsWith('accounts/')) {
    normalizedId = `locations/${locationId}`;
  }

  // 5. Fetch Metric ACTIONS_PHONE
  const targetDate = new Date(dateStr);
  const dateRange = {
    startDate: { year: targetDate.getFullYear(), month: targetDate.getMonth() + 1, day: targetDate.getDate() },
    endDate: { year: targetDate.getFullYear(), month: targetDate.getMonth() + 1, day: targetDate.getDate() }
  };

  const finalUrl = `https://businessprofileperformance.googleapis.com/v1/${normalizedId}:getDailyMetricsTimeSeries`;
  console.log(`[GBP] Fetching: ${finalUrl}`);

  const response = await fetch(finalUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dailyMetric: 'ACTIONS_PHONE', dailyRange: dateRange })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[GBP] API Error: ${response.status} - ${errText}`);
    return 0;
  }

  const data = await response.json();
  let calls = 0;
  if (data.timeSeries?.datedValues) {
    calls = data.timeSeries.datedValues.reduce((sum: number, item: any) => sum + (item.value || 0), 0);
  }

  return calls;
}

/**
 * Core Engine for backfilling metrics for a specific date
 */
export async function processDate(dateStr: string) {
  console.log(`[Engine] Processing: ${dateStr}`);

  // 1. Fetch Clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select(`
      id, name, slug,
      service_configs (ga_property_id, gads_customer_id, gsc_site_url, gbp_location_id)
    `)
    .eq('is_active', true);

  if (clientsError) throw clientsError;

  const results = [];
  const adsConnector = new GoogleAdsServiceAccountConnector();

  for (const client of clients) {
    try {
      const config = Array.isArray(client.service_configs) ? client.service_configs[0] : client.service_configs;
      if (!config) continue;

      const timeRange = { startDate: dateStr, endDate: dateStr, period: 'custom' as const };

      // Fetch GA4
      let formFills = 0;
      if (config.ga_property_id) {
        const gaConnector = new GoogleAnalyticsConnector(client.slug);
        const gaData = await gaConnector.getEventCounts(timeRange, config.ga_property_id);
        formFills = gaData?.formSubmissions || 0;
      }

      // Fetch Ads
      let adsConversions = 0;
      let spend = 0;
      if (config.gads_customer_id) {
        const adsData = await adsConnector.getCampaignReport(timeRange, config.gads_customer_id, MCC_ID);
        adsConversions = Math.round(adsData?.totalMetrics?.conversions || 0);
        spend = Math.round((adsData?.totalMetrics?.cost || 0) * 100) / 100;
      }

      // GBP (OAuth Auth)
      let gbpCalls = 0;
      if (config.gbp_location_id) {
        gbpCalls = await fetchGBPPhoneCalls(config.gbp_location_id, dateStr);
      }

      // Final Payload
      const totalLeads = adsConversions + formFills + gbpCalls;
      const cpl = totalLeads > 0 ? Math.round((spend / totalLeads) * 100) / 100 : 0;

      results.push({
        client_id: client.id,
        date: dateStr,
        period_type: 'daily',
        google_ads_conversions: adsConversions,
        ad_spend: spend,
        form_fills: formFills,
        gbp_calls: gbpCalls,
        total_leads: totalLeads,
        cpl: cpl,
        updated_at: new Date().toISOString()
      });

    } catch (err) {
      console.error(`[Engine] Error for ${client.name}:`, err);
    }
  }

  // Upsert to DB
  if (results.length > 0) {
    const { error: upsertError } = await supabase
      .from('client_metrics_summary')
      .upsert(results, { onConflict: 'client_id,date,period_type' });

    if (upsertError) throw upsertError;
    console.log(`[Engine] Successfully upserted ${results.length} records (including GBP) for ${dateStr}`);
  }

  return results.length;
}
