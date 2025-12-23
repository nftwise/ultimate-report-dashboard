import { config } from 'dotenv';
config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function compare() {
  // Load token
  const masterTokenPath = path.join(process.cwd(), '.oauth-tokens', 'gbp-master.json');
  const tokenData = JSON.parse(fs.readFileSync(masterTokenPath, 'utf8'));
  const token = tokenData.access_token;

  const locationId = 'locations/15767825285937852276';
  const clientId = 'a5973fa6-5530-4b8c-a0f1-83ee503caf13';

  const dates = ['2025-12-12', '2025-12-13', '2025-12-14', '2025-12-15', '2025-12-16'];

  console.log('GBP Data Comparison: Database vs API');
  console.log('=====================================\n');
  console.log('Date\t\t| Source | Clicks | Dirs | Views');
  console.log('-'.repeat(55));

  for (const dateStr of dates) {
    // Fetch API data
    const d = new Date(dateStr);
    let apiClicks = 0, apiDirs = 0, apiViews = 0;

    const metrics = [
      { name: 'WEBSITE_CLICKS', field: 'clicks' },
      { name: 'BUSINESS_DIRECTION_REQUESTS', field: 'dirs' },
      { name: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', field: 'views' },
      { name: 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', field: 'views' },
      { name: 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', field: 'views' },
      { name: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH', field: 'views' },
    ];

    for (const m of metrics) {
      const url = new URL(`https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`);
      url.searchParams.set('dailyMetric', m.name);
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

        if (m.name === 'WEBSITE_CLICKS') apiClicks = value;
        else if (m.name === 'BUSINESS_DIRECTION_REQUESTS') apiDirs = value;
        else apiViews += value;
      }
    }

    // Fetch DB data
    const { data: dbRow } = await supabase
      .from('client_metrics_summary')
      .select('gbp_website_clicks, gbp_directions, gbp_profile_views')
      .eq('client_id', clientId)
      .eq('date', dateStr)
      .single();

    const dbClicks = dbRow?.gbp_website_clicks || 0;
    const dbDirs = dbRow?.gbp_directions || 0;
    const dbViews = dbRow?.gbp_profile_views || 0;

    // Print comparison
    console.log(`${dateStr}\t| API    | ${apiClicks}\t | ${apiDirs}\t| ${apiViews}`);
    console.log(`${dateStr}\t| DB     | ${dbClicks}\t | ${dbDirs}\t| ${dbViews}`);

    const clicksMatch = apiClicks === dbClicks ? '✅' : '❌';
    const dirsMatch = apiDirs === dbDirs ? '✅' : '❌';
    const viewsMatch = apiViews === dbViews ? '✅' : '❌';
    console.log(`${dateStr}\t| Match  | ${clicksMatch}\t | ${dirsMatch}\t| ${viewsMatch}`);
    console.log('-'.repeat(55));
  }
}

compare().catch(console.error);
