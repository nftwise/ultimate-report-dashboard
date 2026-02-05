'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import DateRangePicker from '@/components/admin/DateRangePicker';
import ClientDetailsSidebar from '@/components/admin/ClientDetailsSidebar';
import ExecutiveSummaryCards from '@/components/admin/ExecutiveSummaryCards';
import SpendVsLeadsComboChart from '@/components/admin/SpendVsLeadsComboChart';
import TopConvertingSearchTerms from '@/components/admin/TopConvertingSearchTerms';
import AdGroupPerformanceTable from '@/components/admin/AdGroupPerformanceTable';
import { createClient } from '@supabase/supabase-js';

interface ClientMetrics {
  id: string;
  name: string;
  slug: string;
  city: string;
}

interface DailyMetrics {
  date: string;
  seo_impressions?: number;
  seo_clicks?: number;
  seo_ctr?: number;
  traffic_organic?: number;
  traffic_paid?: number;
  traffic_direct?: number;
  traffic_referral?: number;
  traffic_ai?: number;
  sessions?: number;
  users?: number;
}

interface KeywordData {
  keyword: string;
  impressions: number;
  clicks: number;
  position: number;
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

  // Fetch SEO daily metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!client) return;

      try {
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

        const { data: metricsData } = await supabase
          .from('client_metrics_summary')
          .select('date, seo_impressions, seo_clicks, seo_ctr, traffic_organic, traffic_paid, traffic_direct, traffic_referral, traffic_ai, sessions, users')
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

  // Calculate KPIs
  const totalImpressions = dailyData.reduce((sum: number, d: any) => sum + (d.seo_impressions || 0), 0);
  const totalClicks = dailyData.reduce((sum: number, d: any) => sum + (d.seo_clicks || 0), 0);
  const totalOrganicTraffic = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_organic || 0), 0);
  const totalSessions = dailyData.reduce((sum: number, d: any) => sum + (d.sessions || 0), 0);

  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  const avgPosition = 0; // Would need additional data
  const conversionRate = totalSessions > 0 ? ((totalOrganicTraffic / totalSessions) * 100).toFixed(2) : '0.00';

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

            {/* Section 2: Executive Summary */}
            <ExecutiveSummaryCards
              totalSpend={totalImpressions}
              totalConversions={totalClicks}
              costPerLead={parseFloat(avgCtr)}
              conversionRate={parseFloat(conversionRate)}
            />

            {/* Section 3: Visual Trend Analysis */}
            <div className="mb-12">
              <SpendVsLeadsComboChart data={dailyData} height={350} />
            </div>

            {/* Section 4: Traffic Breakdown */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60% 40%',
              gap: '24px',
              marginBottom: '32px'
            }}>
              {/* Left Column: Traffic Sources */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#5c5850',
                  margin: '0 0 8px 0'
                }}>
                  📊 Traffic Sources
                </p>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#2c2419',
                  margin: '0 0 16px 0',
                  letterSpacing: '-0.02em'
                }}>
                  By Channel
                </h3>

                {/* Traffic Stats Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  marginTop: '12px'
                }}>
                  {/* Organic */}
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                    borderLeft: '3px solid #10b981'
                  }}>
                    <p style={{
                      fontSize: '10px',
                      color: '#5c5850',
                      margin: '0 0 4px 0',
                      fontWeight: '600'
                    }}>
                      Organic
                    </p>
                    <p style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#10b981',
                      margin: 0
                    }}>
                      {totalOrganicTraffic}
                    </p>
                  </div>

                  {/* Paid */}
                  <div style={{
                    background: 'rgba(196, 112, 79, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                    borderLeft: '3px solid #c4704f'
                  }}>
                    <p style={{
                      fontSize: '10px',
                      color: '#5c5850',
                      margin: '0 0 4px 0',
                      fontWeight: '600'
                    }}>
                      Paid
                    </p>
                    <p style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#c4704f',
                      margin: 0
                    }}>
                      {dailyData.reduce((sum: number, d: any) => sum + (d.traffic_paid || 0), 0)}
                    </p>
                  </div>

                  {/* Direct */}
                  <div style={{
                    background: 'rgba(217, 168, 84, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                    borderLeft: '3px solid #d9a854'
                  }}>
                    <p style={{
                      fontSize: '10px',
                      color: '#5c5850',
                      margin: '0 0 4px 0',
                      fontWeight: '600'
                    }}>
                      Direct
                    </p>
                    <p style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#d9a854',
                      margin: 0
                    }}>
                      {dailyData.reduce((sum: number, d: any) => sum + (d.traffic_direct || 0), 0)}
                    </p>
                  </div>

                  {/* Referral */}
                  <div style={{
                    background: 'rgba(157, 181, 160, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                    borderLeft: '3px solid #9db5a0'
                  }}>
                    <p style={{
                      fontSize: '10px',
                      color: '#5c5850',
                      margin: '0 0 4px 0',
                      fontWeight: '600'
                    }}>
                      Referral
                    </p>
                    <p style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#9db5a0',
                      margin: 0
                    }}>
                      {dailyData.reduce((sum: number, d: any) => sum + (d.traffic_referral || 0), 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: SEO Metrics */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#5c5850',
                  margin: '0 0 8px 0'
                }}>
                  🔍 SEO Metrics
                </p>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#2c2419',
                  margin: '0 0 16px 0',
                  letterSpacing: '-0.02em'
                }}>
                  Search Visibility
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  marginTop: '12px'
                }}>
                  {/* Impressions */}
                  <div style={{
                    background: 'rgba(196, 112, 79, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                    borderLeft: '3px solid #c4704f'
                  }}>
                    <p style={{
                      fontSize: '10px',
                      color: '#5c5850',
                      margin: '0 0 4px 0',
                      fontWeight: '600'
                    }}>
                      Impressions
                    </p>
                    <p style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#c4704f',
                      margin: 0
                    }}>
                      {totalImpressions}
                    </p>
                  </div>

                  {/* Clicks */}
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                    borderLeft: '3px solid #10b981'
                  }}>
                    <p style={{
                      fontSize: '10px',
                      color: '#5c5850',
                      margin: '0 0 4px 0',
                      fontWeight: '600'
                    }}>
                      Clicks
                    </p>
                    <p style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#10b981',
                      margin: 0
                    }}>
                      {totalClicks}
                    </p>
                  </div>

                  {/* CTR */}
                  <div style={{
                    background: 'rgba(217, 168, 84, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                    borderLeft: '3px solid #d9a854'
                  }}>
                    <p style={{
                      fontSize: '10px',
                      color: '#5c5850',
                      margin: '0 0 4px 0',
                      fontWeight: '600'
                    }}>
                      CTR
                    </p>
                    <p style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#d9a854',
                      margin: 0
                    }}>
                      {avgCtr}%
                    </p>
                  </div>

                  {/* Sessions */}
                  <div style={{
                    background: 'rgba(157, 181, 160, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                    borderLeft: '3px solid #9db5a0'
                  }}>
                    <p style={{
                      fontSize: '10px',
                      color: '#5c5850',
                      margin: '0 0 4px 0',
                      fontWeight: '600'
                    }}>
                      Sessions
                    </p>
                    <p style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#9db5a0',
                      margin: 0
                    }}>
                      {totalSessions}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Summary */}
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
                💡 Key Insights
              </p>
              <p style={{
                fontSize: '11px',
                color: '#5c5850',
                margin: 0,
                lineHeight: '1.5'
              }}>
                Your site received <strong>{totalImpressions} impressions</strong> in search results, resulting in <strong>{totalClicks} clicks</strong> (CTR: {avgCtr}%).
                Organic traffic accounted for <strong>{totalOrganicTraffic} sessions</strong> out of <strong>{totalSessions} total sessions</strong>.
                Focus on improving content for high-traffic keywords to increase click-through rate and organic visibility.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
