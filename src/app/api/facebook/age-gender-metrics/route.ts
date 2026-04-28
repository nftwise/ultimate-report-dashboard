import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');
  const dateFrom = request.nextUrl.searchParams.get('dateFrom');
  const dateTo = request.nextUrl.searchParams.get('dateTo');

  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  let query = supabaseAdmin
    .from('fb_age_gender_metrics')
    .select('age, gender, spend, impressions, clicks, leads')
    .eq('client_id', clientId);

  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate by age+gender
  const map: Record<string, any> = {};
  for (const r of data || []) {
    const key = `${r.age}|${r.gender}`;
    if (!map[key]) map[key] = { age: r.age, gender: r.gender, spend: 0, impressions: 0, clicks: 0, leads: 0 };
    map[key].spend += r.spend || 0;
    map[key].impressions += r.impressions || 0;
    map[key].clicks += r.clicks || 0;
    map[key].leads += r.leads || 0;
  }

  const result = Object.values(map).sort((a: any, b: any) => b.spend - a.spend);
  return NextResponse.json({ data: result });
}
