import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Compute next occurrence of a weekly UTC schedule (given day-of-week 0=Sun, hour, minute)
function nextWeeklyUTC(dayOfWeek: number, hour: number, minute: number): string {
  const now = new Date();
  const candidate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour,
    minute,
    0,
    0
  ));
  const currentDay = now.getUTCDay();
  let daysAhead = (dayOfWeek - currentDay + 7) % 7;
  // If same day but time already passed (or exactly now), push to next week
  if (daysAhead === 0 && now.getTime() >= candidate.getTime()) {
    daysAhead = 7;
  }
  candidate.setUTCDate(candidate.getUTCDate() + daysAhead);
  return candidate.toISOString();
}

// Compute next daily UTC occurrence (today if not yet passed, tomorrow otherwise)
function nextDailyUTC(hour: number, minute: number): string {
  const now = new Date();
  const candidate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour,
    minute,
    0,
    0
  ));
  if (now.getTime() >= candidate.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate.toISOString();
}

// Compute next 1st-of-month at given UTC hour:minute
function nextMonthlyUTC(hour: number, minute: number): string {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth(); // 0-indexed

  const candidate = new Date(Date.UTC(year, month, 1, hour, minute, 0, 0));
  if (now.getTime() >= candidate.getTime()) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    candidate.setUTCFullYear(year);
    candidate.setUTCMonth(month);
    candidate.setUTCDate(1);
  }
  return candidate.toISOString();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientSlug: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { clientSlug } = await params;
  const userRole = (session.user as any)?.role || '';
  const userClientId = (session.user as any)?.clientId;

  // Look up client
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id, name, slug, city')
    .eq('slug', clientSlug)
    .eq('is_active', true)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Client role: enforce own client only
  if (userRole === 'client' && userClientId !== client.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const isClientRole = userRole === 'client';

  // Fetch last 200 events (up from 50) for full 90-day history
  const eventsQuery = supabaseAdmin
    .from('mission_events')
    .select(
      isClientRole
        ? 'id, event_type, category, severity, title, description, actor, occurred_at'
        : 'id, event_type, category, severity, title, description, data, actor, source, occurred_at'
    )
    .eq('client_id', client.id)
    .order('occurred_at', { ascending: false })
    .limit(200);

  // Monthly summary — current month
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const monthlyQuery = supabaseAdmin
    .from('mission_events_monthly')
    .select('*')
    .eq('client_id', client.id)
    .eq('month', monthKey)
    .single();

  // Daily metrics — last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateFrom = sevenDaysAgo.toISOString().split('T')[0];

  const metricsQuery = supabaseAdmin
    .from('mission_metrics_daily')
    .select('*')
    .eq('client_id', client.id)
    .gte('date', dateFrom)
    .order('date', { ascending: false });

  const [eventsResult, monthlyResult, metricsResult] = await Promise.all([
    eventsQuery,
    monthlyQuery,
    metricsQuery,
  ]);

  const events: Array<{
    id: string;
    event_type: string;
    category?: string;
    severity?: string;
    title: string;
    occurred_at: string;
    [key: string]: unknown;
  }> = eventsResult.data || [];

  // ── Stats aggregation ──────────────────────────────────────────────────────
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const ev of events) {
    const cat = ev.category || 'unknown';
    const sev = ev.severity || 'info';
    const typ = ev.event_type || 'unknown';

    byCategory[cat] = (byCategory[cat] || 0) + 1;
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    byType[typ] = (byType[typ] || 0) + 1;
  }

  const stats = {
    total: events.length,
    byCategory,
    bySeverity,
    byType,
  };

  // ── Last event per type ────────────────────────────────────────────────────
  // Events are already ordered newest-first; first occurrence of each type wins
  const lastByType: Record<string, { title: string; occurred_at: string }> = {};
  for (const ev of events) {
    const typ = ev.event_type || 'unknown';
    if (!lastByType[typ]) {
      lastByType[typ] = { title: ev.title, occurred_at: ev.occurred_at };
    }
  }

  // ── Next scheduled actions ─────────────────────────────────────────────────
  // Schedules mirror the GitHub Actions cron definitions in .github/workflows/
  const nextActions = [
    {
      label: 'Daily Ads sync',
      when: nextDailyUTC(14, 0),   // 14:00 UTC daily (covers groups A/B/C window)
      icon: 'sync',
    },
    {
      label: 'Search terms classification',
      when: nextWeeklyUTC(1, 23, 0), // Monday 23:00 UTC
      icon: 'search',
    },
    {
      label: 'Weekly digest',
      when: nextWeeklyUTC(0, 5, 30), // Sunday 05:30 UTC
      icon: 'mail',
    },
    {
      label: 'Monthly compress',
      when: nextMonthlyUTC(14, 0),   // 1st of next month 14:00 UTC
      icon: 'archive',
    },
  ];

  return NextResponse.json({
    client: { id: client.id, name: client.name, slug: client.slug, city: client.city },
    events,
    monthly: monthlyResult.data || null,
    metrics: metricsResult.data || [],
    stats,
    nextActions,
    lastByType,
    generatedAt: new Date().toISOString(),
  });
}
