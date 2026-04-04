import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { JWT } from 'google-auth-library';

export const maxDuration = 300;

const MARCH_START = '2026-03-01';
const MARCH_END   = '2026-03-31';
const DIFF_THRESH = 0.05; // 5%

// ── auth ─────────────────────────────────────────────────────────────────────
async function getToken(scopes: string[]): Promise<string> {
  const key   = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  if (!key || !email) throw new Error('Missing GOOGLE_PRIVATE_KEY / GOOGLE_CLIENT_EMAIL');
  const jwt = new JWT({ email, key, scopes });
  const { token } = await jwt.getAccessToken();
  return token!;
}

// ── GA4: run a date-range report ──────────────────────────────────────────────
async function fetchGA4March(token: string, propertyId: string) {
  const url  = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const body = {
    dateRanges: [{ startDate: MARCH_START, endDate: MARCH_END }],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'conversions' },
    ],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GA4 ${res.status}: ${txt.slice(0, 150)}`);
  }
  const data = await res.json();
  if (!data.rows?.length) return { sessions: 0, users: 0, conversions: 0 };
  const v = data.rows[0].metricValues;
  return {
    sessions:    parseInt(v[0].value) || 0,
    users:       parseInt(v[1].value) || 0,
    conversions: parseInt(v[2].value) || 0,
  };
}

// ── Google Ads: GAQL aggregate for March ──────────────────────────────────────
async function fetchAdsMarch(token: string, customerId: string) {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const mccId    = process.env.GOOGLE_ADS_MCC_ID?.replace(/-|\s/g, '');
  if (!devToken) throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN');

  const gaql = `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '20260301' AND '20260331'
      AND campaign.status != 'REMOVED'
  `;
  const headers: Record<string, string> = {
    Authorization:     `Bearer ${token}`,
    'developer-token': devToken,
    'Content-Type':    'application/json',
  };
  if (mccId) headers['login-customer-id'] = mccId;

  const res = await fetch(
    `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:search`,
    { method: 'POST', headers, body: JSON.stringify({ query: gaql }), signal: AbortSignal.timeout(25000) }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Ads ${res.status}: ${txt.slice(0, 150)}`);
  }
  const data = await res.json();
  let impressions = 0, clicks = 0, costMicros = 0, conversions = 0;
  for (const r of data.results || []) {
    impressions += parseInt(r.metrics?.impressions || 0);
    clicks      += parseInt(r.metrics?.clicks      || 0);
    costMicros  += parseInt(r.metrics?.costMicros  || 0);
    conversions += parseFloat(r.metrics?.conversions || 0);
  }
  return {
    impressions,
    clicks,
    spend:       Math.round(costMicros / 1_000_000 * 100) / 100,
    conversions: Math.round(conversions),
  };
}

