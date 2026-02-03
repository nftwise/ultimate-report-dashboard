'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import DateRangePicker from '@/components/admin/DateRangePicker';
import { createClient } from '@supabase/supabase-js';

const SixMonthBarChart = dynamic(() => import('@/components/admin/SixMonthBarChart'), { ssr: false });
const DailyTrafficLineChart = dynamic(() => import('@/components/admin/DailyTrafficLineChart'), { ssr: false });
const TrafficSourceDonut = dynamic(() => import('@/components/admin/TrafficSourceDonut'), { ssr: false });

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
}

interface DailyMetrics {
  date: string;
  total_leads: number;
  form_fills: number;
  gbp_calls: number;
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
  health_score?: number;
  budget_utilization?: number;
}

export default function ClientDetailPage() {
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

        console.log('[Client Details] Fetching metrics from Supabase:', { clientId: client.id, dateFromISO, dateToISO });

        const { data, error } = await supabase
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
            health_score,
            budget_utilization
          `)
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: true });

        if (error) {
          console.error('[Client Details] Supabase error:', error);
          setDailyData([]);
          return;
        }

        console.log('[Client Details] Supabase response:', data?.length || 0, 'records');
        setDailyData((data || []) as DailyMetrics[]);
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
  const healthScore = dailyData.length > 0 ? dailyData[dailyData.length - 1].health_score || 0 : 0;
  const budgetUtilization = dailyData.length > 0 ? dailyData[dailyData.length - 1].budget_utilization || 0 : 0;
  const trafficOrganic = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_organic || 0), 0);
  const trafficPaid = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_paid || 0), 0);
  const trafficDirect = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_direct || 0), 0);
  const trafficAi = dailyData.reduce((sum: number, d: any) => sum + (d.traffic_ai || 0), 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
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
          <h1 className="text-2xl font-black" style={{ color: '#2c2419' }}>{client.name}</h1>
          <p className="text-sm" style={{ color: '#5c5850' }}>{client.city || 'Location'}</p>
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
                {days} days
              </button>
            ))}
          </div>
          <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
        </div>
      </nav>

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

          {/* Section 2: Executive Summary (Full Width - 3 Cards) */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            {/* What's Great */}
            <div className="rounded-2xl p-6" style={{
              background: 'rgba(157, 181, 160, 0.1)',
              borderLeft: '4px solid #9db5a0',
              border: '1px solid rgba(157, 181, 160, 0.2)'
            }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">✓</span>
                <h3 className="font-black text-lg" style={{ color: '#9db5a0' }}>What's Great</h3>
              </div>
              <p className="text-sm font-semibold" style={{ color: '#2c2419' }}>Strong {totalAdsConversions > 0 ? (totalAdsConversions / Math.max(totalLeads, 1) * 100).toFixed(1) : '0'}% conversion rate on ads</p>
            </div>

            {/* Needs Attention */}
            <div className="rounded-2xl p-6" style={{
              background: 'rgba(196, 112, 79, 0.1)',
              borderLeft: '4px solid #c4704f',
              border: '1px solid rgba(196, 112, 79, 0.2)'
            }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">⚠</span>
                <h3 className="font-black text-lg" style={{ color: '#c4704f' }}>Needs Attention</h3>
              </div>
              <p className="text-sm font-semibold" style={{ color: '#2c2419' }}>Monitor lead generation trends</p>
            </div>

            {/* We're Working On It */}
            <div className="rounded-2xl p-6" style={{
              background: 'rgba(217, 168, 84, 0.1)',
              borderLeft: '4px solid #d9a854',
              border: '1px solid rgba(217, 168, 84, 0.2)'
            }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">→</span>
                <h3 className="font-black text-lg" style={{ color: '#d9a854' }}>We're Working On It</h3>
              </div>
              <p className="text-sm font-semibold" style={{ color: '#2c2419' }}>Analyzing traffic patterns and optimizing</p>
            </div>
          </div>

          {/* Section 3: Key Performance Metrics (Full Width - 4 Cards) */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Total Leads', value: totalLeads, trend: '-22%', trendType: 'down' },
              { label: 'Website Sessions', value: sessions, trend: '+0%', trendType: 'neutral' },
              { label: 'Ad Spend', value: `$${Math.round(adSpend)}`, trend: '-21%', trendType: 'down' },
              { label: 'Cost Per Lead', value: `$${costPerLead}`, trend: '+2%', trendType: 'up' }
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
                  {metric.trend} vs last period
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
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#9db5a0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      ↑ 1057%
                    </div>
                    <p className="text-xs font-semibold mt-1" style={{ color: '#5c5850' }}>Jan 2026 Growth</p>
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

                <div className="grid grid-cols-2 gap-6 mt-8">
                  <div style={{
                    padding: '16px',
                    background: 'rgba(44, 36, 25, 0.02)',
                    borderRadius: '12px',
                    borderLeft: '2px solid #d9a854'
                  }}>
                    <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px' }}>Total Leads</p>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2c2419' }}>{totalLeads}</div>
                    <p className="text-xs mt-2" style={{ color: '#5c5850' }}>Cumulative total</p>
                  </div>
                  <div style={{
                    padding: '16px',
                    background: 'rgba(44, 36, 25, 0.02)',
                    borderRadius: '12px',
                    borderLeft: '2px solid #c4704f'
                  }}>
                    <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '4px' }}>Avg Per Month</p>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2c2419' }}>{Math.round(totalLeads / 2)}</div>
                    <p className="text-xs mt-2" style={{ color: '#5c5850' }}>Last 2 months avg</p>
                  </div>
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

                <div className="grid grid-cols-4 gap-6 mt-6" style={{
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
                  <div>
                    <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '8px' }}>Peak Sessions Day</p>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c2419' }}>{sessions}</div>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '8px' }}>Total Conversions</p>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#c4704f' }}>{totalLeads}</div>
                  </div>
                </div>
              </div>

              {/* Traffic Coverage by Source */}
              <div className="rounded-2xl p-8" style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Source Attribution</p>
                    <h3 className="text-2xl font-black mt-2" style={{ color: '#2c2419' }}>Traffic Coverage by Source</h3>
                  </div>
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-bold" style={{
                    background: 'rgba(157, 181, 160, 0.2)',
                    color: '#4a6b4e'
                  }}>
                    🟢 Tracking Active
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_1.2fr] gap-8 items-center">
                  {/* Traffic Source Donut Chart */}
                  <div style={{
                    position: 'relative',
                    background: 'rgba(44, 36, 25, 0.02)',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {dailyData.length > 0 ? (
                      <TrafficSourceDonut data={dailyData} />
                    ) : (
                      <div style={{ color: '#5c5850', textAlign: 'center' }}>
                        No data available
                      </div>
                    )}
                  </div>

                  {/* Table */}
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(44, 36, 25, 0.1)', color: '#5c5850', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>Source</th>
                        <th style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid rgba(44, 36, 25, 0.1)', color: '#5c5850', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>Sessions</th>
                        <th style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid rgba(44, 36, 25, 0.1)', color: '#5c5850', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>Share</th>
                        <th style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid rgba(44, 36, 25, 0.1)', color: '#5c5850', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>Leads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Organic', color: '#c4704f', value: trafficOrganic },
                        { label: 'Paid Ads', color: '#d9a854', value: trafficPaid },
                        { label: 'Direct', color: '#9db5a0', value: trafficDirect }
                      ].map((source, idx) => {
                        const totalSessions = trafficOrganic + trafficPaid + trafficDirect + trafficAi;
                        const share = totalSessions > 0 ? ((source.value / totalSessions) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={idx}>
                            <td style={{ padding: '16px', borderBottom: '1px solid rgba(44, 36, 25, 0.08)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: source.color }}></div>
                              <strong>{source.label}</strong>
                            </td>
                            <td style={{ textAlign: 'right', padding: '16px', borderBottom: '1px solid rgba(44, 36, 25, 0.08)', color: '#5c5850' }}>{source.value}</td>
                            <td style={{ textAlign: 'right', padding: '16px', borderBottom: '1px solid rgba(44, 36, 25, 0.08)', fontWeight: 'bold' }}>{share}%</td>
                            <td style={{ textAlign: 'right', padding: '16px', borderBottom: '1px solid rgba(44, 36, 25, 0.08)', fontWeight: 'bold' }}>
                              {Math.round((source.value / totalSessions) * totalLeads) || 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
                    { label: 'Health Score', value: `${healthScore}%`, color: '#2c2419' }
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
                        <span style={{ fontWeight: 'bold', color: '#d9a854' }}>{(trafficOrganic / (trafficOrganic + trafficPaid + trafficDirect) * 100).toFixed(1)}%</span>
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
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#c4704f' }}>{((trafficAi / (trafficOrganic + trafficPaid + trafficDirect + trafficAi) * 100) || 0).toFixed(1)}%</div>
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
              {/* Team Section */}
              <div className="rounded-2xl p-8" style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Strategic Team</p>
                <h3 className="text-2xl font-black mt-2 mb-6" style={{ color: '#2c2419' }}>Who's Working On This</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {[
                    { name: 'Quan', role: 'SEO & Local SEO Expert', bg: '#2c2419' },
                    { name: 'Trieu', role: 'Strategic Developer', bg: '#c4704f' }
                  ].map((member, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: member.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '18px'
                      }}>
                        {member.name[0]}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c2419', marginBottom: '2px' }}>{member.name}</h4>
                        <p style={{ fontSize: '13px', color: '#5c5850' }}>{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lead Distribution */}
              <div className="rounded-2xl p-8" style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Channel Impact</p>
                <h3 className="text-2xl font-black mt-2 mb-6" style={{ color: '#2c2419' }}>Lead Distribution</h3>

                {[
                  { label: 'Google Ads', value: totalLeads, color: '#c4704f' },
                  { label: 'SEO/Organic', value: totalFormFills, color: '#9db5a0' },
                  { label: 'Google Business', value: totalGbpCalls, color: '#d9a854' },
                  { label: 'Form Submissions', value: 0, color: '#5c5850' }
                ].map((channel, i) => (
                  <div key={i} style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600', color: '#2c2419' }}>{channel.label}</span>
                      <span style={{ fontWeight: 'bold', color: '#2c2419' }}>{channel.value} ({Math.round((channel.value / Math.max(totalLeads, 1)) * 100)}%)</span>
                    </div>
                    <div style={{
                      height: '6px',
                      background: 'rgba(44, 36, 25, 0.05)',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${(channel.value / Math.max(totalLeads, 1)) * 100}%`,
                        background: channel.color,
                        borderRadius: '3px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Channel Details */}
              {[
                { title: 'Google Ads', status: 'Active', statusColor: '#4a6b4e', statusBg: 'rgba(157, 181, 160, 0.1)', metrics: [
                  { label: 'Conversions', value: totalAdsConversions },
                  { label: 'Clicks', value: adsClicks },
                  { label: 'Spend', value: `$${Math.round(adSpend)}` },
                  { label: 'CTR', value: `${adsCtr}%` }
                ]},
                { title: 'SEO Performance', status: 'Growing', statusColor: '#8a6a35', statusBg: 'rgba(217, 168, 84, 0.1)', metrics: [
                  { label: 'Organic Clicks', value: seoClicks },
                  { label: 'Impressions', value: seoImpressions },
                  { label: 'CTR', value: `${seoCtr}%` }
                ]},
                { title: 'Google Business', status: 'Local', statusColor: '#5c5850', statusBg: 'rgba(92, 88, 80, 0.1)', metrics: [
                  { label: 'Phone Calls', value: totalGbpCalls },
                  { label: 'Profile Views', value: '—' },
                  { label: 'Web Clicks', value: '—' },
                  { label: 'Directions', value: '—' }
                ]}
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
    </div>
  );
}
