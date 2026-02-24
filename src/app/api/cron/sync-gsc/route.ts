import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { JWT } from 'google-auth-library';

export const maxDuration = 300;

const BATCH_SIZE = 3;
const TIMEOUT_MS = 20000;

/**
 * GET /api/cron/sync-gsc
 * Daily cron: Sync yesterday's Google Search Console data to raw tables
 * Tables: gsc_queries, gsc_pages
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // GSC data has a 2-3 day delay, so fetch 3 days ago for reliable data
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const targetDate = threeDaysAgo.toISOString().split('T')[0];

    console.log(`[sync-gsc] Starting for ${targetDate}`);

    // Get auth
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    if (!privateKey || !clientEmail) {
      return NextResponse.json({ success: false, error: 'Missing service account credentials' }, { status: 500 });
    }

    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    const tokenResponse = await auth.getAccessToken();
    const token = tokenResponse.token || '';

    // Fetch clients with GSC config
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('id, name, service_configs(gsc_site_url)')
      .eq('is_active', true);

    if (clientsError) throw new Error(`Failed to fetch clients: ${clientsError.message}`);

    const clientsWithGSC = (clients || [])
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        siteUrl: (Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs)?.gsc_site_url,
      }))
      .filter((c: any) => c.siteUrl);

    console.log(`[sync-gsc] Processing ${clientsWithGSC.length} clients`);

    let totalQueries = 0, totalPages = 0;
    const errors: string[] = [];

    // Process clients in batches
    for (let i = 0; i < clientsWithGSC.length; i += BATCH_SIZE) {
      const batch = clientsWithGSC.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (client: any) => {
        try {
          const [queries, pages] = await Promise.all([
            fetchGSCQueries(token, client.siteUrl, targetDate, client.id).catch((e) => { console.log(`[sync-gsc] Queries error ${client.name}:`, e.message); return []; }),
            fetchGSCPages(token, client.siteUrl, targetDate, client.id).catch((e) => { console.log(`[sync-gsc] Pages error ${client.name}:`, e.message); return []; }),
          ]);

          if (queries.length > 0) {
            // Batch insert in chunks of 500 (GSC can return lots of queries)
            for (let j = 0; j < queries.length; j += 500) {
              const chunk = queries.slice(j, j + 500);
              const { error } = await supabaseAdmin.from('gsc_queries').upsert(chunk, { onConflict: 'client_id,site_url,date,query' });
              if (error) console.log(`[sync-gsc] Queries upsert error ${client.name}:`, error.message);
            }
          }
          if (pages.length > 0) {
            for (let j = 0; j < pages.length; j += 500) {
              const chunk = pages.slice(j, j + 500);
              const { error } = await supabaseAdmin.from('gsc_pages').upsert(chunk, { onConflict: 'client_id,site_url,date,page' });
              if (error) console.log(`[sync-gsc] Pages upsert error ${client.name}:`, error.message);
            }
          }

          return { queries: queries.length, pages: pages.length };
        } catch (err: any) {
          errors.push(`${client.name}: ${err.message}`);
          return { queries: 0, pages: 0 };
        }
      }));

      results.forEach((r) => {
        totalQueries += r.queries;
        totalPages += r.pages;
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-gsc] Done in ${duration}ms: ${totalQueries} queries, ${totalPages} pages`);

    return NextResponse.json({
      success: true,
      date: targetDate,
      clients: clientsWithGSC.length,
      records: { queries: totalQueries, pages: totalPages },
      total: totalQueries + totalPages,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    });
  } catch (error: any) {
    console.error('[sync-gsc] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =====================================================
// GSC API HELPERS
// =====================================================

async function fetchGSCData(token: string, siteUrl: string, date: string, dimensions: string[], rowLimit: number = 5000): Promise<any[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
        rowLimit,
        dataState: 'final',
      }),
      signal: controller.signal,
    }
  );
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`GSC API error: ${response.status}`);
  }

  const data = await response.json();
  return data.rows || [];
}

async function fetchGSCQueries(token: string, siteUrl: string, date: string, clientId: string) {
  const rows = await fetchGSCData(token, siteUrl, date, ['query'], 5000);

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
  const rows = await fetchGSCData(token, siteUrl, date, ['page'], 5000);

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
