import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/db/supabase';

/**
 * GET /api/ads-analysis/dashboard?clientId=xxx&startDate=xxx&endDate=xxx
 * Fetch ads analysis dashboard data for a client
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    // Get client info
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, slug')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get latest health score
    const { data: healthScore } = await supabaseAdmin
      .from('ads_account_health')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    // Get campaign metrics for date range
    const { data: campaigns } = await supabaseAdmin
      .from('ads_campaign_metrics')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    // Get active insights
    const { data: insights } = await supabaseAdmin
      .from('ads_insights')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('severity', { ascending: false });

    // Calculate summary metrics
    const summary = {
      totalSpend: 0,
      totalConversions: 0,
      totalClicks: 0,
      totalImpressions: 0,
      avgCPC: 0,
      avgCPA: 0,
      avgCTR: 0,
      avgROAS: 0,
    };

    if (campaigns && campaigns.length > 0) {
      campaigns.forEach((camp) => {
        summary.totalSpend += Number(camp.cost) || 0;
        summary.totalConversions += camp.conversions || 0;
        summary.totalClicks += camp.clicks || 0;
        summary.totalImpressions += camp.impressions || 0;
      });

      summary.avgCPC = summary.totalClicks > 0 ? summary.totalSpend / summary.totalClicks : 0;
      summary.avgCPA = summary.totalConversions > 0 ? summary.totalSpend / summary.totalConversions : 0;
      summary.avgCTR = summary.totalImpressions > 0 ? (summary.totalClicks / summary.totalImpressions) * 100 : 0;
      summary.avgROAS = summary.totalSpend > 0 ? (summary.totalConversions * 100 / summary.totalSpend) : 0;

      // Round to 2 decimals
      summary.avgCPC = Math.round(summary.avgCPC * 100) / 100;
      summary.avgCPA = Math.round(summary.avgCPA * 100) / 100;
      summary.avgCTR = Math.round(summary.avgCTR * 100) / 100;
      summary.avgROAS = Math.round(summary.avgROAS * 100) / 100;
    }

    return NextResponse.json({
      success: true,
      data: {
        client: {
          id: client.id,
          name: client.name,
          slug: client.slug,
        },
        dateRange: {
          startDate,
          endDate,
        },
        healthScore: healthScore || null,
        campaigns: campaigns || [],
        insights: insights || [],
        summary,
      },
    });
  } catch (error: any) {
    console.error('Error fetching ads dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: error.message },
      { status: 500 }
    );
  }
}
