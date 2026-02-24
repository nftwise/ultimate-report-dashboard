#!/usr/bin/env npx tsx
/**
 * Full Google Ads Backfill Script
 *
 * Fetches Google Ads data for all clients over a date range and writes to ALL 4 tables:
 *   1. ads_campaign_metrics
 *   2. ads_ad_group_metrics
 *   3. campaign_conversion_actions
 *   4. campaign_search_terms
 *
 * Uses service account auth (same as cron route), NOT OAuth.
 *
 * Usage:
 *   npx tsx scripts/ads-backfill-full.ts
 *   npx tsx scripts/ads-backfill-full.ts --days=90
 *   npx tsx scripts/ads-backfill-full.ts --days=30
 *   npx tsx scripts/ads-backfill-full.ts --client=slugname
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load env from .env.local
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

import { JWT } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';

// --- Configuration ---
const BATCH_SIZE = 2; // Process 2 clients at a time
const DELAY_BETWEEN_BATCHES_MS = 3000;
const TIMEOUT_MS = 60000; // 60s timeout per API call
const UPSERT_BATCH_SIZE = 500;
// Process dates in chunks to avoid API limits
const DAYS_PER_CHUNK = 30;

// --- Parse CLI args ---
function parseDays(): number {
  const daysArg = process.argv.find(a => a.startsWith('--days='));
  const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 90;
  if (isNaN(days) || days < 1 || days > 365) {
    console.error('Error: --days must be between 1 and 365');
    process.exit(1);
  }
  return days;
}

function parseClientFilter(): string | null {
  const clientArg = process.argv.find(a => a.startsWith('--client='));
  return clientArg ? clientArg.split('=')[1] : null;
}

// --- Helpers ---
function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatGaqlDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Google Ads API ---
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
    throw new Error(`Ads API ${response.status}: ${errorText.slice(0, 300)}`);
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

// --- Data Fetchers (same GAQL as cron, but with date range) ---

async function fetchCampaignMetrics(
  apiUrl: string, headers: Record<string, string>,
  startDate: string, endDate: string, clientId: string
): Promise<any[]> {
  const query = `
    SELECT campaign.id, campaign.name, campaign.status,
      segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
      metrics.conversions_value, metrics.ctr, metrics.average_cpc, metrics.cost_per_conversion,
      metrics.search_impression_share, metrics.search_budget_lost_impression_share,
      metrics.search_rank_lost_impression_share
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
  `;

  const rows = await executeGAQL(apiUrl, headers, query);
  return rows.map((r: any) => {
    const m = r.metrics || {};
    const c = r.campaign || {};
    const seg = r.segments || {};
    const costMicros = parseInt(m.costMicros || m.cost_micros || '0');
    const conversions = parseFloat(m.conversions || '0');
    const cost = Math.round(costMicros / 10000) / 100;
    const conversionValue = parseFloat(m.conversionsValue || m.conversions_value || '0');
    return {
      client_id: clientId,
      date: seg.date || '',
      campaign_id: c.id?.toString() || '',
      campaign_name: c.name || '',
      campaign_status: c.status || '',
      impressions: parseInt(m.impressions || '0'),
      clicks: parseInt(m.clicks || '0'),
      cost,
      conversions,
      conversion_value: Math.round(conversionValue * 100) / 100,
      ctr: Math.round(parseFloat(m.ctr || '0') * 10000) / 100,
      cpc: Math.round(parseFloat(m.averageCpc || m.average_cpc || '0') / 10000) / 100,
      cpa: conversions > 0 ? Math.round(costMicros / conversions / 10000) / 100 : 0,
      search_impression_share: Math.round(parseFloat(m.searchImpressionShare || m.search_impression_share || '0') * 10000) / 100,
      search_lost_is_budget: Math.round(parseFloat(m.searchBudgetLostImpressionShare || m.search_budget_lost_impression_share || '0') * 10000) / 100,
      search_lost_is_rank: Math.round(parseFloat(m.searchRankLostImpressionShare || m.search_rank_lost_impression_share || '0') * 10000) / 100,
    };
  });
}

async function fetchAdGroupMetrics(
  apiUrl: string, headers: Record<string, string>,
  startDate: string, endDate: string, clientId: string
): Promise<any[]> {
  const query = `
    SELECT campaign.id, ad_group.id, ad_group.name,
      segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
      metrics.ctr, metrics.average_cpc, metrics.cost_per_conversion
    FROM ad_group
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'
  `;

  const rows = await executeGAQL(apiUrl, headers, query);
  return rows.map((r: any) => {
    const m = r.metrics || {};
    const seg = r.segments || {};
    const costMicros = parseInt(m.costMicros || m.cost_micros || '0');
    return {
      client_id: clientId,
      date: seg.date || '',
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

async function fetchConversionActions(
  apiUrl: string, headers: Record<string, string>,
  startDate: string, endDate: string, clientId: string
): Promise<any[]> {
  const query = `
    SELECT campaign.id,
      segments.date,
      segments.conversion_action_name,
      segments.conversion_action_category,
      metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
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
      date: seg.date || '',
      conversion_action_name: seg.conversionActionName || seg.conversion_action_name || 'Unknown',
      conversion_action_type: seg.conversionActionCategory || seg.conversion_action_category || '',
      conversions: parseFloat(m.conversions || '0'),
      conversion_value: parseFloat(m.conversionsValue || m.conversions_value || '0'),
      avg_conversion_lag_days: 0,
    };
  });
}

async function fetchSearchTerms(
  apiUrl: string, headers: Record<string, string>,
  startDate: string, endDate: string, clientId: string
): Promise<any[]> {
  const query = `
    SELECT campaign.id,
      segments.date,
      search_term_view.search_term,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM search_term_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
      AND (metrics.conversions > 0 OR metrics.clicks >= 3)
  `;

  const rows = await executeGAQL(apiUrl, headers, query);
  return rows.map((r: any) => {
    const m = r.metrics || {};
    const seg = r.segments || {};
    const stv = r.searchTermView || r.search_term_view || {};
    const costMicros = parseInt(m.costMicros || m.cost_micros || '0');
    return {
      client_id: clientId,
      campaign_id: r.campaign?.id?.toString() || '',
      date: seg.date || '',
      search_term: stv.searchTerm || stv.search_term || '',
      match_type: '', // not available in search_term_view resource directly
      impressions: parseInt(m.impressions || '0'),
      clicks: parseInt(m.clicks || '0'),
      cost: Math.round(costMicros / 10000) / 100,
      conversions: parseFloat(m.conversions || '0'),
      is_irrelevant: false,
      wasted_spend: 0,
    };
  });
}

// --- Supabase Upsert Helper ---
async function batchUpsert(
  supabase: any,
  tableName: string,
  records: any[],
  onConflict: string,
  label: string
): Promise<number> {
  if (records.length === 0) return 0;

  let upserted = 0;
  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict });

    if (error) {
      console.error(`  [${label}] Upsert error (batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}): ${error.message}`);
    } else {
      upserted += batch.length;
    }
  }
  return upserted;
}

// --- Generate date chunks ---
function getDateChunks(startDate: Date, endDate: Date, chunkDays: number): Array<{ start: string; end: string }> {
  const chunks: Array<{ start: string; end: string }> = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    const chunkEnd = new Date(current);
    chunkEnd.setDate(chunkEnd.getDate() + chunkDays - 1);
    if (chunkEnd > endDate) chunkEnd.setTime(endDate.getTime());

    chunks.push({
      start: formatDate(current),
      end: formatDate(chunkEnd),
    });

    current = new Date(chunkEnd);
    current.setDate(current.getDate() + 1);
  }

  return chunks;
}

// --- Main ---
async function main() {
  const days = parseDays();
  const clientFilter = parseClientFilter();
  const startTime = Date.now();

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 1); // yesterday

  console.log(`=== Google Ads Full Backfill ===`);
  console.log(`Date range: ${formatDate(startDate)} to ${formatDate(endDate)} (${days} days)`);
  if (clientFilter) console.log(`Client filter: ${clientFilter}`);
  console.log('');

  // Validate env
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const mccId = process.env.GOOGLE_ADS_MCC_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!developerToken || !privateKey || !clientEmail) {
    console.error('Missing Google Ads credentials (GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL)');
    process.exit(1);
  }
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }

  // Initialize auth
  const jwtClient = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/adwords'],
  });
  const tokens = await jwtClient.authorize();
  const accessToken = tokens.access_token!;
  console.log('Google Ads auth: OK');

  const cleanMccId = mccId?.replace(/-|\s/g, '');

  // Initialize Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch clients with google_ads_customer_id
  let query = supabase
    .from('clients')
    .select('id, name, slug, google_ads_customer_id')
    .not('google_ads_customer_id', 'is', null)
    .neq('google_ads_customer_id', '');

  if (clientFilter) {
    query = query.eq('slug', clientFilter);
  }

  const { data: clients, error: clientsError } = await query;

  if (clientsError) {
    console.error('Failed to fetch clients:', clientsError.message);
    process.exit(1);
  }

  if (!clients || clients.length === 0) {
    console.log('No clients with google_ads_customer_id found.');
    process.exit(0);
  }

  console.log(`Clients to process: ${clients.length}`);
  clients.forEach((c: any) => console.log(`  - ${c.name} (${c.google_ads_customer_id})`));
  console.log('');

  // Generate date chunks
  const dateChunks = getDateChunks(startDate, endDate, DAYS_PER_CHUNK);
  console.log(`Processing in ${dateChunks.length} date chunks of up to ${DAYS_PER_CHUNK} days each`);
  console.log('');

  // Totals
  let totalCampaigns = 0;
  let totalAdGroups = 0;
  let totalConversions = 0;
  let totalSearchTerms = 0;
  const errors: string[] = [];

  // Process clients in batches of BATCH_SIZE
  for (let i = 0; i < clients.length; i += BATCH_SIZE) {
    const batch = clients.slice(i, i + BATCH_SIZE);
    console.log(`--- Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(clients.length / BATCH_SIZE)} ---`);

    const batchResults = await Promise.all(batch.map(async (client: any) => {
      const customerId = client.google_ads_customer_id.replace(/-/g, '');
      console.log(`[${client.name}] Customer ID: ${customerId}`);

      const clientTotals = { campaigns: 0, adGroups: 0, conversions: 0, searchTerms: 0 };

      const apiHeaders: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      };
      if (cleanMccId) apiHeaders['login-customer-id'] = cleanMccId;

      const apiUrl = `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:searchStream`;

      // Process each date chunk
      for (const chunk of dateChunks) {
        const gaqlStart = formatGaqlDate(chunk.start);
        const gaqlEnd = formatGaqlDate(chunk.end);

        try {
          // Fetch all 4 report types in parallel
          const [campaigns, adGroups, conversions, searchTerms] = await Promise.all([
            fetchCampaignMetrics(apiUrl, apiHeaders, gaqlStart, gaqlEnd, client.id)
              .catch(e => { console.log(`  [${client.name}] Campaign error (${chunk.start}): ${e.message.slice(0, 100)}`); return []; }),
            fetchAdGroupMetrics(apiUrl, apiHeaders, gaqlStart, gaqlEnd, client.id)
              .catch(e => { console.log(`  [${client.name}] AdGroup error (${chunk.start}): ${e.message.slice(0, 100)}`); return []; }),
            fetchConversionActions(apiUrl, apiHeaders, gaqlStart, gaqlEnd, client.id)
              .catch(e => { console.log(`  [${client.name}] Conversion error (${chunk.start}): ${e.message.slice(0, 100)}`); return []; }),
            fetchSearchTerms(apiUrl, apiHeaders, gaqlStart, gaqlEnd, client.id)
              .catch(e => { console.log(`  [${client.name}] SearchTerm error (${chunk.start}): ${e.message.slice(0, 100)}`); return []; }),
          ]);

          // Upsert each table
          const c1 = await batchUpsert(supabase, 'ads_campaign_metrics', campaigns, 'client_id,campaign_id,date', `${client.name}/campaigns`);
          const c2 = await batchUpsert(supabase, 'ads_ad_group_metrics', adGroups, 'client_id,campaign_id,ad_group_id,date', `${client.name}/adgroups`);
          const c3 = await batchUpsert(supabase, 'campaign_conversion_actions', conversions, 'client_id,campaign_id,date,conversion_action_name', `${client.name}/conversions`);
          const c4 = await batchUpsert(supabase, 'campaign_search_terms', searchTerms, 'client_id,campaign_id,date,search_term', `${client.name}/searchterms`);

          clientTotals.campaigns += c1;
          clientTotals.adGroups += c2;
          clientTotals.conversions += c3;
          clientTotals.searchTerms += c4;

          console.log(`  [${client.name}] ${chunk.start} to ${chunk.end}: ${c1} campaigns, ${c2} ad groups, ${c3} conversions, ${c4} search terms`);
        } catch (err: any) {
          const msg = `${client.name} (${chunk.start}-${chunk.end}): ${err.message}`;
          errors.push(msg);
          console.error(`  [${client.name}] ERROR: ${err.message.slice(0, 150)}`);
        }

        // Small delay between chunks to avoid rate limits
        await sleep(500);
      }

      console.log(`  [${client.name}] TOTAL: ${clientTotals.campaigns} campaigns, ${clientTotals.adGroups} ad groups, ${clientTotals.conversions} conversions, ${clientTotals.searchTerms} search terms`);
      return clientTotals;
    }));

    batchResults.forEach(r => {
      totalCampaigns += r.campaigns;
      totalAdGroups += r.adGroups;
      totalConversions += r.conversions;
      totalSearchTerms += r.searchTerms;
    });

    // Delay between client batches
    if (i + BATCH_SIZE < clients.length) {
      console.log(`  Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  console.log('');
  console.log('========== SUMMARY ==========');
  console.log(`  Clients processed: ${clients.length}`);
  console.log(`  Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);
  console.log(`  ads_campaign_metrics: ${totalCampaigns} records`);
  console.log(`  ads_ad_group_metrics: ${totalAdGroups} records`);
  console.log(`  campaign_conversion_actions: ${totalConversions} records`);
  console.log(`  campaign_search_terms: ${totalSearchTerms} records`);
  console.log(`  TOTAL records: ${totalCampaigns + totalAdGroups + totalConversions + totalSearchTerms}`);
  if (errors.length > 0) {
    console.log(`  Errors (${errors.length}):`);
    errors.forEach(e => console.log(`    - ${e}`));
  }
  console.log(`  Duration: ${duration}s`);
  console.log('=============================');
}

main()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
