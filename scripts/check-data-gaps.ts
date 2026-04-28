#!/usr/bin/env npx tsx
/**
 * Data Gap Analyzer
 * Check if last 2 weeks of data is complete for all clients across all APIs
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface ClientMetric {
  client_id: string;
  date: string;
  period_type: string;
  sessions?: number;
  google_ads_conversions?: number;
  gbp_calls?: number;
  seo_clicks?: number;
  form_fills?: number;
  ad_spend?: number;
  total_leads?: number;
}

interface ClientInfo {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

async function main() {
  console.log(`${COLORS.bold}${COLORS.cyan}📊 DATA GAP ANALYZER - Last 2 Weeks${COLORS.reset}\n`);

  // Get last 2 weeks dates
  const today = new Date();
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const startDate = twoWeeksAgo.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  console.log(`📅 Date Range: ${startDate} → ${endDate}\n`);

  // Get all active clients
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name, slug, is_active')
    .eq('is_active', true)
    .order('name');

  if (clientError || !clients) {
    console.error(`${COLORS.red}Error fetching clients:${COLORS.reset}`, clientError);
    return;
  }

  console.log(`${COLORS.bold}Found ${clients.length} active clients${COLORS.reset}\n`);

  const results: any[] = [];

  for (const client of clients) {
    // Get client metrics for 2 weeks
    const { data: metrics, error: metricsError } = await supabase
      .from('client_metrics_summary')
      .select('date, sessions, google_ads_conversions, gbp_calls, seo_clicks, form_fills, ad_spend, total_leads')
      .eq('client_id', client.id)
      .eq('period_type', 'daily')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (metricsError) {
      console.error(`${COLORS.red}Error for ${client.name}:${COLORS.reset}`, metricsError);
      continue;
    }

    // Calculate expected dates (14 days)
    const expectedDates = new Set<string>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(twoWeeksAgo.getTime() + i * 24 * 60 * 60 * 1000);
      expectedDates.add(d.toISOString().split('T')[0]);
    }

    const actualDates = new Set((metrics || []).map((m: any) => m.date));
    const missingDates = Array.from(expectedDates).filter(d => !actualDates.has(d));

    // Analyze data completeness
    const metricsArray = metrics || [];
    const completeness = {
      sessions: metricsArray.filter((m: any) => m.sessions && m.sessions > 0).length,
      ads: metricsArray.filter((m: any) => m.google_ads_conversions && m.google_ads_conversions > 0).length,
      gbp: metricsArray.filter((m: any) => m.gbp_calls && m.gbp_calls > 0).length,
      seo: metricsArray.filter((m: any) => m.seo_clicks && m.seo_clicks > 0).length,
      facebook: metricsArray.filter((m: any) => m.form_fills && m.form_fills > 0).length,
    };

    results.push({
      client,
      totalDays: metricsArray.length,
      missingDates,
      completeness,
      metrics: metricsArray,
    });
  }

  // Display results
  console.log(`${COLORS.bold}┌─────────────────────────────────────────────────────────────────────┐${COLORS.reset}`);
  console.log(`${COLORS.bold}│ CLIENT DATA COMPLETENESS (14 days expected)${COLORS.reset}`);
  console.log(`${COLORS.bold}└─────────────────────────────────────────────────────────────────────┘${COLORS.reset}\n`);

  let totalClientsComplete = 0;
  let totalClientsGaps = 0;

  for (const result of results) {
    const { client, totalDays, missingDates, completeness } = result;
    const isComplete = missingDates.length === 0 && totalDays === 14;

    if (isComplete) {
      totalClientsComplete++;
      console.log(`${COLORS.green}✅${COLORS.reset} ${client.name.padEnd(35)} | Days: 14/14 | Gap: 0`);
    } else {
      totalClientsGaps++;
      console.log(`${COLORS.red}❌${COLORS.reset} ${client.name.padEnd(35)} | Days: ${totalDays}/14 | Gap: ${missingDates.length}`);

      if (missingDates.length > 0) {
        console.log(`   ${COLORS.yellow}Missing: ${missingDates.join(', ')}${COLORS.reset}`);
      }
    }

    // Show API data breakdown
    const total = 14;
    const sessions = ((completeness.sessions / total) * 100).toFixed(0);
    const ads = ((completeness.ads / total) * 100).toFixed(0);
    const gbp = ((completeness.gbp / total) * 100).toFixed(0);
    const seo = ((completeness.seo / total) * 100).toFixed(0);
    const fb = ((completeness.facebook / total) * 100).toFixed(0);

    console.log(`   Analytics: GA4=${sessions}% | Ads=${ads}% | GBP=${gbp}% | SEO=${seo}% | FB=${fb}%`);
    console.log('');
  }

  // Summary
  console.log(`${COLORS.bold}┌─────────────────────────────────────────────────────────────────────┐${COLORS.reset}`);
  console.log(`${COLORS.bold}│ SUMMARY${COLORS.reset}`);
  console.log(`${COLORS.bold}└─────────────────────────────────────────────────────────────────────┘${COLORS.reset}\n`);

  console.log(`${COLORS.green}✅ Clients with complete data: ${totalClientsComplete}/${clients.length}${COLORS.reset}`);
  console.log(`${COLORS.red}❌ Clients with data gaps:     ${totalClientsGaps}/${clients.length}${COLORS.reset}\n`);

  // Show clients with gaps in detail
  if (totalClientsGaps > 0) {
    console.log(`${COLORS.bold}${COLORS.yellow}⚠️  CLIENTS WITH DATA GAPS:${COLORS.reset}\n`);

    for (const result of results) {
      if (result.missingDates.length > 0) {
        console.log(`${COLORS.yellow}${result.client.name}${COLORS.reset}`);
        console.log(`  Missing dates: ${result.missingDates.join(', ')}`);
        console.log(`  API breakdown:`);

        const metrics = result.metrics;
        const total = 14;
        const apiStatus = {
          'GA4 Sessions': metrics.filter((m: any) => m.sessions > 0).length,
          'Google Ads': metrics.filter((m: any) => m.google_ads_conversions > 0).length,
          'GBP Calls': metrics.filter((m: any) => m.gbp_calls > 0).length,
          'Search Console': metrics.filter((m: any) => m.seo_clicks > 0).length,
          'Facebook': metrics.filter((m: any) => m.form_fills > 0).length,
        };

        for (const [api, count] of Object.entries(apiStatus)) {
          const pct = ((count / total) * 100).toFixed(0);
          const status = count === 14 ? '✓' : count === 0 ? '✗' : '~';
          console.log(`    ${status} ${api.padEnd(20)}: ${count}/14 days (${pct}%)`);
        }
        console.log('');
      }
    }
  }

  // Cronjob status check
  console.log(`${COLORS.bold}┌─────────────────────────────────────────────────────────────────────┐${COLORS.reset}`);
  console.log(`${COLORS.bold}│ CRONJOB FILL STATUS${COLORS.reset}`);
  console.log(`${COLORS.bold}└─────────────────────────────────────────────────────────────────────┘${COLORS.reset}\n`);

  const completionRate = ((totalClientsComplete / clients.length) * 100).toFixed(1);

  if (totalClientsComplete === clients.length) {
    console.log(`${COLORS.green}✅ ALL CLIENTS HAVE COMPLETE DATA (${completionRate}%)${COLORS.reset}`);
    console.log(`\nCronjobs are working correctly! All syncs are filling data properly.`);
  } else if (completionRate > 80) {
    console.log(`${COLORS.yellow}⚠️  MOST CLIENTS COMPLETE (${completionRate}%)${COLORS.reset}`);
    console.log(`\nSome clients have minor gaps. Check logs for failed sync jobs.`);
  } else {
    console.log(`${COLORS.red}❌ MANY CLIENTS WITH GAPS (${completionRate}%)${COLORS.reset}`);
    console.log(`\n⚠️  CRONJOB ISSUES DETECTED!`);
    console.log(`- Check GitHub Actions workflow logs for sync-group-a/b/c`);
    console.log(`- Verify Supabase API keys are correct`);
    console.log(`- Check Telegram alerts for failure messages`);
  }
}

main().catch(console.error);
