import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 300;

/**
 * GET /api/cron/sync-bing
 * Daily cron: Sync Bing Webmaster Tools organic page stats → bing_page_stats
 *
 * Data source: BWT GetPageStats API (clicks / impressions / avg_position per page per day)
 *
 * AI Citations (bing_ai_citations / bing_ai_page_citations) are imported manually
 * via the Import AI Data modal — BWT API does not expose AI citation data.
 *
 * SQL (run once in Supabase if table doesn't exist):
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
 */

const BWT_API_KEY = process.env.BING_SEARCH_API_KEY || '';
const BWT_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

// Parse .NET JSON date: /Date(1731657600000-0800)/ → "2024-11-15"
function parseNetDate(dateStr: string): string {
  const ms = parseInt(dateStr.replace(/\/Date\((\d+)[+-].*\)\//, '$1'));
  return new Date(ms).toISOString().split('T')[0];
}

function extractDomain(url: string): string {
  return url
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase()
    .trim();
}

async function getBWTSites(): Promise<string[]> {
  const res = await fetch(`${BWT_BASE}/GetUserSites?apikey=${BWT_API_KEY}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.d || []).filter((s: any) => s.IsVerified).map((s: any) => s.Url as string);
}

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

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!BWT_API_KEY) {
    return NextResponse.json({ error: 'BING_SEARCH_API_KEY not set' }, { status: 500 });
  }

  const endParam = request.nextUrl.searchParams.get('endDate');
  const startParam = request.nextUrl.searchParams.get('startDate');
  const targetSlug = request.nextUrl.searchParams.get('slug');

  const endDate = endParam || (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();
  const startDate = startParam || (() => {
    const d = new Date(endDate); d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  })();

  console.log(`[sync-bing] ${startDate} → ${endDate}${targetSlug ? ` slug=${targetSlug}` : ''}`);

  const bwtSites = await getBWTSites();
  const bwtDomainMap = new Map<string, string>();
  for (const siteUrl of bwtSites) {
    bwtDomainMap.set(extractDomain(siteUrl), siteUrl);
  }

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
      const rows = await getBWTPageStats(bwtSiteUrl, startDate, endDate);
      if (rows.length === 0) {
        results[client.slug] = { rows: 0 };
        continue;
      }

      const upsertRows = rows
        .filter(r => r.page_url)
        .map(r => ({
          client_id: client.id,
          date: r.date,
          page_url: r.page_url,
          clicks: r.clicks,
          impressions: r.impressions,
          avg_position: r.avg_position,
        }));

      const { error } = await supabaseAdmin
        .from('bing_page_stats')
        .upsert(upsertRows, { onConflict: 'client_id,date,page_url' });

      results[client.slug] = error
        ? { error: error.message }
        : { rows: upsertRows.length };
    } catch (err: any) {
      results[client.slug] = { error: err.message };
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return NextResponse.json({ success: true, startDate, endDate, results });
}
