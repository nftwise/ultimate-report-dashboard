import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { JWT } from 'google-auth-library';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BATCH_SIZE = 3;
const DAYS = parseInt(process.argv.find(a => a.startsWith('--days='))?.split('=')[1] || '90');

async function main() {
  console.log(`=== GSC Backfill (${DAYS} days) ===\n`);

  // Auth
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  if (!privateKey || !clientEmail) throw new Error('Missing GOOGLE_PRIVATE_KEY or GOOGLE_CLIENT_EMAIL');

  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const tokenResponse = await auth.getAccessToken();
  const token = tokenResponse.token || '';

  // Fetch clients with GSC config (include city for local query filtering)
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, slug, city, service_configs(gsc_site_url)')
    .eq('is_active', true);

  const clientsWithGSC = (clients || [])
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city || '',
      siteUrl: (Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs)?.gsc_site_url,
    }))
    .filter((c: any) => c.siteUrl);

  console.log(`Clients with GSC: ${clientsWithGSC.length}`);
  clientsWithGSC.forEach(c => console.log(`  - ${c.name} (${c.siteUrl})`));

  // Generate dates (GSC has 3-day delay, so start from 4 days ago)
  const dates: string[] = [];
  for (let i = 4; i < DAYS + 4; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  dates.reverse(); // oldest first

  console.log(`\nDate range: ${dates[0]} → ${dates[dates.length - 1]} (${dates.length} days)\n`);

  const startTime = Date.now();
  let totalQueries = 0;
  let totalPages = 0;

  for (let di = 0; di < dates.length; di++) {
    const date = dates[di];
    let dayQueries = 0;
    let dayPages = 0;

    // Process clients in batches
    for (let i = 0; i < clientsWithGSC.length; i += BATCH_SIZE) {
      const batch = clientsWithGSC.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (client) => {
        try {
          const [allQueries, allPages] = await Promise.all([
            fetchGSCQueries(token, client.siteUrl, date, client.id),
            fetchGSCPages(token, client.siteUrl, date, client.id),
          ]);

          // LAYER 1: Save daily totals to gsc_daily_summary before filtering
          if (allQueries.length > 0) {
            const { error: summaryError } = await supabase.from('gsc_daily_summary').upsert({
              client_id: client.id,
              site_url: client.siteUrl,
              date,
              total_impressions: allQueries.reduce((s: number, q: any) => s + (q.impressions || 0), 0),
              total_clicks: allQueries.reduce((s: number, q: any) => s + (q.clicks || 0), 0),
              top_keywords_count: allQueries.filter((q: any) => (q.position || 999) <= 10).length,
            }, { onConflict: 'client_id,site_url,date' });
            if (summaryError) console.error(`  [${client.slug}] summary upsert error:`, summaryError.message);
          }

          // LAYER 2: Filter queries — top 50 by impressions + city-related queries for google_rank
          const cityKeyword = client.city ? client.city.split(',')[0].toLowerCase().trim() : '';
          const top50 = [...allQueries].sort((a: any, b: any) => (b.impressions || 0) - (a.impressions || 0)).slice(0, 50);
          const seen = new Set(top50.map((q: any) => q.query));
          const cityQueries = cityKeyword
            ? allQueries.filter((q: any) => !seen.has(q.query) && q.query.toLowerCase().includes(cityKeyword))
            : [];
          const filteredQueries = [...top50, ...cityQueries];

          if (filteredQueries.length > 0) {
            for (let j = 0; j < filteredQueries.length; j += 500) {
              const chunk = filteredQueries.slice(j, j + 500);
              const { error } = await supabase.from('gsc_queries').upsert(chunk, { onConflict: 'client_id,site_url,date,query' });
              if (error) console.error(`  [${client.slug}] queries upsert error:`, error.message);
            }
          }

          // Only store top 5 pages by clicks per client/day
          const topPages = [...allPages].sort((a: any, b: any) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 5);
          if (topPages.length > 0) {
            const { error } = await supabase.from('gsc_pages').upsert(topPages, { onConflict: 'client_id,site_url,date,page' });
            if (error) console.error(`  [${client.slug}] pages upsert error:`, error.message);
          }

          return { queries: filteredQueries.length, pages: topPages.length };
        } catch (err: any) {
          if (!err.message?.includes('403')) {
            console.error(`  [${client.slug}] ${err.message}`);
          }
          return { queries: 0, pages: 0 };
        }
      }));

      results.forEach(r => {
        dayQueries += r.queries;
        dayPages += r.pages;
      });
    }

    totalQueries += dayQueries;
    totalPages += dayPages;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const pct = Math.round(((di + 1) / dates.length) * 100);
    console.log(`[${pct}%] ${date} - ${dayQueries}q + ${dayPages}p (${di + 1}/${dates.length}, ${elapsed}s)`);
  }

  console.log(`\n========== SUMMARY ==========`);
  console.log(`  Clients: ${clientsWithGSC.length}`);
  console.log(`  Days: ${dates.length}`);
  console.log(`  Total queries: ${totalQueries}`);
  console.log(`  Total pages: ${totalPages}`);
  console.log(`  Duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
  console.log(`=============================`);
}

async function fetchGSCData(token: string, siteUrl: string, date: string, dimensions: string[]): Promise<any[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: date,
        endDate: date,
        dimensions,
        rowLimit: 5000,
        dataState: 'final',
      }),
      signal: controller.signal,
    }
  );
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`GSC API ${response.status}`);
  }

  const data = await response.json();
  return data.rows || [];
}

async function fetchGSCQueries(token: string, siteUrl: string, date: string, clientId: string) {
  const rows = await fetchGSCData(token, siteUrl, date, ['query']);
  return rows.map((row: any) => ({
    client_id: clientId,
    site_url: siteUrl,
    date,
    query: row.keys[0] || '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: Math.round((row.ctr || 0) * 10000) / 100,
    position: Math.round((row.position || 0) * 10) / 10,
  }));
}

async function fetchGSCPages(token: string, siteUrl: string, date: string, clientId: string) {
  const rows = await fetchGSCData(token, siteUrl, date, ['page']);
  return rows.map((row: any) => ({
    client_id: clientId,
    site_url: siteUrl,
    date,
    page: row.keys[0] || '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: Math.round((row.ctr || 0) * 10000) / 100,
    position: Math.round((row.position || 0) * 10) / 10,
  }));
}

main().catch(console.error);
