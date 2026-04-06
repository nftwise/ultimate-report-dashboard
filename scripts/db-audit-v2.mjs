import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const MONTHS = [
  '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09',
  '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'
];

function monthBounds(ym) {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${ym}-01`,
    mid: `${ym}-15`,
    mid2: `${ym}-16`,
    end: `${ym}-${String(lastDay).padStart(2, '0')}`
  };
}

// Fetch rows for a date range using 2-half pagination to avoid 1000-row limit
async function fetchRows(table, columns, filters, start, end) {
  const { mid, mid2 } = { mid: start.slice(0, 8) + '15', mid2: start.slice(0, 8) + '16' };
  const actualMid = start <= `${start.slice(0,7)}-15` ? `${start.slice(0,7)}-15` : mid;
  const actualMid2 = `${start.slice(0,7)}-16`;

  let q1 = sb.from(table).select(columns);
  let q2 = sb.from(table).select(columns);

  for (const [k, v] of Object.entries(filters)) {
    q1 = q1.eq(k, v);
    q2 = q2.eq(k, v);
  }

  q1 = q1.gte('date', start).lte('date', actualMid).limit(1000);
  q2 = q2.gte('date', actualMid2).lte('date', end).limit(1000);

  const [r1, r2] = await Promise.all([q1, q2]);
  if (r1.error) throw new Error(`${table} q1: ${r1.error.message}`);
  if (r2.error) throw new Error(`${table} q2: ${r2.error.message}`);
  return [...(r1.data || []), ...(r2.data || [])];
}

function sumField(rows, field) {
  return rows.reduce((s, r) => s + parseFloat(r[field] || 0), 0);
}

function pctDiff(raw, sum) {
  if (sum === 0 && raw === 0) return 0;
  if (sum === 0) return 1;
  return Math.abs(raw - sum) / sum;
}

async function main() {
  console.log('='.repeat(80));
  console.log('KIỂM TRA TOÀN DIỆN DATABASE INTEGRITY');
  console.log('Ngày chạy: ' + new Date().toLocaleString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh'}));
  console.log('='.repeat(80));

  // Load all clients
  const { data: allClients } = await sb.from('clients').select('id, name, slug, is_active').order('name');
  const clientMap = {};
  for (const c of allClients) clientMap[c.id] = c;
  const activeClients = allClients.filter(c => c.is_active);
  console.log(`\nTổng clients: ${allClients.length}, Active: ${activeClients.length}`);

  // =========================================================
  // CHECK 1: GBP — Raw vs Summary
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 1: GBP — gbp_location_daily_metrics vs client_metrics_summary');
  console.log('Ngưỡng flag: |raw - summary| > 5% VÀ diff > 2 calls');
  console.log('='.repeat(80));

  // GBP clients = clients that have rows in gbp_location_daily_metrics
  const { data: gbpClientRows } = await sb.from('gbp_location_daily_metrics')
    .select('client_id').gte('date', '2025-04-01').lte('date', '2026-03-31').limit(10000);
  const gbpClientIds = [...new Set((gbpClientRows || []).map(r => r.client_id))];
  const gbpClients = gbpClientIds.map(id => clientMap[id]).filter(Boolean);

  console.log(`GBP clients có data Apr2025-Mar2026: ${gbpClients.length}`);
  gbpClients.forEach(c => console.log(`  - ${c.name}`));

  const gbpFailures = [];
  const gbpMonthSummary = [];

  for (const client of gbpClients) {
    for (const month of MONTHS) {
      const { start, mid, mid2, end } = monthBounds(month);

      // Raw: gbp_location_daily_metrics
      const rawRows = await fetchRows('gbp_location_daily_metrics', 'phone_calls',
        { client_id: client.id }, start, end);
      const rawTotal = sumField(rawRows, 'phone_calls');

      // Summary: client_metrics_summary
      const sumRows = await fetchRows('client_metrics_summary', 'gbp_calls',
        { client_id: client.id }, start, end);
      const sumTotal = sumField(sumRows, 'gbp_calls');

      const diff = Math.abs(rawTotal - sumTotal);
      const pct = pctDiff(rawTotal, sumTotal);

      gbpMonthSummary.push({ client: client.name, month, raw: rawTotal, sum: sumTotal, diff, pct });

      if (diff > 2 && pct > 0.05) {
        gbpFailures.push({ client: client.name, month, raw: rawTotal, summary: sumTotal, diff, pct });
      }
    }
    process.stdout.write('.');
  }
  console.log('');

  // Print all month details for GBP
  console.log('\nChi tiết GBP raw vs summary (phone_calls / gbp_calls):');
  console.log(`${'Client'.padEnd(35)} ${'Tháng'.padEnd(8)} ${'Raw'.padEnd(8)} ${'Summary'.padEnd(10)} ${'Diff'.padEnd(8)} Pct`);
  for (const r of gbpMonthSummary) {
    const flag = r.diff > 2 && r.pct > 0.05 ? ' ❌' : '';
    console.log(`${r.client.padEnd(35)} ${r.month.padEnd(8)} ${String(r.raw).padEnd(8)} ${String(r.sum).padEnd(10)} ${String(r.diff.toFixed(0)).padEnd(8)} ${(r.pct*100).toFixed(1)}%${flag}`);
  }

  if (gbpFailures.length === 0) {
    console.log('\n✅ CHECK 1 PASS: Tất cả GBP phone_calls đều khớp (trong ngưỡng 5% hoặc diff ≤ 2)');
  } else {
    console.log(`\n❌ CHECK 1 FAIL: ${gbpFailures.length} tháng không khớp:`);
    for (const f of gbpFailures) {
      console.log(`  ❌ ${f.client} / ${f.month}: raw=${f.raw}, summary=${f.summary}, diff=${f.diff.toFixed(0)} (${(f.pct*100).toFixed(1)}%)`);
    }
  }

  // =========================================================
  // CHECK 2: GA4 — Raw vs Summary
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 2: GA4 — ga4_sessions vs client_metrics_summary');
  console.log('Ngưỡng flag: diff > 10%');
  console.log('='.repeat(80));

  // GA4 clients with non-(all)/(all) data
  const { data: ga4AllRows } = await sb.from('ga4_sessions')
    .select('client_id, source_medium').limit(10000);
  const ga4ClientIds = [...new Set(
    (ga4AllRows || []).filter(r => r.source_medium !== '(all) / (all)').map(r => r.client_id)
  )];
  const ga4Clients = ga4ClientIds.map(id => clientMap[id]).filter(Boolean);
  console.log(`GA4 clients có data non-(all): ${ga4Clients.length}`);
  ga4Clients.forEach(c => console.log(`  - ${c.name}`));

  const ga4Failures = [];
  const ga4Summary = [];

  for (const client of ga4Clients) {
    for (const month of MONTHS) {
      const { start, end } = monthBounds(month);

      // Raw: ga4_sessions excluding (all)/(all)
      // Use manual filtering since we can't do neq + date range + limit cleanly for large sets
      const r1 = await sb.from('ga4_sessions')
        .select('sessions').eq('client_id', client.id)
        .neq('source_medium', '(all) / (all)')
        .gte('date', start).lte('date', `${month}-15`).limit(1000);
      const r2 = await sb.from('ga4_sessions')
        .select('sessions').eq('client_id', client.id)
        .neq('source_medium', '(all) / (all)')
        .gte('date', `${month}-16`).lte('date', end).limit(1000);

      const rawTotal = sumField([...(r1.data || []), ...(r2.data || [])], 'sessions');

      // Summary
      const sumRows = await fetchRows('client_metrics_summary', 'sessions',
        { client_id: client.id }, start, end);
      const sumTotal = sumField(sumRows, 'sessions');

      const diff = Math.abs(rawTotal - sumTotal);
      const pct = pctDiff(rawTotal, sumTotal);

      ga4Summary.push({ client: client.name, month, raw: rawTotal, sum: sumTotal, diff, pct });

      if (diff > 0 && pct > 0.10) {
        ga4Failures.push({ client: client.name, month, raw: rawTotal, summary: sumTotal, diff, pct });
      }
    }
    process.stdout.write('.');
  }
  console.log('');

  console.log('\nChi tiết GA4 raw vs summary (sessions) — chỉ hiện tháng có diff > 0:');
  console.log(`${'Client'.padEnd(35)} ${'Tháng'.padEnd(8)} ${'Raw'.padEnd(8)} ${'Summary'.padEnd(10)} ${'Diff'.padEnd(8)} Pct`);
  for (const r of ga4Summary.filter(r => r.diff > 0)) {
    const flag = r.pct > 0.10 ? ' ❌' : '';
    console.log(`${r.client.padEnd(35)} ${r.month.padEnd(8)} ${String(r.raw.toFixed(0)).padEnd(8)} ${String(r.sum.toFixed(0)).padEnd(10)} ${String(r.diff.toFixed(0)).padEnd(8)} ${(r.pct*100).toFixed(1)}%${flag}`);
  }

  if (ga4Failures.length === 0) {
    console.log('\n✅ CHECK 2 PASS: GA4 sessions đều khớp (trong ngưỡng 10%)');
  } else {
    console.log(`\n❌ CHECK 2 FAIL: ${ga4Failures.length} tháng không khớp:`);
    for (const f of ga4Failures) {
      console.log(`  ❌ ${f.client} / ${f.month}: raw=${f.raw.toFixed(0)}, summary=${f.summary.toFixed(0)}, diff=${f.diff.toFixed(0)} (${(f.pct*100).toFixed(1)}%)`);
    }
  }

  // =========================================================
  // CHECK 3: Ads — Raw vs Summary
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 3: Ads — ads_campaign_metrics vs client_metrics_summary');
  console.log('Ngưỡng flag: diff > 1%');
  console.log('='.repeat(80));

  // Zen Care Physical Medicine is the Ads client
  const ZEN_CARE_ID = '0459d9d5-f4c6-444e-8f66-2c9f225deeb6';
  const COREPOSTURE_ID = '3c80f930-5f4d-49d6-9428-f2440e496aac';

  // Find all unique ads clients
  const { data: adsClientRows } = await sb.from('ads_campaign_metrics')
    .select('client_id').limit(1000);
  const adsClientIds = [...new Set((adsClientRows || []).map(r => r.client_id))];
  console.log('Ads clients:', adsClientIds.map(id => clientMap[id]?.name || id).join(', '));

  const adsFailures = [];
  const adsAllSummary = [];

  for (const clientId of adsClientIds) {
    const clientName = clientMap[clientId]?.name || clientId;
    for (const month of MONTHS) {
      const { start, end } = monthBounds(month);

      const rawRows = await fetchRows('ads_campaign_metrics', 'cost',
        { client_id: clientId }, start, end);
      const rawTotal = sumField(rawRows, 'cost');

      const sumRows = await fetchRows('client_metrics_summary', 'ad_spend',
        { client_id: clientId }, start, end);
      const sumTotal = sumField(sumRows, 'ad_spend');

      const diff = Math.abs(rawTotal - sumTotal);
      const pct = pctDiff(rawTotal, sumTotal);

      adsAllSummary.push({ client: clientName, month, raw: rawTotal, sum: sumTotal, diff, pct });

      if (diff > 0.01 && pct > 0.01) {
        adsFailures.push({ client: clientName, month, raw: rawTotal, summary: sumTotal, diff, pct });
      }
    }
  }

  console.log('\nChi tiết Ads raw cost vs summary ad_spend:');
  console.log(`${'Client'.padEnd(30)} ${'Tháng'.padEnd(8)} ${'Raw Cost'.padEnd(12)} ${'Summ Spend'.padEnd(12)} ${'Diff'.padEnd(10)} Pct`);
  for (const r of adsAllSummary) {
    const flag = r.diff > 0.01 && r.pct > 0.01 ? ' ❌' : '';
    if (r.raw > 0 || r.sum > 0) {
      console.log(`${r.client.padEnd(30)} ${r.month.padEnd(8)} ${r.raw.toFixed(2).padEnd(12)} ${r.sum.toFixed(2).padEnd(12)} ${r.diff.toFixed(2).padEnd(10)} ${(r.pct*100).toFixed(2)}%${flag}`);
    }
  }

  if (adsFailures.length === 0) {
    console.log('\n✅ CHECK 3 PASS: Ads cost raw vs summary đều khớp (trong ngưỡng 1%)');
  } else {
    console.log(`\n❌ CHECK 3 FAIL: ${adsFailures.length} tháng không khớp:`);
    for (const f of adsFailures) {
      console.log(`  ❌ ${f.client} / ${f.month}: raw=${f.raw.toFixed(2)}, summary=${f.summary.toFixed(2)}, diff=${f.diff.toFixed(2)} (${(f.pct*100).toFixed(2)}%)`);
    }
  }

  // =========================================================
  // CHECK 4: GSC — Raw vs Summary
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 4: GSC — gsc_daily_summary vs client_metrics_summary');
  console.log('Ngưỡng flag: diff > 10%');
  console.log('='.repeat(80));

  const { data: gscClientRows } = await sb.from('gsc_daily_summary')
    .select('client_id').limit(1000);
  const gscClientIds = [...new Set((gscClientRows || []).map(r => r.client_id))];
  const gscClients = gscClientIds.map(id => clientMap[id]).filter(Boolean).slice(0, 3);
  console.log(`Kiểm tra ${gscClients.length} GSC clients (sample):`, gscClients.map(c => c.name).join(', '));

  const gscFailures = [];
  const gscAllSummary = [];

  for (const client of gscClients) {
    for (const month of MONTHS) {
      const { start, end } = monthBounds(month);

      const rawRows = await fetchRows('gsc_daily_summary', 'total_clicks',
        { client_id: client.id }, start, end);
      const rawTotal = sumField(rawRows, 'total_clicks');

      const sumRows = await fetchRows('client_metrics_summary', 'seo_clicks',
        { client_id: client.id }, start, end);
      const sumTotal = sumField(sumRows, 'seo_clicks');

      const diff = Math.abs(rawTotal - sumTotal);
      const pct = pctDiff(rawTotal, sumTotal);

      gscAllSummary.push({ client: client.name, month, raw: rawTotal, sum: sumTotal, diff, pct });

      if (diff > 0 && pct > 0.10) {
        gscFailures.push({ client: client.name, month, raw: rawTotal, summary: sumTotal, diff, pct });
      }
    }
    process.stdout.write('.');
  }
  console.log('');

  console.log('\nChi tiết GSC total_clicks vs seo_clicks (chỉ tháng có data):');
  console.log(`${'Client'.padEnd(35)} ${'Tháng'.padEnd(8)} ${'Raw'.padEnd(8)} ${'Summary'.padEnd(10)} ${'Diff'.padEnd(8)} Pct`);
  for (const r of gscAllSummary) {
    if (r.raw > 0 || r.sum > 0) {
      const flag = r.pct > 0.10 ? ' ❌' : '';
      console.log(`${r.client.padEnd(35)} ${r.month.padEnd(8)} ${String(r.raw).padEnd(8)} ${String(r.sum.toFixed(0)).padEnd(10)} ${String(r.diff.toFixed(0)).padEnd(8)} ${(r.pct*100).toFixed(1)}%${flag}`);
    }
  }

  if (gscFailures.length === 0) {
    console.log('\n✅ CHECK 4 PASS: GSC clicks raw vs summary đều khớp (trong ngưỡng 10%)');
  } else {
    console.log(`\n❌ CHECK 4 FAIL: ${gscFailures.length} tháng không khớp:`);
    for (const f of gscFailures) {
      console.log(`  ❌ ${f.client} / ${f.month}: raw=${f.raw}, summary=${f.summary.toFixed(0)}, diff=${f.diff.toFixed(0)} (${(f.pct*100).toFixed(1)}%)`);
    }
  }

  // =========================================================
  // CHECK 5: Data gaps
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 5: Data gaps — tháng có 0 data ở CẢ raw lẫn summary (GBP clients)');
  console.log('='.repeat(80));

  const gapIssues = [];

  for (const clientId of gbpClientIds) {
    const clientName = clientMap[clientId]?.name || clientId;
    for (const month of MONTHS) {
      const { start, end } = monthBounds(month);

      const rawRows = await fetchRows('gbp_location_daily_metrics',
        'phone_calls, website_clicks, direction_requests, views',
        { client_id: clientId }, start, end);

      let rawTotal = 0;
      for (const r of rawRows) {
        rawTotal += parseFloat(r.phone_calls || 0) + parseFloat(r.website_clicks || 0) +
          parseFloat(r.direction_requests || 0) + parseFloat(r.views || 0);
      }

      const sumRows = await fetchRows('client_metrics_summary',
        'gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views',
        { client_id: clientId }, start, end);

      let sumTotal = 0;
      for (const r of sumRows) {
        sumTotal += parseFloat(r.gbp_calls || 0) + parseFloat(r.gbp_website_clicks || 0) +
          parseFloat(r.gbp_directions || 0) + parseFloat(r.gbp_profile_views || 0);
      }

      const rawRowCount = rawRows.length;
      const sumRowCount = sumRows.length;

      if (rawTotal === 0 && sumTotal === 0) {
        gapIssues.push({ client: clientName, month, rawRows: rawRowCount, sumRows: sumRowCount });
      }
    }
    process.stdout.write('.');
  }
  console.log('');

  if (gapIssues.length === 0) {
    console.log('✅ CHECK 5 PASS: Không tháng nào có 0 data hoàn toàn ở cả raw lẫn summary');
  } else {
    console.log(`⚠️ CHECK 5 WARN: ${gapIssues.length} tháng có toàn 0 (có thể sync chưa chạy):`);
    for (const g of gapIssues) {
      console.log(`  ⚠️ ${g.client} / ${g.month} — raw rows: ${g.rawRows}, sum rows: ${g.sumRows}`);
    }
  }

  // =========================================================
  // CHECK 6: Summary coverage (all active clients × 12 months)
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 6: Summary coverage — 19 active clients × 12 tháng Apr25-Mar26');
  console.log('='.repeat(80));

  const coverageIssues = [];
  const coverageTable = [];

  for (const client of activeClients) {
    const monthCoverage = [];
    for (const month of MONTHS) {
      const { start, end } = monthBounds(month);
      const rows = await fetchRows('client_metrics_summary', 'date',
        { client_id: client.id }, start, end);
      const rowCount = rows.length;
      monthCoverage.push({ month, rows: rowCount });
      if (rowCount === 0) {
        coverageIssues.push({ client: client.name, month, rows: 0 });
      }
    }
    coverageTable.push({ client: client.name, months: monthCoverage });
    process.stdout.write('.');
  }
  console.log('');

  // Print coverage matrix
  console.log('\nCoverage matrix (số rows/tháng):');
  const header = 'Client'.padEnd(35) + MONTHS.map(m => m.slice(5)).join(' ');
  console.log(header);
  for (const row of coverageTable) {
    const cells = row.months.map(m => String(m.rows).padStart(2)).join('  ');
    console.log(row.client.padEnd(35) + cells);
  }

  if (coverageIssues.length === 0) {
    console.log('\n✅ CHECK 6 PASS: Tất cả active clients đều có data trong client_metrics_summary');
  } else {
    console.log(`\n❌ CHECK 6 FAIL: ${coverageIssues.length} client-month bị thiếu hoàn toàn (0 rows):`);
    for (const c of coverageIssues) {
      console.log(`  ❌ ${c.client} / ${c.month}`);
    }
  }

  // =========================================================
  // CHECK 7: Future dates & negative values
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 7: Future dates và negative values');
  console.log('='.repeat(80));

  const FUTURE_CUTOFF = '2026-04-06';

  const [futureGBP, futureSummary, futureGA4, futureAds, futureGSC] = await Promise.all([
    sb.from('gbp_location_daily_metrics').select('date, location_id, client_id').gt('date', FUTURE_CUTOFF).limit(50),
    sb.from('client_metrics_summary').select('date, client_id').gt('date', FUTURE_CUTOFF).limit(50),
    sb.from('ga4_sessions').select('date, client_id').gt('date', FUTURE_CUTOFF).limit(50),
    sb.from('ads_campaign_metrics').select('date, client_id').gt('date', FUTURE_CUTOFF).limit(50),
    sb.from('gsc_daily_summary').select('date, client_id').gt('date', FUTURE_CUTOFF).limit(50),
  ]);

  const futureTotal = [futureGBP, futureSummary, futureGA4, futureAds, futureGSC]
    .reduce((s, r) => s + (r.data?.length || 0), 0);

  if (futureTotal === 0) {
    console.log(`✅ CHECK 7a PASS: Không có rows với date > ${FUTURE_CUTOFF}`);
  } else {
    console.log(`❌ CHECK 7a FAIL: Có ${futureTotal} rows với future dates:`);
    if (futureGBP.data?.length) console.log(`  gbp_location_daily_metrics: ${futureGBP.data.length} rows - dates: ${futureGBP.data.map(r=>r.date).join(', ')}`);
    if (futureSummary.data?.length) console.log(`  client_metrics_summary: ${futureSummary.data.length} rows - dates: ${futureSummary.data.map(r=>r.date).join(', ')}`);
    if (futureGA4.data?.length) console.log(`  ga4_sessions: ${futureGA4.data.length} rows`);
    if (futureAds.data?.length) console.log(`  ads_campaign_metrics: ${futureAds.data.length} rows`);
    if (futureGSC.data?.length) console.log(`  gsc_daily_summary: ${futureGSC.data.length} rows`);
  }

  // Negative values check
  const [negGBPCalls, negGBPViews, negAdSpend, negGBPCallsSummary, negSessions, negSeoClicks] = await Promise.all([
    sb.from('gbp_location_daily_metrics').select('date, client_id, phone_calls').lt('phone_calls', 0).limit(50),
    sb.from('gbp_location_daily_metrics').select('date, client_id, views').lt('views', 0).limit(50),
    sb.from('client_metrics_summary').select('date, client_id, ad_spend').lt('ad_spend', 0).limit(50),
    sb.from('client_metrics_summary').select('date, client_id, gbp_calls').lt('gbp_calls', 0).limit(50),
    sb.from('client_metrics_summary').select('date, client_id, sessions').lt('sessions', 0).limit(50),
    sb.from('client_metrics_summary').select('date, client_id, seo_clicks').lt('seo_clicks', 0).limit(50),
  ]);

  const negTotal = [negGBPCalls, negGBPViews, negAdSpend, negGBPCallsSummary, negSessions, negSeoClicks]
    .reduce((s, r) => s + (r.data?.length || 0), 0);

  if (negTotal === 0) {
    console.log('✅ CHECK 7b PASS: Không có negative values trong các cột chính');
  } else {
    console.log(`❌ CHECK 7b FAIL: Có ${negTotal} rows với negative values:`);
    if (negGBPCalls.data?.length) console.log(`  gbp_location_daily_metrics.phone_calls < 0: ${negGBPCalls.data.length} rows`);
    if (negGBPViews.data?.length) console.log(`  gbp_location_daily_metrics.views < 0: ${negGBPViews.data.length} rows`);
    if (negAdSpend.data?.length) console.log(`  client_metrics_summary.ad_spend < 0: ${negAdSpend.data.length} rows`);
    if (negGBPCallsSummary.data?.length) console.log(`  client_metrics_summary.gbp_calls < 0: ${negGBPCallsSummary.data.length} rows`);
    if (negSessions.data?.length) console.log(`  client_metrics_summary.sessions < 0: ${negSessions.data.length} rows`);
    if (negSeoClicks.data?.length) console.log(`  client_metrics_summary.seo_clicks < 0: ${negSeoClicks.data.length} rows`);
  }

  // =========================================================
  // BONUS: Check GBP data coverage by month more broadly
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('BONUS CHECK: GBP data rows per month (tất cả 17 clients có GBP)');
  console.log('='.repeat(80));

  // Get all unique client_ids in gbp_location_daily_metrics
  const { data: allGbpClientRows } = await sb.from('gbp_location_daily_metrics')
    .select('client_id').limit(10000);
  const allGbpClientIds = [...new Set((allGbpClientRows || []).map(r => r.client_id))];
  console.log(`GBP: ${allGbpClientIds.length} unique clients in raw table`);

  for (const month of MONTHS) {
    const { start, end } = monthBounds(month);
    const r1 = await sb.from('gbp_location_daily_metrics')
      .select('client_id', { count: 'exact' }).gte('date', start).lte('date', `${month}-15`).limit(1000);
    const r2 = await sb.from('gbp_location_daily_metrics')
      .select('client_id', { count: 'exact' }).gte('date', `${month}-16`).lte('date', end).limit(1000);
    const clientsWithData = [...new Set([...(r1.data || []), ...(r2.data || [])].map(r => r.client_id))];
    console.log(`  ${month}: ${clientsWithData.length} clients có data`);
  }

  // =========================================================
  // FINAL SUMMARY
  // =========================================================
  console.log('\n' + '='.repeat(80));
  console.log('TÓM TẮT AUDIT DATABASE INTEGRITY');
  console.log('='.repeat(80));

  const results = [
    ['Check 1 - GBP phone_calls consistency', gbpFailures.length === 0, gbpFailures.length === 0 ? 'Tất cả GBP calls khớp' : `${gbpFailures.length} tháng không khớp`],
    ['Check 2 - GA4 sessions consistency', ga4Failures.length === 0, ga4Failures.length === 0 ? 'GA4 sessions khớp' : `${ga4Failures.length} tháng không khớp`],
    ['Check 3 - Ads cost consistency', adsFailures.length === 0, adsFailures.length === 0 ? 'Ads cost khớp' : `${adsFailures.length} tháng không khớp`],
    ['Check 4 - GSC clicks consistency', gscFailures.length === 0, gscFailures.length === 0 ? 'GSC clicks khớp' : `${gscFailures.length} tháng không khớp`],
    ['Check 5 - GBP data gaps', gapIssues.length === 0, gapIssues.length === 0 ? 'Không có gaps' : `${gapIssues.length} tháng có 0 data`, 'warn'],
    ['Check 6 - Summary coverage', coverageIssues.length === 0, coverageIssues.length === 0 ? 'Coverage đầy đủ' : `${coverageIssues.length} client-month thiếu`],
    ['Check 7a - No future dates', futureTotal === 0, futureTotal === 0 ? 'Không có future dates' : `${futureTotal} rows future`],
    ['Check 7b - No negative values', negTotal === 0, negTotal === 0 ? 'Không có negative values' : `${negTotal} rows negative`],
  ];

  for (const [name, pass, detail, type] of results) {
    const icon = pass ? '✅' : (type === 'warn' ? '⚠️' : '❌');
    const status = pass ? 'PASS' : (type === 'warn' ? 'WARN' : 'FAIL');
    console.log(`${icon} ${status.padEnd(5)} ${name.padEnd(40)} — ${detail}`);
  }

  const totalFail = results.filter(([,,, type]) => type !== 'warn').filter(([,pass]) => !pass).length;
  const totalWarn = results.filter(([,pass,, type]) => !pass && type === 'warn').length;
  console.log(`\nKết quả: ${results.filter(([,p])=>p).length}/${results.length} PASS, ${totalFail} FAIL, ${totalWarn} WARN`);

  if (totalFail === 0) {
    console.log('\n🎉 DATABASE INTEGRITY: ĐẠT — Không có lỗi nghiêm trọng!');
  } else {
    console.log('\n🚨 DATABASE INTEGRITY: KHÔNG ĐẠT — Cần xử lý các lỗi trên!');
  }
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
