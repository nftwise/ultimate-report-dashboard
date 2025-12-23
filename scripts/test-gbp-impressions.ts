import { config } from 'dotenv';
config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';

async function testGBPImpressions() {
  // Load token
  const masterTokenPath = path.join(process.cwd(), '.oauth-tokens', 'gbp-master.json');
  const tokenData = JSON.parse(fs.readFileSync(masterTokenPath, 'utf8'));
  const token = tokenData.access_token;

  const locationId = 'locations/15767825285937852276';

  const dates = [
    { date: '2025-12-13', label: '12-13' },
    { date: '2025-12-14', label: '12-14' },
    { date: '2025-12-15', label: '12-15' },
  ];

  const impressionMetrics = [
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  ];

  console.log('Testing GBP Impressions API directly...\n');

  for (const { date, label } of dates) {
    const d = new Date(date);
    let totalImpressions = 0;

    console.log(`=== ${label} (${date}) ===`);

    for (const metric of impressionMetrics) {
      const url = new URL(`https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`);
      url.searchParams.set('dailyMetric', metric);
      url.searchParams.set('dailyRange.start_date.year', d.getFullYear().toString());
      url.searchParams.set('dailyRange.start_date.month', (d.getMonth() + 1).toString());
      url.searchParams.set('dailyRange.start_date.day', d.getDate().toString());
      url.searchParams.set('dailyRange.end_date.year', d.getFullYear().toString());
      url.searchParams.set('dailyRange.end_date.month', (d.getMonth() + 1).toString());
      url.searchParams.set('dailyRange.end_date.day', d.getDate().toString());

      const resp = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resp.ok) {
        const data = await resp.json();
        const value = (data.timeSeries?.datedValues || [])
          .reduce((sum: number, v: any) => sum + (parseInt(v.value) || 0), 0);
        console.log(`  ${metric}: ${value}`);
        totalImpressions += value;
      } else {
        console.log(`  ${metric}: ERROR ${resp.status}`);
      }
    }

    console.log(`  --> TOTAL Profile Views: ${totalImpressions}\n`);
  }
}

testGBPImpressions().catch(console.error);
