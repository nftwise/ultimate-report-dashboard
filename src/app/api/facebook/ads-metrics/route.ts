import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/facebook/ads-metrics
 * Returns FB Ads campaign metrics grouped by campaign_name for a given date range.
 *
 * Query params:
 *   clientId  - UUID of the client (required)
 *   dateFrom  - ISO date string YYYY-MM-DD (optional, defaults to 30 days ago)
 *   dateTo    - ISO date string YYYY-MM-DD (optional, defaults to today)
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId');
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing clientId parameter' },
        { status: 400 }
      );
    }

    // Default date range: last 30 days
    const now = new Date();
    const defaultTo = now.toISOString().split('T')[0];
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const from = dateFrom || defaultFrom;
    const to = dateTo || defaultTo;

    const { data, error } = await supabaseAdmin
      .from('fb_campaign_metrics')
      .select('campaign_id, campaign_name, spend, impressions, clicks, leads, cpl')
      .eq('client_id', clientId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });

    if (error) {
      console.error('[fb/ads-metrics GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by campaign_name and sum metrics
    const grouped: Record<
      string,
      {
        campaign_id: string;
        campaign_name: string;
        spend: number;
        impressions: number;
        clicks: number;
        leads: number;
      }
    > = {};

    for (const row of data || []) {
      const key = row.campaign_name || row.campaign_id;
      if (!grouped[key]) {
        grouped[key] = {
          campaign_id: row.campaign_id,
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

    // Build result array sorted by spend desc, compute CPL
    const campaigns = Object.values(grouped)
      .map((c) => ({
        ...c,
        spend: Math.round(c.spend * 100) / 100,
        cpl: c.leads > 0 ? Math.round((c.spend / c.leads) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.spend - a.spend);

    return NextResponse.json({ data: campaigns });
  } catch (err) {
    console.error('[fb/ads-metrics GET] Exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
