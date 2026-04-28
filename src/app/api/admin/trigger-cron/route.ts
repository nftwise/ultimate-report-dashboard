import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic'

const ALLOWED_ENDPOINTS = [
  '/api/cron/sync-ga4',
  '/api/cron/sync-gsc',
  '/api/cron/sync-ads',
  '/api/cron/sync-gbp',
  '/api/admin/run-rollup',
];

/**
 * POST /api/admin/trigger-cron
 * Proxy for "Run Now" buttons on the cron-monitor page.
 * Checks admin session, then forwards to the cron endpoint with CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'team'].includes((session.user as any)?.role || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { endpoint, method, params } = await request.json();
  if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  }

  const url = new URL(endpoint, request.nextUrl.origin);
  const cronSecret = process.env.CRON_SECRET;
  const authHeaders: Record<string, string> = {};
  if (cronSecret) authHeaders['authorization'] = `Bearer ${cronSecret}`;

  // Append params as query string for GET crons (date, clientId, etc.)
  if (params && method !== 'POST') {
    for (const [key, val] of Object.entries(params)) {
      if (val != null) url.searchParams.set(key, String(val));
    }
  }

  // If caller passes method:'POST' + params, forward as POST with body (used by rollup)
  const res = (method === 'POST' && params)
    ? await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ ...params, secret: cronSecret }),
        cache: 'no-store',
      })
    : await fetch(url.toString(), { headers: authHeaders, cache: 'no-store' });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
