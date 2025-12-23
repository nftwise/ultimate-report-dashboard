/**
 * Nightly Metrics Rollup Script
 *
 * This script fetches metrics from all data sources (Google Ads, GA4, Search Console)
 * and stores pre-computed daily summaries in the client_metrics_summary table.
 *
 * Run manually: npx tsx scripts/nightly-metrics-rollup.ts
 * Schedule with cron: 0 2 * * * cd /path/to/project && npx tsx scripts/nightly-metrics-rollup.ts
 *
 * Or call via API: POST /api/admin/run-rollup (for Vercel cron jobs)
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsServiceAccountConnector } from '../src/lib/google-ads-service-account';
import { GoogleAnalyticsConnector } from '../src/lib/google-analytics';
import { JWT } from 'google-auth-library';

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 5;
const TIMEOUT_MS = 10000;

interface ClientConfig {
  id: string;
  name: string;
  slug: string;
  gaPropertyId?: string;
  adsCustomerId?: string;
  gscSiteUrl?: string;
  gbpLocationId?: string;
}

interface DailyMetrics {
  clientId: string;
  date: string;
  googleAdsConversions: number;
  adSpend: number;
  formFills: number;
  gbpCalls: number;
  googleRank?: number;
  topKeywords: number;
  totalLeads: number;
  cpl: number;
}

async function main() {
  const startTime = Date.now();
  console.log('🌙 [Nightly Rollup] Starting metrics rollup...');
  console.log(`📅 Date: ${new Date().toISOString()}`);

  try {
    // Get yesterday's date (we're rolling up yesterday's data)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    console.log(`📊 Rolling up metrics for: ${dateStr}`);

    // Step 1: Fetch all active clients with service configs
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        id,
        name,
        slug,
        service_configs (
          ga_property_id,
          gads_customer_id,
          gsc_site_url,
          gbp_location_id
        )
      `)
      .eq('is_active', true);

    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`);
    }

    console.log(`👥 Found ${clients?.length || 0} active clients`);

    // Process clients
    const clientConfigs: ClientConfig[] = (clients || []).map((client: any) => {
      const config = Array.isArray(client.service_configs)
        ? client.service_configs[0]
        : client.service_configs || {};

      return {
        id: client.id,
        name: client.name,
        slug: client.slug,
        gaPropertyId: config.ga_property_id,
        adsCustomerId: config.gads_customer_id,
        gscSiteUrl: config.gsc_site_url,
        gbpLocationId: config.gbp_location_id,
      };
    });

    // Step 2: Fetch metrics from all sources
    const timeRange = { startDate: dateStr, endDate: dateStr, period: 'custom' as const };
    const mccId = process.env.GOOGLE_ADS_MCC_ID || '8432700368';

    // Google Ads
    const adsConnector = new GoogleAdsServiceAccountConnector();
    const adsResults = new Map<string, any>();
    const clientsWithAds = clientConfigs.filter(c => c.adsCustomerId);

    console.log(`💰 Fetching Google Ads for ${clientsWithAds.length} clients...`);
    for (let i = 0; i < clientsWithAds.length; i += BATCH_SIZE) {
      const batch = clientsWithAds.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (client) => {
        try {
          const result = await Promise.race([
            adsConnector.getCampaignReport(timeRange, client.adsCustomerId!, mccId),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
          ]);
          return { clientId: client.id, data: result };
        } catch (error) {
          console.log(`  ⚠️ Ads error for ${client.name}: ${(error as Error).message}`);
          return { clientId: client.id, data: null };
        }
      });
      const results = await Promise.all(promises);
      results.forEach(r => adsResults.set(r.clientId, r.data));
    }

    // Google Analytics
    const gaResults = new Map<string, any>();
    const clientsWithGA = clientConfigs.filter(c => c.gaPropertyId);

    console.log(`📈 Fetching GA4 for ${clientsWithGA.length} clients...`);
    for (let i = 0; i < clientsWithGA.length; i += BATCH_SIZE) {
      const batch = clientsWithGA.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (client) => {
        try {
          const gaConnector = new GoogleAnalyticsConnector(client.slug);
          const events = await Promise.race([
            gaConnector.getEventCounts(timeRange, client.gaPropertyId!),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
          ]);
          return { clientId: client.id, events };
        } catch (error) {
          console.log(`  ⚠️ GA error for ${client.name}: ${(error as Error).message}`);
          return { clientId: client.id, events: null };
        }
      });
      const results = await Promise.all(promises);
      results.forEach(r => gaResults.set(r.clientId, r.events));
    }

    // Search Console
    const gscResults = new Map<string, any>();
    const clientsWithGSC = clientConfigs.filter(c => c.gscSiteUrl);

    console.log(`🔍 Fetching Search Console for ${clientsWithGSC.length} clients...`);
    try {
      const auth = getSearchConsoleAuth();

      for (let i = 0; i < clientsWithGSC.length; i += BATCH_SIZE) {
        const batch = clientsWithGSC.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (client) => {
          try {
            const queries = await Promise.race([
              fetchSearchConsoleQueries(auth, client.gscSiteUrl!, dateStr, dateStr),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
            ]);
            return { clientId: client.id, queries };
          } catch (error) {
            console.log(`  ⚠️ GSC error for ${client.name}: ${(error as Error).message}`);
            return { clientId: client.id, queries: null };
          }
        });
        const results = await Promise.all(promises);
        results.forEach(r => gscResults.set(r.clientId, r.queries));
      }
    } catch (error) {
      console.log(`⚠️ Search Console auth error: ${(error as Error).message}`);
    }

    // GBP Performance (Phone Calls)
    const gbpResults = new Map<string, number>();
    const clientsWithGBP = clientConfigs.filter(c => c.gbpLocationId);

    console.log(`📍 Fetching GBP for ${clientsWithGBP.length} clients...`);
    for (let i = 0; i < clientsWithGBP.length; i += BATCH_SIZE) {
      const batch = clientsWithGBP.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (client) => {
        try {
          const gbpCalls = await Promise.race([
            fetchGBPPhoneCalls(client.slug, client.id, client.gbpLocationId!, dateStr),
            new Promise<number>((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
          ]);
          return { clientId: client.id, calls: gbpCalls };
        } catch (error) {
          console.log(`  ⚠️ GBP error for ${client.name}: ${(error as Error).message}`);
          return { clientId: client.id, calls: 0 };
        }
      });
      const results = await Promise.all(promises);
      results.forEach(r => gbpResults.set(r.clientId, r.calls));
    }

    // Step 3: Aggregate and save to database
    console.log('💾 Saving metrics to database...');
    const metricsToSave: DailyMetrics[] = [];

    for (const client of clientConfigs) {
      const adsData = adsResults.get(client.id);
      const gaData = gaResults.get(client.id);
      const gscData = gscResults.get(client.id);
      const gbpCalls = gbpResults.get(client.id) || 0;

      // Calculate metrics
      const googleAdsConversions = Math.round(adsData?.totalMetrics?.conversions || 0);
      const adSpend = Math.round((adsData?.totalMetrics?.cost || 0) * 100) / 100;
      const formFills = gaData?.formSubmissions || 0;

      // Search Console metrics
      let googleRank: number | undefined;
      let topKeywords = 0;

      if (gscData && Array.isArray(gscData)) {
        topKeywords = gscData.filter((q: any) => q.position <= 10).length;

        const chiropractorQueries = gscData.filter((q: any) => {
          const query = q.query.toLowerCase();
          return query.includes('chiropractor') || query.includes('chiropractic');
        });

        if (chiropractorQueries.length > 0) {
          const totalPosition = chiropractorQueries.reduce((sum: number, q: any) => sum + q.position, 0);
          googleRank = Math.round((totalPosition / chiropractorQueries.length) * 10) / 10;
        }
      }

      // Total leads now includes GBP calls
      const totalLeads = googleAdsConversions + formFills + gbpCalls;
      const cpl = totalLeads > 0 ? Math.round((adSpend / totalLeads) * 100) / 100 : 0;

      metricsToSave.push({
        clientId: client.id,
        date: dateStr,
        googleAdsConversions,
        adSpend,
        formFills,
        gbpCalls,
        googleRank,
        topKeywords,
        totalLeads,
        cpl,
      });
    }

    // Upsert metrics (insert or update if exists)
    const { error: upsertError } = await supabase
      .from('client_metrics_summary')
      .upsert(
        metricsToSave.map(m => ({
          client_id: m.clientId,
          date: m.date,
          period_type: 'daily',
          google_ads_conversions: m.googleAdsConversions,
          ad_spend: m.adSpend,
          form_fills: m.formFills,
          gbp_calls: m.gbpCalls,
          google_rank: m.googleRank,
          top_keywords: m.topKeywords,
          total_leads: m.totalLeads,
          cpl: m.cpl,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'client_id,date,period_type' }
      );

    if (upsertError) {
      throw new Error(`Failed to save metrics: ${upsertError.message}`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [Nightly Rollup] Completed in ${duration}ms`);
    console.log(`   📊 Processed ${metricsToSave.length} clients for ${dateStr}`);

    return { success: true, processed: metricsToSave.length, duration };

  } catch (error) {
    console.error('❌ [Nightly Rollup] Error:', error);
    throw error;
  }
}

// Helper: Get Search Console auth
function getSearchConsoleAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error('Missing Google service account credentials');
  }

  return new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });
}

// Helper: Fetch Search Console queries
async function fetchSearchConsoleQueries(
  auth: JWT,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const tokenResponse = await auth.getAccessToken();
  const token = tokenResponse.token || '';

  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 100,
      dataState: 'final'
    })
  });

  if (!response.ok) {
    throw new Error(`Search Console API error: ${response.status}`);
  }

  const data = await response.json();

  return (data.rows || []).map((row: any) => ({
    query: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position
  }));
}

// Helper: Fetch GBP Phone Calls
async function fetchGBPPhoneCalls(
  clientSlug: string,
  clientId: string,
  locationId: string,
  date: string
): Promise<number> {
  const fs = await import('fs');
  const path = await import('path');
  const { google } = await import('googleapis');

  // Try to load OAuth token - check multiple patterns
  const tokensDir = path.join(process.cwd(), '.oauth-tokens');
  const possibleFiles = [
    'agency-gbp-master.json',
    `${clientId}-gbp.json`,
    `${clientSlug}-gbp.json`,
  ];

  let tokenFile = '';
  for (const file of possibleFiles) {
    const fullPath = path.join(tokensDir, file);
    if (fs.existsSync(fullPath)) {
      tokenFile = fullPath;
      break;
    }
  }

  if (!tokenFile) {
    throw new Error('No OAuth token found');
  }

  const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
  oauth2Client.setCredentials(tokens);

  const { token } = await oauth2Client.getAccessToken();
  if (!token) {
    throw new Error('Failed to get access token');
  }

  // Normalize locationId format
  let normalizedLocationId = locationId;
  if (!locationId.startsWith('locations/') && !locationId.includes('/locations/')) {
    normalizedLocationId = `locations/${locationId}`;
  }

  // Calculate date range for single day
  const targetDate = new Date(date);
  const dateRange = {
    startDate: {
      year: targetDate.getFullYear(),
      month: targetDate.getMonth() + 1,
      day: targetDate.getDate(),
    },
    endDate: {
      year: targetDate.getFullYear(),
      month: targetDate.getMonth() + 1,
      day: targetDate.getDate(),
    },
  };

  // Fetch ACTIONS_PHONE metric
  const response = await fetch(
    `https://businessprofileperformance.googleapis.com/v1/${normalizedLocationId}:getDailyMetricsTimeSeries`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dailyMetric: 'ACTIONS_PHONE',
        dailyRange: dateRange,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GBP API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Sum up phone calls
  let totalCalls = 0;
  if (data.timeSeries && data.timeSeries.datedValues) {
    totalCalls = data.timeSeries.datedValues.reduce((sum: number, item: any) => {
      return sum + (item.value || 0);
    }, 0);
  }

  return totalCalls;
}

// Run if called directly
main()
  .then(result => {
    console.log('Result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

export { main as runNightlyRollup };
