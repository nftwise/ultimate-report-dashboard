'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import DateRangePicker from '@/components/admin/DateRangePicker';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';
import { createClient } from '@supabase/supabase-js';
import { fmtNum, fmtCurrency, toLocalDateStr } from '@/lib/format';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer } from 'recharts';

const ChartSkeleton = () => (
  <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#9ca3af', fontSize: '13px' }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    Loading chart…
  </div>
);

const SixMonthBarChart = dynamic(() => import('@/components/admin/SixMonthBarChart'), { ssr: false, loading: ChartSkeleton });
const DailyTrafficLineChart = dynamic(() => import('@/components/admin/DailyTrafficLineChart'), { ssr: false, loading: ChartSkeleton });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface ClientMetrics {
  id: string;
  name: string;
  slug: string;
  city: string;
  notes?: string | null;
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
  const [prevData, setPrevData] = useState<{ leads: number; sessions: number; adSpend: number; adsCv: number; seoClicks: number; gbpCalls: number; formFills: number }>({ leads: 0, sessions: 0, adSpend: 0, adsCv: 0, seoClicks: 0, gbpCalls: 0, formFills: 0 });
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<7 | 30 | 90 | null>(30);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date(); to.setDate(to.getDate() - 1);
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    return { from, to };
  });
  const [lastAvailableDate, setLastAvailableDate] = useState<Date | null>(null);
  // FIX #10: fetch latest GBP rating independently of date range
  const [latestGbpRating, setLatestGbpRating] = useState(0);


  const handlePresetDays = (days: 7 | 30 | 90) => {
    setSelectedDays(days);
    const to = lastAvailableDate ?? (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })();
    const from = new Date(to);
    from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  const handleDateRangeChange = (newRange: { from: Date; to: Date }) => {
    setSelectedDays(null);
    setDateRange(newRange);
  };

  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/clients/list');
        const data = await response.json();
        if (data.success && data.clients) {
          const foundClient = data.clients.find((c: any) => c.slug === clientSlug);
          if (foundClient) setClient(foundClient);
        }
      } catch (error) {
        console.error('Error fetching client:', error);
      } finally {
        setLoading(false);
      }
    };
    if (clientSlug) fetchClient();
  }, [clientSlug]);


  // Anchor date range to last available data date (same as admin page)
  useEffect(() => {
    if (!client) return;
    supabase.from('client_metrics_summary')
      .select('date').eq('client_id', client.id).eq('period_type', 'daily')
      .order('date', { ascending: false }).limit(1).single()
      .then(({ data }) => {
        if (data?.date) {
          const to = new Date(data.date + 'T12:00:00');
          setLastAvailableDate(to);
          const from = new Date(to); from.setDate(from.getDate() - 30);
          setDateRange({ from, to });
        }
      });
  }, [client]);

  // FIX #10: fetch latest GBP rating once per client, independent of date range
  useEffect(() => {
    if (!client) return;
    supabase.from('gbp_location_daily_metrics')
      .select('average_rating')
      .eq('client_id', client.id)
      .gt('average_rating', 0)
      .order('date', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data && (data as any).average_rating > 0) setLatestGbpRating((data as any).average_rating);
        else {
          supabase.from('client_metrics_summary')
            .select('gbp_rating_avg')
            .eq('client_id', client.id)
            .eq('period_type', 'daily')
            .gt('gbp_rating_avg', 0)
            .order('date', { ascending: false })
            .limit(1)
            .single()
            .then(({ data: s }) => { if (s && (s as any).gbp_rating_avg > 0) setLatestGbpRating((s as any).gbp_rating_avg); });
        }
      });
  }, [client]);

  useEffect(() => {
    const fetchDailyMetrics = async () => {
      if (!client) return;
      setChartLoading(true);
      try {
        const dateFromISO = toLocalDateStr(dateRange.from);
        const dateToISO = toLocalDateStr(dateRange.to);

        const { data: metricsData, error: metricsError } = await supabase
          .from('client_metrics_summary')
          .select(`date, total_leads, form_fills, gbp_calls, google_ads_conversions, sessions,
            seo_impressions, seo_clicks, seo_ctr, traffic_organic, traffic_paid,
            traffic_direct, traffic_referral, traffic_ai, ads_impressions, ads_clicks,
            ads_ctr, ad_spend, cpl, budget_utilization`)
          .eq('client_id', client.id)
          .eq('period_type', 'daily')
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: true });

        if (metricsError) { setDailyData([]); return; }

        const { data: gbpData } = await supabase
          .from('gbp_location_daily_metrics')
          .select('date, phone_calls, views, website_clicks, direction_requests')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: true });

        const gbpArr = Array.isArray(gbpData) ? gbpData : [];
        const merged = (metricsData || []).map((metric: any) => {
          const gbp = gbpArr.find((g: any) => g.date === metric.date);
          return {
            ...metric,
            gbp_calls: gbp?.phone_calls ?? metric.gbp_calls ?? 0,
            gbp_profile_views: gbp?.views ?? 0,
            gbp_website_clicks: gbp?.website_clicks ?? 0,
            gbp_direction_requests: gbp?.direction_requests ?? 0,
          };
        });
        setDailyData(merged as DailyMetrics[]);
        setFetchError(null);

        // Previous period for MoM
        const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000);
        const prevTo = new Date(dateRange.from); prevTo.setDate(prevTo.getDate() - 1);
        const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - periodDays);

        const [{ data: prevMetrics }, { data: prevGbp }] = await Promise.all([
          supabase.from('client_metrics_summary')
            .select('total_leads, sessions, ad_spend, google_ads_conversions, seo_clicks, gbp_calls, form_fills')
            .eq('client_id', client.id).eq('period_type', 'daily')
            .gte('date', prevFrom.toISOString().split('T')[0]).lte('date', prevTo.toISOString().split('T')[0]),
          supabase.from('gbp_location_daily_metrics')
            .select('phone_calls')
            .eq('client_id', client.id)
            .gte('date', prevFrom.toISOString().split('T')[0]).lte('date', prevTo.toISOString().split('T')[0]),
        ]);

        setPrevData({
          leads: prevMetrics?.reduce((s: number, d: any) => s + (d.total_leads || 0), 0) || 0,
          sessions: prevMetrics?.reduce((s: number, d: any) => s + (d.sessions || 0), 0) || 0,
          adSpend: prevMetrics?.reduce((s: number, d: any) => s + (d.ad_spend || 0), 0) || 0,
          adsCv: prevMetrics?.reduce((s: number, d: any) => s + (d.google_ads_conversions || 0), 0) || 0,
          seoClicks: prevMetrics?.reduce((s: number, d: any) => s + (d.seo_clicks || 0), 0) || 0,
          gbpCalls: prevGbp?.reduce((s: number, d: any) => s + (d.phone_calls || 0), 0)
            || prevMetrics?.reduce((s: number, d: any) => s + (d.gbp_calls || 0), 0) || 0,
          formFills: prevMetrics?.reduce((s: number, d: any) => s + (d.form_fills || 0), 0) || 0,
        });
      } catch (error) {
        console.error('[Client Details] Error:', error);
        setFetchError('Không thể tải dữ liệu. Vui lòng thử lại.');
        setDailyData([]);
      } finally {
        setChartLoading(false);
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

  // ── Aggregates ────────────────────────────────────────────────────────────
  // Individual channel metrics computed first so totalLeads = their exact sum (no mismatch)
  const totalFormFills = dailyData.reduce((s: number, d: any) => s + (d.form_fills || 0), 0);
  const totalGbpCalls = dailyData.reduce((s: number, d: any) => s + (d.gbp_calls || 0), 0);
  const totalGbpWebsiteClicks = dailyData.reduce((s: number, d: any) => s + (d.gbp_website_clicks || 0), 0);
  const totalGbpDirections = dailyData.reduce((s: number, d: any) => s + (d.gbp_direction_requests || 0), 0);
  const totalAdsConversions = dailyData.reduce((s: number, d: any) => s + (d.google_ads_conversions || 0), 0);
  // Total Leads = sum of active channels → always matches Lead Sources breakdown
  const totalLeads = totalFormFills + totalAdsConversions + totalGbpCalls;
  const adSpend = dailyData.reduce((s: number, d: any) => s + (d.ad_spend || 0), 0);
  const costPerLead = totalAdsConversions > 0 ? Math.round((adSpend / totalAdsConversions) * 100) / 100 : 0;
  const sessions = dailyData.reduce((s: number, d: any) => s + (d.sessions || 0), 0);
  const seoImpressions = dailyData.reduce((s: number, d: any) => s + (d.seo_impressions || 0), 0);
  const seoClicks = dailyData.reduce((s: number, d: any) => s + (d.seo_clicks || 0), 0);
  const seoCtr = seoImpressions > 0 ? ((seoClicks / seoImpressions) * 100).toFixed(2) : '0.00';
  const adsClicks = dailyData.reduce((s: number, d: any) => s + (d.ads_clicks || 0), 0);
  const adsImpressions = dailyData.reduce((s: number, d: any) => s + (d.ads_impressions || 0), 0);
  const adsCtr = adsImpressions > 0 ? ((adsClicks / adsImpressions) * 100).toFixed(2) : '0.00';
  const trafficOrganic = dailyData.reduce((s: number, d: any) => s + (d.traffic_organic || 0), 0);
  const trafficPaid = dailyData.reduce((s: number, d: any) => s + (d.traffic_paid || 0), 0);
  const trafficDirect = dailyData.reduce((s: number, d: any) => s + (d.traffic_direct || 0), 0);
  const trafficAi = dailyData.reduce((s: number, d: any) => s + (d.traffic_ai || 0), 0);
  const trafficReferral = dailyData.reduce((s: number, d: any) => s + (d.traffic_referral || 0), 0);
  const totalTraffic = trafficOrganic + trafficPaid + trafficDirect + trafficReferral + trafficAi;

  const hasAds = client.services?.googleAds !== false;
  const hasSeo = client.services?.seo !== false;
  const hasGbp = client.services?.googleLocalService !== false;

  // ── MoM ──────────────────────────────────────────────────────────────────
  const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000);
  const calcMoM = (curr: number, prev: number, invert = false) => {
    if (prev === 0) return { pct: '—', type: 'neutral' as const };
    const raw = (curr - prev) / prev * 100;
    const isPos = raw > 0;
    const isGood = invert ? !isPos : isPos;
    const type = Math.abs(raw) < 0.01 ? 'neutral' : (invert ? (raw < 0 ? 'up' : 'down') : (raw > 0 ? 'up' : 'down'));
    return { pct: isPos ? `+${raw.toFixed(1)}%` : `${raw.toFixed(1)}%`, type: type as 'up' | 'down' | 'neutral' };
  };

  // Compute previous period label for display in MoM badges
  const prevPeriodEnd = new Date(dateRange.from); prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);
  const prevPeriodStart = new Date(prevPeriodEnd); prevPeriodStart.setDate(prevPeriodStart.getDate() - periodDays);
  const fmtD = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const prevLabel = `${fmtD(prevPeriodStart)} – ${fmtD(prevPeriodEnd)}`;

  const prevCpl = prevData.adsCv > 0 ? prevData.adSpend / prevData.adsCv : 0;
  const leadTrendData = calcMoM(totalLeads, prevData.leads);
  const sessionsTrendData = calcMoM(sessions, prevData.sessions);
  const adSpendTrendData = calcMoM(adSpend, prevData.adSpend, true);
  const cplTrendData = calcMoM(costPerLead, prevCpl, true);
  const gbpCallsTrendData = calcMoM(totalGbpCalls, prevData.gbpCalls);
  const formFillsTrendData = calcMoM(totalFormFills, prevData.formFills);
  const leadTrend = leadTrendData.pct;
  const isTrendUp = leadTrendData.type === 'up';

  const trendBadge = (mom: ReturnType<typeof calcMoM>) => (
    <div style={{ marginTop: '8px' }}>
      <span className="text-xs font-semibold px-2 py-1 rounded" style={{
        background: mom.type === 'up' ? 'rgba(157,181,160,0.15)' : mom.type === 'down' ? 'rgba(196,112,79,0.15)' : 'rgba(92,88,80,0.1)',
        color: mom.type === 'up' ? '#4a6b4e' : mom.type === 'down' ? '#8a4a2e' : '#5c5850'
      }}>
        {mom.pct}
      </span>
      <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '5px' }}>vs prev {periodDays}d</span>
    </div>
  );

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} clientName={client.name} clientCity={client.city} activeTab="overview" />

      {/* Sticky date bar */}
      <div className="sticky top-14 md:top-0 z-30 flex items-center justify-end gap-3 px-8 py-3" style={{ background: 'rgba(245,241,237,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
        {dailyData.length > 0 && (
          <span style={{ fontSize: '11px', color: '#9ca3af', marginRight: 'auto' }}>
            Data through {new Date(dailyData[dailyData.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
        <div className="flex gap-1 p-1 rounded-full" style={{ background: 'rgba(44,36,25,0.05)' }}>
          {[7, 30, 90].map((days) => (
            <button key={days} onClick={() => handlePresetDays(days as 7 | 30 | 90)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition"
              style={{ background: days === selectedDays ? '#fff' : 'transparent', color: days === selectedDays ? '#2c2419' : '#5c5850', cursor: 'pointer' }}>
              {days}d
            </button>
          ))}
        </div>
        <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">

          {/* Error banner */}
          {fetchError && (
            <div style={{
              background: 'rgba(196,112,79,0.1)',
              border: '1px solid #c4704f',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              color: '#8a4a2e',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ⚠️ {fetchError}
              <button onClick={() => setFetchError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#8a4a2e', fontSize: '16px' }}>✕</button>
            </div>
          )}

          {/* Header */}
          <div className="mb-8">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.15em' }}>Performance Dashboard</span>
            <h1 className="text-4xl font-black mt-2" style={{ color: '#2c2419', letterSpacing: '-0.02em' }}>Marketing Overview</h1>
          </div>

          {/* FIX #9: KPI Cards — hide Ad Spend + CPL if no Ads service */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            {/* Total Leads — always shown */}
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px' }}>Total Inquiries</p>
              <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>Phone calls + forms + Google Ads</p>
              <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{fmtNum(totalLeads)}</div>
              {trendBadge(leadTrendData)}
            </div>

            {/* Website Visits — always shown */}
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px' }}>Website Visitors</p>
              <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>People who visited your website</p>
              <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{fmtNum(sessions)}</div>
              {trendBadge(sessionsTrendData)}
            </div>

            {/* Ad Spend — only if Ads service active */}
            {hasAds ? (
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px' }}>Ad Spend</p>
                <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>Amount spent on Google Ads</p>
                <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{fmtCurrency(adSpend, 0)}</div>
                {trendBadge(adSpendTrendData)}
              </div>
            ) : (
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px' }}>Contact Forms</p>
                <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>Forms submitted on your website</p>
                <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{fmtNum(totalFormFills)}</div>
                {trendBadge(formFillsTrendData)}
              </div>
            )}

            {/* CPL — only if Ads active, else GBP Calls */}
            {hasAds ? (
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px' }}>Cost Per Inquiry</p>
                <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>Average ad cost per patient inquiry</p>
                <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{costPerLead > 0 ? fmtCurrency(costPerLead) : '—'}</div>
                {trendBadge(cplTrendData)}
              </div>
            ) : hasGbp ? (
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px' }}>Google Phone Calls</p>
                <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>Taps on your Google Business phone number</p>
                <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{fmtNum(totalGbpCalls)}</div>
                {trendBadge(gbpCallsTrendData)}
              </div>
            ) : null}
          </div>

          {/* Full-width: Daily Traffic & Leads */}
          <div className="rounded-2xl p-8 mb-8" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
            <div style={{ marginBottom: '24px' }}>
              <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px' }}>Day by Day</p>
              <h3 className="text-2xl font-black" style={{ color: '#2c2419' }}>Visitors & Inquiries Over Time</h3>
            </div>
            <div style={{ background: 'rgba(44,36,25,0.02)', borderRadius: '12px', padding: '20px' }}>
              {chartLoading ? <ChartSkeleton /> : dailyData.length > 0 ? (
                <DailyTrafficLineChart data={dailyData} />
              ) : (
                <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#9ca3af' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.5}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  <span style={{ fontSize: '13px' }}>No data for this date range</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-6" style={{ marginTop: '20px' }}>
              <div style={{ padding: '16px', background: 'rgba(157,181,160,0.08)', borderRadius: '12px', borderLeft: '3px solid #9db5a0' }}>
                <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '6px' }}>Avg. Daily Visitors</p>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9db5a0' }}>{fmtNum(Math.round(sessions / Math.max(dailyData.length, 1)))}</div>
              </div>
              <div style={{ padding: '16px', background: 'rgba(217,168,84,0.08)', borderRadius: '12px', borderLeft: '3px solid #d9a854' }}>
                <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '6px' }}>Avg. Daily Inquiries</p>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d9a854' }}>{fmtNum(Math.round(totalLeads / Math.max(dailyData.length, 1)))}</div>
              </div>
            </div>
          </div>

          {/* Main 2-column layout */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.618fr_1fr] gap-8">

            {/* ── Left Column ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-8">

              {/* Performance Trend chart */}
              <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Monthly Progress</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: isTrendUp ? '#9db5a0' : '#c4704f', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {leadTrendData.type === 'neutral' ? '—' : `${isTrendUp ? '↑' : '↓'} ${Math.abs(isNaN(parseFloat(leadTrend)) ? 0 : parseFloat(leadTrend))}%`}
                    </div>
                    <p className="text-xs font-semibold mt-1" style={{ color: '#5c5850' }}>Inquiries vs previous period</p>
                  </div>
                </div>
                <div style={{ background: 'rgba(44,36,25,0.02)', borderRadius: '12px', padding: '20px', marginTop: '24px' }}>
                  {chartLoading ? <ChartSkeleton /> : dailyData.length > 0 ? (
                    <SixMonthBarChart data={dailyData} />
                  ) : (
                    <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#9ca3af' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.5}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                      <span style={{ fontSize: '13px' }}>No data for this date range</span>
                    </div>
                  )}
                </div>
              </div>


              {/* SEO Analytics */}
              {hasSeo && (
                <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                  <div className="mb-6">
                    <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Google Traffic</p>
                    <h3 className="text-2xl font-black mt-2" style={{ color: '#2c2419' }}>How Patients Find You on Google</h3>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Shown on Google', value: seoImpressions > 0 ? fmtNum(seoImpressions) : '—', color: '#9db5a0' },
                      { label: 'Clicked Your Link', value: seoClicks > 0 ? fmtNum(seoClicks) : '—', color: '#d9a854' },
                      { label: 'Click Rate', value: seoCtr !== '0.00' ? `${seoCtr}%` : '—', color: '#c4704f' },
                      { label: 'Search Visitors', value: trafficOrganic > 0 ? fmtNum(trafficOrganic) : '—', color: '#2c2419' },
                    ].map((m, i) => (
                      <div key={i} style={{ padding: '16px', background: 'rgba(44,36,25,0.02)', borderRadius: '12px', textAlign: 'center', borderLeft: `3px solid ${m.color}` }}>
                        <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '8px' }}>{m.label}</p>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: m.color }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* FIX #5: AI Traffic — only show if there is data */}
                  {trafficAi > 0 && (
                    <div style={{ padding: '20px', background: 'linear-gradient(135deg,rgba(44,36,25,0.05),rgba(44,36,25,0.02))', borderRadius: '12px', border: '1px solid rgba(44,36,25,0.08)' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#2c2419' }}>
                        Visitors From AI Tools (ChatGPT, Perplexity, Claude)
                      </h4>
                      <div style={{ display: 'flex', gap: '32px' }}>
                        <div>
                          <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px' }}>Sessions</p>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#c4704f' }}>{fmtNum(trafficAi)}</div>
                        </div>
                        <div>
                          <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px' }}>% of All Traffic</p>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#c4704f' }}>{totalTraffic > 0 ? ((trafficAi / totalTraffic) * 100).toFixed(1) : '0'}%</div>
                        </div>
                        <div style={{ alignSelf: 'flex-end' }}>
                          <p style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>Visitors referred by AI chat tools</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Right Sidebar ────────────────────────────────────────── */}
            <div className="flex flex-col gap-8">

              {/* Lead Distribution — Donut Chart */}
              <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Inquiry Sources</p>
                <h3 className="text-2xl font-black mt-2 mb-4" style={{ color: '#2c2419' }}>Where Inquiries Come From</h3>
                {(() => {
                  const channels = [
                    ...(hasAds ? [{ label: 'Google Ads', sublabel: 'ad inquiries', value: totalAdsConversions, color: '#c4704f' }] : []),
                    ...(hasSeo ? [{ label: 'Website Forms', sublabel: 'contact forms', value: totalFormFills, color: '#9db5a0' }] : []),
                    ...(hasGbp ? [{ label: 'Google Business', sublabel: 'phone calls', value: totalGbpCalls, color: '#d9a854' }] : []),
                  ];
                  const total = channels.reduce((s, c) => s + c.value, 0);
                  return (
                    <>
                      <div style={{ position: 'relative' }}>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={channels.length > 0 && total > 0 ? channels : [{ label: 'No data', sublabel: '', value: 1, color: 'rgba(44,36,25,0.08)' }]}
                              cx="50%" cy="50%"
                              innerRadius={58} outerRadius={88}
                              paddingAngle={channels.length > 1 ? 3 : 0}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              {(channels.length > 0 && total > 0 ? channels : [{ color: 'rgba(44,36,25,0.08)' }]).map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            {total > 0 && (
                              <PieTooltip
                                contentStyle={{ fontSize: '12px', borderRadius: '10px', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                                formatter={(v: any, _: any, props: any) => [`${fmtNum(v)} (${Math.round((v / total) * 100)}%)`, props.payload?.label]}
                              />
                            )}
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Center label */}
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                          <div style={{ fontSize: '26px', fontWeight: 800, color: '#2c2419', lineHeight: 1 }}>{fmtNum(total)}</div>
                          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>total inquiries</div>
                        </div>
                      </div>
                      {/* Legend */}
                      {total > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                          {channels.map((ch, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: ch.color, display: 'inline-block', flexShrink: 0 }} />
                                <div>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#2c2419' }}>{ch.label}</span>
                                  <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '6px' }}>{ch.sublabel}</span>
                                </div>
                              </div>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#2c2419' }}>
                                {fmtNum(ch.value)} <span style={{ fontSize: '11px', fontWeight: 400, color: '#9ca3af' }}>({Math.round((ch.value / Math.max(total, 1)) * 100)}%)</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* FIX #4 & #8: Channel Details — remove Budget Used, fix Active/Inactive logic */}
              {[
                ...(hasAds ? [{
                  title: 'Google Ads',
                  active: hasAds,
                  metrics: [
                    { label: 'Patient Inquiries', value: fmtNum(totalAdsConversions) },
                    { label: 'Ad Clicks', value: fmtNum(adsClicks) },
                    { label: 'Amount Spent', value: fmtCurrency(adSpend, 0) },
                    { label: 'Click Rate', value: `${adsCtr}%` },
                  ]
                }] : []),
                ...(hasSeo ? [{
                  title: 'Google Search',
                  active: hasSeo,
                  metrics: [
                    { label: 'Clicked Your Link', value: fmtNum(seoClicks) },
                    { label: 'Times Shown', value: fmtNum(seoImpressions) },
                    { label: 'Click Rate', value: `${seoCtr}%` },
                    { label: 'Free Visitors', value: trafficOrganic > 0 ? fmtNum(trafficOrganic) : '—' },
                  ]
                }] : []),
                ...(hasGbp ? [{
                  title: 'Google Business Profile',
                  active: hasGbp,
                  metrics: [
                    { label: 'Phone Calls', value: fmtNum(totalGbpCalls) },
                    { label: 'Website Clicks', value: fmtNum(totalGbpWebsiteClicks) },
                    { label: 'Direction Requests', value: fmtNum(totalGbpDirections) },
                    { label: 'Star Rating', value: latestGbpRating > 0 ? `★ ${latestGbpRating.toFixed(1)}` : '—' },
                  ]
                }] : []),
              ].map((ch, i) => (
                <div key={i} className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5c5850' }}>{ch.title}</h4>
                    <span style={{ background: 'rgba(157,181,160,0.1)', color: '#4a6b4e', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                      Active
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {ch.metrics.map((m, j) => (
                      <div key={j} style={{ padding: '12px', background: 'rgba(44,36,25,0.02)', borderRadius: '8px' }}>
                        <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', fontSize: '9px', letterSpacing: '0.1em', marginBottom: '4px' }}>{m.label}</p>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c2419' }}>{m.value}</div>
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
