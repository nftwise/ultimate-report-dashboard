import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { JWT } from 'google-auth-library';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/admin/backfill-gsc-buckets
 * One-time backfill: re-fetch GSC query data for past N days and populate position_buckets.
 * Query params: days (default 90), clientId (optional, defaults to all)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || (role !== 'admin' && role !== 'team')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const days = parseInt(request.nextUrl.searchParams.get('days') || '90', 10);
  const clientIdParam = request.nextUrl.searchParams.get('clientId') || null;

  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
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
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name, service_configs(gsc_site_url)')
    .eq('is_active', true);

  let targets = (clients || [])
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      siteUrl: (Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs)?.gsc_site_url,
    }))
    .filter((c: any) => c.siteUrl);

  if (clientIdParam) {
    targets = targets.filter((c: any) => c.id === clientIdParam);
  }

  // Build date list (skip last 2 days — GSC delay)
  const dates: string[] = [];
  for (let i = 3; i <= days; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  let updated = 0;
  const errors: string[] = [];

  for (const client of targets) {
    for (const date of dates) {
      try {
        const rows = await fetchGSCQueries(token, client.siteUrl, date);
        if (rows.length === 0) continue;

        const pb = {
          top3:     rows.filter((q: any) => (q.position || 999) <= 3).length,
          top5:     rows.filter((q: any) => (q.position || 999) <= 5).length,
          top10:    rows.filter((q: any) => (q.position || 999) <= 10).length,
          top11_20: rows.filter((q: any) => { const p = q.position || 999; return p > 10 && p <= 20; }).length,
          top20:    rows.filter((q: any) => (q.position || 999) <= 20).length,
          top50:    rows.filter((q: any) => (q.position || 999) <= 50).length,
          total:    rows.length,
        };

        const { error } = await supabaseAdmin
          .from('gsc_daily_summary')
          .update({ position_buckets: pb, top5_keywords_count: pb.top5, top11to20_keywords_count: pb.top11_20 })
          .eq('client_id', client.id)
          .eq('date', date);

        if (error) {
          errors.push(`${client.name} ${date}: ${error.message}`);
        } else {
          updated++;
        }
      } catch (err: any) {
        errors.push(`${client.name} ${date}: ${err.message}`);
      }
    }
  }

  return NextResponse.json({
    success: true,
    clients: targets.length,
    datesPerClient: dates.length,
    updated,
    errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
  });
}

async function fetchGSCQueries(token: string, siteUrl: string, date: string): Promise<any[]> {
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: date, endDate: date, dimensions: ['query'], rowLimit: 5000 }),
      signal: AbortSignal.timeout(20000),
    }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json.rows || []).map((r: any) => ({
    query: r.keys?.[0] || '',
    position: r.position || 999,
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
  }));
}
