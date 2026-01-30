import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
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
    const { data, error } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, total_leads, form_fills, gbp_calls, google_ads_conversions')
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

    if (!data || data.length === 0) {
      console.warn(`No data found for client ${clientId} between ${dateFrom} and ${dateTo}`);
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // Transform data to match expected format
    // Using total_leads as proxy for traffic (sessions data not directly available)
    const formattedData = (data || []).map((item: any) => ({
      date: item.date,
      traffic: (item.total_leads || 0) + (item.form_fills || 0) + (item.gbp_calls || 0),
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
