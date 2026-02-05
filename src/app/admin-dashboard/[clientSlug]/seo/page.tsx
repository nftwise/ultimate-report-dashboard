'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import DateRangePicker from '@/components/admin/DateRangePicker';
import ClientDetailsSidebar from '@/components/admin/ClientDetailsSidebar';
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
  branded_traffic?: number;
  non_branded_traffic?: number;
  keywords_improved?: number;
  keywords_declined?: number;
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
          .select('date, sessions, users, new_users, returning_users, sessions_desktop, sessions_mobile, blog_sessions, top_landing_pages, traffic_organic, traffic_paid, traffic_direct, traffic_referral, traffic_ai, branded_traffic, non_branded_traffic, keywords_improved, keywords_declined, seo_impressions, seo_clicks, seo_ctr, google_rank, top_keywords')
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

  // Fetch funnel data
  useEffect(() => {
    const fetchFunnelData = async () => {
      if (!client) return;
      try {
        const dateFromISO = new Date(dateRange.from).toISOString().split('T')[0];
        const dateToISO = new Date(dateRange.to).toISOString().split('T')[0];

        // Get sessions
        const { data: sessionsData } = await supabase
          .from('ga4_sessions')
          .select('sessions, conversions')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO);

        // Get events
        const { data: eventsData } = await supabase
          .from('ga4_events')
          .select('event_count')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO);

        // Get conversions
        const { data: conversionsData } = await supabase
          .from('ga4_conversions')
          .select('conversions')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO);

        const totalSessions = sessionsData?.reduce((sum, s) => sum + (s.sessions || 0), 0) || 0;
        const totalEvents = eventsData?.reduce((sum, e) => sum + (e.event_count || 0), 0) || 0;
        const totalConversions = conversionsData?.reduce((sum, c) => sum + (c.conversions || 0), 0) || 0;

        setFunnelData({ sessions: totalSessions, events: totalEvents, conversions: totalConversions });

        // Get top landing pages
        const { data: lpData } = await supabase
          .from('ga4_landing_pages')
          .select('landing_page, sessions, conversions, conversion_rate, bounce_rate')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('sessions', { ascending: false })
          .limit(5);

        setTopLandingPages(lpData || []);

        // Get top keywords
        const { data: kwData } = await supabase
          .from('gsc_queries')
          .select('query, clicks, impressions, ctr, position')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('impressions', { ascending: false })
          .limit(5);

        setTopKeywords(kwData || []);
      } catch (error) {
        console.error('Error fetching funnel data:', error);
      }
    };

    fetchFunnelData();
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
  const totalBrandedTraffic = dailyData.reduce((sum: number, d: any) => sum + (d.branded_traffic || 0), 0);
  const totalNonBrandedTraffic = dailyData.reduce((sum: number, d: any) => sum + (d.non_branded_traffic || 0), 0);
  const totalKeywordsImproved = dailyData.reduce((sum: number, d: any) => sum + (d.keywords_improved || 0), 0);
  const totalKeywordsDeclined = dailyData.reduce((sum: number, d: any) => sum + (d.keywords_declined || 0), 0);
  const totalImpressions = dailyData.reduce((sum: number, d: any) => sum + (d.seo_impressions || 0), 0);
  const totalClicks = dailyData.reduce((sum: number, d: any) => sum + (d.seo_clicks || 0), 0);

  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  // Traffic source totals for pie chart
  const totalTrafficPaid = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_paid || 0), 0);
  const totalTrafficDirect = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_direct || 0), 0);
  const totalTrafficReferral = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_referral || 0), 0);
  const totalTrafficAI = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_ai || 0), 0);

  // Calculate total traffic for percentages
  const totalAllTraffic = totalOrganicTraffic + totalBrandedTraffic + totalNonBrandedTraffic +
                          totalTrafficPaid + totalTrafficDirect + totalTrafficReferral + totalTrafficAI;

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

  // NEW: Branded vs Non-Branded percentages
  const totalBrandedNonBranded = totalBrandedTraffic + totalNonBrandedTraffic;
  const brandedPercent = totalBrandedNonBranded > 0
    ? ((totalBrandedTraffic / totalBrandedNonBranded) * 100).toFixed(1) : '0';
  const nonBrandedPercent = totalBrandedNonBranded > 0
    ? ((totalNonBrandedTraffic / totalBrandedNonBranded) * 100).toFixed(1) : '0';

  // NEW: Keywords net change
  const keywordsNetChange = totalKeywordsImproved - totalKeywordsDeclined;

  // NEW: Blog metrics
  const totalBlogSessions = dailyData.reduce((sum: number, d: any) => sum + (d.blog_sessions || 0), 0);
  const latestTopLandingPages = dailyData.length > 0 ? dailyData[dailyData.length - 1].top_landing_pages : null;

  // NEW: Keywords Ranking Analysis (Top 5, Top 10, 11-20)
  const keywordsInTop5 = dailyData.filter((d: any) => d.google_rank && d.google_rank <= 5).length;
  const keywordsInTop10 = dailyData.filter((d: any) => d.google_rank && d.google_rank <= 10).length;
  const keywordsIn11To20 = dailyData.filter((d: any) => d.google_rank && d.google_rank > 10 && d.google_rank <= 20).length;
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
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
      {/* Sidebar */}
      <ClientDetailsSidebar clientSlug={clientSlug} />

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Header Navigation */}
        <nav className="sticky top-0 z-50 flex items-center gap-6 px-8 py-4" style={{
          background: 'rgba(245, 241, 237, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(44, 36, 25, 0.1)'
        }}>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 hover:opacity-70 transition"
            style={{ color: '#c4704f' }}
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <div>
            <h1 className="text-2xl font-black" style={{ color: '#2c2419' }}>SEO Analytics</h1>
            <p className="text-sm" style={{ color: '#5c5850' }}>{client.name}</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex gap-1 p-1 rounded-full" style={{ background: 'rgba(44, 36, 25, 0.05)' }}>
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => handlePresetDays(days as 7 | 30 | 90)}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition"
                  style={{
                    background: days === selectedDays ? '#fff' : 'transparent',
                    color: days === selectedDays ? '#2c2419' : '#5c5850',
                    cursor: 'pointer'
                  }}
                >
                  {days}d
                </button>
              ))}
            </div>
            <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
          </div>
        </nav>

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
                <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>From GA4</p>
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
                <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>Unique visitors</p>
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
                <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>Click-through rate</p>
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
                <p style={{ fontSize: '32px', fontWeight: '700', color: '#2c2419', margin: '0 0 4px 0' }}>{totalOrganicTraffic}</p>
                <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>Sessions from search</p>
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

            {/* Conversion Funnel - Vertical Bars */}
            <div className="mb-12" style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
            }}>
              <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                🎯 Conversion Funnel
              </p>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#2c2419', margin: '0 0 24px 0', letterSpacing: '-0.02em' }}>
                Sessions → Events → Conversions
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', alignItems: 'flex-end' }}>
                {/* Stage 1: Sessions */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    background: 'linear-gradient(180deg, rgba(157, 181, 160, 0.15), rgba(157, 181, 160, 0.05))',
                    borderRadius: '12px',
                    padding: '24px 16px',
                    border: '2px solid #9db5a0',
                    minHeight: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end'
                  }}>
                    <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                      Stage 1: Sessions
                    </p>
                    <p style={{ fontSize: '36px', fontWeight: '700', color: '#9db5a0', margin: '0 0 8px 0' }}>
                      {funnelData.sessions.toLocaleString()}
                    </p>
                    <p style={{ fontSize: '11px', color: '#5c5850', margin: '0', fontWeight: '500' }}>
                      Entry point
                    </p>
                  </div>
                </div>

                {/* Arrow Down + Rate */}
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
                  <p style={{ fontSize: '24px', margin: '0', color: '#9db5a0' }}>↓</p>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#d9a854', margin: '0', background: 'rgba(217, 168, 84, 0.1)', padding: '6px 8px', borderRadius: '6px' }}>
                    {funnelMetrics.sessionToEventRate}%
                  </p>
                </div>

                {/* Stage 2: Events */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    background: 'linear-gradient(180deg, rgba(217, 168, 84, 0.15), rgba(217, 168, 84, 0.05))',
                    borderRadius: '12px',
                    padding: '24px 16px',
                    border: '2px solid #d9a854',
                    minHeight: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end'
                  }}>
                    <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                      Stage 2: Events
                    </p>
                    <p style={{ fontSize: '36px', fontWeight: '700', color: '#d9a854', margin: '0 0 8px 0' }}>
                      {funnelData.events.toLocaleString()}
                    </p>
                    <p style={{ fontSize: '11px', color: '#5c5850', margin: '0', fontWeight: '500' }}>
                      User engagement
                    </p>
                  </div>
                </div>

                {/* Arrow Down + Rate */}
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
                  <p style={{ fontSize: '24px', margin: '0', color: '#d9a854' }}>↓</p>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#ef4444', margin: '0', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 8px', borderRadius: '6px' }}>
                    {funnelMetrics.eventToConversionRate}%
                  </p>
                </div>

                {/* Stage 3: Conversions */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))',
                    borderRadius: '12px',
                    padding: '24px 16px',
                    border: '2px solid #10b981',
                    minHeight: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end'
                  }}>
                    <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                      Stage 3: Conversions
                    </p>
                    <p style={{ fontSize: '36px', fontWeight: '700', color: '#10b981', margin: '0 0 8px 0' }}>
                      {funnelData.conversions.toLocaleString()}
                    </p>
                    <p style={{ fontSize: '11px', color: '#5c5850', margin: '0', fontWeight: '500' }}>
                      Goals achieved
                    </p>
                  </div>
                </div>

                {/* Overall Rate */}
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#2c2419', margin: '0' }}>Overall</p>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', margin: '0', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 8px', borderRadius: '6px' }}>
                    {funnelMetrics.sessionToConversionRate}%
                  </p>
                </div>
              </div>
            </div>

            {/* Tier 3: Analysis Columns (2-column @ 50/50) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              {/* Column 1: User Identity Analysis */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                  👥 User Identity Analysis
                </p>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#2c2419', margin: '0 0 20px 0', letterSpacing: '-0.02em' }}>
                  Who Are Your Visitors
                </h3>

                {/* Sub-cards: Comparisons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid #10b981' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>New Users</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#10b981', margin: 0 }}>{totalNewUsers.toLocaleString()}</p>
                  </div>
                  <div style={{ background: 'rgba(196, 112, 79, 0.08)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid #c4704f' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Returning Users</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#c4704f', margin: 0 }}>{totalReturningUsers.toLocaleString()}</p>
                  </div>
                  <div style={{ background: 'rgba(217, 168, 84, 0.08)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid #d9a854' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Desktop Sessions</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#d9a854', margin: 0 }}>{totalDesktopSessions.toLocaleString()}</p>
                  </div>
                  <div style={{ background: 'rgba(157, 181, 160, 0.08)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid #9db5a0' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Mobile Sessions</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#9db5a0', margin: 0 }}>{totalMobileSessions.toLocaleString()}</p>
                  </div>
                </div>

                {/* Progress Bars: Percentages */}
                <div style={{ marginTop: '20px' }}>
                  <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Device Distribution</p>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>Desktop</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#d9a854' }}>{desktopPercent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(44, 36, 25, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${desktopPercent}%`, height: '100%', background: '#d9a854', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>Mobile</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#9db5a0' }}>{mobilePercent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(44, 36, 25, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${mobilePercent}%`, height: '100%', background: '#9db5a0', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                  <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '20px 0 8px 0', textTransform: 'uppercase' }}>User Type Distribution</p>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>New Visitors</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#10b981' }}>{newUserPercent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(44, 36, 25, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${newUserPercent}%`, height: '100%', background: '#10b981', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>Returning Visitors</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#c4704f' }}>{returningUserPercent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(44, 36, 25, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${returningUserPercent}%`, height: '100%', background: '#c4704f', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: Search Health Analysis */}
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
                  Keyword Performance & Brand Visibility
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

                {/* Progress Bars: Brand Distribution */}
                <div style={{ marginTop: '20px' }}>
                  <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Brand vs Non-Brand Traffic</p>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>Branded</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#10b981' }}>{totalBrandedTraffic.toLocaleString()} ({brandedPercent}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: 'rgba(44, 36, 25, 0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${brandedPercent}%`, height: '100%', background: '#10b981', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>Non-Branded</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#d9a854' }}>{totalNonBrandedTraffic.toLocaleString()} ({nonBrandedPercent}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: 'rgba(44, 36, 25, 0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${nonBrandedPercent}%`, height: '100%', background: '#d9a854', transition: 'width 0.3s ease' }}></div>
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

                {/* Blog Highlight Box */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(157, 181, 160, 0.15), rgba(16, 185, 129, 0.15))',
                  borderRadius: '12px',
                  padding: '16px',
                  borderLeft: '4px solid #9db5a0',
                  marginTop: '16px'
                }}>
                  <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                    📝 Blog Performance
                  </p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: '#9db5a0', margin: '0 0 4px 0' }}>
                    {totalBlogSessions.toLocaleString()}
                  </p>
                  <p style={{ fontSize: '10px', color: '#5c5850', margin: 0 }}>
                    Sessions on blog content
                  </p>
                </div>

                {/* Average Rank Info */}
                <div style={{
                  background: 'rgba(44, 36, 25, 0.02)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginTop: '12px',
                  textAlign: 'center',
                  border: '1px solid rgba(44, 36, 25, 0.05)'
                }}>
                  <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0' }}>
                    Average Rank
                  </p>
                  <p style={{ fontSize: '18px', fontWeight: '700', color: '#2c2419', margin: 0 }}>
                    {avgGoogleRankValue.toFixed(1)}
                  </p>
                </div>
              </div>

              {/* Column 2: Top Landing Pages */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                  📄 Top Landing Pages
                </p>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#2c2419', margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
                  Where Visitors Land
                </h3>
                <div>
                  <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 4px', color: '#5c5850', fontWeight: '600' }}>Page</th>
                        <th style={{ textAlign: 'right', padding: '8px 4px', color: '#5c5850', fontWeight: '600' }}>Sessions</th>
                        <th style={{ textAlign: 'right', padding: '8px 4px', color: '#5c5850', fontWeight: '600' }}>Conv.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topLandingPages.length > 0 ? (
                        topLandingPages.map((page, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.05)' }}>
                            <td style={{ padding: '8px 4px', color: '#2c2419', fontSize: '9px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {page.landing_page?.length > 20 ? page.landing_page.substring(0, 17) + '...' : page.landing_page}
                            </td>
                            <td style={{ padding: '8px 4px', color: '#2c2419', textAlign: 'right', fontWeight: '600' }}>
                              {page.sessions?.toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 4px', color: '#10b981', textAlign: 'right', fontWeight: '600' }}>
                              {page.conversions || 0}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} style={{ padding: '16px 4px', color: '#9ca3af', textAlign: 'center', fontSize: '10px' }}>
                            No landing page data
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Column 3 (Row 2, Col 1): Top Keywords */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                  🔑 Top Keywords (GSC)
                </p>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#2c2419', margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
                  Search Queries
                </h3>
                <div>
                  <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 4px', color: '#5c5850', fontWeight: '600' }}>Query</th>
                        <th style={{ textAlign: 'right', padding: '8px 4px', color: '#5c5850', fontWeight: '600' }}>Impr.</th>
                        <th style={{ textAlign: 'right', padding: '8px 4px', color: '#5c5850', fontWeight: '600' }}>Pos.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topKeywords.length > 0 ? (
                        topKeywords.map((kw, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.05)' }}>
                            <td style={{ padding: '8px 4px', color: '#2c2419', fontSize: '9px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {kw.query?.length > 20 ? kw.query.substring(0, 17) + '...' : kw.query}
                            </td>
                            <td style={{ padding: '8px 4px', color: '#2c2419', textAlign: 'right', fontWeight: '600' }}>
                              {kw.impressions?.toLocaleString()}
                            </td>
                            <td style={{
                              padding: '8px 4px',
                              textAlign: 'right',
                              fontWeight: '600',
                              color: kw.position <= 10 ? '#10b981' : kw.position <= 20 ? '#d9a854' : '#c4704f'
                            }}>
                              {kw.position?.toFixed(1)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} style={{ padding: '16px 4px', color: '#9ca3af', textAlign: 'center', fontSize: '10px' }}>
                            No keyword data
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
                Your site appeared in search results <strong>{totalImpressions} times</strong>, generating <strong>{totalClicks} clicks</strong> with an average CTR of <strong>{avgCtr}%</strong>.
                Organic search traffic generated <strong>{totalOrganicTraffic} sessions</strong>.
                Keywords improved: <strong>{totalKeywordsImproved}</strong> | Keywords declined: <strong>{totalKeywordsDeclined}</strong>.
                Focus on content optimization for non-branded keywords to increase organic visibility and reduce keyword decline rate.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
