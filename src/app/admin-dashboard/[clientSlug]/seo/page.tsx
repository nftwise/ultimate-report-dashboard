'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import DateRangePicker from '@/components/admin/DateRangePicker';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';
import SEOTrendChart from '@/components/admin/SEOTrendChart';
import { createClient } from '@supabase/supabase-js';

interface ClientMetrics {
  id: string;
  name: string;
  slug: string;
  city: string;
}

interface DailyMetrics {
  date: string;
  sessions?: number;
  users?: number;
  new_users?: number;
  returning_users?: number;
  sessions_desktop?: number;
  sessions_mobile?: number;
  blog_sessions?: number;
  top_landing_pages?: any;
  traffic_organic?: number;
  traffic_paid?: number;
  traffic_direct?: number;
  traffic_referral?: number;
  traffic_ai?: number;
  keywords_improved?: number;
  keywords_declined?: number;
  engagement_rate?: number;
  conversion_rate?: number;
  seo_impressions?: number;
  seo_clicks?: number;
  seo_ctr?: number;
  google_rank?: number;
  top_keywords?: any;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function SEOPage() {
  const router = useRouter();
  const params = useParams();
  const clientSlug = params?.clientSlug as string;

  const [client, setClient] = useState<ClientMetrics | null>(null);
  const [dailyData, setDailyData] = useState<DailyMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState<7 | 30 | 90>(30);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
  });

  // NEW: Conversion Funnel Data (31 days aggregated)
  const [funnelData, setFunnelData] = useState<{
    sessions: number;
    events: number;
    conversions: number;
  }>({ sessions: 0, events: 0, conversions: 0 });

  const [topLandingPages, setTopLandingPages] = useState<any[]>([]);
  const [topKeywords, setTopKeywords] = useState<any[]>([]);
  const [keywordRankBuckets, setKeywordRankBuckets] = useState<{ top5: number; top10: number; top11to20: number }>({ top5: 0, top10: 0, top11to20: 0 });
  const [keywordMovement, setKeywordMovement] = useState<{ improved: number; declined: number }>({ improved: 0, declined: 0 });
  const [prevPeriodMetrics, setPrevPeriodMetrics] = useState<{ sessions: number; users: number; ctr: number; seoClicks: number }>({ sessions: 0, users: 0, ctr: 0, seoClicks: 0 });
  const [realConversions, setRealConversions] = useState<number>(0);

  const handlePresetDays = (days: 7 | 30 | 90) => {
    setSelectedDays(days);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  const handleDateRangeChange = (newRange: { from: Date; to: Date }) => {
    setDateRange(newRange);
  };

  // Fetch client
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

  // Fetch SEO ONLY metrics from Supabase
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!client) return;

      try {
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

        // ONLY SELECT SEO METRICS - NO ADS, NO GBP
        // Using GA4 sessions + organic traffic (not GSC data)
        const { data: metricsData } = await supabase
          .from('client_metrics_summary')
          .select('date, sessions, users, new_users, returning_users, sessions_desktop, sessions_mobile, blog_sessions, top_landing_pages, traffic_organic, traffic_paid, traffic_direct, traffic_referral, traffic_ai, keywords_improved, keywords_declined, seo_impressions, seo_clicks, seo_ctr, google_rank, top_keywords, engagement_rate, conversion_rate')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: true });

        setDailyData((metricsData || []) as DailyMetrics[]);
      } catch (error) {
        console.error('Error fetching SEO metrics:', error);
      }
    };

    fetchMetrics();
  }, [client, dateRange]);

  // Fetch funnel data (from client_metrics_summary which has aggregated data)
  useEffect(() => {
    const fetchFunnelData = async () => {
      if (!client) return;
      try {
        const dateFromISO = new Date(dateRange.from).toISOString().split('T')[0];
        const dateToISO = new Date(dateRange.to).toISOString().split('T')[0];

        // Get aggregated funnel data from client_metrics_summary
        const { data: summaryData } = await supabase
          .from('client_metrics_summary')
          .select('sessions, content_conversions, engagement_rate')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO);

        // Calculate totals from summary
        const totalSessions = summaryData?.reduce((sum, s) => sum + (s.sessions || 0), 0) || 0;
        // Estimate events as sessions * engagement_rate (if available) or use conversions
        const totalEvents = summaryData?.reduce((sum, e) => {
          const sessions = e.sessions || 0;
          const engagementRate = e.engagement_rate || 0;
          return sum + Math.round(sessions * (engagementRate / 100 || 0.5));
        }, 0) || 0;
        const totalConversions = summaryData?.reduce((sum, c) => sum + (c.content_conversions || 0), 0) || 0;

        setFunnelData({ sessions: totalSessions, events: totalEvents, conversions: totalConversions });

        // Get top landing pages from client_metrics_summary
        const { data: summaryLP } = await supabase
          .from('client_metrics_summary')
          .select('top_landing_pages')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: false })
          .limit(1);

        if (summaryLP && summaryLP[0]?.top_landing_pages) {
          setTopLandingPages(summaryLP[0].top_landing_pages);
        } else {
          setTopLandingPages([]);
        }

        // Get top keywords from client_metrics_summary
        const { data: summaryKW } = await supabase
          .from('client_metrics_summary')
          .select('top_keywords')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: false })
          .limit(1);

        if (summaryKW && summaryKW[0]?.top_keywords) {
          setTopKeywords(summaryKW[0].top_keywords);
        } else {
          setTopKeywords([]);
        }

        // Fetch accurate top10 count from gsc_daily_summary (authoritative source)
        const { data: gscDailySummary } = await supabase
          .from('gsc_daily_summary')
          .select('top_keywords_count')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: false })
          .limit(1);

        const accurateTop10 = gscDailySummary?.[0]?.top_keywords_count || 0;

        // Fetch gsc_queries for estimating top5 and top11to20 (sample data ~50/day)
        const { data: gscData } = await supabase
          .from('gsc_queries')
          .select('query, position')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: false });

        if (gscData && gscData.length > 0) {
          // Deduplicate by query, keeping the best (lowest) position
          const bestPositionByQuery = new Map<string, number>();
          for (const row of gscData) {
            const q = (row.query || '').toLowerCase();
            const pos = row.position || 999;
            if (!bestPositionByQuery.has(q) || pos < bestPositionByQuery.get(q)!) {
              bestPositionByQuery.set(q, pos);
            }
          }
          let sampleTop5 = 0, sampleTop10 = 0, sampleTop11to20 = 0;
          for (const pos of bestPositionByQuery.values()) {
            if (pos <= 5) sampleTop5++;
            if (pos <= 10) sampleTop10++;
            else if (pos <= 20) sampleTop11to20++;
          }
          // Use gsc_daily_summary as authoritative top10; sample data for top5 and 11-20
          setKeywordRankBuckets({ top5: sampleTop5, top10: accurateTop10 || sampleTop10, top11to20: sampleTop11to20 });
        } else {
          // Fallback: use gsc_daily_summary top_keywords_count for top10
          setKeywordRankBuckets({ top5: 0, top10: accurateTop10, top11to20: 0 });
        }
      } catch (error) {
        console.error('Error fetching funnel data:', error);
      }
    };

    fetchFunnelData();
  }, [client, dateRange]);

  // Fetch previous period data for keyword movement + MoM + real conversions
  useEffect(() => {
    const fetchPrevPeriodData = async () => {
      if (!client) return;
      try {
        const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        const prevTo = new Date(dateRange.from);
        prevTo.setDate(prevTo.getDate() - 1);
        const prevFrom = new Date(prevTo);
        prevFrom.setDate(prevFrom.getDate() - periodDays);
        const prevFromISO = prevFrom.toISOString().split('T')[0];
        const prevToISO = prevTo.toISOString().split('T')[0];
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

        // Previous period keywords for movement comparison
        const { data: prevKeywords } = await supabase
          .from('gsc_queries')
          .select('query, position')
          .eq('client_id', client.id)
          .gte('date', prevFromISO)
          .lte('date', prevToISO);

        // Current period keywords
        const { data: currKeywords } = await supabase
          .from('gsc_queries')
          .select('query, position')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO);

        // Compute avg position per keyword for each period
        const avgPos = (rows: any[]) => {
          const map = new Map<string, number[]>();
          for (const r of rows || []) {
            const q = (r.query || '').toLowerCase();
            if (!map.has(q)) map.set(q, []);
            map.get(q)!.push(r.position || 999);
          }
          const result = new Map<string, number>();
          for (const [q, positions] of map) {
            result.set(q, positions.reduce((a, b) => a + b, 0) / positions.length);
          }
          return result;
        };

        const prevAvg = avgPos(prevKeywords || []);
        const currAvg = avgPos(currKeywords || []);

        let improved = 0;
        let declined = 0;
        // Compare keywords that exist in both periods
        for (const [query, currPos] of currAvg) {
          const prevPos = prevAvg.get(query);
          if (prevPos !== undefined) {
            if (prevPos > currPos + 0.5) improved++;
            else if (currPos > prevPos + 0.5) declined++;
          }
        }
        setKeywordMovement({ improved, declined });

        // Previous period metrics for MoM comparison
        const { data: prevMetrics } = await supabase
          .from('client_metrics_summary')
          .select('sessions, users, seo_ctr, seo_clicks')
          .eq('client_id', client.id)
          .gte('date', prevFromISO)
          .lte('date', prevToISO);

        const prevSessions = (prevMetrics || []).reduce((s, d) => s + (d.sessions || 0), 0);
        const prevUsers = (prevMetrics || []).reduce((s, d) => s + (d.users || 0), 0);
        const prevSeoClicks = (prevMetrics || []).reduce((s, d) => s + (d.seo_clicks || 0), 0);
        const prevCtrDays = (prevMetrics || []).filter(d => d.seo_ctr);
        const prevCtr = prevCtrDays.length > 0
          ? prevCtrDays.reduce((s, d) => s + (d.seo_ctr || 0), 0) / prevCtrDays.length
          : 0;
        setPrevPeriodMetrics({ sessions: prevSessions, users: prevUsers, ctr: prevCtr, seoClicks: prevSeoClicks });

        // Real conversions from ga4_events — any event containing "success" (case-insensitive)
        const { count: convCount } = await supabase
          .from('ga4_events')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .ilike('event_name', '%success%');

        setRealConversions(convCount || 0);
      } catch (error) {
        console.error('Error fetching previous period data:', error);
      }
    };

    fetchPrevPeriodData();
  }, [client, dateRange]);

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
        <p style={{ color: '#2c2419' }}>Loading...</p>
      </div>
    );
  }

  // Calculate SEO KPIs ONLY (GA4 based)
  const totalSessions = dailyData.reduce((sum: number, d: any) => sum + (d.sessions || 0), 0);
  const totalUsers = dailyData.reduce((sum: number, d: any) => sum + (d.users || 0), 0);
  const totalOrganicTraffic = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_organic || 0), 0);

  // Keywords improved/declined from previous period comparison (via state)
  const totalKeywordsImproved = keywordMovement.improved;
  const totalKeywordsDeclined = keywordMovement.declined;

  // MoM helper
  const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
  const calcMoM = (current: number, previous: number): { pct: number; label: string } => {
    if (previous === 0) return { pct: current > 0 ? 100 : 0, label: `vs prev ${periodDays}d` };
    return { pct: ((current - previous) / previous) * 100, label: `vs prev ${periodDays}d` };
  };
  const totalImpressions = dailyData.reduce((sum: number, d: any) => sum + (d.seo_impressions || 0), 0);
  const totalClicks = dailyData.reduce((sum: number, d: any) => sum + (d.seo_clicks || 0), 0);
  const sessionsMoM = calcMoM(totalSessions, prevPeriodMetrics.sessions);
  const usersMoM = calcMoM(totalUsers, prevPeriodMetrics.users);
  const avgCtrNum = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const ctrMoM = calcMoM(avgCtrNum, prevPeriodMetrics.ctr);
  const organicMoM = calcMoM(totalOrganicTraffic, prevPeriodMetrics.seoClicks);

  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  // Traffic source totals for pie chart
  const totalTrafficPaid = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_paid || 0), 0);
  const totalTrafficDirect = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_direct || 0), 0);
  const totalTrafficReferral = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_referral || 0), 0);
  const totalTrafficAI = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_ai || 0), 0);

  // Calculate total traffic for percentages
  const totalAllTraffic = totalOrganicTraffic +
                          totalTrafficPaid + totalTrafficDirect + totalTrafficReferral + totalTrafficAI;

  // Engagement metrics
  const avgEngagementRate = dailyData.length > 0
    ? (dailyData.reduce((sum: number, d: any) => sum + (d.engagement_rate || 0), 0) / (dailyData.filter((d: any) => d.engagement_rate).length || 1)).toFixed(1)
    : '0.0';
  const avgConversionRate = dailyData.length > 0
    ? (dailyData.reduce((sum: number, d: any) => sum + (d.conversion_rate || 0), 0) / dailyData.filter((d: any) => d.conversion_rate).length || 0).toFixed(2)
    : '0.00';

  // GSC metrics
  const avgGoogleRank = dailyData.length > 0
    ? (dailyData.reduce((sum: number, d: any) => sum + (d.google_rank || 0), 0) / dailyData.filter((d: any) => d.google_rank).length).toFixed(1)
    : '0.0';

  const latestTopKeywords = dailyData.length > 0 ? dailyData[dailyData.length - 1].top_keywords : null;

  // Prepare data for traffic channels (primary sources only - no overlap)
  const trafficSourceData = [
    { name: 'Organic', value: totalOrganicTraffic, color: '#9db5a0' },
    { name: 'Direct', value: totalTrafficDirect, color: '#a8a094' },
    { name: 'Paid', value: totalTrafficPaid, color: '#c4704f' },
    { name: 'Referral', value: totalTrafficReferral, color: '#8b7355' },
    { name: 'AI', value: totalTrafficAI, color: '#6b5b95' }
  ].filter(source => source.value > 0);

  // Note: Branded/Non-Branded are sub-categories of traffic, not primary sources
  // They're shown separately in Search Health Analysis section

  // NEW: User Identity Metrics
  const totalNewUsers = dailyData.reduce((sum: number, d: any) => sum + (d.new_users || 0), 0);
  const totalReturningUsers = dailyData.reduce((sum: number, d: any) => sum + (d.returning_users || 0), 0);
  const totalDesktopSessions = dailyData.reduce((sum: number, d: any) => sum + (d.sessions_desktop || 0), 0);
  const totalMobileSessions = dailyData.reduce((sum: number, d: any) => sum + (d.sessions_mobile || 0), 0);

  // NEW: Percentages for progress bars
  const newUserPercent = totalUsers > 0 ? ((totalNewUsers / totalUsers) * 100).toFixed(1) : '0';
  const returningUserPercent = totalUsers > 0 ? ((totalReturningUsers / totalUsers) * 100).toFixed(1) : '0';
  const desktopPercent = totalSessions > 0 ? ((totalDesktopSessions / totalSessions) * 100).toFixed(1) : '0';
  const mobilePercent = totalSessions > 0 ? ((totalMobileSessions / totalSessions) * 100).toFixed(1) : '0';

  // NEW: Keywords net change
  const keywordsNetChange = totalKeywordsImproved - totalKeywordsDeclined;

  // NEW: Blog metrics
  const totalBlogSessions = dailyData.reduce((sum: number, d: any) => sum + (d.blog_sessions || 0), 0);
  const latestTopLandingPages = dailyData.length > 0 ? dailyData[dailyData.length - 1].top_landing_pages : null;

  // Keywords Ranking Analysis (from gsc_queries, deduplicated by query)
  const keywordsInTop5 = keywordRankBuckets.top5;
  const keywordsInTop10 = keywordRankBuckets.top10;
  const keywordsIn11To20 = keywordRankBuckets.top11to20;
  const daysWithRankData = dailyData.filter((d: any) => d.google_rank).length;

  const avgGoogleRankValue = daysWithRankData > 0
    ? (dailyData.filter((d: any) => d.google_rank).reduce((sum: number, d: any) => sum + (d.google_rank || 0), 0) / daysWithRankData)
    : 0;

  // Calculate funnel metrics
  const funnelMetrics = {
    sessionToEventRate: funnelData.sessions > 0 ? ((funnelData.events / funnelData.sessions) * 100).toFixed(1) : '0',
    eventToConversionRate: funnelData.events > 0 ? ((funnelData.conversions / funnelData.events) * 100).toFixed(2) : '0',
    sessionToConversionRate: funnelData.sessions > 0 ? ((funnelData.conversions / funnelData.sessions) * 100).toFixed(2) : '0'
  };

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} clientName={client.name} clientCity={client.city} activeTab="seo" />

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

        {/* Main Content Area */}
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {/* Section 1: Page Header */}
            <div className="mb-12">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.15em' }}>SEO PERFORMANCE</span>
              <h1 className="text-4xl font-black mt-2" style={{ color: '#2c2419', letterSpacing: '-0.02em' }}>Search Performance Report</h1>
              <p className="text-sm mt-2" style={{ color: '#9ca3af' }}>Organic search visibility and traffic metrics</p>
            </div>

            {/* Section 2: SEO Key Metrics */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '32px'
            }}>
              {/* User Sessions Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>User Sessions</p>
                <p style={{ fontSize: '32px', fontWeight: '700', color: '#2c2419', margin: '0 0 4px 0' }}>{totalSessions.toLocaleString()}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: sessionsMoM.pct >= 0 ? '#10b981' : '#ef4444' }}>
                    {sessionsMoM.pct >= 0 ? '+' : ''}{sessionsMoM.pct.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: '9px', color: '#9ca3af' }}>{sessionsMoM.label}</span>
                </div>
              </div>

              {/* Users Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Users</p>
                <p style={{ fontSize: '32px', fontWeight: '700', color: '#2c2419', margin: '0 0 4px 0' }}>{totalUsers.toLocaleString()}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: usersMoM.pct >= 0 ? '#10b981' : '#ef4444' }}>
                    {usersMoM.pct >= 0 ? '+' : ''}{usersMoM.pct.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: '9px', color: '#9ca3af' }}>{usersMoM.label}</span>
                </div>
              </div>

              {/* CTR Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>CTR</p>
                <p style={{ fontSize: '32px', fontWeight: '700', color: '#2c2419', margin: '0 0 4px 0' }}>{avgCtr}%</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: ctrMoM.pct >= 0 ? '#10b981' : '#ef4444' }}>
                    {ctrMoM.pct >= 0 ? '+' : ''}{ctrMoM.pct.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: '9px', color: '#9ca3af' }}>{ctrMoM.label}</span>
                </div>
              </div>

              {/* Organic Traffic Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Organic Traffic</p>
                <p style={{ fontSize: '32px', fontWeight: '700', color: '#2c2419', margin: '0 0 4px 0' }}>{totalOrganicTraffic.toLocaleString()}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: organicMoM.pct >= 0 ? '#10b981' : '#ef4444' }}>
                    {organicMoM.pct >= 0 ? '+' : ''}{organicMoM.pct.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: '9px', color: '#9ca3af' }}>{organicMoM.label}</span>
                </div>
              </div>
            </div>

            {/* Section 3: Visual Trend Analysis - Daily SEO Performance Chart */}
            <div className="mb-12" style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: '24px'
              }}>
                <div>
                  <p style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: '#5c5850',
                    margin: '0 0 8px 0'
                  }}>
                    📈 Daily Performance Trend
                  </p>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#2c2419',
                    margin: '0',
                    letterSpacing: '-0.02em'
                  }}>
                    Search Visibility Over Time
                  </h3>
                </div>
              </div>

              {/* Line Chart */}
              <SEOTrendChart data={dailyData} height={380} />

              {/* Summary Stats Below Chart */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                marginTop: '24px'
              }}>
                <div style={{
                  background: 'rgba(196, 112, 79, 0.08)',
                  borderRadius: '8px',
                  padding: '16px',
                  borderLeft: '3px solid #c4704f',
                  textAlign: 'center'
                }}>
                  <p style={{
                    fontSize: '10px',
                    color: '#5c5850',
                    margin: '0 0 8px 0',
                    fontWeight: '600'
                  }}>
                    Total Impressions
                  </p>
                  <p style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#c4704f',
                    margin: '0 0 4px 0'
                  }}>
                    {totalImpressions.toLocaleString()}
                  </p>
                  <p style={{
                    fontSize: '9px',
                    color: '#9ca3af',
                    margin: '0'
                  }}>
                    from {dailyData.length} days
                  </p>
                </div>

                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  borderRadius: '8px',
                  padding: '16px',
                  borderLeft: '3px solid #10b981',
                  textAlign: 'center'
                }}>
                  <p style={{
                    fontSize: '10px',
                    color: '#5c5850',
                    margin: '0 0 8px 0',
                    fontWeight: '600'
                  }}>
                    Total Clicks
                  </p>
                  <p style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#10b981',
                    margin: '0 0 4px 0'
                  }}>
                    {totalClicks.toLocaleString()}
                  </p>
                  <p style={{
                    fontSize: '9px',
                    color: '#9ca3af',
                    margin: '0'
                  }}>
                    from search results
                  </p>
                </div>

                <div style={{
                  background: 'rgba(217, 168, 84, 0.08)',
                  borderRadius: '8px',
                  padding: '16px',
                  borderLeft: '3px solid #d9a854',
                  textAlign: 'center'
                }}>
                  <p style={{
                    fontSize: '10px',
                    color: '#5c5850',
                    margin: '0 0 8px 0',
                    fontWeight: '600'
                  }}>
                    Average CTR
                  </p>
                  <p style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#d9a854',
                    margin: '0 0 4px 0'
                  }}>
                    {avgCtr}%
                  </p>
                  <p style={{
                    fontSize: '9px',
                    color: '#9ca3af',
                    margin: '0'
                  }}>
                    click-through rate
                  </p>
                </div>
              </div>
            </div>

            {/* Traffic Funnel - Horizontal */}
            <div className="mb-12" style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
            }}>
              <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                🎯 Traffic Funnel
              </p>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#2c2419', margin: '0 0 28px 0', letterSpacing: '-0.02em' }}>
                All Sessions → Organic → Conversions
              </h3>

              {/* Horizontal funnel bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Stage 1: All Sessions */}
                {(() => {
                  const s1 = totalSessions;
                  const s2 = totalOrganicTraffic;
                  const s3 = realConversions || funnelData.conversions;
                  const maxVal = s1 || 1;
                  const organicRate = s1 > 0 ? ((s2 / s1) * 100).toFixed(1) : '0';
                  const convRate = s2 > 0 ? ((s3 / s2) * 100).toFixed(1) : '0';
                  return (
                    <>
                      {/* Row 1 */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All Sessions</span>
                          <span style={{ fontSize: '22px', fontWeight: '700', color: '#9db5a0' }}>{s1.toLocaleString()}</span>
                        </div>
                        <div style={{ width: '100%', height: '36px', background: 'rgba(44,36,25,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
                          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #9db5a0, #b8ceba)', borderRadius: '8px', display: 'flex', alignItems: 'center', paddingLeft: '12px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#fff' }}>100%</span>
                          </div>
                        </div>
                      </div>

                      {/* Arrow + rate */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px' }}>
                        <span style={{ fontSize: '16px', color: '#9db5a0' }}>↓</span>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#d9a854', background: 'rgba(217,168,84,0.12)', padding: '3px 10px', borderRadius: '20px' }}>
                          {organicRate}% organic rate
                        </span>
                      </div>

                      {/* Row 2 */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Organic Traffic</span>
                          <span style={{ fontSize: '22px', fontWeight: '700', color: '#c4704f' }}>{s2.toLocaleString()}</span>
                        </div>
                        <div style={{ width: '100%', height: '36px', background: 'rgba(44,36,25,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max((s2 / maxVal) * 100, 2)}%`, height: '100%', background: 'linear-gradient(90deg, #c4704f, #d4845f)', borderRadius: '8px', display: 'flex', alignItems: 'center', paddingLeft: '12px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#fff' }}>{organicRate}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Arrow + rate */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px' }}>
                        <span style={{ fontSize: '16px', color: '#c4704f' }}>↓</span>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '3px 10px', borderRadius: '20px' }}>
                          {convRate}% conversion rate
                        </span>
                      </div>

                      {/* Row 3 */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conversions</span>
                          <span style={{ fontSize: '22px', fontWeight: '700', color: '#10b981' }}>{s3.toLocaleString()}</span>
                        </div>
                        <div style={{ width: '100%', height: '36px', background: 'rgba(44,36,25,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max((s3 / maxVal) * 100, 1)}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '8px', display: 'flex', alignItems: 'center', paddingLeft: '12px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#fff' }}>{s1 > 0 ? ((s3/s1)*100).toFixed(2) : 0}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Summary row */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid rgba(44,36,25,0.08)' }}>
                        <div style={{ textAlign: 'center', background: 'rgba(157,181,160,0.08)', borderRadius: '10px', padding: '12px' }}>
                          <p style={{ fontSize: '9px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600', textTransform: 'uppercase' }}>Avg Daily Sessions</p>
                          <p style={{ fontSize: '20px', fontWeight: '700', color: '#9db5a0', margin: 0 }}>{dailyData.length > 0 ? Math.round(s1 / dailyData.length) : 0}</p>
                        </div>
                        <div style={{ textAlign: 'center', background: 'rgba(196,112,79,0.08)', borderRadius: '10px', padding: '12px' }}>
                          <p style={{ fontSize: '9px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600', textTransform: 'uppercase' }}>Organic Share</p>
                          <p style={{ fontSize: '20px', fontWeight: '700', color: '#c4704f', margin: 0 }}>{organicRate}%</p>
                        </div>
                        <div style={{ textAlign: 'center', background: 'rgba(16,185,129,0.08)', borderRadius: '10px', padding: '12px' }}>
                          <p style={{ fontSize: '9px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600', textTransform: 'uppercase' }}>Overall Conv. Rate</p>
                          <p style={{ fontSize: '20px', fontWeight: '700', color: '#10b981', margin: 0 }}>{s1 > 0 ? ((s3/s1)*100).toFixed(2) : 0}%</p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Tier 3: Analysis Columns (full width Search Health Analysis) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginBottom: '32px' }}>
              {/* Search Health Analysis */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                  📊 Search Health Analysis
                </p>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#2c2419', margin: '0 0 20px 0', letterSpacing: '-0.02em' }}>
                  Keyword Performance & Engagement
                </h3>

                {/* Sub-cards: Keyword Movement */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', borderTop: '3px solid #10b981' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>📈 Improved</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#10b981', margin: 0 }}>{totalKeywordsImproved}</p>
                  </div>
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', borderTop: '3px solid #ef4444' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>📉 Declined</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444', margin: 0 }}>{totalKeywordsDeclined}</p>
                  </div>
                  <div style={{
                    background: keywordsNetChange >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    borderRadius: '12px', padding: '16px', textAlign: 'center',
                    borderTop: `3px solid ${keywordsNetChange >= 0 ? '#10b981' : '#ef4444'}`
                  }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Net Change</p>
                    <p style={{
                      fontSize: '24px', fontWeight: '700',
                      color: keywordsNetChange >= 0 ? '#10b981' : '#ef4444',
                      margin: 0
                    }}>
                      {keywordsNetChange >= 0 ? '+' : ''}{keywordsNetChange}
                    </p>
                  </div>
                </div>

                {/* Progress Bars: Engagement Metrics */}
                <div style={{ marginTop: '20px' }}>
                  <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Engagement Metrics</p>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>Engagement Rate</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#10b981' }}>{avgEngagementRate}%</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: 'rgba(44, 36, 25, 0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(parseFloat(avgEngagementRate), 100)}%`, height: '100%', background: '#10b981', transition: 'width 0.3s ease' }}></div>
                    </div>
                    <p style={{ fontSize: '9px', color: '#9ca3af', margin: '4px 0 0 0', textAlign: 'right' }}>
                      {parseFloat(avgEngagementRate) > 60 ? 'Excellent' : parseFloat(avgEngagementRate) > 40 ? 'Good' : 'Needs improvement'}
                    </p>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>Conversion Rate</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#d9a854' }}>{avgConversionRate}%</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: 'rgba(44, 36, 25, 0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(parseFloat(avgConversionRate) * 10, 100)}%`, height: '100%', background: '#d9a854', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                  <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '20px 0 8px 0', textTransform: 'uppercase' }}>CTR Performance</p>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>Click-Through Rate</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#c4704f' }}>{avgCtr}%</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: 'rgba(44, 36, 25, 0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(parseFloat(avgCtr), 100)}%`,
                        height: '100%',
                        background: parseFloat(avgCtr) > 5 ? '#10b981' : parseFloat(avgCtr) > 2 ? '#d9a854' : '#c4704f',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                    <p style={{ fontSize: '9px', color: '#9ca3af', margin: '4px 0 0 0', textAlign: 'right' }}>
                      {parseFloat(avgCtr) > 5 ? 'Excellent' : parseFloat(avgCtr) > 2 ? 'Good' : 'Needs improvement'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tier 4: Granular Data (2x2 grid @ 50/50) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '32px' }}>
              {/* Column 1: Keywords Top Rankings */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                  🏆 Keywords Ranking
                </p>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#2c2419', margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
                  Top Performing Keywords
                </h3>

                {/* Ranking Breakdown Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '12px',
                    padding: '12px',
                    textAlign: 'center',
                    borderTop: '3px solid #10b981'
                  }}>
                    <p style={{ fontSize: '9px', fontWeight: '600', color: '#5c5850', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
                      Top 5
                    </p>
                    <p style={{ fontSize: '22px', fontWeight: '700', color: '#10b981', margin: 0 }}>
                      {keywordsInTop5}
                    </p>
                  </div>
                  <div style={{
                    background: 'rgba(217, 168, 84, 0.1)',
                    borderRadius: '12px',
                    padding: '12px',
                    textAlign: 'center',
                    borderTop: '3px solid #d9a854'
                  }}>
                    <p style={{ fontSize: '9px', fontWeight: '600', color: '#5c5850', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
                      Top 10
                    </p>
                    <p style={{ fontSize: '22px', fontWeight: '700', color: '#d9a854', margin: 0 }}>
                      {keywordsInTop10}
                    </p>
                  </div>
                  <div style={{
                    background: 'rgba(196, 112, 79, 0.1)',
                    borderRadius: '12px',
                    padding: '12px',
                    textAlign: 'center',
                    borderTop: '3px solid #c4704f'
                  }}>
                    <p style={{ fontSize: '9px', fontWeight: '600', color: '#5c5850', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
                      11-20
                    </p>
                    <p style={{ fontSize: '22px', fontWeight: '700', color: '#c4704f', margin: 0 }}>
                      {keywordsIn11To20}
                    </p>
                  </div>
                </div>

                {/* Content Performance */}
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '0 0 12px 0', textTransform: 'uppercase' }}>Content Performance</p>
                  <div style={{ display: 'grid', gridTemplateColumns: totalBlogSessions > 0 ? '1fr 1fr' : '1fr', gap: '10px' }}>
                    {totalBlogSessions > 0 && (
                      <div style={{ background: 'rgba(157,181,160,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center', borderTop: '3px solid #9db5a0' }}>
                        <p style={{ fontSize: '9px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600', textTransform: 'uppercase' }}>Blog Sessions</p>
                        <p style={{ fontSize: '20px', fontWeight: '700', color: '#9db5a0', margin: 0 }}>{totalBlogSessions.toLocaleString()}</p>
                      </div>
                    )}
                    <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center', borderTop: '3px solid #10b981' }}>
                      <p style={{ fontSize: '9px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600', textTransform: 'uppercase' }}>Engagement</p>
                      <p style={{ fontSize: '20px', fontWeight: '700', color: '#10b981', margin: 0 }}>{avgEngagementRate}%</p>
                    </div>
                  </div>
                </div>

                {/* Avg Rank summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginTop: '16px' }}>
                  <div style={{ background: 'rgba(44,36,25,0.04)', borderRadius: '10px', padding: '12px', textAlign: 'center', borderTop: '3px solid #2c2419' }}>
                    <p style={{ fontSize: '9px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600', textTransform: 'uppercase' }}>Avg Rank</p>
                    <p style={{ fontSize: '20px', fontWeight: '700', color: '#2c2419', margin: 0 }}>{avgGoogleRankValue.toFixed(1)}</p>
                  </div>
                </div>
              </div>

              {/* Column 2: SEO Momentum */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                  📈 SEO Momentum
                </p>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#2c2419', margin: '0 0 20px 0', letterSpacing: '-0.02em' }}>
                  Search Visibility Performance
                </h3>
                {/* Avg Position card */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: 'rgba(44,36,25,0.04)', borderRadius: '10px', padding: '14px', borderLeft: '3px solid #2c2419' }}>
                    <p style={{ fontSize: '9px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600', textTransform: 'uppercase' }}>Avg Position</p>
                    <p style={{ fontSize: '22px', fontWeight: '700', color: '#2c2419', margin: 0 }}>#{avgGoogleRankValue.toFixed(1)}</p>
                    <p style={{ fontSize: '9px', color: '#9ca3af', margin: '2px 0 0 0' }}>average Google rank</p>
                  </div>
                </div>
                {/* Keyword movement bar */}
                <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(44,36,25,0.08)' }}>
                  <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '0 0 10px 0', textTransform: 'uppercase' }}>Keyword Movement</p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1, background: 'rgba(16,185,129,0.1)', borderRadius: '8px', padding: '10px', textAlign: 'center', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <p style={{ fontSize: '9px', color: '#10b981', margin: '0 0 2px 0', fontWeight: '700' }}>↑ IMPROVED</p>
                      <p style={{ fontSize: '20px', fontWeight: '700', color: '#10b981', margin: 0 }}>{totalKeywordsImproved}</p>
                    </div>
                    <div style={{ fontSize: '16px', color: '#9ca3af' }}>vs</div>
                    <div style={{ flex: 1, background: 'rgba(239,68,68,0.1)', borderRadius: '8px', padding: '10px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <p style={{ fontSize: '9px', color: '#ef4444', margin: '0 0 2px 0', fontWeight: '700' }}>↓ DECLINED</p>
                      <p style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444', margin: 0 }}>{totalKeywordsDeclined}</p>
                    </div>
                    <div style={{
                      flex: 1, borderRadius: '8px', padding: '10px', textAlign: 'center',
                      background: keywordsNetChange >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${keywordsNetChange >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
                    }}>
                      <p style={{ fontSize: '9px', color: '#5c5850', margin: '0 0 2px 0', fontWeight: '700' }}>NET</p>
                      <p style={{ fontSize: '20px', fontWeight: '700', color: keywordsNetChange >= 0 ? '#10b981' : '#ef4444', margin: 0 }}>
                        {keywordsNetChange >= 0 ? '+' : ''}{keywordsNetChange}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 3: Engagement Breakdown */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                  💡 Engagement Breakdown
                </p>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#2c2419', margin: '0 0 20px 0', letterSpacing: '-0.02em' }}>
                  How Users Interact
                </h3>
                {/* New vs Returning */}
                <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '0 0 10px 0', textTransform: 'uppercase' }}>New vs Returning</p>
                {[
                  { label: 'New Users', value: dailyData.reduce((s: number, d: any) => s + (d.new_users || 0), 0), color: '#10b981', total: totalUsers },
                  { label: 'Returning Users', value: dailyData.reduce((s: number, d: any) => s + (d.returning_users || 0), 0), color: '#c4704f', total: totalUsers },
                ].map((item, idx) => (
                  <div key={idx} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850', fontWeight: '500' }}>{item.label}</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: item.color }}>
                        {item.value.toLocaleString()} ({item.total > 0 ? ((item.value / item.total) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(44,36,25,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%`, height: '100%', background: item.color, borderRadius: '4px' }}></div>
                    </div>
                  </div>
                ))}
                {/* Desktop vs Mobile */}
                <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '16px 0 10px 0', textTransform: 'uppercase' }}>Device Split</p>
                {[
                  { label: 'Desktop', value: totalDesktopSessions, color: '#d9a854', total: totalSessions },
                  { label: 'Mobile', value: totalMobileSessions, color: '#9db5a0', total: totalSessions },
                ].map((item, idx) => (
                  <div key={idx} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850', fontWeight: '500' }}>{item.label}</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: item.color }}>
                        {item.value.toLocaleString()} ({item.total > 0 ? ((item.value / item.total) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(44,36,25,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%`, height: '100%', background: item.color, borderRadius: '4px' }}></div>
                    </div>
                  </div>
                ))}
                {/* Organic vs Paid */}
                <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '16px 0 10px 0', textTransform: 'uppercase' }}>Organic vs Paid</p>
                {[
                  { label: 'Organic', value: totalOrganicTraffic, color: '#9db5a0' },
                  { label: 'Paid', value: totalTrafficPaid, color: '#c4704f' },
                ].map((item, idx) => {
                  const total = totalOrganicTraffic + totalTrafficPaid;
                  return (
                    <div key={idx} style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#5c5850', fontWeight: '500' }}>{item.label}</span>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: item.color }}>
                          {item.value.toLocaleString()} ({total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(44,36,25,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%`, height: '100%', background: item.color, borderRadius: '4px' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Column 4 (Row 2, Col 2): Traffic Channel Distribution */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                  🚀 Traffic Channels
                </p>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#2c2419', margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
                  Channel Distribution
                </h3>
                <div>
                  {trafficSourceData.map((source, idx) => {
                    const percentage = totalAllTraffic > 0
                      ? ((source.value / totalAllTraffic) * 100).toFixed(1)
                      : '0.0';
                    return (
                      <div key={idx} style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#2c2419' }}>{source.name}</span>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: source.color }}>
                            {source.value.toLocaleString()} ({percentage}%)
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(44, 36, 25, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${percentage}%`,
                            height: '100%',
                            background: source.color,
                            transition: 'width 0.3s ease'
                          }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 5: Summary - SEO Only */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)',
              marginBottom: '32px'
            }}>
              <p style={{
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#5c5850',
                margin: '0 0 12px 0'
              }}>
                💡 SEO Key Insights
              </p>
              <p style={{
                fontSize: '11px',
                color: '#5c5850',
                margin: 0,
                lineHeight: '1.5'
              }}>
                Your site appeared in search results <strong>{totalImpressions.toLocaleString()} times</strong>, generating <strong>{totalClicks.toLocaleString()} clicks</strong> with an average CTR of <strong>{avgCtr}%</strong>.
                Organic search traffic generated <strong>{totalOrganicTraffic.toLocaleString()} sessions</strong> with <strong>{avgEngagementRate}% engagement rate</strong>.
                Keywords improved (period over period): <strong>{totalKeywordsImproved}</strong> | Keywords declined: <strong>{totalKeywordsDeclined}</strong>.
                {sessionsMoM.pct > 0 ? `Sessions are up ${sessionsMoM.pct.toFixed(1)}% compared to the previous period.` : sessionsMoM.pct < 0 ? `Sessions are down ${Math.abs(sessionsMoM.pct).toFixed(1)}% compared to the previous period.` : ''}
              </p>
            </div>
          </div>
        </div>
    </AdminLayout>
  );
}
