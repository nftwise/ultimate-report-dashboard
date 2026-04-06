import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MONTHS = [
  '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09',
  '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'
];

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const start = `${ym}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${ym}-${String(lastDay).padStart(2, '0')}`;
  return { start, end, mid: `${ym}-15`, mid2: `${ym}-16` };
}

async function fetchSum(table, column, filters) {
  // Use 2-half pagination: first half (1-15) + second half (16-end)
  const { start, end, mid, mid2 } = monthRange(filters.month);
  let total = 0;

  // First half: 1-15
  let query1 = supabase.from(table).select(column);
  if (filters.client_id) query1 = query1.eq('client_id', filters.client_id);
  if (filters.location_id) query1 = query1.eq('location_id', filters.location_id);
  if (filters.source_medium_filter) query1 = query1.neq('source_medium', '(all) / (all)');
  query1 = query1.gte('date', start).lte('date', mid);
  const { data: d1, error: e1 } = await query1.limit(1000);
  if (e1) throw new Error(`${table} ${column} first half error: ${e1.message}`);

  // Second half: 16-end
  let query2 = supabase.from(table).select(column);
  if (filters.client_id) query2 = query2.eq('client_id', filters.client_id);
  if (filters.location_id) query2 = query2.eq('location_id', filters.location_id);
  if (filters.source_medium_filter) query2 = query2.neq('source_medium', '(all) / (all)');
  query2 = query2.gte('date', mid2).lte('date', end);
  const { data: d2, error: e2 } = await query2.limit(1000);
  if (e2) throw new Error(`${table} ${column} second half error: ${e2.message}`);

  const all = [...(d1 || []), ...(d2 || [])];
  for (const row of all) {
    const val = parseFloat(row[column] || 0);
    if (!isNaN(val)) total += val;
  }
  return { total, count: all.length };
}

