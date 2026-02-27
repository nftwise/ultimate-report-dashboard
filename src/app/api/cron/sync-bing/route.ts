import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 300;

/**
 * GET /api/cron/sync-bing
 * Daily cron: Sync Bing search rankings + news mentions per client
 *
 * Tables used:
 *   bing_search_rankings (client_id, date, query, position, page_title, page_url)
 *   bing_news_mentions   (client_id, date, headline, url, publisher, published_at)
 *
 * SQL to create tables (run once in Supabase SQL editor):
 *
 *   CREATE TABLE IF NOT EXISTS bing_search_rankings (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
 *     date date NOT NULL,
 *     query text NOT NULL,
 *     position integer,
 *     page_title text,
 *     page_url text,
 *     created_at timestamptz DEFAULT now(),
 *     UNIQUE(client_id, date, query)
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

const BING_API_KEY = process.env.BING_SEARCH_API_KEY || '';
const BING_SEARCH_URL = 'https://api.bing.microsoft.com/v7.0/search';
const BING_NEWS_URL = 'https://api.bing.microsoft.com/v7.0/news/search';
const RESULTS_PER_QUERY = 20;
const TOP_KEYWORDS = 10;
const BATCH_SIZE = 2; // clients per batch to avoid rate limits

// Extract clean domain from various URL formats
function extractDomain(url: string): string {
  return url
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase()
    .trim();
}

// Search Bing for a query, return position of client's domain (1-based, null if not found)
async function getBingPosition(query: string, domain: string): Promise<{
  position: number | null;
  page_title: string | null;
  page_url: string | null;
}> {
  try {
    const url = `${BING_SEARCH_URL}?q=${encodeURIComponent(query)}&count=${RESULTS_PER_QUERY}&responseFilter=Webpages&mkt=en-US`;
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': BING_API_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { position: null, page_title: null, page_url: null };
    const data = await res.json();
    const pages: any[] = data?.webPages?.value || [];
    for (let i = 0; i < pages.length; i++) {
      const pageUrl = (pages[i].url || '').toLowerCase();
      const display = (pages[i].displayUrl || '').toLowerCase();
      if (pageUrl.includes(domain) || display.includes(domain)) {
        return {
          position: i + 1,
          page_title: pages[i].name || null,
          page_url: pages[i].url || null,
        };
      }
    }
    return { position: null, page_title: null, page_url: null };
  } catch {
    return { position: null, page_title: null, page_url: null };
  }
}

// Fetch Bing News mentions for a brand name
async function getBingNews(brandName: string): Promise<Array<{
  headline: string;
  url: string;
  publisher: string;
  published_at: string;
  snippet: string;
}>> {
  try {
    const query = `"${brandName}"`;
    const url = `${BING_NEWS_URL}?q=${encodeURIComponent(query)}&count=10&freshness=Month&mkt=en-US`;
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': BING_API_KEY },
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
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!BING_API_KEY) {
    return NextResponse.json({ error: 'BING_SEARCH_API_KEY not set' }, { status: 500 });
  }

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  // Allow targeting a specific client via query param (for backfill/testing)
  const targetSlug = request.nextUrl.searchParams.get('slug');
  const dateParam = request.nextUrl.searchParams.get('date') || today;

  console.log(`[sync-bing] Starting for ${dateParam}${targetSlug ? ` (slug: ${targetSlug})` : ''}`);

  // Fetch clients with GSC site URL (used to extract domain)
  let clientsQuery = supabaseAdmin
    .from('clients')
    .select('id, name, slug, service_configs(gsc_site_url)')
    .eq('is_active', true);
  if (targetSlug) clientsQuery = clientsQuery.eq('slug', targetSlug);

  const { data: clients, error: clientsError } = await clientsQuery;
  if (clientsError || !clients?.length) {
    return NextResponse.json({ error: 'No clients found', detail: clientsError?.message }, { status: 500 });
  }

  const results: Record<string, any> = {};

  for (let i = 0; i < clients.length; i += BATCH_SIZE) {
    const batch = clients.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (client: any) => {
      const cfg = Array.isArray(client.service_configs) ? client.service_configs[0] : client.service_configs;
      const rawSiteUrl = cfg?.gsc_site_url || '';
      if (!rawSiteUrl) {
        results[client.slug] = { skipped: true, reason: 'no gsc_site_url' };
        return;
      }
      const domain = extractDomain(rawSiteUrl);
      console.log(`[sync-bing] ${client.name} → domain: ${domain}`);

      // ── 1. Get top keywords from gsc_queries (last 30 days) ──
      const { data: keywords } = await supabaseAdmin
        .from('gsc_queries')
        .select('query, clicks')
        .eq('client_id', client.id)
        .gte('date', thirtyDaysAgoStr)
        .order('clicks', { ascending: false })
        .limit(TOP_KEYWORDS * 3); // over-fetch then deduplicate

      // Deduplicate queries (take highest-click version per unique query text)
      const seenQueries = new Set<string>();
      const topQueries: string[] = [];
      for (const kw of (keywords || [])) {
        const q = (kw.query || '').toLowerCase().trim();
        if (q && !seenQueries.has(q)) {
          seenQueries.add(q);
          topQueries.push(kw.query);
          if (topQueries.length >= TOP_KEYWORDS) break;
        }
      }

      if (!topQueries.length) {
        results[client.slug] = { skipped: true, reason: 'no keywords in gsc_queries' };
        return;
      }

      // ── 2. Check Bing position for each keyword ──
      const rankingRows: any[] = [];
      for (const query of topQueries) {
        const { position, page_title, page_url } = await getBingPosition(query, domain);
        rankingRows.push({
          client_id: client.id,
          date: dateParam,
          query,
          position,
          page_title,
          page_url,
        });
        // Small delay to avoid rate-limiting
        await new Promise(r => setTimeout(r, 300));
      }

      // Upsert rankings
      const { error: rankError } = await supabaseAdmin
        .from('bing_search_rankings')
        .upsert(rankingRows, { onConflict: 'client_id,date,query' });

      // ── 3. Fetch Bing News mentions ──
      const news = await getBingNews(client.name);
      if (news.length) {
        const newsRows = news.map(n => ({
          client_id: client.id,
          date: dateParam,
          ...n,
        }));
        await supabaseAdmin
          .from('bing_news_mentions')
          .upsert(newsRows, { onConflict: 'client_id,url' });
      }

      results[client.slug] = {
        domain,
        keywords_checked: rankingRows.length,
        ranked: rankingRows.filter(r => r.position !== null).length,
        news_found: news.length,
        rank_error: rankError?.message,
      };
    }));
  }

  console.log('[sync-bing] Done', results);
  return NextResponse.json({ success: true, date: dateParam, results });
}
