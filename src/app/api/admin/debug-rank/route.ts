import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/debug-rank
 * Debug ranking data for a specific client
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientSlug = searchParams.get('client') || 'decarlo';

    // Get client info
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
        city,
        service_configs (
          gsc_site_url
        )
      `)
      .eq('slug', clientSlug)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get recent rank data from client_metrics_summary
    const { data: rankData } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, google_rank, top_keywords, total_leads')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(30);

    // Get rank stats
    const ranksWithData = (rankData || []).filter(r => r.google_rank !== null);
    const avgRank = ranksWithData.length > 0
      ? ranksWithData.reduce((sum, r) => sum + r.google_rank, 0) / ranksWithData.length
      : null;

    // Check the run-rollup logic - get city parsing
    const cityFull = client.city ? client.city.split(',')[0].toLowerCase().trim() : '';
    const cityFirst = cityFull.split(' ')[0];

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        slug: client.slug,
        city: client.city,
        cityParsed: { full: cityFull, first: cityFirst },
        gscSiteUrl: Array.isArray(client.service_configs) ? client.service_configs[0]?.gsc_site_url : (client.service_configs as any)?.gsc_site_url,
      },
      rankData: {
        recentDays: rankData,
        daysWithRank: ranksWithData.length,
        avgRankStored: avgRank ? Math.round(avgRank * 10) / 10 : null,
      },
      note: 'google_rank is calculated from GSC keywords matching: chiropractor/chiropractic + city name'
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