async function main() {
  console.log('='.repeat(80));
  console.log('DATABASE INTEGRITY AUDIT - ' + new Date().toISOString());
  console.log('='.repeat(80));

  // ===== GET ACTIVE CLIENTS =====
  const { data: clients, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, slug, is_active')
    .eq('is_active', true)
    .order('name');

  if (clientErr) { console.error('Cannot fetch clients:', clientErr.message); process.exit(1); }
  console.log(`\nFound ${clients.length} active clients.`);

  // ===== GET GBP CLIENTS (have location) =====
  const { data: gbpLocations } = await supabase
    .from('gbp_locations')
    .select('client_id, location_id, name');

  const gbpClientMap = {};
  for (const loc of (gbpLocations || [])) {
    if (!gbpClientMap[loc.client_id]) gbpClientMap[loc.client_id] = [];
    gbpClientMap[loc.client_id].push(loc.location_id);
  }
  const gbpClientIds = Object.keys(gbpClientMap);

  // ===== GET SERVICE CONFIGS FOR GA4 =====
  const { data: serviceConfigs } = await supabase
    .from('service_configs')
    .select('client_id, ga_property_id, google_ads_customer_id, gsc_property_url');

  const ga4Clients = new Set((serviceConfigs || []).filter(s => s.ga_property_id).map(s => s.client_id));
  const adClients = new Set((serviceConfigs || []).filter(s => s.google_ads_customer_id).map(s => s.client_id));
  const gscClients = new Set((serviceConfigs || []).filter(s => s.gsc_property_url).map(s => s.client_id));

  console.log(`GBP clients: ${gbpClientIds.length}, GA4 clients: ${ga4Clients.size}, Ads clients: ${adClients.size}, GSC clients: ${gscClients.size}`);

  // =========================================================
  // CHECK 1: GBP Raw vs Summary
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 1: GBP — gbp_location_daily_metrics vs client_metrics_summary');
  console.log('='.repeat(80));

  const gbpFailures = [];
  const gbpActiveClients = clients.filter(c => gbpClientIds.includes(c.id));
  console.log(`Checking ${gbpActiveClients.length} GBP clients across ${MONTHS.length} months...`);

  for (const client of gbpActiveClients) {
    const locationIds = gbpClientMap[client.id];
    for (const month of MONTHS) {
      const { start, end, mid, mid2 } = monthRange(month);

      // Raw: sum from gbp_location_daily_metrics (all locations for this client)
      let rawTotal = 0;
      for (const locId of locationIds) {
        const r1 = await supabase.from('gbp_location_daily_metrics')
          .select('phone_calls').eq('location_id', locId).gte('date', start).lte('date', mid).limit(1000);
        const r2 = await supabase.from('gbp_location_daily_metrics')
          .select('phone_calls').eq('location_id', locId).gte('date', mid2).lte('date', end).limit(1000);
        for (const row of [...(r1.data || []), ...(r2.data || [])]) {
          rawTotal += parseFloat(row.phone_calls || 0);
        }
      }

      // Summary
      const s1 = await supabase.from('client_metrics_summary')
        .select('gbp_calls').eq('client_id', client.id).gte('date', start).lte('date', mid).limit(1000);
      const s2 = await supabase.from('client_metrics_summary')
        .select('gbp_calls').eq('client_id', client.id).gte('date', mid2).lte('date', end).limit(1000);
      let summaryTotal = 0;
      for (const row of [...(s1.data || []), ...(s2.data || [])]) {
        summaryTotal += parseFloat(row.gbp_calls || 0);
      }

      // Flag: |raw - summary| > 5% AND diff > 2
      const diff = Math.abs(rawTotal - summaryTotal);
      const pct = summaryTotal > 0 ? diff / summaryTotal : (rawTotal > 0 ? 1 : 0);
      if (diff > 2 && pct > 0.05) {
        gbpFailures.push({ client: client.name, month, raw: rawTotal, summary: summaryTotal, diff, pct: (pct * 100).toFixed(1) + '%' });
      }
    }
    process.stdout.write('.');
  }
  console.log('');

  if (gbpFailures.length === 0) {
    console.log('✅ CHECK 1 PASS: Tất cả GBP raw vs summary đều khớp (trong ngưỡng 5%)');
  } else {
    console.log(`❌ CHECK 1 FAIL: ${gbpFailures.length} trường hợp không khớp:`);
    for (const f of gbpFailures) {
      console.log(`  - ${f.client} / ${f.month}: raw=${f.raw}, summary=${f.summary}, diff=${f.diff} (${f.pct})`);
    }
  }

  // =========================================================
  // CHECK 2: GA4 Raw vs Summary
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 2: GA4 — ga4_sessions vs client_metrics_summary');
  console.log('='.repeat(80));

  const ga4Failures = [];
  const ga4ActiveClients = clients.filter(c => ga4Clients.has(c.id));
  console.log(`Checking ${ga4ActiveClients.length} GA4 clients...`);

  for (const client of ga4ActiveClients) {
    for (const month of MONTHS) {
      const { start, end, mid, mid2 } = monthRange(month);

      // Raw: sum from ga4_sessions WHERE source_medium != '(all) / (all)'
      const r1 = await supabase.from('ga4_sessions')
        .select('sessions').eq('client_id', client.id).neq('source_medium', '(all) / (all)')
        .gte('date', start).lte('date', mid).limit(1000);
      const r2 = await supabase.from('ga4_sessions')
        .select('sessions').eq('client_id', client.id).neq('source_medium', '(all) / (all)')
        .gte('date', mid2).lte('date', end).limit(1000);
      let rawTotal = 0;
      for (const row of [...(r1.data || []), ...(r2.data || [])]) {
        rawTotal += parseFloat(row.sessions || 0);
      }

      // Summary
      const s1 = await supabase.from('client_metrics_summary')
        .select('sessions').eq('client_id', client.id).gte('date', start).lte('date', mid).limit(1000);
      const s2 = await supabase.from('client_metrics_summary')
        .select('sessions').eq('client_id', client.id).gte('date', mid2).lte('date', end).limit(1000);
      let summaryTotal = 0;
      for (const row of [...(s1.data || []), ...(s2.data || [])]) {
        summaryTotal += parseFloat(row.sessions || 0);
      }

      const diff = Math.abs(rawTotal - summaryTotal);
      const pct = summaryTotal > 0 ? diff / summaryTotal : (rawTotal > 0 ? 1 : 0);
      if (diff > 0 && pct > 0.10) {
        ga4Failures.push({ client: client.name, month, raw: rawTotal, summary: summaryTotal, diff, pct: (pct * 100).toFixed(1) + '%' });
      }
    }
    process.stdout.write('.');
  }
  console.log('');

  if (ga4Failures.length === 0) {
    console.log('✅ CHECK 2 PASS: GA4 raw vs summary đều khớp (trong ngưỡng 10%)');
  } else {
    console.log(`❌ CHECK 2 FAIL: ${ga4Failures.length} trường hợp không khớp:`);
    for (const f of ga4Failures) {
      console.log(`  - ${f.client} / ${f.month}: raw=${f.raw}, summary=${f.summary}, diff=${f.diff} (${f.pct})`);
    }
  }

  // =========================================================
  // CHECK 3: Ads — Raw vs Summary (CorePosture)
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 3: Ads — ads_campaign_metrics vs client_metrics_summary (CorePosture)');
  console.log('='.repeat(80));

  const COREPOSTURE_ID = '3c80f930-5f4d-49d6-9428-f2440e496aac';
  const adsFailures = [];

  for (const month of MONTHS) {
    const { start, end, mid, mid2 } = monthRange(month);

    const r1 = await supabase.from('ads_campaign_metrics')
      .select('cost').eq('client_id', COREPOSTURE_ID).gte('date', start).lte('date', mid).limit(1000);
    const r2 = await supabase.from('ads_campaign_metrics')
      .select('cost').eq('client_id', COREPOSTURE_ID).gte('date', mid2).lte('date', end).limit(1000);
    let rawTotal = 0;
    for (const row of [...(r1.data || []), ...(r2.data || [])]) {
      rawTotal += parseFloat(row.cost || 0);
    }

    const s1 = await supabase.from('client_metrics_summary')
      .select('ad_spend').eq('client_id', COREPOSTURE_ID).gte('date', start).lte('date', mid).limit(1000);
    const s2 = await supabase.from('client_metrics_summary')
      .select('ad_spend').eq('client_id', COREPOSTURE_ID).gte('date', mid2).lte('date', end).limit(1000);
    let summaryTotal = 0;
    for (const row of [...(s1.data || []), ...(s2.data || [])]) {
      summaryTotal += parseFloat(row.ad_spend || 0);
    }

    const diff = Math.abs(rawTotal - summaryTotal);
    const pct = summaryTotal > 0 ? diff / summaryTotal : (rawTotal > 0 ? 1 : 0);
    if (diff > 0.01 && pct > 0.01) {
      adsFailures.push({ month, raw: rawTotal.toFixed(2), summary: summaryTotal.toFixed(2), diff: diff.toFixed(2), pct: (pct * 100).toFixed(2) + '%' });
    }
  }

  if (adsFailures.length === 0) {
    console.log('✅ CHECK 3 PASS: Ads cost raw vs summary đều khớp (trong ngưỡng 1%)');
  } else {
    console.log(`❌ CHECK 3 FAIL: ${adsFailures.length} tháng không khớp:`);
    for (const f of adsFailures) {
      console.log(`  - ${f.month}: raw_cost=${f.raw}, summary_ad_spend=${f.summary}, diff=${f.diff} (${f.pct})`);
    }
  }

  // =========================================================
  // CHECK 4: GSC Raw vs Summary
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 4: GSC — gsc_daily_summary vs client_metrics_summary');
  console.log('='.repeat(80));

  const gscActiveClients = clients.filter(c => gscClients.has(c.id)).slice(0, 3);
  console.log(`Checking ${gscActiveClients.length} GSC clients (sample)...`);
  const gscFailures = [];

  for (const client of gscActiveClients) {
    for (const month of MONTHS) {
      const { start, end, mid, mid2 } = monthRange(month);

      // Check if gsc_daily_summary exists
      const r1 = await supabase.from('gsc_daily_summary')
        .select('total_clicks').eq('client_id', client.id).gte('date', start).lte('date', mid).limit(1000);
      const r2 = await supabase.from('gsc_daily_summary')
        .select('total_clicks').eq('client_id', client.id).gte('date', mid2).lte('date', end).limit(1000);

      let rawTotal = 0;
      const allRaw = [...(r1.data || []), ...(r2.data || [])];
      for (const row of allRaw) rawTotal += parseFloat(row.total_clicks || 0);

      const s1 = await supabase.from('client_metrics_summary')
        .select('seo_clicks').eq('client_id', client.id).gte('date', start).lte('date', mid).limit(1000);
      const s2 = await supabase.from('client_metrics_summary')
        .select('seo_clicks').eq('client_id', client.id).gte('date', mid2).lte('date', end).limit(1000);
      let summaryTotal = 0;
      for (const row of [...(s1.data || []), ...(s2.data || [])]) {
        summaryTotal += parseFloat(row.seo_clicks || 0);
      }

      const diff = Math.abs(rawTotal - summaryTotal);
      const pct = summaryTotal > 0 ? diff / summaryTotal : (rawTotal > 0 ? 1 : 0);
      if (diff > 0 && pct > 0.10) {
        gscFailures.push({ client: client.name, month, raw: rawTotal, summary: summaryTotal, diff, pct: (pct * 100).toFixed(1) + '%' });
      }
    }
  }

  if (gscFailures.length === 0) {
    console.log('✅ CHECK 4 PASS: GSC clicks raw vs summary đều khớp (trong ngưỡng 10%)');
  } else {
    console.log(`❌ CHECK 4 FAIL: ${gscFailures.length} trường hợp không khớp:`);
    for (const f of gscFailures) {
      console.log(`  - ${f.client} / ${f.month}: raw=${f.raw}, summary=${f.summary}, diff=${f.diff} (${f.pct})`);
    }
  }

  // =========================================================
  // CHECK 5: Data gaps — months with 0 data
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 5: Data gaps — tháng nào có 0 data ở CẢ hai bảng raw và summary?');
  console.log('='.repeat(80));

  const gapIssues = [];

  for (const client of gbpActiveClients) {
    const locationIds = gbpClientMap[client.id];
    for (const month of MONTHS) {
      const { start, end, mid, mid2 } = monthRange(month);

      let rawTotal = 0;
      for (const locId of locationIds) {
        const r1 = await supabase.from('gbp_location_daily_metrics')
          .select('phone_calls, website_clicks, direction_requests, views')
          .eq('location_id', locId).gte('date', start).lte('date', mid).limit(1000);
        const r2 = await supabase.from('gbp_location_daily_metrics')
          .select('phone_calls, website_clicks, direction_requests, views')
          .eq('location_id', locId).gte('date', mid2).lte('date', end).limit(1000);
        for (const row of [...(r1.data || []), ...(r2.data || [])]) {
          rawTotal += parseFloat(row.phone_calls || 0) + parseFloat(row.website_clicks || 0) +
            parseFloat(row.direction_requests || 0) + parseFloat(row.views || 0);
        }
      }

      const s1 = await supabase.from('client_metrics_summary')
        .select('gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views')
        .eq('client_id', client.id).gte('date', start).lte('date', mid).limit(1000);
      const s2 = await supabase.from('client_metrics_summary')
        .select('gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views')
        .eq('client_id', client.id).gte('date', mid2).lte('date', end).limit(1000);
      let summaryTotal = 0;
      for (const row of [...(s1.data || []), ...(s2.data || [])]) {
        summaryTotal += parseFloat(row.gbp_calls || 0) + parseFloat(row.gbp_website_clicks || 0) +
          parseFloat(row.gbp_directions || 0) + parseFloat(row.gbp_profile_views || 0);
      }

      if (rawTotal === 0 && summaryTotal === 0) {
        gapIssues.push({ client: client.name, month });
      }
    }
    process.stdout.write('.');
  }
  console.log('');

  if (gapIssues.length === 0) {
    console.log('✅ CHECK 5 PASS: Không có tháng nào có 0 data hoàn toàn ở cả raw và summary');
  } else {
    console.log(`⚠️ CHECK 5 WARN: ${gapIssues.length} tháng có 0 data (cả raw lẫn summary):`);
    for (const g of gapIssues) {
      console.log(`  - ${g.client} / ${g.month}`);
    }
  }

  // =========================================================
  // CHECK 6: Summary coverage
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 6: Summary coverage — client_metrics_summary đầy đủ?');
  console.log('='.repeat(80));

  const coverageIssues = [];

  for (const client of clients) {
    for (const month of MONTHS) {
      const { start, end, mid, mid2 } = monthRange(month);

      const s1 = await supabase.from('client_metrics_summary')
        .select('date', { count: 'exact' }).eq('client_id', client.id)
        .gte('date', start).lte('date', mid).limit(1000);
      const s2 = await supabase.from('client_metrics_summary')
        .select('date', { count: 'exact' }).eq('client_id', client.id)
        .gte('date', mid2).lte('date', end).limit(1000);

      const rowCount = (s1.data?.length || 0) + (s2.data?.length || 0);
      if (rowCount === 0) {
        coverageIssues.push({ client: client.name, month, rows: 0 });
      }
    }
  }

  if (coverageIssues.length === 0) {
    console.log('✅ CHECK 6 PASS: Tất cả active clients đều có data trong client_metrics_summary cho mọi tháng');
  } else {
    console.log(`❌ CHECK 6 FAIL: ${coverageIssues.length} client-month bị thiếu hoàn toàn:`);
    for (const c of coverageIssues) {
      console.log(`  - ${c.client} / ${c.month}: 0 rows`);
    }
  }

  // =========================================================
  // CHECK 7: Future dates or negative values
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 7: Future dates và negative values');
  console.log('='.repeat(80));

  const futureDate = '2026-04-06';

  // Future dates
  const { data: futureGBP } = await supabase.from('gbp_location_daily_metrics')
    .select('date, location_id').gt('date', futureDate).limit(50);
  const { data: futureSummary } = await supabase.from('client_metrics_summary')
    .select('date, client_id').gt('date', futureDate).limit(50);
  const { data: futureGA4 } = await supabase.from('ga4_sessions')
    .select('date, client_id').gt('date', futureDate).limit(50);
  const { data: futureAds } = await supabase.from('ads_campaign_metrics')
    .select('date, client_id').gt('date', futureDate).limit(50);

  const hasFuture = (futureGBP?.length || 0) + (futureSummary?.length || 0) + (futureGA4?.length || 0) + (futureAds?.length || 0);
  if (hasFuture === 0) {
    console.log('✅ CHECK 7a PASS: Không có future dates (sau 2026-04-06)');
  } else {
    console.log(`❌ CHECK 7a FAIL: Có ${hasFuture} rows với future dates!`);
    if (futureGBP?.length) console.log(`  gbp_location_daily_metrics: ${futureGBP.length} rows`, futureGBP.slice(0, 5));
    if (futureSummary?.length) console.log(`  client_metrics_summary: ${futureSummary.length} rows`, futureSummary.slice(0, 5));
    if (futureGA4?.length) console.log(`  ga4_sessions: ${futureGA4.length} rows`, futureGA4.slice(0, 5));
    if (futureAds?.length) console.log(`  ads_campaign_metrics: ${futureAds.length} rows`, futureAds.slice(0, 5));
  }

  // Negative values
  const { data: negGBP } = await supabase.from('gbp_location_daily_metrics')
    .select('date, location_id, phone_calls').lt('phone_calls', 0).limit(50);
  const { data: negSummaryAdSpend } = await supabase.from('client_metrics_summary')
    .select('date, client_id, ad_spend').lt('ad_spend', 0).limit(50);
  const { data: negSummaryCalls } = await supabase.from('client_metrics_summary')
    .select('date, client_id, gbp_calls').lt('gbp_calls', 0).limit(50);
  const { data: negSummarySessions } = await supabase.from('client_metrics_summary')
    .select('date, client_id, sessions').lt('sessions', 0).limit(50);

  const negCount = (negGBP?.length || 0) + (negSummaryAdSpend?.length || 0) + (negSummaryCalls?.length || 0) + (negSummarySessions?.length || 0);
  if (negCount === 0) {
    console.log('✅ CHECK 7b PASS: Không có negative values trong các cột chính');
  } else {
    console.log(`❌ CHECK 7b FAIL: Có ${negCount} rows với negative values:`);
    if (negGBP?.length) console.log(`  gbp_location_daily_metrics.phone_calls < 0: ${negGBP.length} rows`);
    if (negSummaryAdSpend?.length) console.log(`  client_metrics_summary.ad_spend < 0: ${negSummaryAdSpend.length} rows`);
    if (negSummaryCalls?.length) console.log(`  client_metrics_summary.gbp_calls < 0: ${negSummaryCalls.length} rows`);
    if (negSummarySessions?.length) console.log(`  client_metrics_summary.sessions < 0: ${negSummarySessions.length} rows`);
  }

  // ===== FINAL SUMMARY =====
  console.log('\n' + '='.repeat(80));
  console.log('TÓM TẮT AUDIT');
  console.log('='.repeat(80));
  const check1 = gbpFailures.length === 0 ? '✅ PASS' : `❌ FAIL (${gbpFailures.length} issues)`;
  const check2 = ga4Failures.length === 0 ? '✅ PASS' : `❌ FAIL (${ga4Failures.length} issues)`;
  const check3 = adsFailures.length === 0 ? '✅ PASS' : `❌ FAIL (${adsFailures.length} issues)`;
  const check4 = gscFailures.length === 0 ? '✅ PASS' : `❌ FAIL (${gscFailures.length} issues)`;
  const check5 = gapIssues.length === 0 ? '✅ PASS' : `⚠️ WARN (${gapIssues.length} gaps)`;
  const check6 = coverageIssues.length === 0 ? '✅ PASS' : `❌ FAIL (${coverageIssues.length} missing)`;
  const check7a = hasFuture === 0 ? '✅ PASS' : `❌ FAIL`;
  const check7b = negCount === 0 ? '✅ PASS' : `❌ FAIL`;
  console.log(`Check 1 (GBP consistency): ${check1}`);
  console.log(`Check 2 (GA4 consistency): ${check2}`);
  console.log(`Check 3 (Ads consistency): ${check3}`);
  console.log(`Check 4 (GSC consistency): ${check4}`);
  console.log(`Check 5 (Data gaps):       ${check5}`);
  console.log(`Check 6 (Coverage):        ${check6}`);
  console.log(`Check 7a (Future dates):   ${check7a}`);
  console.log(`Check 7b (Negative vals):  ${check7b}`);
}

main().catch(console.error);
