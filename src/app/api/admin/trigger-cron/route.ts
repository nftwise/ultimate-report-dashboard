import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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

  const { endpoint } = await request.json();
  if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  }

  const url = new URL(endpoint, request.nextUrl.origin);
  const headers: Record<string, string> = {};
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    headers['authorization'] = `Bearer ${cronSecret}`;
  }

  const res = await fetch(url.toString(), { headers, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
