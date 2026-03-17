import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !['admin', 'team'].includes(session.user?.role as string)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
  }

  // Compute the start of 6 months ago (format: 'YYYY-MM')
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const fromYearMonth = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

  const { data, error } = await supabaseAdmin
    .from('manual_form_fills')
    .select('id, client_id, year_month, form_fills, created_at, updated_at')
    .eq('client_id', clientId)
    .gte('year_month', fromYearMonth)
    .order('year_month', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !['admin', 'team'].includes(session.user?.role as string)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { client_id: string; year_month: string; form_fills: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { client_id, year_month, form_fills } = body;

  if (!client_id || !year_month || form_fills === undefined) {
    return NextResponse.json(
      { error: 'client_id, year_month, and form_fills are required' },
      { status: 400 }
    );
  }

  // Validate year_month format
  if (!/^\d{4}-\d{2}$/.test(year_month)) {
    return NextResponse.json(
      { error: 'year_month must be in YYYY-MM format' },
      { status: 400 }
    );
  }

  if (!Number.isInteger(form_fills) || form_fills < 0) {
    return NextResponse.json(
      { error: 'form_fills must be a non-negative integer' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('manual_form_fills')
    .upsert(
      {
        client_id,
        year_month,
        form_fills,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,year_month' }
    )
    .select('id, client_id, year_month, form_fills, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
