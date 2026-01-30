import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!clientId || !dateFrom || !dateTo) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: clientId, dateFrom, dateTo'
      }, { status: 400 });
    }

    // Fetch daily metrics for the client within the date range
    const { data, error } = await supabase
      .from('client_metrics_daily')
      .select('date, website_sessions, total_leads')
      .eq('client_id', clientId)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    // Transform data to match expected format
    const formattedData = (data || []).map((item: any) => ({
      date: item.date,
      traffic: item.website_sessions || 0,
      leads: item.total_leads || 0
    }));

    return NextResponse.json({
      success: true,
      data: formattedData
    });
  } catch (error: any) {
    console.error('Error fetching daily traffic:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch daily traffic data'
    }, { status: 500 });
  }
}
