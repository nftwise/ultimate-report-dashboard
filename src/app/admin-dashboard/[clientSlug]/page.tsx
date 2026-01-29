'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Calendar, TrendingUp, TrendingDown, BarChart3, PieChart } from 'lucide-react';

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

interface MetricCard {
  label: string;
  value: string | number;
  trend: number;
  trendLabel: string;
  icon?: string;
}

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientSlug = params?.clientSlug as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  });

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

  const stats: MetricCard[] = [
    { label: 'Total Leads', value: client.total_leads || 0, trend: 12.5, trendLabel: 'vs last month' },
    { label: 'Ad Spend', value: '$3,749', trend: -2.1, trendLabel: 'optimization' },
    { label: 'Form Fills', value: client.seo_form_submits || 0, trend: 45, trendLabel: 'vs last month' },
    { label: 'Cost Per Lead', value: '$58', trend: -5.7, trendLabel: 'efficiency' },
  ];

  const tabConfig = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'seo', label: '🔍 SEO' },
    { id: 'ads', label: '📢 Ads' },
    { id: 'gbp', label: '🗺️ GBP' },
    { id: 'notes', label: '📝 Notes' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
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

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: '#fff', border: '1px solid rgba(44, 36, 25, 0.1)' }}>
            <Calendar className="w-4 h-4" style={{ color: '#c4704f' }} />
            <span className="text-sm font-semibold" style={{ color: '#2c2419' }}>
              Last 30 days
            </span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #cc8b65 0%, #d49a6a 100%)',
        color: 'white',
        padding: '60px 20px 100px',
        textAlign: 'center'
      }}>
        <h1 className="text-4xl font-black mb-2" style={{ letterSpacing: '-0.02em' }}>
          Performance Dashboard
        </h1>
        <p className="text-lg opacity-90">
          Comprehensive metrics and insights for {client.name}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-16 z-40 flex items-center gap-8 px-8 py-4" style={{
        background: 'rgba(245, 241, 237, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44, 36, 25, 0.1)'
      }}>
        {tabConfig.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="py-2 px-3 font-semibold text-sm transition border-b-2"
            style={{
              color: activeTab === tab.id ? '#c4704f' : '#5c5850',
              borderBottomColor: activeTab === tab.id ? '#c4704f' : 'transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8 pb-12">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid (Overlapping) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 -mt-4 mb-8">
              {stats.map((stat, i) => (
                <div
                  key={i}
                  className="bg-white rounded-3xl p-8 shadow-lg transition hover:shadow-xl"
                  style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}
                >
                  <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#5c5850' }}>
                    {stat.label}
                  </p>
                  <p className="text-4xl font-extrabold mb-4" style={{ color: '#2c2419' }}>
                    {stat.value}
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center gap-1"
                      style={{ color: stat.trend > 0 ? '#10b981' : '#ef4444' }}
                    >
                      {stat.trend > 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span className="text-sm font-semibold">{Math.abs(stat.trend)}%</span>
                    </div>
                    <span className="text-xs" style={{ color: '#9ca3af' }}>
                      {stat.trendLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Insight Grid: Top Performers, Needs Attention, Growth Opportunities */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Top Performers */}
              <div className="bg-white rounded-3xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
                <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>🏆 Top Performers</h3>
                <div className="space-y-4">
                  <div style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.05)', paddingBottom: '16px' }}>
                    <p className="font-semibold text-sm" style={{ color: '#2c2419' }}>Google Ads</p>
                    <p className="text-xs mt-1" style={{ color: '#5c5850' }}>2.8x ROAS</p>
                  </div>
                  <div style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.05)', paddingBottom: '16px' }}>
                    <p className="font-semibold text-sm" style={{ color: '#2c2419' }}>Organic Search</p>
                    <p className="text-xs mt-1" style={{ color: '#5c5850' }}>24 ranking keywords</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#2c2419' }}>Lead Quality</p>
                    <p className="text-xs mt-1" style={{ color: '#5c5850' }}>45% form completion</p>
                  </div>
                </div>
              </div>

              {/* Needs Attention */}
              <div className="bg-white rounded-3xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
                <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>⚠️ Needs Attention</h3>
                <div className="space-y-4">
                  <div style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.05)', paddingBottom: '16px' }}>
                    <p className="font-semibold text-sm" style={{ color: '#ef4444' }}>CPL Trending Up</p>
                    <p className="text-xs mt-1" style={{ color: '#5c5850' }}>↑ 12% from last month</p>
                  </div>
                  <div style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.05)', paddingBottom: '16px' }}>
                    <p className="font-semibold text-sm" style={{ color: '#ef4444' }}>GBP Calls Low</p>
                    <p className="text-xs mt-1" style={{ color: '#5c5850' }}>↓ 8% decrease</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#f59e0b' }}>Budget Utilization</p>
                    <p className="text-xs mt-1" style={{ color: '#5c5850' }}>78% of monthly budget</p>
                  </div>
                </div>
              </div>

              {/* Growth Opportunities */}
              <div className="bg-white rounded-3xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
                <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>🚀 Growth Opportunities</h3>
                <div className="space-y-4">
                  <div style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.05)', paddingBottom: '16px' }}>
                    <p className="font-semibold text-sm" style={{ color: '#2c2419' }}>SEO Expansion</p>
                    <p className="text-xs mt-1" style={{ color: '#5c5850' }}>12 new keywords ready</p>
                  </div>
                  <div style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.05)', paddingBottom: '16px' }}>
                    <p className="font-semibold text-sm" style={{ color: '#2c2419' }}>Audience Targeting</p>
                    <p className="text-xs mt-1" style={{ color: '#5c5850' }}>Untapped demographics</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#2c2419' }}>Retargeting</p>
                    <p className="text-xs mt-1" style={{ color: '#5c5850' }}>+35% conversion potential</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Large Chart Section */}
            <div className="bg-white rounded-3xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>
                📈 Daily Leads Trend (30 Days)
              </h3>
              <div className="h-64 flex items-end gap-1 mb-8">
                {Array.from({ length: 30 }).map((_, i) => {
                  const value = Math.floor(Math.random() * 100);
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t transition hover:opacity-80"
                      style={{
                        background: '#c4704f',
                        height: `${(value / 100) * 100}%`,
                        minHeight: '4px',
                      }}
                      title={`Day ${i + 1}: ${value}`}
                    />
                  );
                })}
              </div>

              {/* Summary Stats Below Chart */}
              <div className="grid grid-cols-3 gap-4" style={{ borderTop: '1px solid rgba(44, 36, 25, 0.1)', paddingTop: '24px' }}>
                <div style={{ textAlign: 'center', borderRight: '1px solid rgba(44, 36, 25, 0.1)' }}>
                  <p className="text-xs uppercase font-bold" style={{ color: '#5c5850' }}>Highest</p>
                  <p className="text-2xl font-bold mt-2" style={{ color: '#10b981' }}>98</p>
                  <p className="text-xs mt-1" style={{ color: '#5c5850' }}>Day 24</p>
                </div>
                <div style={{ textAlign: 'center', borderRight: '1px solid rgba(44, 36, 25, 0.1)' }}>
                  <p className="text-xs uppercase font-bold" style={{ color: '#5c5850' }}>Average</p>
                  <p className="text-2xl font-bold mt-2" style={{ color: '#c4704f' }}>52</p>
                  <p className="text-xs mt-1" style={{ color: '#5c5850' }}>Daily Average</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p className="text-xs uppercase font-bold" style={{ color: '#5c5850' }}>Lowest</p>
                  <p className="text-2xl font-bold mt-2" style={{ color: '#ef4444' }}>12</p>
                  <p className="text-xs mt-1" style={{ color: '#5c5850' }}>Day 8</p>
                </div>
              </div>
            </div>

            {/* Lead Distribution by Channel */}
            <div className="bg-white rounded-3xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>Lead Distribution by Channel</h3>
              <div className="space-y-6">
                {[
                  { label: 'Google Ads', value: client.ads_conversions || 0, color: '#d9a854', icon: '📊' },
                  { label: 'SEO / Organic', value: client.seo_form_submits || 0, color: '#9db5a0', icon: '🔍' },
                  { label: 'Google Business Profile', value: client.gbp_calls || 0, color: '#60a5fa', icon: '🗺️' },
                ].map((item, i) => {
                  const total = (client.ads_conversions || 0) + (client.seo_form_submits || 0) + (client.gbp_calls || 0);
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
                        <p className="text-2xl font-extrabold" style={{ color: item.color }}>{item.value}</p>
                      </div>
                      <div className="w-full h-4 rounded-full" style={{ background: 'rgba(44, 36, 25, 0.05)' }}>
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

            {/* Channel Performance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Google Ads */}
              <div className="bg-white rounded-3xl p-6 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
                <h3 className="text-lg font-bold mb-4" style={{ color: '#2c2419' }}>📊 Google Ads</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Conversions</span>
                    <span style={{ color: '#d9a854', fontWeight: 'bold' }}>{client.ads_conversions || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Ad Spend</span>
                    <span style={{ color: '#d9a854', fontWeight: 'bold' }}>$2,450</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>ROAS</span>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>2.8x</span>
                  </div>
                </div>
              </div>

              {/* SEO */}
              <div className="bg-white rounded-3xl p-6 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
                <h3 className="text-lg font-bold mb-4" style={{ color: '#2c2419' }}>🔍 SEO</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Form Submissions</span>
                    <span style={{ color: '#9db5a0', fontWeight: 'bold' }}>{client.seo_form_submits || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Organic Traffic</span>
                    <span style={{ color: '#9db5a0', fontWeight: 'bold' }}>1,240 sessions</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Ranking Keywords</span>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>24 keywords</span>
                  </div>
                </div>
              </div>

              {/* GBP */}
              <div className="bg-white rounded-3xl p-6 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
                <h3 className="text-lg font-bold mb-4" style={{ color: '#2c2419' }}>🗺️ Google Business</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Calls</span>
                    <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{client.gbp_calls || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Views</span>
                    <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>892 views</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Avg Rating</span>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>4.8 ⭐</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'seo' && (
          <div className="bg-white rounded-3xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
            <h2 className="text-2xl font-bold mb-6" style={{ color: '#2c2419' }}>
              SEO Performance
            </h2>
            <p style={{ color: '#5c5850' }}>SEO detailed metrics coming soon...</p>
          </div>
        )}

        {activeTab === 'ads' && (
          <div className="bg-white rounded-3xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
            <h2 className="text-2xl font-bold mb-6" style={{ color: '#2c2419' }}>
              Google Ads Performance
            </h2>
            <p style={{ color: '#5c5850' }}>Ads detailed metrics coming soon...</p>
          </div>
        )}

        {activeTab === 'gbp' && (
          <div className="bg-white rounded-3xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
            <h2 className="text-2xl font-bold mb-6" style={{ color: '#2c2419' }}>
              Google Business Profile
            </h2>
            <p style={{ color: '#5c5850' }}>GBP detailed metrics coming soon...</p>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="bg-white rounded-3xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
            <h2 className="text-2xl font-bold mb-6" style={{ color: '#2c2419' }}>
              Internal Notes
            </h2>
            <p style={{ color: '#5c5850' }}>Notes section coming soon...</p>
          </div>
        )}
      </main>
    </div>
  );
}
