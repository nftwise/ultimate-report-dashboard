'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import DateRangePicker from '@/components/admin/DateRangePicker';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';
import { createClient } from '@supabase/supabase-js';

const SixMonthBarChart = dynamic(() => import('@/components/admin/SixMonthBarChart'), { ssr: false });
const DailyTrafficLineChart = dynamic(() => import('@/components/admin/DailyTrafficLineChart'), { ssr: false });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface ClientMetrics {
  id: string;
  name: string;
  slug: string;
  city: string;
  total_leads?: number;
  form_fills?: number;
  gbp_calls?: number;
  ads_conversions?: number;
  services?: {
    googleAds: boolean;
    seo: boolean;
    googleLocalService: boolean;
  };
}

interface DailyMetrics {
  date: string;
  total_leads: number;
  form_fills: number;
  gbp_calls: number;
  gbp_profile_views?: number;
  gbp_website_clicks?: number;
  gbp_direction_requests?: number;
  google_ads_conversions: number;
  sessions?: number;
  seo_impressions?: number;
  seo_clicks?: number;
  seo_ctr?: number;
  traffic_organic?: number;
  traffic_paid?: number;
  traffic_direct?: number;
  traffic_referral?: number;
  traffic_ai?: number;
  ads_impressions?: number;
  ads_clicks?: number;
  ads_ctr?: number;
  ad_spend?: number;
  cpl?: number;
  budget_utilization?: number;
}

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const clientSlug = params?.clientSlug as string;

  const [client, setClient] = useState<ClientMetrics | null>(null);
  const [dailyData, setDailyData] = useState<DailyMetrics[]>([]);
  const [prevData, setPrevData] = useState<{ leads: number; sessions: number; adSpend: number; adsCv: number; seoClicks: number; gbpCalls: number }>({ leads: 0, sessions: 0, adSpend: 0, adsCv: 0, seoClicks: 0, gbpCalls: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState<7 | 30 | 90>(30);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
  });

  // Handle preset time period selection
  const handlePresetDays = (days: 7 | 30 | 90) => {
    setSelectedDays(days);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  // Update daily data when date range changes
  const handleDateRangeChange = (newRange: { from: Date; to: Date }) => {
    setDateRange(newRange);
    // Don't update selectedDays when using custom calendar picker
    // to allow flexibility for any date range
  };

  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/clients/list');
        const data = await response.json();

        if (data.success && data.clients) {
          const foundClient = data.clients.find((c: any) => c.slug === clientSlug);
          if (foundClient) {
            setClient(foundClient);
          }
        }
      } catch (error) {
        console.error('Error fetching client:', error);
      } finally {
        setLoading(false);
      }
    };

    if (clientSlug) {
      fetchClient();
    }
  }, [clientSlug]);

  useEffect(() => {
    const fetchDailyMetrics = async () => {
      if (!client) return;

      try {
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

        // Fetch main metrics from client_metrics_summary
        const { data: metricsData, error: metricsError } = await supabase
          .from('client_metrics_summary')
          .select(`
            date,
            total_leads,
            form_fills,
            gbp_calls,
            google_ads_conversions,
            sessions,
            seo_impressions,
            seo_clicks,
            seo_ctr,
            traffic_organic,
            traffic_paid,
            traffic_direct,
            traffic_referral,
            traffic_ai,
            ads_impressions,
            ads_clicks,
            ads_ctr,
            ad_spend,
            cpl,
            budget_utilization
          `)
          .eq('client_id', client.id)
          .eq('period_type', 'daily')
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: true });

        if (metricsError) {
          console.error('[Client Details] Metrics error:', metricsError);
          setDailyData([]);
          return;
        }

        // Fetch GBP data from gbp_location_daily_metrics
        const { data: gbpData, error: gbpError } = await supabase
          .from('gbp_location_daily_metrics')
          .select(`
            date,
            phone_calls,
            views,
            website_clicks,
            direction_requests,
            average_rating
          `)
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: true });

        if (gbpError) {
          // Don't fail if GBP data unavailable, just use metrics data
        }

        // Merge GBP data into metrics data
        const gbpDataArray = Array.isArray(gbpData) ? gbpData : [];
        const merged = (metricsData || []).map((metric: any) => {
          const gbp = gbpDataArray.find((g: any) => g.date === metric.date);
          const phoneCallsValue = gbp?.phone_calls !== undefined ? gbp.phone_calls : (metric.gbp_calls || 0);
          return {
            ...metric,
            // Prefer location-level GBP data (more reliable) over client-level
            gbp_calls: phoneCallsValue,
            gbp_profile_views: gbp?.views !== undefined ? gbp.views : 0,
            gbp_website_clicks: gbp?.website_clicks !== undefined ? gbp.website_clicks : 0,
            gbp_direction_requests: gbp?.direction_requests !== undefined ? gbp.direction_requests : 0,
            average_rating: gbp?.average_rating ?? 0
          };
        });

        setDailyData((merged || []) as DailyMetrics[]);

        // Fetch previous period for MoM comparison
        const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        const prevTo = new Date(dateRange.from);
        prevTo.setDate(prevTo.getDate() - 1);
        const prevFrom = new Date(prevTo);
        prevFrom.setDate(prevFrom.getDate() - periodDays);
        const prevFromISO = prevFrom.toISOString().split('T')[0];
        const prevToISO = prevTo.toISOString().split('T')[0];

        const [{ data: prevMetrics }, { data: prevGbp }] = await Promise.all([
          supabase.from('client_metrics_summary')
            .select('total_leads, sessions, ad_spend, google_ads_conversions, seo_clicks, gbp_calls')
            .eq('client_id', client.id).eq('period_type', 'daily').gte('date', prevFromISO).lte('date', prevToISO),
          supabase.from('gbp_location_daily_metrics')
            .select('phone_calls')
            .eq('client_id', client.id).gte('date', prevFromISO).lte('date', prevToISO),
        ]);

        setPrevData({
          leads: prevMetrics?.reduce((s: number, d: any) => s + (d.total_leads || 0), 0) || 0,
          sessions: prevMetrics?.reduce((s: number, d: any) => s + (d.sessions || 0), 0) || 0,
          adSpend: prevMetrics?.reduce((s: number, d: any) => s + (d.ad_spend || 0), 0) || 0,
          adsCv: prevMetrics?.reduce((s: number, d: any) => s + (d.google_ads_conversions || 0), 0) || 0,
          seoClicks: prevMetrics?.reduce((s: number, d: any) => s + (d.seo_clicks || 0), 0) || 0,
          gbpCalls: prevGbp?.reduce((s: number, d: any) => s + (d.phone_calls || 0), 0)
            || prevMetrics?.reduce((s: number, d: any) => s + (d.gbp_calls || 0), 0) || 0,
        });
      } catch (error) {
        console.error('[Client Details] Error fetching daily metrics:', error);
        setDailyData([]);
      }
    };

    fetchDailyMetrics();
  }, [client, dateRange.from, dateRange.to]);

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
        <p style={{ color: '#2c2419' }}>Loading...</p>
      </div>
    );
  }

  // Calculate metrics from daily data (respects date range changes)
  const totalLeads = dailyData.reduce((sum: number, d: any) => sum + (d.total_leads || 0), 0);
  const totalFormFills = dailyData.reduce((sum: number, d: any) => sum + (d.form_fills || 0), 0);
  const totalGbpCalls = dailyData.reduce((sum: number, d: any) => sum + (d.gbp_calls || 0), 0);
  const totalGbpProfileViews = dailyData.reduce((sum: number, d: any) => sum + (d.gbp_profile_views || 0), 0);
  const totalGbpWebsiteClicks = dailyData.reduce((sum: number, d: any) => sum + (d.gbp_website_clicks || 0), 0);
  const totalGbpDirections = dailyData.reduce((sum: number, d: any) => sum + (d.gbp_direction_requests || 0), 0);
  const totalAdsConversions = dailyData.reduce((sum: number, d: any) => sum + (d.google_ads_conversions || 0), 0);
  const adSpend = dailyData.reduce((sum: number, d: any) => sum + ((d.ad_spend || 0)), 0);
  const costPerLead = totalLeads > 0 ? Math.round((adSpend / totalLeads) * 100) / 100 : 0;
  const sessions = dailyData.reduce((sum: number, d: any) => sum + (d.sessions || 0), 0);

  // Calculate metrics from daily data
  const seoImpressions = dailyData.reduce((sum: number, d: any) => sum + (d.seo_impressions || 0), 0);
  const seoClicks = dailyData.reduce((sum: number, d: any) => sum + (d.seo_clicks || 0), 0);
  const seoCtr = seoImpressions > 0 ? ((seoClicks / seoImpressions) * 100).toFixed(2) : '0.00';
  const adsClicks = dailyData.reduce((sum: number, d: any) => sum + (d.ads_clicks || 0), 0);
  const adsImpressions = dailyData.reduce((sum: number, d: any) => sum + (d.ads_impressions || 0), 0);
  const adsCtr = adsImpressions > 0 ? ((adsClicks / adsImpressions) * 100).toFixed(2) : '0.00';
  const budgetUtilization = dailyData.length > 0 ? dailyData[dailyData.length - 1].budget_utilization || 0 : 0;
  const trafficOrganic = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_organic || 0), 0);
  const trafficPaid = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_paid || 0), 0);
  const trafficDirect = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_direct || 0), 0);
  const trafficAi = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_ai || 0), 0);
  const latestGbpRating = dailyData.length > 0 ? (dailyData[dailyData.length - 1] as any).average_rating || 0 : 0;

  // MoM comparison: current period vs previous period
  const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));

  const calcMoM = (current: number, prev: number, invert = false) => {
    if (prev === 0) return { pct: '—', type: 'neutral' as const };
    const raw = ((current - prev) / prev * 100);
    const pct = raw.toFixed(1);
    const isPositive = raw > 0;
    const isGood = invert ? !isPositive : isPositive;
    return {
      pct: isPositive ? `+${pct}%` : `${pct}%`,
      type: (raw === 0 ? 'neutral' : isGood ? 'up' : 'down') as 'up' | 'down' | 'neutral',
    };
  };

  const prevCpl = prevData.leads > 0 ? prevData.adSpend / prevData.leads : 0;

  const leadTrendData = calcMoM(totalLeads, prevData.leads);
  const sessionsTrendData = calcMoM(sessions, prevData.sessions);
  const adSpendTrendData = calcMoM(adSpend, prevData.adSpend, true);
  const cplTrendData = calcMoM(costPerLead, prevCpl, true);
  const adsCvTrendData = calcMoM(totalAdsConversions, prevData.adsCv);
  const seoClicksTrendData = calcMoM(seoClicks, prevData.seoClicks);
  const gbpCallsTrendData = calcMoM(totalGbpCalls, prevData.gbpCalls);

  const leadTrend = leadTrendData.pct;
  const isTrendUp = leadTrendData.type === 'up';

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} clientName={client.name} clientCity={client.city} activeTab="overview" />

      {/* Date controls */}
      <div className="sticky top-0 z-40 flex items-center gap-3 px-8 py-3" style={{ background: 'rgba(245,241,237,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
        <div className="flex gap-1 p-1 rounded-full" style={{ background: 'rgba(44,36,25,0.05)' }}>
          {[7, 30, 90].map((days) => (
            <button key={days} onClick={() => handlePresetDays(days as 7 | 30 | 90)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition"
              style={{ background: days === selectedDays ? '#c4704f' : 'transparent', color: days === selectedDays ? '#fff' : '#5c5850', cursor: 'pointer' }}>
              {days}d
            </button>
          ))}
        </div>
        <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Section 1: Header (Full Width) */}
          <div className="mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.15em' }}>Performance Dashboard</span>
              <h1 className="text-4xl font-black mt-2" style={{ color: '#2c2419', letterSpacing: '-0.02em' }}>Marketing Overview</h1>
            </div>
          </div>

          {/* Section 2: Executive Summary removed - cards were hardcoded */}

          {/* Section 3: Key Performance Metrics (Full Width - 4 Cards) */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Total Leads', value: totalLeads, trend: leadTrendData.pct, trendType: leadTrendData.type },
              { label: 'Website Sessions', value: sessions, trend: sessionsTrendData.pct, trendType: sessionsTrendData.type },
              { label: 'Ad Spend', value: `$${Math.round(adSpend)}`, trend: adSpendTrendData.pct, trendType: adSpendTrendData.type },
              { label: 'Cost Per Lead', value: `$${costPerLead}`, trend: cplTrendData.pct, trendType: cplTrendData.type }
            ].map((metric, i) => (
              <div key={i} className="rounded-2xl p-6" style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '8px' }}>{metric.label}</p>
                <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{metric.value}</div>
                <span className="text-xs font-semibold px-2 py-1 rounded" style={{
                  background: metric.trendType === 'up' ? 'rgba(157, 181, 160, 0.15)' : metric.trendType === 'down' ? 'rgba(196, 112, 79, 0.15)' : 'rgba(92, 88, 80, 0.1)',
                  color: metric.trendType === 'up' ? '#4a6b4e' : metric.trendType === 'down' ? '#8a4a2e' : '#5c5850'
                }}>
                  {metric.trend} vs prev {periodDays}d
                </span>
              </div>
            ))}
          </div>

          {/* Main Layout: 2 Columns */}
          <div className="grid grid-cols-[1.618fr_1fr] gap-8">
            {/* Left Column */}
            <div className="flex flex-col gap-8">
              {/* 6-Month Performance */}
              <div className="rounded-2xl p-8" style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Performance Trend</p>
                    <h3 className="text-2xl font-black mt-2" style={{ color: '#2c2419' }}>6-Month Lead Generation</h3>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: isTrendUp ? '#9db5a0' : '#c4704f', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {leadTrendData.type === 'neutral' ? '—' : `${isTrendUp ? '↑' : '↓'} ${Math.abs(isNaN(parseFloat(leadTrend)) ? 0 : parseFloat(leadTrend))}%`}
                    </div>
                    <p className="text-xs font-semibold mt-1" style={{ color: '#5c5850' }}>Period vs Period</p>
                  </div>
                </div>

                {/* 6-Month Bar Chart */}
                <div style={{
                  background: 'rgba(44, 36, 25, 0.02)',
                  borderRadius: '12px',
                  padding: '20px',
                  marginTop: '24px'
                }}>
                  {dailyData.length > 0 ? (
                    <SixMonthBarChart data={dailyData} />
                  ) : (
                    <div style={{
                      height: '300px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#5c5850'
                    }}>
                      No data available for this date range
                    </div>
                  )}
                </div>

              </div>

              {/* Daily Traffic & Leads */}
              <div className="rounded-2xl p-8" style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <h3 className="text-2xl font-black mb-6" style={{ color: '#2c2419' }}>Daily Traffic & Leads Analysis</h3>

                {/* Daily Traffic Line Chart */}
                <div style={{
                  background: 'rgba(44, 36, 25, 0.02)',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  {dailyData.length > 0 ? (
                    <DailyTrafficLineChart data={dailyData} />
                  ) : (
                    <div style={{
                      height: '300px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#5c5850'
                    }}>
                      No data available for this date range
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6 mt-6" style={{
                  borderTop: '1px solid rgba(44, 36, 25, 0.1)',
                  paddingTop: '24px'
                }}>
                  <div>
                    <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '8px' }}>Avg. Daily Sessions</p>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9db5a0' }}>{Math.round(sessions / Math.max(dailyData.length, 1))}</div>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '8px' }}>Avg. Daily Leads</p>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d9a854' }}>{Math.round(totalLeads / Math.max(dailyData.length, 1))}</div>
                  </div>
                </div>
              </div>

              {/* Channel Attribution */}
              <div className="rounded-2xl p-8" style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Channel Performance</p>
                    <h3 className="text-2xl font-black mt-2" style={{ color: '#2c2419' }}>Lead Attribution by Channel</h3>
                  </div>
                </div>

                {/* Channel Breakdown */}
                {(() => {
                  const channels = [
                    ...(client.services?.googleAds !== false ? [{ label: 'Google Ads', value: totalAdsConversions, icon: '📊', color: '#c4704f', mom: adsCvTrendData }] : []),
                    ...(client.services?.seo !== false ? [{ label: 'SEO/Organic', value: seoClicks, icon: '🔍', color: '#9db5a0', mom: seoClicksTrendData }] : []),
                    ...(client.services?.googleLocalService !== false ? [{ label: 'Google Business', value: totalGbpCalls, icon: '📍', color: '#d9a854', mom: gbpCallsTrendData }] : [])
                  ];
                  return (
                <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${channels.length}, 1fr)` }}>
                  {channels.map((channel, idx) => (
                    <div key={idx} style={{
                      padding: '20px',
                      background: 'rgba(44, 36, 25, 0.02)',
                      borderRadius: '12px',
                      textAlign: 'center',
                      borderLeft: `4px solid ${channel.color}`
                    }}>
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>{channel.icon}</div>
                      <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px' }}>{channel.label}</p>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: channel.color }}>{channel.value}</div>
                      <p className="text-xs mt-1" style={{ color: '#5c5850' }}>Conversions</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded mt-2 inline-block" style={{
                        background: channel.mom.type === 'up' ? 'rgba(157, 181, 160, 0.15)' : channel.mom.type === 'down' ? 'rgba(196, 112, 79, 0.15)' : 'rgba(92, 88, 80, 0.1)',
                        color: channel.mom.type === 'up' ? '#4a6b4e' : channel.mom.type === 'down' ? '#8a4a2e' : '#5c5850'
                      }}>{channel.mom.pct}</span>
                    </div>
                  ))}
                </div>
                  );
                })()}
              </div>

              {/* SEO & AI Analytics */}
              <div className="rounded-2xl p-8" style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>SEO Performance</p>
                  <h3 className="text-2xl font-black mt-2" style={{ color: '#2c2419' }}>Traffic & SEO Analytics</h3>
                </div>

                {/* SEO Metrics Grid - Real Data from Database */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                  {[
                    { label: 'Search Impressions', value: seoImpressions.toLocaleString(), color: '#9db5a0' },
                    { label: 'Clicks', value: seoClicks.toLocaleString(), color: '#d9a854' },
                    { label: 'CTR', value: `${seoCtr}%`, color: '#c4704f' },
                    { label: 'Organic Traffic', value: trafficOrganic > 0 ? trafficOrganic.toLocaleString() : '—', color: '#2c2419' }
                  ].map((metric, i) => (
                    <div key={i} style={{
                      padding: '16px',
                      background: seoImpressions > 0 || seoCtr !== '0.00' ? 'rgba(44, 36, 25, 0.02)' : 'rgba(44, 36, 25, 0.02)',
                      borderRadius: '12px',
                      textAlign: 'center',
                      borderLeft: `3px solid ${metric.color}`
                    }}>
                      <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '8px' }}>{metric.label}</p>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: metric.color }}>
                        {metric.value === '0' || metric.value === '0.00%' ? '—' : metric.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Keyword Context & AI Traffic Bento */}
                <div className="grid grid-cols-2 gap-6">
                  <div style={{
                    padding: '24px',
                    background: 'rgba(44, 36, 25, 0.02)',
                    borderRadius: '12px',
                    borderLeft: '4px solid #d9a854'
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#2c2419' }}>
                      📊 Organic Search Performance
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', color: '#5c5850' }}>Organic Traffic</span>
                        <span style={{ fontWeight: 'bold', color: '#d9a854' }}>{trafficOrganic > 0 ? trafficOrganic.toLocaleString() : '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', color: '#5c5850' }}>% of Total</span>
                        <span style={{ fontWeight: 'bold', color: '#d9a854' }}>{((trafficOrganic + trafficPaid + trafficDirect) > 0 ? (trafficOrganic / (trafficOrganic + trafficPaid + trafficDirect) * 100) : 0).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    padding: '24px',
                    background: 'linear-gradient(135deg, rgba(44, 36, 25, 0.05), rgba(44, 36, 25, 0.02))',
                    borderRadius: '12px',
                    border: '1px solid rgba(44, 36, 25, 0.08)'
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#2c2419' }}>
                      ✨ AI Assistant Traffic
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px', fontSize: '9px' }}>AI Sessions</p>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#c4704f' }}>{trafficAi > 0 ? trafficAi.toLocaleString() : '—'}</div>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px', fontSize: '9px' }}>% of Total</p>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#c4704f' }}>{((trafficOrganic + trafficPaid + trafficDirect + trafficAi) > 0 ? (trafficAi / (trafficOrganic + trafficPaid + trafficDirect + trafficAi) * 100) : 0).toFixed(1)}%</div>
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', color: '#5c5850', marginTop: '12px', fontStyle: 'italic' }}>
                      Referring: ChatGPT, Perplexity, Claude
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="flex flex-col gap-8">
              {/* Lead Distribution */}
              <div className="rounded-2xl p-8" style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Channel Impact</p>
                <h3 className="text-2xl font-black mt-2 mb-6" style={{ color: '#2c2419' }}>Lead Distribution</h3>

                {(() => {
                  const channels = [
                    { label: 'Google Ads', value: totalAdsConversions, color: '#c4704f' },
                    { label: 'SEO/Organic', value: totalFormFills, color: '#9db5a0' },
                    { label: 'Google Business', value: totalGbpCalls, color: '#d9a854' }
                  ];
                  const channelTotal = Math.max(channels.reduce((s, c) => s + c.value, 0), 1);
                  return channels.map((channel, i) => (
                  <div key={i} style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600', color: '#2c2419' }}>{channel.label}</span>
                      <span style={{ fontWeight: 'bold', color: '#2c2419' }}>{channel.value} ({Math.round((channel.value / channelTotal) * 100)}%)</span>
                    </div>
                    <div style={{
                      height: '6px',
                      background: 'rgba(44, 36, 25, 0.05)',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${(channel.value / channelTotal) * 100}%`,
                        background: channel.color,
                        borderRadius: '3px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                  ));
                })()}
              </div>

              {/* Channel Details */}
              {[
                ...(client.services?.googleAds !== false ? [{ title: 'Google Ads', status: totalAdsConversions > 0 || adSpend > 0 ? 'Active' : 'Inactive', statusColor: totalAdsConversions > 0 || adSpend > 0 ? '#4a6b4e' : '#9ca3af', statusBg: totalAdsConversions > 0 || adSpend > 0 ? 'rgba(157, 181, 160, 0.1)' : 'rgba(156, 163, 175, 0.1)', metrics: [
                  { label: 'Conversions', value: totalAdsConversions },
                  { label: 'Clicks', value: adsClicks },
                  { label: 'Spend', value: `$${Math.round(adSpend)}` },
                  { label: 'CTR', value: `${adsCtr}%` },
                  { label: 'Budget Used', value: `${Math.round(budgetUtilization)}%` }
                ]}] : []),
                ...(client.services?.seo !== false ? [{ title: 'SEO Performance', status: seoClicks > 0 ? 'Active' : 'Inactive', statusColor: seoClicks > 0 ? '#4a6b4e' : '#9ca3af', statusBg: seoClicks > 0 ? 'rgba(157, 181, 160, 0.1)' : 'rgba(156, 163, 175, 0.1)', metrics: [
                  { label: 'Organic Clicks', value: seoClicks },
                  { label: 'Impressions', value: seoImpressions },
                  { label: 'CTR', value: `${seoCtr}%` }
                ]}] : []),
                ...(client.services?.googleLocalService !== false ? [{ title: 'Google Business', status: totalGbpCalls > 0 ? 'Active' : 'Inactive', statusColor: totalGbpCalls > 0 ? '#4a6b4e' : '#9ca3af', statusBg: totalGbpCalls > 0 ? 'rgba(157, 181, 160, 0.1)' : 'rgba(156, 163, 175, 0.1)', metrics: [
                  { label: 'Phone Calls', value: totalGbpCalls },
                  { label: 'Web Clicks', value: totalGbpWebsiteClicks },
                  { label: 'Directions', value: totalGbpDirections },
                  { label: 'Rating', value: latestGbpRating > 0 ? `★ ${latestGbpRating.toFixed(1)}` : '—' }
                ]}] : [])
              ].map((channel, i) => (
                <div key={i} className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5c5850' }}>{channel.title}</h4>
                    <span style={{
                      background: channel.statusBg,
                      color: channel.statusColor,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase'
                    }}>
                      {channel.status}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {channel.metrics.map((metric, j) => (
                      <div key={j} style={{
                        padding: '12px',
                        background: 'rgba(44, 36, 25, 0.02)',
                        borderRadius: '8px'
                      }}>
                        <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', fontSize: '9px', letterSpacing: '0.1em', marginBottom: '4px' }}>{metric.label}</p>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c2419' }}>{metric.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
