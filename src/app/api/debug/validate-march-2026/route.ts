import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET() {
  const marchStart = '2026-03-01';
  const today = '2026-04-04';

  const results: any = {
    generatedAt: new Date().toISOString(),
    reportDate: '2026-04-04',
    period: 'March 1 - April 4, 2026 (35 days)',
    dataBySource: {},
  };

  try {
    // Get all clients
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, slug, has_seo, has_ads, has_gbp');

    results.totalClients = clients?.length || 0;

    // GA4 data
    const { data: ga4, count: ga4Count } = await supabase
      .from('ga4_sessions')
      .select('client_id, date', { count: 'exact' })
      .gte('date', marchStart)
      .lte('date', today);

    const ga4DateRange = new Set(ga4?.map((r: any) => r.date) || []);
    const ga4Clients = new Set(ga4?.map((r: any) => r.client_id) || []);
    const ga4Dates = Array.from(ga4DateRange).sort();

    results.dataBySource.ga4 = {
      rowCount: ga4Count,
      uniqueDates: ga4DateRange.size,
      clientsWithData: ga4Clients.size,
      dateRange: ga4Dates.length > 0 ? `${ga4Dates[0]} to ${ga4Dates[ga4Dates.length - 1]}` : 'N/A',
      coverage: ((ga4DateRange.size / 35) * 100).toFixed(1) + '%',
    };

    // GSC data
    const { data: gsc, count: gscCount } = await supabase
      .from('gsc_queries')
      .select('client_id, date', { count: 'exact' })
      .gte('date', marchStart)
      .lte('date', today);

    const gscDateRange = new Set(gsc?.map((r: any) => r.date) || []);
    const gscClients = new Set(gsc?.map((r: any) => r.client_id) || []);
    const gscDates = Array.from(gscDateRange).sort();

    results.dataBySource.gsc = {
      rowCount: gscCount,
      uniqueDates: gscDateRange.size,
      clientsWithData: gscClients.size,
      dateRange: gscDates.length > 0 ? `${gscDates[0]} to ${gscDates[gscDates.length - 1]}` : 'N/A',
      coverage: ((gscDateRange.size / 35) * 100).toFixed(1) + '%',
    };

    // Ads campaign data
    const { data: ads, count: adsCount } = await supabase
      .from('ads_campaign_metrics')
      .select('client_id, date', { count: 'exact' })
      .gte('date', marchStart)
      .lte('date', today);

    const adsDateRange = new Set(ads?.map((r: any) => r.date) || []);
    const adsClients = new Set(ads?.map((r: any) => r.client_id) || []);
    const adsDates = Array.from(adsDateRange).sort();

    results.dataBySource.ads = {
      rowCount: adsCount,
      uniqueDates: adsDateRange.size,
      clientsWithData: adsClients.size,
      dateRange: adsDates.length > 0 ? `${adsDates[0]} to ${adsDates[adsDates.length - 1]}` : 'N/A',
      coverage: ((adsDateRange.size / 35) * 100).toFixed(1) + '%',
    };

    // GBP data
    const { data: gbp, count: gbpCount } = await supabase
      .from('gbp_location_daily_metrics')
      .select('client_id, date', { count: 'exact' })
      .gte('date', marchStart)
      .lte('date', today);

    const gbpDateRange = new Set(gbp?.map((r: any) => r.date) || []);
    const gbpClients = new Set(gbp?.map((r: any) => r.client_id) || []);
    const gbpDates = Array.from(gbpDateRange).sort();

    results.dataBySource.gbp = {
      rowCount: gbpCount,
      uniqueDates: gbpDateRange.size,
      clientsWithData: gbpClients.size,
      dateRange: gbpDates.length > 0 ? `${gbpDates[0]} to ${gbpDates[gbpDates.length - 1]}` : 'N/A',
      coverage: ((gbpDateRange.size / 35) * 100).toFixed(1) + '%',
    };

    // client_metrics_summary (aggregated)
    const { data: summary, count: summaryCount } = await supabase
      .from('client_metrics_summary')
      .select('client_id, date', { count: 'exact' })
      .gte('date', marchStart)
      .lte('date', today);

    const summaryDateRange = new Set(summary?.map((r: any) => r.date) || []);
    const summaryClients = new Set(summary?.map((r: any) => r.client_id) || []);
    const summaryDates = Array.from(summaryDateRange).sort();

    results.dataBySource.summary = {
      rowCount: summaryCount,
      uniqueDates: summaryDateRange.size,
      clientsWithData: summaryClients.size,
      dateRange: summaryDates.length > 0 ? `${summaryDates[0]} to ${summaryDates[summaryDates.length - 1]}` : 'N/A',
      coverage: ((summaryDateRange.size / 35) * 100).toFixed(1) + '%',
    };

    // Freshness analysis
    const ga4Latest = ga4Dates[ga4Dates.length - 1];
    const gscLatest = gscDates[gscDates.length - 1];
    const adsLatest = adsDates[adsDates.length - 1];
    const gbpLatest = gbpDates[gbpDates.length - 1];

    results.freshness = {
      apiDelayNotes: {
        ga4: '1-2 days delay → expect data up to April 2-3',
        gsc: '1-2 days delay → expect data up to April 2-3',
        ads: '1-2 days delay → expect data up to April 2-3',
        gbp: '2-5 days delay → expect data up to March 30 - April 1',
      },
      latestData: {
        ga4: ga4Latest || 'N/A',
        gsc: gscLatest || 'N/A',
        ads: adsLatest || 'N/A',
        gbp: gbpLatest || 'N/A',
      },
      isUpToDate: {
        ga4: ga4Latest && ga4Latest >= '2026-04-02' ? '✓' : '⚠',
        gsc: gscLatest && gscLatest >= '2026-04-02' ? '✓' : '⚠',
        ads: adsLatest && adsLatest >= '2026-04-02' ? '✓' : '⚠',
        gbp: gbpLatest && gbpLatest >= '2026-03-30' ? '✓' : '⚠',
      },
    };

    // Client-level breakdown
    results.clientBreakdown = [];
    clients?.slice(0, 10).forEach((client: any) => {
      const clientData = {
        name: client.name,
        slug: client.slug,
        ga4Days: ga4Clients.has(client.id)
          ? Array.from(ga4DateRange).filter(d => ga4?.find((r: any) => r.client_id === client.id && r.date === d)).length
          : 0,
        gscDays: gscClients.has(client.id)
          ? Array.from(gscDateRange).filter(d => gsc?.find((r: any) => r.client_id === client.id && r.date === d)).length
          : 0,
        adsDays: adsClients.has(client.id)
          ? Array.from(adsDateRange).filter(d => ads?.find((r: any) => r.client_id === client.id && r.date === d)).length
          : 0,
        gbpDays: gbpClients.has(client.id)
          ? Array.from(gbpDateRange).filter(d => gbp?.find((r: any) => r.client_id === client.id && r.date === d)).length
          : 0,
      };
      results.clientBreakdown.push(clientData);
    });

    // Overall status
    const allUpToDate =
      ga4Latest && ga4Latest >= '2026-04-02' &&
      gscLatest && gscLatest >= '2026-04-02' &&
      adsLatest && adsLatest >= '2026-04-02' &&
      gbpLatest && gbpLatest >= '2026-03-30';

    results.overallStatus = allUpToDate ? '✓ ALL DATA IS UP TO DATE' : '⚠ SOME DATA MAY BE STALE';

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
