#!/usr/bin/env npx tsx
/**
 * Backfill ads_campaign_metrics table
 *
 * Fetches campaign-level Google Ads data via OAuth (google-ads-api package)
 * and upserts into the ads_campaign_metrics table.
 *
 * Usage:
 *   npx tsx scripts/backfill-ads-campaigns.ts
 *   npx tsx scripts/backfill-ads-campaigns.ts --days=90
 *   npx tsx scripts/backfill-ads-campaigns.ts --days=365
 *
 * Default: 90 days, max 365.
 */

import { GoogleAdsApi, enums } from 'google-ads-api';
import { createClient } from '@supabase/supabase-js';

// --- Configuration ---

const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || '';
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || '';
const GOOGLE_ADS_REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN || '';
const GOOGLE_ADS_MCC_ID = process.env.GOOGLE_ADS_MCC_ID || '';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const DELAY_MS = 500;

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

// --- Helpers ---

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Main ---

async function main() {
  const days = parseDays();
  const startTime = Date.now();

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 1); // yesterday

  console.log(`[backfill-ads-campaigns] Starting backfill`);
  console.log(`  Days: ${days}`);
  console.log(`  Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);

  // Initialize Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Initialize Google Ads API
  const googleAdsApi = new GoogleAdsApi({
    client_id: GOOGLE_ADS_CLIENT_ID,
    client_secret: GOOGLE_ADS_CLIENT_SECRET,
    developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  // Fetch clients with gads_customer_id from service_configs
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, slug, service_configs!inner(gads_customer_id)')
    .not('service_configs.gads_customer_id', 'is', null)
    .neq('service_configs.gads_customer_id', '');

  if (clientsError) {
    console.error('Failed to fetch clients:', clientsError.message);
    process.exit(1);
  }

  if (!clients || clients.length === 0) {
    console.log('No clients with gads_customer_id found in service_configs.');
    process.exit(0);
  }

  console.log(`  Clients with Google Ads: ${clients.length}`);
  console.log('');

  let totalCampaigns = 0;
  let totalErrors = 0;

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const config = Array.isArray(client.service_configs) ? client.service_configs[0] : client.service_configs;
    const customerId = (config?.gads_customer_id || '').replace(/-/g, '');

    console.log(`[${i + 1}/${clients.length}] ${client.name} (${customerId})`);

    try {
      const customer = googleAdsApi.Customer({
        customer_id: customerId,
        login_customer_id: GOOGLE_ADS_MCC_ID,
        refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
      });

      // GAQL query for campaign metrics in the date range
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value,
          metrics.ctr,
          metrics.average_cpc,
          metrics.cost_per_conversion,
          metrics.search_impression_share,
          metrics.search_budget_lost_impression_share,
          metrics.search_rank_lost_impression_share
        FROM campaign
        WHERE segments.date BETWEEN '${formatDate(startDate)}' AND '${formatDate(endDate)}'
        ORDER BY segments.date DESC
      `;

      const rows = await customer.query(query);

      if (!rows || rows.length === 0) {
        console.log(`  No campaign data found.`);
        if (i < clients.length - 1) await sleep(DELAY_MS);
        continue;
      }

      // Transform rows into upsert records
      const records = rows.map((row: any) => {
        const campaign = row.campaign;
        const metrics = row.metrics;
        const date = row.segments.date;

        const costMicros = Number(metrics.cost_micros || 0);
        const cost = costMicros / 1_000_000;
        const clicks = Number(metrics.clicks || 0);
        const conversions = Number(metrics.conversions || 0);
        const impressions = Number(metrics.impressions || 0);

        // Map campaign status enum to string
        let statusStr = 'UNKNOWN';
        if (campaign.status === enums.CampaignStatus.ENABLED) statusStr = 'ENABLED';
        else if (campaign.status === enums.CampaignStatus.PAUSED) statusStr = 'PAUSED';
        else if (campaign.status === enums.CampaignStatus.REMOVED) statusStr = 'REMOVED';

        const ctr = Number(metrics.ctr || 0) * 100; // API returns as fraction
        const cpc = Number(metrics.average_cpc || 0) / 1_000_000; // micros
        const cpa = conversions > 0 ? cost / conversions : 0;
        const conversionValue = Number(metrics.conversions_value || 0);
        const roas = cost > 0 ? conversionValue / cost : 0;

        const searchImpressionShare = Number(metrics.search_impression_share || 0) * 100;
        const searchLostBudget = Number(metrics.search_budget_lost_impression_share || 0) * 100;
        const searchLostRank = Number(metrics.search_rank_lost_impression_share || 0) * 100;

        return {
          client_id: client.id,
          campaign_id: String(campaign.id),
          campaign_name: campaign.name || 'Unknown',
          campaign_status: statusStr,
          date: date,
          impressions: impressions,
          clicks: clicks,
          cost: Math.round(cost * 100) / 100,
          conversions: Math.round(conversions * 100) / 100,
          conversion_value: Math.round(conversionValue * 100) / 100,
          ctr: Math.round(ctr * 100) / 100,
          cpc: Math.round(cpc * 100) / 100,
          cpa: Math.round(cpa * 100) / 100,
          roas: Math.round(roas * 100) / 100,
          quality_score: null, // Not available at campaign level via GAQL
          impression_share: Math.round(searchImpressionShare * 100) / 100,
          search_impression_share: Math.round(searchImpressionShare * 100) / 100,
          search_lost_is_budget: Math.round(searchLostBudget * 100) / 100,
          search_lost_is_rank: Math.round(searchLostRank * 100) / 100,
        };
      });

      // Upsert in batches of 500
      const BATCH_SIZE = 500;
      let upsertedCount = 0;

      for (let b = 0; b < records.length; b += BATCH_SIZE) {
        const batch = records.slice(b, b + BATCH_SIZE);
        const { error: upsertError } = await supabase
          .from('ads_campaign_metrics')
          .upsert(batch, { onConflict: 'client_id,campaign_id,date' });

        if (upsertError) {
          console.error(`  Upsert error (batch ${Math.floor(b / BATCH_SIZE) + 1}): ${upsertError.message}`);
          totalErrors++;
        } else {
          upsertedCount += batch.length;
        }
      }

      console.log(`  Upserted ${upsertedCount} campaign-day records.`);
      totalCampaigns += upsertedCount;

    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
      totalErrors++;
    }

    if (i < clients.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log('');
  console.log('--- Summary ---');
  console.log(`  Total campaign-day records upserted: ${totalCampaigns}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log(`  Duration: ${duration}s`);
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
