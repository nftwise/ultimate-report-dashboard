#!/usr/bin/env node
/**
 * compare-march-2026.mjs
 *
 * Runs 2 tasks in parallel:
 *   Task 1 — DB:  reads client_metrics_summary (March 2026) per client
 *   Task 2 — API: calls GA4, Google Ads, GSC live APIs for March 2026 totals per client
 *
 * Then diffs the two results and flags any discrepancy > 5%.
 *
 * Usage:
 *   node scripts/compare-march-2026.mjs
 *   node scripts/compare-march-2026.mjs --client=some-slug   # single client
 *   node scripts/compare-march-2026.mjs --ga4-only
 *   node scripts/compare-march-2026.mjs --ads-only
 *   node scripts/compare-march-2026.mjs --gsc-only
 */

import { createClient } from '@supabase/supabase-js';
import { JWT } from 'google-auth-library';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── load .env.local ──────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dir, '../.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && !k.startsWith('#') && !process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim();
      }
    }
  } catch {}
}
loadEnv();

// ── config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';
const MARCH_START   = '2026-03-01';
const MARCH_END     = '2026-03-31';
const DIFF_THRESH   = 0.05;   // 5% tolerance

const ONLY_CLIENT = process.argv.find(a => a.startsWith('--client='))?.split('=')[1];
const GA4_ONLY    = process.argv.includes('--ga4-only');
const ADS_ONLY    = process.argv.includes('--ads-only');
const GSC_ONLY    = process.argv.includes('--gsc-only');
const RUN_ALL     = !GA4_ONLY && !ADS_ONLY && !GSC_ONLY;

// ── colors ───────────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',  bold:   '\x1b[1m',
  red:    '\x1b[31m', green:  '\x1b[32m',
  yellow: '\x1b[33m', cyan:   '\x1b[36m',
  blue:   '\x1b[34m', dim:    '\x1b[2m',
};
const ok   = msg => console.log(`${C.green}✓${C.reset} ${msg}`);
const warn = msg => console.log(`${C.yellow}⚠${C.reset} ${msg}`);
const err  = msg => console.log(`${C.red}✗${C.reset} ${msg}`);
const info = msg => console.log(`${C.blue}ℹ${C.reset} ${msg}`);
const sec  = msg => console.log(`\n${C.bold}${C.cyan}══ ${msg} ══${C.reset}`);

// ── supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── google auth ───────────────────────────────────────────────────────────────
async function getGA4Token() {
  const key   = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  if (!key || !email) return null;
  const jwt = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/analytics.readonly'] });
  const { token } = await jwt.getAccessToken();
  return token;
}

async function getAdsToken() {
  const key   = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  if (!key || !email) return null;
  const jwt = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/adwords'] });
  const res = await jwt.authorize();
  return res.access_token;
}

async function getGSCToken() {
  const key   = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  if (!key || !email) return null;
  const jwt = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
  const { token } = await jwt.getAccessToken();
  return token;
}

// ── GA4 API helpers ──────────────────────────────────────────────────────────
async function fetchGA4MarchTotals(token, propertyId) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const body = {
    dateRanges: [{ startDate: MARCH_START, endDate: MARCH_END }],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'conversions' },
    ],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GA4 API ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.rows?.length) return { sessions: 0, users: 0, newUsers: 0, conversions: 0 };
  const v = data.rows[0].metricValues;
  return {
    sessions:    parseInt(v[0].value || 0),
    users:       parseInt(v[1].value || 0),
    newUsers:    parseInt(v[2].value || 0),
    conversions: parseInt(v[3].value || 0),
  };
}