// ── GSC: aggregate query for March ────────────────────────────────────────────
async function fetchGSCMarch(token: string, siteUrl: string) {
  const url  = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const body = { startDate: MARCH_START, endDate: MARCH_END, rowLimit: 1, dataState: 'final' };
  const res  = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GSC ${res.status}: ${txt.slice(0, 150)}`);
  }
  const data = await res.json();
  const row  = data.rows?.[0];
  if (!row) return { clicks: 0, impressions: 0 };
  return { clicks: row.clicks || 0, impressions: row.impressions || 0 };
}

// ── Task 1: DB totals ─────────────────────────────────────────────────────────
async function readDB(clientIds: string[]) {
  const { data: rows, error } = await supabaseAdmin
    .from('client_metrics_summary')
    .select(`
      client_id,
      sessions, users,
      ad_spend, google_ads_conversions, ads_clicks, ads_impressions,
      seo_clicks, seo_impressions
    `)
    .eq('period_type', 'daily')
    .gte('date', MARCH_START)
    .lte('date', MARCH_END)
    .in('client_id', clientIds);

  if (error) throw new Error(`DB: ${error.message}`);

  const map = new Map<string, any>();
  for (const r of rows || []) {
    if (!map.has(r.client_id)) {
      map.set(r.client_id, { sessions: 0, users: 0, adSpend: 0, adsConversions: 0, adsClicks: 0, adsImpressions: 0, seoClicks: 0, seoImpressions: 0 });
    }
    const c = map.get(r.client_id)!;
    c.sessions        += r.sessions               || 0;
    c.users           += r.users                  || 0;
    c.adSpend         += r.ad_spend               || 0;
    c.adsConversions  += r.google_ads_conversions || 0;
    c.adsClicks       += r.ads_clicks             || 0;
    c.adsImpressions  += r.ads_impressions        || 0;
    c.seoClicks       += r.seo_clicks             || 0;
    c.seoImpressions  += r.seo_impressions        || 0;
  }
  return map;
}

// ── diff helpers ──────────────────────────────────────────────────────────────
function pct(a: number, b: number) {
  if (!a && !b) return 0;
  return Math.abs(a - b) / Math.max(a, b);
}

function diffRow(metric: string, db: number, api: number, clientName: string, issues: any[]) {
  const p = pct(db, api);
  if (p > DIFF_THRESH) issues.push({ client: clientName, metric, db: Math.round(db * 100) / 100, api: Math.round(api * 100) / 100, diffPct: Math.round(p * 1000) / 10 });
  return { db: Math.round(db * 100) / 100, api: Math.round(api * 100) / 100, diffPct: Math.round(p * 1000) / 10, ok: p <= DIFF_THRESH };
}

// ── main handler ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const onlySlug = request.nextUrl.searchParams.get('client');
  const startTime = Date.now();

  try {
    // ── load clients ─────────────────────────────────────────────────────────
    let query = supabaseAdmin
      .from('clients')
      .select('id, name, slug, service_configs(ga_property_id, gads_customer_id, gsc_site_url)')
      .eq('is_active', true)
      .order('name');

    if (onlySlug) (query as any) = (query as any).eq('slug', onlySlug);

    const { data: rawClients, error: ce } = await query;
    if (ce) throw new Error(`clients: ${ce.message}`);

    const clients = (rawClients || []).map((c: any) => {
      const sc = Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs;
      return {
        id:            c.id,
        name:          c.name,
        slug:          c.slug,
        ga4PropertyId: sc?.ga_property_id  || null,
        adsCustomerId: sc?.gads_customer_id?.replace(/-|\s/g, '') || null,
        gscSiteUrl:    sc?.gsc_site_url    || null,
      };
    });

    // ── get Google tokens + DB in parallel ────────────────────────────────────
    const [ga4Token, adsToken, gscToken, dbMap] = await Promise.allSettled([
      getToken(['https://www.googleapis.com/auth/analytics.readonly']),
      getToken(['https://www.googleapis.com/auth/adwords']),
      getToken(['https://www.googleapis.com/auth/webmasters.readonly']),
      readDB(clients.map((c: any) => c.id)),
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : null));

    const tokenErrors: string[] = [];
    if (!ga4Token) tokenErrors.push('GA4 token failed');
    if (!adsToken) tokenErrors.push('Ads token failed');
    if (!gscToken) tokenErrors.push('GSC token failed');

    // ── per-client API fetch + compare ────────────────────────────────────────
    const clientResults: any[] = [];
    const issues: any[] = [];

    // Process in batches of 3 to avoid hitting rate limits
    for (let i = 0; i < clients.length; i += 3) {
      const batch = clients.slice(i, i + 3) as any[];
      const batchResults = await Promise.all(batch.map(async (client: any) => {
        const db = (dbMap as Map<string, any>)?.get(client.id) || null;
        const result: any = { id: client.id, name: client.name, slug: client.slug, db, api: {}, diff: {} };

        // GA4
        if (client.ga4PropertyId && ga4Token) {
          try {
            const apiGA4 = await fetchGA4March(ga4Token as string, client.ga4PropertyId);
            result.api.ga4 = apiGA4;
            result.diff.sessions = diffRow('GA4 sessions', db?.sessions || 0, apiGA4.sessions, client.name, issues);
            result.diff.users    = diffRow('GA4 users',    db?.users    || 0, apiGA4.users,    client.name, issues);
          } catch (e: any) {
            result.api.ga4 = { error: e.message.slice(0, 100) };
          }
        } else if (!client.ga4PropertyId) {
          result.api.ga4 = { skipped: 'no GA4 property configured' };
        } else {
          result.api.ga4 = { skipped: 'no GA4 token' };
        }

        // Ads
        if (client.adsCustomerId && adsToken) {
          try {
            const apiAds = await fetchAdsMarch(adsToken as string, client.adsCustomerId);
            result.api.ads = apiAds;
            result.diff.adSpend = diffRow('Ads spend',  db?.adSpend  || 0, apiAds.spend,  client.name, issues);
            result.diff.adsClicks = diffRow('Ads clicks', db?.adsClicks || 0, apiAds.clicks, client.name, issues);
          } catch (e: any) {
            result.api.ads = { error: e.message.slice(0, 100) };
          }
        } else if (!client.adsCustomerId) {
          result.api.ads = { skipped: 'no Ads customer ID configured' };
        }

        // GSC
        if (client.gscSiteUrl && gscToken) {
          try {
            const apiGSC = await fetchGSCMarch(gscToken as string, client.gscSiteUrl);
            result.api.gsc = apiGSC;
            result.diff.seoClicks      = diffRow('GSC clicks',       db?.seoClicks      || 0, apiGSC.clicks,       client.name, issues);
            result.diff.seoImpressions = diffRow('GSC impressions',  db?.seoImpressions || 0, apiGSC.impressions,  client.name, issues);
          } catch (e: any) {
            result.api.gsc = { error: e.message.slice(0, 100) };
          }
        } else if (!client.gscSiteUrl) {
          result.api.gsc = { skipped: 'no GSC site URL configured' };
        }

        return result;
      }));
      clientResults.push(...batchResults);
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      range: { start: MARCH_START, end: MARCH_END },
      clients: clientResults.length,
      issueCount: issues.length,
      issues,          // ← top-level list of all discrepancies > 5%
      results: clientResults,
      tokenErrors,
      duration,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[compare-march]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
