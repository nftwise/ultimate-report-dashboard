import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

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

  // Fetch last 50 events
  const eventsQuery = supabaseAdmin
    .from('mission_events')
    .select(
      isClientRole
        ? 'id, event_type, category, severity, title, description, actor, occurred_at'
        : 'id, event_type, category, severity, title, description, data, actor, source, occurred_at'
    )
    .eq('client_id', client.id)
    .order('occurred_at', { ascending: false })
    .limit(50);

  // Monthly summary — current month
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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

  return NextResponse.json({
    client: { id: client.id, name: client.name, slug: client.slug, city: client.city },
    events: eventsResult.data || [],
    monthly: monthlyResult.data || null,
    metrics: metricsResult.data || [],
    generatedAt: new Date().toISOString(),
  });
}
