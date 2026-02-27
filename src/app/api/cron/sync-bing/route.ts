import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 300;

/**
 * GET /api/cron/sync-bing
 * Daily cron: Sync Bing Webmaster Tools data (organic page stats) + Bing News mentions
 *
 * Data sources:
 *   - BWT GetPageStats   → bing_page_stats   (per-page clicks/impressions/position on Bing)
 *   - Bing News Search   → bing_news_mentions (brand news mentions)
 *
 * AI Citations (bing_ai_citations / bing_ai_page_citations) are imported manually
 * via POST /api/admin/import-bing-ai since BWT API doesn't expose AI data yet.
 *
 * SQL tables (run once in Supabase):
 *
 *   CREATE TABLE IF NOT EXISTS bing_page_stats (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
 *     date date NOT NULL,
 *     page_url text NOT NULL,
 *     clicks integer DEFAULT 0,
 *     impressions integer DEFAULT 0,
 *     avg_position decimal,
 *     created_at timestamptz DEFAULT now(),
 *     UNIQUE(client_id, date, page_url)
 *   );
 *
 *   CREATE TABLE IF NOT EXISTS bing_ai_citations (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
 *     date date NOT NULL,
 *     citations integer DEFAULT 0,
 *     cited_pages integer DEFAULT 0,
 *     created_at timestamptz DEFAULT now(),
 *     UNIQUE(client_id, date)
 *   );
 *
 *   CREATE TABLE IF NOT EXISTS bing_ai_page_citations (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
 *     page_url text NOT NULL,
 *     citations integer DEFAULT 0,
 *     updated_at timestamptz DEFAULT now(),
 *     UNIQUE(client_id, page_url)
 *   );
 *
 *   CREATE TABLE IF NOT EXISTS bing_news_mentions (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
 *     date date NOT NULL,
 *     headline text,
 *     url text,
 *     publisher text,
 *     published_at timestamptz,
 *     snippet text,
 *     created_at timestamptz DEFAULT now(),
 *     UNIQUE(client_id, url)
 *   );
 */

const BWT_API_KEY = process.env.BING_SEARCH_API_KEY || '';
const BWT_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';
const BING_NEWS_URL = 'https://api.bing.microsoft.com/v7.0/news/search';

// Parse .NET JSON date: /Date(1731657600000-0800)/ → "2024-11-15"
function parseNetDate(dateStr: string): string {
  const ms = parseInt(dateStr.replace(/\/Date\((\d+)[+-].*\)\//, '$1'));
  return new Date(ms).toISOString().split('T')[0];
}

// Extract clean domain from gsc_site_url for matching with BWT site URL
function extractDomain(url: string): string {
  return url
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase()
    .trim();
}

// Fetch Bing Webmaster Tools page stats for a site
async function getBWTPageStats(siteUrl: string, startDate: string, endDate: string): Promise<Array<{
  page_url: string; clicks: number; impressions: number; avg_position: number | null; date: string;
}>> {
  const url = `${BWT_BASE}/GetPageStats?apikey=${BWT_API_KEY}&siteUrl=${encodeURIComponent(siteUrl)}&startDate=${startDate}&endDate=${endDate}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.d || []).map((row: any) => ({
    page_url: row.Query || '',
    clicks: row.Clicks || 0,
    impressions: row.Impressions || 0,
    avg_position: row.AvgImpressionPosition > 0 ? row.AvgImpressionPosition : null,
    date: parseNetDate(row.Date || '/Date(0)/'),
  }));
}

// Fetch all BWT verified sites
async function getBWTSites(): Promise<string[]> {
  const url = `${BWT_BASE}/GetUserSites?apikey=${BWT_API_KEY}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.d || []).filter((s: any) => s.IsVerified).map((s: any) => s.Url as string);
}

// Fetch Bing News for a brand name
async function getBingNews(brandName: string): Promise<Array<{
  headline: string; url: string; publisher: string; published_at: string; snippet: string;
}>> {
  try {
    const q = encodeURIComponent(`"${brandName}"`);
    const res = await fetch(`${BING_NEWS_URL}?q=${q}&count=10&freshness=Month&mkt=en-US`, {
      headers: { 'Ocp-Apim-Subscription-Key': BWT_API_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.value || []).map((item: any) => ({
      headline: item.name || '',
      url: item.url || '',
      publisher: item.provider?.[0]?.name || '',
      published_at: item.datePublished || new Date().toISOString(),
      snippet: item.description || '',
    }));
  } catch { return []; }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!BWT_API_KEY) {
    return NextResponse.json({ error: 'BING_SEARCH_API_KEY not set' }, { status: 500 });
  }

  // Date range: yesterday back 30 days (or custom for backfill)
  const endParam = request.nextUrl.searchParams.get('endDate');
  const startParam = request.nextUrl.searchParams.get('startDate');
  const targetSlug = request.nextUrl.searchParams.get('slug');

  const endDate = endParam || (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();
  const startDate = startParam || (() => {
    const d = new Date(endDate); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  })();

  console.log(`[sync-bing] ${startDate} → ${endDate}${targetSlug ? ` slug=${targetSlug}` : ''}`);

  // 1. Get all BWT verified sites
  const bwtSites = await getBWTSites();
  const bwtDomainMap = new Map<string, string>(); // domain → full BWT siteUrl
  for (const siteUrl of bwtSites) {
    const domain = extractDomain(siteUrl);
    bwtDomainMap.set(domain, siteUrl);
  }

  // 2. Get active clients with GSC site URL
  let clientsQuery = supabaseAdmin
    .from('clients')
    .select('id, name, slug, service_configs(gsc_site_url)')
    .eq('is_active', true);
  if (targetSlug) clientsQuery = clientsQuery.eq('slug', targetSlug);
  const { data: clients } = await clientsQuery;

  const results: Record<string, any> = {};

  for (const client of clients || []) {
    const cfg = Array.isArray(client.service_configs) ? client.service_configs[0] : client.service_configs;
    const gscUrl = cfg?.gsc_site_url || '';
    if (!gscUrl) { results[client.slug] = { skip: 'no gsc_site_url' }; continue; }

    const domain = extractDomain(gscUrl);
    const bwtSiteUrl = bwtDomainMap.get(domain);
    if (!bwtSiteUrl) { results[client.slug] = { skip: `domain ${domain} not in BWT` }; continue; }

    try {
      // ── Bing page stats ──
      const pageStats = await getBWTPageStats(bwtSiteUrl, startDate, endDate);
      if (pageStats.length > 0) {
        const rows = pageStats.map(r => ({
          client_id: client.id,
          date: r.date,
          page_url: r.page_url,
          clicks: r.clicks,
          impressions: r.impressions,
          avg_position: r.avg_position,
        }));
        // Batch upsert in chunks of 500
        for (let i = 0; i < rows.length; i += 500) {
          await supabaseAdmin.from('bing_page_stats').upsert(rows.slice(i, i + 500), { onConflict: 'client_id,date,page_url' });
        }
      }

      // ── Bing news ──
      const news = await getBingNews(client.name);
      if (news.length > 0) {
        await supabaseAdmin.from('bing_news_mentions').upsert(
          news.map(n => ({ client_id: client.id, date: endDate, ...n })),
          { onConflict: 'client_id,url' }
        );
      }

      results[client.slug] = {
        bwtSite: bwtSiteUrl,
        pageStatsRows: pageStats.length,
        newsFound: news.length,
      };
    } catch (err: any) {
      results[client.slug] = { error: err.message };
    }

    // Small delay between clients
    await new Promise(r => setTimeout(r, 500));
  }

  return NextResponse.json({ success: true, startDate, endDate, results });
}
