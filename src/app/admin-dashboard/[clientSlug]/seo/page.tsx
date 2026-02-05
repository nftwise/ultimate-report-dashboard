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
          .select('date, sessions, users, traffic_organic, traffic_paid, traffic_direct, traffic_referral, traffic_ai, branded_traffic, non_branded_traffic, keywords_improved, keywords_declined, seo_impressions, seo_clicks, seo_ctr, google_rank, top_keywords')
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

  // Prepare data for pie chart
  const trafficSourceData = [
    { name: 'Organic', value: totalOrganicTraffic, color: '#9db5a0' },
    { name: 'Branded', value: totalBrandedTraffic, color: '#10b981' },
    { name: 'Non-Branded', value: totalNonBrandedTraffic, color: '#d9a854' },
    { name: 'Paid', value: totalTrafficPaid, color: '#c4704f' },
    { name: 'Direct', value: totalTrafficDirect, color: '#a8a094' },
    { name: 'Referral', value: totalTrafficReferral, color: '#8b7355' },
    { name: 'AI', value: totalTrafficAI, color: '#6b5b95' }
  ].filter(source => source.value > 0);

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

            {/* Section 4: Traffic Sources Distribution Pie Chart */}
            <div className="mb-12" style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
            }}>
              <div style={{ marginBottom: '24px' }}>
                <p style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#5c5850',
                  margin: '0 0 8px 0'
                }}>
                  📊 Traffic Sources Distribution
                </p>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#2c2419',
                  margin: '0',
                  letterSpacing: '-0.02em'
                }}>
                  Where Your Visitors Come From
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'center' }}>
                {/* Pie Chart */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={trafficSourceData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={110}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {trafficSourceData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => value.toLocaleString()}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(44, 36, 25, 0.1)',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend with percentages */}
                <div>
                  {trafficSourceData.map((source: any, idx: number) => {
                    const percentage = totalAllTraffic > 0
                      ? ((source.value / totalAllTraffic) * 100).toFixed(1)
                      : '0.0';
                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        marginBottom: '8px',
                        background: `${source.color}15`,
                        borderRadius: '12px',
                        borderLeft: `4px solid ${source.color}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '3px',
                            background: source.color
                          }}></div>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#2c2419' }}>
                            {source.name}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '16px', fontWeight: '700', color: source.color, margin: '0' }}>
                            {source.value.toLocaleString()}
                          </p>
                          <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0' }}>
                            {percentage}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 5: Enhanced GSC Performance Metrics */}
            <div className="mb-12">
              <div style={{ marginBottom: '24px' }}>
                <p style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#5c5850',
                  margin: '0 0 8px 0'
                }}>
                  🔍 Google Search Console Metrics
                </p>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#2c2419',
                  margin: '0',
                  letterSpacing: '-0.02em'
                }}>
                  Search Visibility & Performance
                </h3>
              </div>

              {/* Top Row: 3 Main GSC Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                marginBottom: '16px'
              }}>
                {/* Impressions Card */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)',
                  borderTop: '4px solid #c4704f'
                }}>
                  <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                    👁️ Impressions
                  </p>
                  <p style={{ fontSize: '36px', fontWeight: '700', color: '#c4704f', margin: '0 0 4px 0' }}>
                    {totalImpressions.toLocaleString()}
                  </p>
                  <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>
                    Times shown in search
                  </p>
                </div>

                {/* Clicks Card */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)',
                  borderTop: '4px solid #10b981'
                }}>
                  <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                    🖱️ Clicks
                  </p>
                  <p style={{ fontSize: '36px', fontWeight: '700', color: '#10b981', margin: '0 0 4px 0' }}>
                    {totalClicks.toLocaleString()}
                  </p>
                  <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>
                    From search results
                  </p>
                </div>

                {/* CTR Card */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)',
                  borderTop: '4px solid #d9a854'
                }}>
                  <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                    📊 CTR
                  </p>
                  <p style={{ fontSize: '36px', fontWeight: '700', color: '#d9a854', margin: '0 0 4px 0' }}>
                    {avgCtr}%
                  </p>
                  <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>
                    Click-through rate
                  </p>
                </div>
              </div>

              {/* Bottom Row: 4 Secondary GSC Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px'
              }}>
                {/* Average Rank Card */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p style={{ fontSize: '10px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                    🏆 Avg Rank
                  </p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: '#2c2419', margin: '0 0 4px 0' }}>
                    {avgGoogleRank}
                  </p>
                  <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>
                    Position
                  </p>
                </div>

                {/* Keywords Improved Card */}
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p style={{ fontSize: '10px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                    📈 Improved
                  </p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: '#10b981', margin: '0 0 4px 0' }}>
                    {totalKeywordsImproved}
                  </p>
                  <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>
                    Keywords up
                  </p>
                </div>

                {/* Keywords Declined Card */}
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p style={{ fontSize: '10px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                    📉 Declined
                  </p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444', margin: '0 0 4px 0' }}>
                    {totalKeywordsDeclined}
                  </p>
                  <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>
                    Keywords down
                  </p>
                </div>

                {/* Top Keywords Card */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p style={{ fontSize: '10px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                    🎯 Top Keywords
                  </p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: '#2c2419', margin: '0 0 4px 0' }}>
                    {latestTopKeywords || 'N/A'}
                  </p>
                  <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>
                    Tracked
                  </p>
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
