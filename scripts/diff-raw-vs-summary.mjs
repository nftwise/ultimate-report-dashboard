#!/usr/bin/env node
/**
 * diff-raw-vs-summary.mjs
 *
 * So sánh data đã kéo về từ API (raw tables) vs client_metrics_summary (rollup).
 * Mục tiêu: kiểm tra rollup có tính đúng không.
 *
 * Raw tables:
 *   ga4_sessions        → sessions, users
 *   gsc_daily_summary   → seo_clicks, seo_impressions
 *   ads_campaign_metrics→ ad_spend, ads_clicks
 *   gbp_location_daily_metrics → gbp_calls, gbp_views
 *
 * Usage:
 *   node scripts/diff-raw-vs-summary.mjs
 *   node scripts/diff-raw-vs-summary.mjs --month=2026-03
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';

const monthArg = process.argv.find(a => a.startsWith('--month='))?.split('=')[1] || '2026-03';
const [year, month] = monthArg.split('-');
const START = `${year}-${month}-01`;
const END   = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]; // last day of month

const DIFF_THRESH = 0.02; // 2% — rollup phải chính xác cao

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m',
};

function pct(a, b) {
  if (!a && !b) return 0;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));
}

async function fetchAll(table, select, filters = {}) {
  let allRows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q = sb.from(table).select(select).gte('date', START).lte('date', END).range(from, from + pageSize - 1);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    allRows = allRows.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

async function main() {
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗`);
  console.log(`║  RAW TABLES vs SUMMARY — ${monthArg}              ║`);
  console.log(`╚══════════════════════════════════════════════════╝${C.reset}`);
  console.log(`  Range: ${START} → ${END}\n`);

  // ── load clients ────────────────────────────────────────────────────────────
  const { data: clients } = await sb.from('clients').select('id, name, slug').eq('is_active', true).order('name');

  // ── Task 1: aggregate raw tables per client ────────────────────────────────
  console.log(`${C.cyan}[1/5]${C.reset} Reading raw tables...`);

  const [ga4Rows, gscRows, adsRows, gbpRows] = await Promise.all([
    fetchAll('ga4_sessions',              'client_id, sessions, total_users'),
    fetchAll('gsc_daily_summary',         'client_id, total_clicks, total_impressions'),
    fetchAll('ads_campaign_metrics',      'client_id, cost, clicks, conversions'),
    fetchAll('gbp_location_daily_metrics','client_id, phone_calls, views, website_clicks, direction_requests'),
  ]);

  // aggregate by client
  const raw = new Map(); // client_id → aggregated raw
  const init = () => ({ sessions: 0, users: 0, seoClicks: 0, seoImpressions: 0, adSpend: 0, adsClicks: 0, adsConversions: 0, gbpCalls: 0, gbpViews: 0, gbpWebClicks: 0, gbpDirs: 0 });

  for (const r of ga4Rows) {
    if (!raw.has(r.client_id)) raw.set(r.client_id, init());
    const c = raw.get(r.client_id);
    c.sessions += r.sessions      || 0;
    c.users    += r.total_users   || 0;
  }
  for (const r of gscRows) {
    if (!raw.has(r.client_id)) raw.set(r.client_id, init());
    const c = raw.get(r.client_id);
    c.seoClicks      += r.total_clicks      || 0;
    c.seoImpressions += r.total_impressions || 0;
  }
  for (const r of adsRows) {
    if (!raw.has(r.client_id)) raw.set(r.client_id, init());
    const c = raw.get(r.client_id);
    c.adSpend        += r.cost        || 0;
    c.adsClicks      += r.clicks      || 0;
    c.adsConversions += r.conversions || 0;
  }
  for (const r of gbpRows) {
    if (!raw.has(r.client_id)) raw.set(r.client_id, init());
    const c = raw.get(r.client_id);
    c.gbpCalls    += r.phone_calls        || 0;
    c.gbpViews    += r.views              || 0;
    c.gbpWebClicks+= r.website_clicks     || 0;
    c.gbpDirs     += r.direction_requests || 0;
  }

  console.log(`  ga4_sessions: ${ga4Rows.length} rows | gsc_daily_summary: ${gscRows.length} rows | ads_campaign_metrics: ${adsRows.length} rows | gbp_metrics: ${gbpRows.length} rows\n`);

  // ── Task 2: read client_metrics_summary ────────────────────────────────────
  console.log(`${C.cyan}[2/5]${C.reset} Reading client_metrics_summary...`);

  const summaryRows = await fetchAll('client_metrics_summary',
    'client_id, sessions, users, seo_clicks, seo_impressions, ad_spend, ads_clicks, google_ads_conversions, gbp_calls, gbp_profile_views, gbp_website_clicks, gbp_directions',
    { period_type: 'daily' }
  );

  const summary = new Map();
  for (const r of summaryRows) {
    if (!summary.has(r.client_id)) summary.set(r.client_id, init());
    const c = summary.get(r.client_id);
    c.sessions       += r.sessions                || 0;
    c.users          += r.users                   || 0;
    c.seoClicks      += r.seo_clicks              || 0;
    c.seoImpressions += r.seo_impressions         || 0;
    c.adSpend        += r.ad_spend                || 0;
    c.adsClicks      += r.ads_clicks              || 0;
    c.adsConversions += r.google_ads_conversions  || 0;
    c.gbpCalls       += r.gbp_calls               || 0;
    c.gbpViews       += r.gbp_profile_views       || 0;
    c.gbpWebClicks   += r.gbp_website_clicks      || 0;
    c.gbpDirs        += r.gbp_directions          || 0;
  }

  console.log(`  ${summaryRows.length} summary rows across ${summary.size} clients\n`);

  // ── Compare ─────────────────────────────────────────────────────────────────
  console.log(`${C.cyan}[3/5]${C.reset} Comparing...\n`);

  const issues = [];
  const metrics = [
    { key: 'sessions',       label: 'GA4 sessions',     rawKey: 'sessions'      },
    { key: 'seoClicks',      label: 'GSC clicks',        rawKey: 'seoClicks'     },
    { key: 'seoImpressions', label: 'GSC impressions',   rawKey: 'seoImpressions'},
    { key: 'adSpend',        label: 'Ads spend $',       rawKey: 'adSpend',  round: 2 },
    { key: 'adsClicks',      label: 'Ads clicks',        rawKey: 'adsClicks'     },
    { key: 'gbpCalls',       label: 'GBP calls',         rawKey: 'gbpCalls'      },
    { key: 'gbpViews',       label: 'GBP views',         rawKey: 'gbpViews'      },
  ];

  for (const client of clients) {
    const r = raw.get(client.id);
    const s = summary.get(client.id);
    if (!r && !s) continue;
    if (!r || !s) {
      if (r) issues.push({ client: client.name, metric: 'ALL', raw: 'has data', summary: 'MISSING', diff: 100 });
      if (s) issues.push({ client: client.name, metric: 'ALL', raw: 'MISSING', summary: 'has data', diff: 100 });
      continue;
    }

    for (const m of metrics) {
      const rv = r[m.rawKey] || 0;
      const sv = s[m.key]    || 0;
      const d  = pct(rv, sv);
      if (d > DIFF_THRESH && (rv > 0 || sv > 0)) {
        issues.push({
          client: client.name,
          metric: m.label,
          raw: m.round ? Math.round(rv * 100) / 100 : Math.round(rv),
          summary: m.round ? Math.round(sv * 100) / 100 : Math.round(sv),
          diff: Math.round(d * 1000) / 10,
        });
      }
    }
  }

  // ── Print per-client table ────────────────────────────────────────────────
  console.log(`${C.bold}PER CLIENT — RAW vs SUMMARY${C.reset}`);
  console.log(`${'─'.repeat(110)}`);
  console.log('Client'.padEnd(35) + ' ' + 'GA4 ses'.padStart(8) + ' ' + '→Sum'.padStart(8) + ' | ' + 'GSCclk'.padStart(7) + ' ' + '→Sum'.padStart(7) + ' | ' + 'Ads$'.padStart(8) + ' ' + '→Sum'.padStart(8) + ' | ' + 'GBPcalls'.padStart(8) + ' ' + '→Sum'.padStart(8));
  console.log(`${'─'.repeat(110)}`);

  for (const client of clients) {
    const r = raw.get(client.id);
    const s = summary.get(client.id);
    if (!r && !s) continue;
    const rv = r || init();
    const sv = s || init();

    const fmt = (rawV, sumV, round = 0) => {
      const rStr = round ? (rawV).toFixed(round) : String(Math.round(rawV));
      const sStr = round ? (sumV).toFixed(round) : String(Math.round(sumV));
      const d    = pct(rawV, sumV);
      const col  = d > DIFF_THRESH && (rawV > 0 || sumV > 0) ? C.red : (rawV > 0 ? C.green : C.dim);
      return `${rStr.padStart(8)} ${col}${sStr.padStart(8)}${C.reset}`;
    };

    console.log(
      `${client.name.slice(0, 34).padEnd(35)} ` +
      `${fmt(rv.sessions, sv.sessions)} | ` +
      `${fmt(rv.seoClicks, sv.seoClicks, 0).slice(0,16)} | ` +
      `${fmt(rv.adSpend, sv.adSpend, 0)} | ` +
      `${fmt(rv.gbpCalls, sv.gbpCalls)}`
    );
  }
  console.log(`${'─'.repeat(110)}\n`);

  // ── Issues summary ───────────────────────────────────────────────────────
  if (issues.length === 0) {
    console.log(`${C.green}✓ Tất cả metrics khớp trong ngưỡng ${DIFF_THRESH * 100}%${C.reset}\n`);
  } else {
    console.log(`${C.red}✗ ${issues.length} discrepancies > ${DIFF_THRESH * 100}%:${C.reset}\n`);
    console.log('  ' + 'Client'.padEnd(35) + ' ' + 'Metric'.padEnd(22) + ' ' + 'Raw'.padStart(10) + ' ' + 'Summary'.padStart(10) + ' ' + 'Diff%'.padStart(7));
    console.log(`  ${'─'.repeat(87)}`);
    for (const i of issues.sort((a, b) => b.diff - a.diff)) {
      const col = i.diff > 20 ? C.red : C.yellow;
      console.log(`  ${i.client.slice(0,34).padEnd(35)} ${i.metric.padEnd(22)} ${String(i.raw).padStart(10)} ${String(i.summary).padStart(10)} ${col}${String(i.diff).padStart(6)}%${C.reset}`);
    }
    console.log();
  }

  // ── Root cause hints ──────────────────────────────────────────────────────
  const gscIssues = issues.filter(i => i.metric.includes('GSC'));
  const ga4Issues = issues.filter(i => i.metric.includes('GA4'));
  const gbpIssues = issues.filter(i => i.metric.includes('GBP'));
  const adsIssues = issues.filter(i => i.metric.includes('Ads'));

  if (gscIssues.length) console.log(`${C.yellow}⚠ GSC: ${gscIssues.length} clients lệch → rollup chưa đọc đúng từ gsc_daily_summary${C.reset}`);
  if (ga4Issues.length) console.log(`${C.yellow}⚠ GA4: ${ga4Issues.length} clients lệch → có thể rollup sum sai dimensions${C.reset}`);
  if (gbpIssues.length) console.log(`${C.yellow}⚠ GBP: ${gbpIssues.length} clients lệch → rollup chưa aggregate đúng locations${C.reset}`);
  if (adsIssues.length) console.log(`${C.yellow}⚠ Ads: ${adsIssues.length} clients lệch → rollup có vấn đề${C.reset}`);
  if (!issues.length)   console.log(`${C.green}✓ Rollup hoạt động chính xác — raw tables và summary khớp${C.reset}`);
  console.log();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