// ── Google Ads API helpers ────────────────────────────────────────────────────
async function fetchAdsMarchTotals(token, customerId) {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const mccId    = process.env.GOOGLE_ADS_MCC_ID;
  if (!devToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not set');

  const startYmd = MARCH_START.replace(/-/g, '');
  const endYmd   = MARCH_END.replace(/-/g, '');

  const gaql = `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${startYmd}' AND '${endYmd}'
      AND campaign.status != 'REMOVED'
  `;

  const headers = {
    Authorization:          `Bearer ${token}`,
    'developer-token':      devToken,
    'Content-Type':         'application/json',
  };
  if (mccId) headers['login-customer-id'] = mccId.replace(/-/g, '');

  const res = await fetch(
    `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:search`,
    {
      method:  'POST',
      headers,
      body:    JSON.stringify({ query: gaql }),
      signal:  AbortSignal.timeout(20000),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Ads API ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const rows = data.results || [];

  let impressions = 0, clicks = 0, cost = 0, conversions = 0;
  for (const r of rows) {
    impressions += parseInt(r.metrics?.impressions || 0);
    clicks      += parseInt(r.metrics?.clicks      || 0);
    cost        += parseInt(r.metrics?.costMicros  || 0);
    conversions += parseFloat(r.metrics?.conversions || 0);
  }
  return {
    impressions,
    clicks,
    cost: Math.round(cost / 1_000_000 * 100) / 100,  // micros → dollars
    conversions: Math.round(conversions),
  };
}

// ── GSC API helpers ───────────────────────────────────────────────────────────
async function fetchGSCMarchTotals(token, siteUrl) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const body = {
    startDate:    MARCH_START,
    endDate:      MARCH_END,
    rowLimit:     1,
    dataState:    'final',
  };
  const res = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GSC API ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  // Without dimensions, GSC returns a single aggregated row
  const row = data.rows?.[0];
  if (!row) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return {
    clicks:      row.clicks     || 0,
    impressions: row.impressions|| 0,
    ctr:         Math.round((row.ctr || 0) * 10000) / 100,
    position:    Math.round((row.position || 0) * 10) / 10,
  };
}

// ── Task 1: DB ────────────────────────────────────────────────────────────────
async function taskDB(clients) {
  sec('TASK 1 — DATABASE (client_metrics_summary, March 2026)');

  // Sum all daily rows for March per client
  const { data: rows, error } = await supabase
    .from('client_metrics_summary')
    .select(`
      client_id, date,
      sessions, users, new_users,
      ad_spend, google_ads_conversions, ads_clicks, ads_impressions,
      seo_clicks, seo_impressions, seo_ctr,
      gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views
    `)
    .eq('period_type', 'daily')
    .gte('date', MARCH_START)
    .lte('date', MARCH_END);

  if (error) throw new Error(`DB query failed: ${error.message}`);

  const byClient = new Map();
  for (const r of rows || []) {
    if (!byClient.has(r.client_id)) {
      byClient.set(r.client_id, {
        days: 0,
        sessions: 0, users: 0, newUsers: 0,
        adSpend: 0, adsConversions: 0, adsClicks: 0, adsImpressions: 0,
        seoClicks: 0, seoImpressions: 0,
        gbpCalls: 0, gbpClicks: 0, gbpDirs: 0, gbpViews: 0,
      });
    }
    const c = byClient.get(r.client_id);
    c.days++;
    c.sessions       += r.sessions         || 0;
    c.users          += r.users            || 0;
    c.newUsers       += r.new_users        || 0;
    c.adSpend        += r.ad_spend         || 0;
    c.adsConversions += r.google_ads_conversions || 0;
    c.adsClicks      += r.ads_clicks       || 0;
    c.adsImpressions += r.ads_impressions  || 0;
    c.seoClicks      += r.seo_clicks       || 0;
    c.seoImpressions += r.seo_impressions  || 0;
    c.gbpCalls       += r.gbp_calls        || 0;
    c.gbpClicks      += r.gbp_website_clicks || 0;
    c.gbpDirs        += r.gbp_directions   || 0;
    c.gbpViews       += r.gbp_profile_views|| 0;
  }

  info(`DB: ${rows?.length || 0} daily rows across ${byClient.size} clients`);

  const result = {};
  for (const client of clients) {
    result[client.id] = byClient.get(client.id) || null;
  }
  return result;
}

// ── Task 2: Live APIs ─────────────────────────────────────────────────────────
async function taskAPIs(clients, ga4Token, adsToken, gscToken) {
  sec('TASK 2 — LIVE APIS (Google GA4 + Ads + GSC, March 2026)');

  const result = {};

  for (const client of clients) {
    const entry = { ga4: null, ads: null, gsc: null };

    // GA4
    if ((RUN_ALL || GA4_ONLY) && client.ga4PropertyId && ga4Token) {
      try {
        entry.ga4 = await fetchGA4MarchTotals(ga4Token, client.ga4PropertyId);
        info(`  [GA4] ${client.name}: sessions=${entry.ga4.sessions}`);
      } catch (e) {
        warn(`  [GA4] ${client.name}: ${e.message.slice(0, 100)}`);
        entry.ga4 = { error: e.message.slice(0, 80) };
      }
    }

    // Ads
    if ((RUN_ALL || ADS_ONLY) && client.adsCustomerId && adsToken) {
      try {
        entry.ads = await fetchAdsMarchTotals(adsToken, client.adsCustomerId);
        info(`  [Ads] ${client.name}: spend=$${entry.ads.cost}, clicks=${entry.ads.clicks}`);
      } catch (e) {
        warn(`  [Ads] ${client.name}: ${e.message.slice(0, 100)}`);
        entry.ads = { error: e.message.slice(0, 80) };
      }
    }

    // GSC
    if ((RUN_ALL || GSC_ONLY) && client.gscSiteUrl && gscToken) {
      try {
        entry.gsc = await fetchGSCMarchTotals(gscToken, client.gscSiteUrl);
        info(`  [GSC] ${client.name}: clicks=${entry.gsc.clicks}, impressions=${entry.gsc.impressions}`);
      } catch (e) {
        warn(`  [GSC] ${client.name}: ${e.message.slice(0, 100)}`);
        entry.gsc = { error: e.message.slice(0, 80) };
      }
    }

    result[client.id] = entry;
  }

  return result;
}

// ── Diff helper ───────────────────────────────────────────────────────────────
function diffPct(a, b) {
  if (!a && !b) return 0;
  if (!b) return a > 0 ? 1 : 0;
  return Math.abs(a - b) / Math.max(a, b);
}

function diffStr(db, api) {
  if (api == null) return `${C.dim}(no API)${C.reset}`;
  const pct = diffPct(db, api);
  const delta = db - api;
  const sign  = delta >= 0 ? '+' : '';
  const color = pct > DIFF_THRESH ? C.red : (pct > 0.01 ? C.yellow : C.green);
  return `DB=${db} API=${api} ${color}(${sign}${delta}, ${(pct*100).toFixed(1)}%)${C.reset}`;
}

// ── Compare & print ───────────────────────────────────────────────────────────
function compare(clients, dbData, apiData) {
  sec('COMPARISON — DB vs Live API (March 2026)');

  const issues = [];

  for (const client of clients) {
    const db  = dbData[client.id];
    const api = apiData[client.id];

    if (!db && !api?.ga4 && !api?.ads && !api?.gsc) continue;

    console.log(`\n${C.bold}${client.name}${C.reset} (${client.slug})`);

    // GA4
    if (RUN_ALL || GA4_ONLY) {
      if (api?.ga4?.error) {
        warn(`  GA4 API error: ${api.ga4.error}`);
      } else if (api?.ga4 && db) {
        const sessionPct = diffPct(db.sessions, api.ga4.sessions);
        console.log(`  GA4 sessions:  ${diffStr(db.sessions, api.ga4.sessions)}`);
        console.log(`  GA4 users:     ${diffStr(db.users, api.ga4.users)}`);
        if (sessionPct > DIFF_THRESH) {
          issues.push({ client: client.name, metric: 'GA4 sessions', db: db.sessions, api: api.ga4.sessions, pct: sessionPct });
        }
      } else if (!api?.ga4 && db?.sessions > 0) {
        warn(`  GA4: DB has ${db.sessions} sessions but no GA4 property configured`);
      } else if (!db && api?.ga4?.sessions > 0) {
        err(`  GA4: API has ${api.ga4.sessions} sessions but DB is EMPTY`);
        issues.push({ client: client.name, metric: 'GA4 sessions', db: 0, api: api.ga4.sessions, pct: 1 });
      }
    }

    // Ads
    if (RUN_ALL || ADS_ONLY) {
      if (api?.ads?.error) {
        warn(`  Ads API error: ${api.ads.error}`);
      } else if (api?.ads && db) {
        const spendPct = diffPct(db.adSpend, api.ads.cost);
        console.log(`  Ads spend:     ${diffStr(Math.round(db.adSpend * 100)/100, api.ads.cost)}`);
        console.log(`  Ads clicks:    ${diffStr(db.adsClicks, api.ads.clicks)}`);
        console.log(`  Ads conv:      ${diffStr(db.adsConversions, api.ads.conversions)}`);
        if (spendPct > DIFF_THRESH) {
          issues.push({ client: client.name, metric: 'Ads spend', db: db.adSpend, api: api.ads.cost, pct: spendPct });
        }
      } else if (!api?.ads && db?.adSpend > 0) {
        warn(`  Ads: DB has $${db.adSpend.toFixed(2)} spend but no Ads customer ID`);
      } else if (!db && api?.ads?.cost > 0) {
        err(`  Ads: API has $${api.ads.cost} spend but DB is EMPTY`);
        issues.push({ client: client.name, metric: 'Ads spend', db: 0, api: api.ads.cost, pct: 1 });
      }
    }

    // GSC
    if (RUN_ALL || GSC_ONLY) {
      if (api?.gsc?.error) {
        warn(`  GSC API error: ${api.gsc.error}`);
      } else if (api?.gsc && db) {
        const clickPct = diffPct(db.seoClicks, api.gsc.clicks);
        console.log(`  GSC clicks:    ${diffStr(db.seoClicks, api.gsc.clicks)}`);
        console.log(`  GSC impress:   ${diffStr(db.seoImpressions, api.gsc.impressions)}`);
        if (clickPct > DIFF_THRESH) {
          issues.push({ client: client.name, metric: 'GSC clicks', db: db.seoClicks, api: api.gsc.clicks, pct: clickPct });
        }
      } else if (!db && api?.gsc?.clicks > 0) {
        err(`  GSC: API has ${api.gsc.clicks} clicks but DB is EMPTY`);
        issues.push({ client: client.name, metric: 'GSC clicks', db: 0, api: api.gsc.clicks, pct: 1 });
      }
    }
  }

  // Summary
  sec('SUMMARY');
  if (issues.length === 0) {
    ok('All metrics match within 5% tolerance!');
  } else {
    err(`Found ${issues.length} discrepancies > 5%:\n`);
    console.log(
      `  ${'Client'.padEnd(30)} ${'Metric'.padEnd(20)} ${'DB'.padEnd(12)} ${'API'.padEnd(12)} Diff`
    );
    console.log('  ' + '─'.repeat(80));
    for (const i of issues) {
      const pctStr = `${(i.pct * 100).toFixed(1)}%`;
      const color  = i.pct > 0.2 ? C.red : C.yellow;
      console.log(
        `  ${i.client.slice(0,29).padEnd(30)} ${i.metric.padEnd(20)} ${String(i.db).padEnd(12)} ${String(i.api).padEnd(12)} ${color}${pctStr}${C.reset}`
      );
    }
  }

  return issues;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════╗`);
  console.log(`║  DB vs API COMPARISON — MARCH 2026           ║`);
  console.log(`╚══════════════════════════════════════════════╝${C.reset}\n`);
  console.log(`Range:  ${MARCH_START} → ${MARCH_END}`);
  console.log(`Filter: ${ONLY_CLIENT || 'all clients'}`);
  console.log(`Mode:   ${GA4_ONLY ? 'GA4 only' : ADS_ONLY ? 'Ads only' : GSC_ONLY ? 'GSC only' : 'GA4 + Ads + GSC'}\n`);

  // 1. Load clients + their service configs
  const { data: rawClients, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, slug, has_seo, has_ads, service_configs(ga_property_id, gads_customer_id, gsc_site_url)')
    .eq('is_active', true)
    .order('name');

  if (clientErr) { err(`Failed to fetch clients: ${clientErr.message}`); process.exit(1); }

  let clients = (rawClients || []).map(c => {
    const sc = Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs;
    return {
      id:            c.id,
      name:          c.name,
      slug:          c.slug,
      hasSeo:        c.has_seo,
      hasAds:        c.has_ads,
      ga4PropertyId: sc?.ga_property_id || null,
      adsCustomerId: sc?.gads_customer_id?.replace(/-|\s/g, '') || null,
      gscSiteUrl:    sc?.gsc_site_url || null,
    };
  });

  if (ONLY_CLIENT) {
    clients = clients.filter(c => c.slug === ONLY_CLIENT);
    if (!clients.length) { err(`Client not found: ${ONLY_CLIENT}`); process.exit(1); }
  }

  info(`Loaded ${clients.length} clients`);

  const ga4Clients = clients.filter(c => c.ga4PropertyId);
  const adsClients = clients.filter(c => c.adsCustomerId);
  const gscClients = clients.filter(c => c.gscSiteUrl);
  info(`GA4 property configured: ${ga4Clients.length}`);
  info(`Ads customer configured: ${adsClients.length}`);
  info(`GSC site configured:     ${gscClients.length}\n`);

  // 2. Get Google tokens + DB in parallel
  info('Authenticating with Google + reading DB in parallel...\n');
  const [ga4Token, adsToken, gscToken] = await Promise.all([
    (RUN_ALL || GA4_ONLY) ? getGA4Token().catch(e => { warn(`GA4 auth: ${e.message}`); return null; }) : null,
    (RUN_ALL || ADS_ONLY) ? getAdsToken().catch(e => { warn(`Ads auth: ${e.message}`); return null; }) : null,
    (RUN_ALL || GSC_ONLY) ? getGSCToken().catch(e => { warn(`GSC auth: ${e.message}`); return null; }) : null,
  ]);

  if (!ga4Token && (RUN_ALL || GA4_ONLY)) warn('GA4 token unavailable — GA4 comparison skipped');
  if (!adsToken && (RUN_ALL || ADS_ONLY)) warn('Ads token unavailable — Ads comparison skipped');
  if (!gscToken && (RUN_ALL || GSC_ONLY)) warn('GSC token unavailable — GSC comparison skipped');

  // 3. Run both tasks in parallel
  const [dbData, apiData] = await Promise.all([
    taskDB(clients),
    taskAPIs(clients, ga4Token, adsToken, gscToken),
  ]);

  // 4. Compare
  const issues = compare(clients, dbData, apiData);

  process.exit(issues.length > 0 ? 1 : 0);
}

main().catch(e => { err(`Fatal: ${e.message}`); console.error(e); process.exit(1); });
