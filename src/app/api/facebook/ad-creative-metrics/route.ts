import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/facebook/ad-creative-metrics
 * Returns FB campaign metrics grouped by campaign_name with spend distribution.
 *
 * Query params:
 *   clientId  - UUID (required)
 *   dateFrom  - YYYY-MM-DD (optional)
 *   dateTo    - YYYY-MM-DD (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId');
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId parameter' }, { status: 400 });
    }

    const now = new Date();
    const defaultTo = now.toISOString().split('T')[0];
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const from = dateFrom || defaultFrom;
    const to = dateTo || defaultTo;

    const { data, error } = await supabaseAdmin
      .from('fb_campaign_metrics')
      .select('campaign_id, campaign_name, spend, impressions, clicks, leads')
      .eq('client_id', clientId)
      .gte('date', from)
      .lte('date', to);

    if (error) {
      console.error('[fb/ad-creative-metrics GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by campaign_name and sum metrics
    const grouped: Record<string, {
      campaign_name: string;
      spend: number;
      impressions: number;
      clicks: number;
      leads: number;
    }> = {};

    for (const row of data || []) {
      const key = row.campaign_name || row.campaign_id;
      if (!grouped[key]) {
        grouped[key] = {
          campaign_name: row.campaign_name || row.campaign_id,
          spend: 0,
          impressions: 0,
          clicks: 0,
          leads: 0,
        };
      }
      grouped[key].spend += Number(row.spend) || 0;
      grouped[key].impressions += Number(row.impressions) || 0;
      grouped[key].clicks += Number(row.clicks) || 0;
      grouped[key].leads += Number(row.leads) || 0;
    }

    // Build result sorted by spend desc, compute CTR
    const campaigns = Object.values(grouped)
      .map((c) => ({
        ...c,
        spend: Math.round(c.spend * 100) / 100,
        ctr: c.impressions > 0
          ? Math.round((c.clicks / c.impressions) * 10000) / 100
          : 0,
      }))
      .sort((a, b) => b.spend - a.spend);

    return NextResponse.json({ data: campaigns });
  } catch (err) {
    console.error('[fb/ad-creative-metrics GET] Exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
