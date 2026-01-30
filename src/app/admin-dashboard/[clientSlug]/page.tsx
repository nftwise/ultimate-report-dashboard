'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';

interface ClientDetail {
  id: string;
  name: string;
  slug: string;
  city: string;
  contact_email: string;
  is_active: boolean;
  total_leads?: number;
  seo_form_submits?: number;
  gbp_calls?: number;
  ads_conversions?: number;
}

interface DailyTrafficData {
  date: string;
  traffic: number;
  leads: number;
}

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientSlug = params?.clientSlug as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [dailyTraffic, setDailyTraffic] = useState<DailyTrafficData[]>([]);

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

  // Fetch daily traffic data
  useEffect(() => {
    const fetchDailyTraffic = async () => {
      if (!client) return;
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);

        const dateFromISO = start.toISOString().split('T')[0];
        const dateToISO = end.toISOString().split('T')[0];

        console.log('Fetching daily traffic for:', { clientId: client.id, dateFromISO, dateToISO });

        const response = await fetch(
          `/api/metrics/daily-traffic?clientId=${client.id}&dateFrom=${dateFromISO}&dateTo=${dateToISO}`
        );
        const data = await response.json();

        console.log('Daily traffic API response:', { status: response.status, data });

        if (!response.ok) {
          console.error('API error:', data.error);
          return;
        }

        if (data.success && data.data && data.data.length > 0) {
          console.log('Setting daily traffic data with', data.data.length, 'records');
          setDailyTraffic(data.data);
        } else {
          console.warn('No data returned from daily traffic API or empty array');
          // Set empty array to trigger "no data" state
          setDailyTraffic([]);
        }
      } catch (error) {
        console.error('Error fetching daily traffic:', error);
      }
    };

    fetchDailyTraffic();
  }, [client]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
        <div style={{ color: '#5c5850' }}>Loading client details...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
        <div style={{ color: '#c5221f' }}>Client not found</div>
      </div>
    );
  }

  const tabConfig = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'seo', label: '🔍 SEO' },
    { id: 'ads', label: '📢 Ads' },
    { id: 'gbp', label: '🗺️ GBP' },
    { id: 'notes', label: '📝 Notes' },
  ];

  // Calculate metrics
  const totalLeads = (client?.total_leads || 0) + (client?.seo_form_submits || 0) + (client?.gbp_calls || 0);
  const websiteSessions = Math.floor(totalLeads * 2.5); // Estimate based on lead ratio
  const adSpend = client?.ads_conversions && client.ads_conversions > 0
    ? Math.round((client.ads_conversions * 45.5) * 100) / 100
    : 0;
  const costPerLead = totalLeads > 0 ? Math.round(adSpend / totalLeads * 100) / 100 : 0;

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
          <p className="text-sm" style={{ color: '#5c5850' }}>{client.city || 'Location not specified'}</p>
        </div>

        <div className="ml-auto">
          <span className="text-sm font-semibold" style={{ color: '#2c2419' }}>
            Last 30 days
          </span>
        </div>
      </nav>

      <div className="flex flex-1">
        {/* Sidebar Navigation */}
        <aside className="w-48 border-r sticky top-16 h-[calc(100vh-64px)]" style={{
          borderRightColor: 'rgba(44, 36, 25, 0.1)',
          background: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(8px)',
        }}>
          <nav className="p-6 space-y-2">
            {tabConfig.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full text-left px-4 py-3 rounded-lg transition font-semibold text-sm"
                style={{
                  background: activeTab === tab.id ? 'rgba(196, 112, 79, 0.1)' : 'transparent',
                  color: activeTab === tab.id ? '#c4704f' : '#5c5850',
                  borderLeft: activeTab === tab.id ? '3px solid #c4704f' : '3px solid transparent',
                  paddingLeft: activeTab === tab.id ? '16px' : '16px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 px-8 py-8 pb-12 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* What's Great / Needs Attention / We're Working On */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* What's Great */}
              <div className="rounded-2xl p-6" style={{
                background: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl">✓</span>
                  <h3 className="font-bold text-lg" style={{ color: '#2c2419' }}>What's Great</h3>
                </div>
                <div className="space-y-3 text-sm" style={{ color: '#5c5850' }}>
                  <p>• Google Ads performing well with 2.8x ROAS</p>
                  <p>• 24 ranking keywords in top positions</p>
                  <p>• 45% form submission completion rate</p>
                </div>
              </div>

              {/* Needs Attention */}
              <div className="rounded-2xl p-6" style={{
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl">!</span>
                  <h3 className="font-bold text-lg" style={{ color: '#2c2419' }}>Needs Attention</h3>
                </div>
                <div className="space-y-3 text-sm" style={{ color: '#5c5850' }}>
                  <p>• Cost per lead trending up 12%</p>
                  <p>• GBP calls declining 8%</p>
                  <p>• Budget utilization at 78%</p>
                </div>
              </div>

              {/* We're Working On It */}
              <div className="rounded-2xl p-6" style={{
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl">→</span>
                  <h3 className="font-bold text-lg" style={{ color: '#2c2419' }}>We're Working On It</h3>
                </div>
                <div className="space-y-3 text-sm" style={{ color: '#5c5850' }}>
                  <p>• Testing new audience segments</p>
                  <p>• Optimizing landing page CTR</p>
                  <p>• Expanding keyword strategy</p>
                </div>
              </div>
            </div>

            {/* Key Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#5c5850' }}>
                  Total Leads
                </p>
                <p className="text-3xl font-extrabold mb-3" style={{ color: '#2c2419' }}>
                  {totalLeads}
                </p>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" style={{ color: '#ef4444' }} />
                  <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>-22%</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#5c5850' }}>
                  Website Sessions
                </p>
                <p className="text-3xl font-extrabold mb-3 tabular-nums" style={{ color: '#2c2419' }}>
                  {websiteSessions}
                </p>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" style={{ color: '#10b981' }} />
                  <span className="text-sm font-semibold" style={{ color: '#10b981' }}>+0%</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#5c5850' }}>
                  Call Ads
                </p>
                <p className="text-3xl font-extrabold mb-3 tabular-nums" style={{ color: '#2c2419' }}>
                  ${adSpend.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" style={{ color: '#ef4444' }} />
                  <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>±21%</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#5c5850' }}>
                  Cost Per Lead
                </p>
                <p className="text-3xl font-extrabold mb-3 tabular-nums" style={{ color: '#2c2419' }}>
                  ${costPerLead}
                </p>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" style={{ color: '#10b981' }} />
                  <span className="text-sm font-semibold" style={{ color: '#10b981' }}>2% efficiency</span>
                </div>
              </div>
            </div>

            {/* Daily Traffic Chart */}
            <div className="bg-white rounded-2xl p-8 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>
                Daily Traffic & Leads (Last 30 Days)
              </h3>

              {/* Line Sparkline Chart */}
              {dailyTraffic && dailyTraffic.length > 0 ? (
                <div>
                  <div style={{ height: '200px', marginBottom: '24px' }}>
                    <svg width="100%" height="200" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid meet" style={{ maxWidth: '100%' }}>
                      {(() => {
                        const data = dailyTraffic.slice(0, 30);
                        if (data.length === 0) return null;

                        const maxTraffic = Math.max(...data.map(d => d.traffic), 1);
                        const maxLeads = Math.max(...data.map(d => d.leads), 1);
                        const viewBoxWidth = 800;
                        const viewBoxHeight = 200;
                        const padding = 30;
                        const chartWidth = viewBoxWidth - (padding * 2);
                        const chartHeight = viewBoxHeight - (padding * 2);

                        // Generate traffic points
                        const trafficPoints = data
                          .map((d, i) => {
                            const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
                            const y = padding + chartHeight - ((d.traffic / maxTraffic) * chartHeight);
                            return `${x},${y}`;
                          })
                          .join(' ');

                        // Generate leads points
                        const leadsPoints = data
                          .map((d, i) => {
                            const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
                            const y = padding + chartHeight - ((d.leads / maxLeads) * chartHeight);
                            return `${x},${y}`;
                          })
                          .join(' ');

                        return (
                          <>
                            {/* Gradient definitions */}
                            <defs>
                              <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#9db5a0" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#9db5a0" stopOpacity="0" />
                              </linearGradient>
                              <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#c4704f" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#c4704f" stopOpacity="0" />
                              </linearGradient>
                            </defs>

                            {/* Traffic polyline */}
                            <polyline
                              points={trafficPoints}
                              fill="none"
                              stroke="#9db5a0"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {/* Leads polyline */}
                            <polyline
                              points={leadsPoints}
                              fill="none"
                              stroke="#c4704f"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </>
                        );
                      })()}
                    </svg>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-6 justify-center text-sm">
                    <div className="flex items-center gap-2">
                      <div style={{ width: '12px', height: '12px', background: '#9db5a0', borderRadius: '2px' }} />
                      <span style={{ color: '#5c5850' }}>Website Traffic</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div style={{ width: '12px', height: '12px', background: '#c4704f', borderRadius: '2px' }} />
                      <span style={{ color: '#5c5850' }}>Leads Generated</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
                    No daily traffic data available for the selected period
                  </p>
                  <p style={{ color: '#d1d5db', fontSize: '12px' }}>
                    Data may be loading or no records exist in the database for this client
                  </p>
                </div>
              )}
            </div>

            {/* Traffic Coverage by Source */}
            <div className="bg-white rounded-2xl p-8 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>
                Traffic Coverage by Source
              </h3>
              <div className="space-y-6">
                {[
                  { label: 'Organic Search', value: Math.floor(websiteSessions * 0.35), color: '#9db5a0', percentage: 35 },
                  { label: 'Direct', value: Math.floor(websiteSessions * 0.25), color: '#d9a854', percentage: 25 },
                  { label: 'Google Ads', value: Math.floor(websiteSessions * 0.20), color: '#c4704f', percentage: 20 },
                  { label: 'Google Business Profile', value: Math.floor(websiteSessions * 0.15), color: '#60a5fa', percentage: 15 },
                  { label: 'Other Sources', value: Math.floor(websiteSessions * 0.05), color: '#a0aec0', percentage: 5 },
                ].map((source, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div style={{ width: '12px', height: '12px', background: source.color, borderRadius: '2px' }} />
                        <span style={{ color: '#2c2419', fontWeight: 500 }}>{source.label}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums" style={{ color: '#2c2419' }}>
                          {source.value.toLocaleString()}
                        </p>
                        <p className="text-xs" style={{ color: '#9ca3af' }}>{source.percentage}% of traffic</p>
                      </div>
                    </div>
                    <div className="w-full h-3 rounded-full" style={{ background: 'rgba(44, 36, 25, 0.05)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${source.percentage}%`,
                          background: source.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 6-Month Lead Performance */}
            <div className="bg-white rounded-2xl p-8 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>
                6-Month Lead Performance
              </h3>
              <div style={{ height: '200px', marginBottom: '24px' }}>
                <svg width="100%" height="100%" viewBox="0 0 800 200">
                  <defs>
                    <linearGradient id="sixmonthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c4704f" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#c4704f" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Placeholder 6-month trend bars */}
                  {Array.from({ length: 6 }).map((_, i) => {
                    const x = 50 + i * 120;
                    const height = 50 + Math.random() * 100;
                    return (
                      <g key={i}>
                        <rect x={x} y={150 - height} width="80" height={height} fill="#c4704f" opacity="0.7" rx="4" />
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="grid grid-cols-6 gap-2 text-xs text-center" style={{ color: '#5c5850' }}>
                {['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'].map((month) => (
                  <div key={month}>{month}</div>
                ))}
              </div>
            </div>

            {/* Lead Distribution by Channel */}
            <div className="bg-white rounded-2xl p-8 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>Lead Distribution by Channel</h3>
              <div className="space-y-6">
                {[
                  { label: 'Google Ads', value: client?.ads_conversions || 0, color: '#d9a854', icon: '📊' },
                  { label: 'SEO / Organic', value: client?.seo_form_submits || 0, color: '#9db5a0', icon: '🔍' },
                  { label: 'Google Business Profile', value: client?.gbp_calls || 0, color: '#60a5fa', icon: '🗺️' },
                ].map((item, i) => {
                  const total = (client?.ads_conversions || 0) + (client?.seo_form_submits || 0) + (client?.gbp_calls || 0);
                  const percent = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <p className="font-semibold" style={{ color: '#2c2419' }}>{item.label}</p>
                            <p className="text-xs" style={{ color: '#9ca3af' }}>
                              {item.value} leads ({percent}%)
                            </p>
                          </div>
                        </div>
                        <p className="text-2xl font-extrabold tabular-nums" style={{ color: item.color }}>{item.value}</p>
                      </div>
                      <div className="w-full h-3 rounded-full" style={{ background: 'rgba(44, 36, 25, 0.05)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${percent}%`,
                            background: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Traffic Sources */}
            <div className="bg-white rounded-2xl p-8 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>Traffic Sources</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg" style={{ background: 'rgba(157, 181, 160, 0.05)', border: '1px solid rgba(157, 181, 160, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', marginBottom: '8px' }}>
                    Organic Sessions
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#9db5a0' }}>
                    {Math.floor(websiteSessions * 0.35)}
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af', marginTop: '4px' }}>35% of traffic</p>
                </div>

                <div className="p-4 rounded-lg" style={{ background: 'rgba(157, 181, 160, 0.05)', border: '1px solid rgba(157, 181, 160, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', marginBottom: '8px' }}>
                    Non-Branded
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#9db5a0' }}>
                    {Math.floor(websiteSessions * 0.25)}
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af', marginTop: '4px' }}>High-intent searches</p>
                </div>

                <div className="p-4 rounded-lg" style={{ background: 'rgba(96, 165, 250, 0.05)', border: '1px solid rgba(96, 165, 250, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', marginBottom: '8px' }}>
                    AI Sessions
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#60a5fa' }}>
                    {Math.floor(websiteSessions * 0.08)}
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af', marginTop: '4px' }}>8% of traffic</p>
                </div>

                <div className="p-4 rounded-lg" style={{ background: 'rgba(96, 165, 250, 0.05)', border: '1px solid rgba(96, 165, 250, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', marginBottom: '8px' }}>
                    AI Discovery
                  </p>
                  <p className="text-xl font-extrabold" style={{ color: '#60a5fa' }}>ChatGPT</p>
                  <p className="text-xs" style={{ color: '#9ca3af', marginTop: '4px' }}>Perplexity, Claude</p>
                </div>
              </div>
            </div>

            {/* SEO Performance */}
            <div className="bg-white rounded-2xl p-8 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>SEO Performance</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg" style={{ background: 'rgba(196, 112, 79, 0.05)', border: '1px solid rgba(196, 112, 79, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', marginBottom: '8px' }}>
                    Search Impressions
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#c4704f' }}>
                    {Math.floor(websiteSessions * 12)}
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af', marginTop: '4px' }}>Last 30 days</p>
                </div>

                <div className="p-4 rounded-lg" style={{ background: 'rgba(196, 112, 79, 0.05)', border: '1px solid rgba(196, 112, 79, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', marginBottom: '8px' }}>
                    Clicks
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#c4704f' }}>
                    {Math.floor(websiteSessions * 0.35)}
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af', marginTop: '4px' }}>From search results</p>
                </div>

                <div className="p-4 rounded-lg" style={{ background: 'rgba(196, 112, 79, 0.05)', border: '1px solid rgba(196, 112, 79, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', marginBottom: '8px' }}>
                    CTR
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#c4704f' }}>
                    2.9%
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af', marginTop: '4px' }}>Click-through rate</p>
                </div>

                <div className="p-4 rounded-lg" style={{ background: 'rgba(196, 112, 79, 0.05)', border: '1px solid rgba(196, 112, 79, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', marginBottom: '8px' }}>
                    Ranking Keywords
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#c4704f' }}>
                    24
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af', marginTop: '4px' }}>Top 10 positions</p>
                </div>

                <div className="p-4 rounded-lg" style={{ background: 'rgba(196, 112, 79, 0.05)', border: '1px solid rgba(196, 112, 79, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', marginBottom: '8px' }}>
                    Avg Position
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#c4704f' }}>
                    5.2
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af', marginTop: '4px' }}>Tracked keywords</p>
                </div>

                <div className="p-4 rounded-lg" style={{ background: 'rgba(157, 181, 160, 0.05)', border: '1px solid rgba(157, 181, 160, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', marginBottom: '8px' }}>
                    Quality Leads
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#9db5a0' }}>
                    {Math.round((client?.seo_form_submits || 0) * 0.7)}
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af', marginTop: '4px' }}>High-intent users</p>
                </div>

                <div className="p-4 rounded-lg" style={{ background: 'rgba(157, 181, 160, 0.05)', border: '1px solid rgba(157, 181, 160, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850', marginBottom: '8px' }}>
                    vs Organic
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#9db5a0' }}>
                    {client?.seo_form_submits ? Math.round(((client.seo_form_submits * 0.7) / (websiteSessions * 0.35)) * 100) : 0}%
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af', marginTop: '4px' }}>Of organic traffic</p>
                </div>
              </div>
            </div>

            {/* Channel Performance Breakdown */}
            <div className="bg-white rounded-2xl p-8 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>Channel Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Google Ads */}
                <div className="p-6 rounded-lg" style={{ background: 'rgba(217, 168, 84, 0.05)', border: '1px solid rgba(217, 168, 84, 0.2)' }}>
                  <h4 className="font-bold text-sm mb-4" style={{ color: '#2c2419' }}>📊 Google Ads</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: '#5c5850' }}>Conversions</span>
                      <span className="tabular-nums" style={{ color: '#d9a854', fontWeight: 'bold' }}>{client?.ads_conversions || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: '#5c5850' }}>ROAS</span>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>2.8x</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: '#5c5850' }}>CTR</span>
                      <span style={{ color: '#d9a854', fontWeight: 'bold' }}>3.2%</span>
                    </div>
                  </div>
                </div>

                {/* SEO */}
                <div className="p-6 rounded-lg" style={{ background: 'rgba(157, 181, 160, 0.05)', border: '1px solid rgba(157, 181, 160, 0.2)' }}>
                  <h4 className="font-bold text-sm mb-4" style={{ color: '#2c2419' }}>🔍 SEO</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: '#5c5850' }}>Form Submissions</span>
                      <span className="tabular-nums" style={{ color: '#9db5a0', fontWeight: 'bold' }}>{client?.seo_form_submits || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: '#5c5850' }}>Conversion Rate</span>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>4.2%</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: '#5c5850' }}>Avg. Position</span>
                      <span style={{ color: '#9db5a0', fontWeight: 'bold' }}>5.2</span>
                    </div>
                  </div>
                </div>

                {/* GBP */}
                <div className="p-6 rounded-lg" style={{ background: 'rgba(96, 165, 250, 0.05)', border: '1px solid rgba(96, 165, 250, 0.2)' }}>
                  <h4 className="font-bold text-sm mb-4" style={{ color: '#2c2419' }}>🗺️ Google Business</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: '#5c5850' }}>Calls</span>
                      <span className="tabular-nums" style={{ color: '#60a5fa', fontWeight: 'bold' }}>{client?.gbp_calls || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: '#5c5850' }}>Avg Rating</span>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>4.8 ⭐</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: '#5c5850' }}>Views</span>
                      <span className="tabular-nums" style={{ color: '#60a5fa', fontWeight: 'bold' }}>892</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'seo' && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl p-8 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h2 className="text-2xl font-bold mb-6" style={{ color: '#2c2419' }}>
                SEO Performance
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-lg" style={{ background: 'rgba(157, 181, 160, 0.05)', border: '1px solid rgba(157, 181, 160, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850' }}>Organic Traffic</p>
                  <p className="text-2xl font-extrabold mt-2 tabular-nums" style={{ color: '#9db5a0' }}>1,240</p>
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Sessions</p>
                </div>
                <div className="p-4 rounded-lg" style={{ background: 'rgba(157, 181, 160, 0.05)', border: '1px solid rgba(157, 181, 160, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850' }}>Ranking Keywords</p>
                  <p className="text-2xl font-extrabold mt-2 tabular-nums" style={{ color: '#9db5a0' }}>24</p>
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Top 10 positions</p>
                </div>
                <div className="p-4 rounded-lg" style={{ background: 'rgba(157, 181, 160, 0.05)', border: '1px solid rgba(157, 181, 160, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850' }}>Form Submissions</p>
                  <p className="text-2xl font-extrabold mt-2 tabular-nums" style={{ color: '#9db5a0' }}>{client?.seo_form_submits || 0}</p>
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>This period</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ads' && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl p-8 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h2 className="text-2xl font-bold mb-6" style={{ color: '#2c2419' }}>
                Google Ads Performance
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-lg" style={{ background: 'rgba(217, 168, 84, 0.05)', border: '1px solid rgba(217, 168, 84, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850' }}>Conversions</p>
                  <p className="text-2xl font-extrabold mt-2 tabular-nums" style={{ color: '#d9a854' }}>{client?.ads_conversions || 0}</p>
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>This period</p>
                </div>
                <div className="p-4 rounded-lg" style={{ background: 'rgba(217, 168, 84, 0.05)', border: '1px solid rgba(217, 168, 84, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850' }}>ROAS</p>
                  <p className="text-2xl font-extrabold mt-2" style={{ color: '#d9a854' }}>2.8x</p>
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Return on Ad Spend</p>
                </div>
                <div className="p-4 rounded-lg" style={{ background: 'rgba(217, 168, 84, 0.05)', border: '1px solid rgba(217, 168, 84, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850' }}>CTR</p>
                  <p className="text-2xl font-extrabold mt-2" style={{ color: '#d9a854' }}>3.2%</p>
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Click-through Rate</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gbp' && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl p-8 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h2 className="text-2xl font-bold mb-6" style={{ color: '#2c2419' }}>
                Google Business Profile
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-lg" style={{ background: 'rgba(96, 165, 250, 0.05)', border: '1px solid rgba(96, 165, 250, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850' }}>Calls</p>
                  <p className="text-2xl font-extrabold mt-2 tabular-nums" style={{ color: '#60a5fa' }}>{client?.gbp_calls || 0}</p>
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>This period</p>
                </div>
                <div className="p-4 rounded-lg" style={{ background: 'rgba(96, 165, 250, 0.05)', border: '1px solid rgba(96, 165, 250, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850' }}>Profile Views</p>
                  <p className="text-2xl font-extrabold mt-2 tabular-nums" style={{ color: '#60a5fa' }}>892</p>
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>This period</p>
                </div>
                <div className="p-4 rounded-lg" style={{ background: 'rgba(96, 165, 250, 0.05)', border: '1px solid rgba(96, 165, 250, 0.2)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: '#5c5850' }}>Avg Rating</p>
                  <p className="text-2xl font-extrabold mt-2" style={{ color: '#60a5fa' }}>4.8 ⭐</p>
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Based on reviews</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl p-8 shadow-sm" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h2 className="text-2xl font-bold mb-6" style={{ color: '#2c2419' }}>
                Internal Notes
              </h2>
              <p style={{ color: '#5c5850', marginBottom: '20px' }}>Add internal notes and observations about this client account here.</p>
              <textarea
                placeholder="Type your notes here..."
                className="w-full p-4 rounded-lg border"
                style={{
                  borderColor: 'rgba(44, 36, 25, 0.1)',
                  minHeight: '200px',
                  fontFamily: 'inherit',
                  color: '#2c2419',
                  background: 'rgba(245, 241, 237, 0.5)'
                }}
              />
            </div>
          </div>
        )}
        </main>
      </div>
    </div>
  );
}
