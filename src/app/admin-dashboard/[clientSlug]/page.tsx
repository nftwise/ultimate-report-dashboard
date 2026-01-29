'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Calendar, TrendingUp, TrendingDown } from 'lucide-react';

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
    // Fetch client details
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
    { label: 'Impressions', value: (client.total_leads || 0) * 5, trend: 8, trendLabel: 'vs last month' },
    { label: 'Form Fills', value: client.seo_form_submits || 0, trend: 45, trendLabel: 'vs last month' },
    { label: 'Cost Per Lead', value: '$156', trend: -5.7, trendLabel: 'efficiency' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
      {/* Header */}
      <nav className="sticky top-0 z-50 flex items-center gap-6 px-8 py-4" style={{ background: '#f5f1ed', borderBottom: '1px solid rgba(44, 36, 25, 0.1)' }}>
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
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: '#fff', border: '1px solid rgba(44, 36, 25, 0.1)' }}>
            <Calendar className="w-4 h-4" style={{ color: '#c4704f' }} />
            <span className="text-sm font-semibold" style={{ color: '#2c2419' }}>
              {dateRange.start?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {dateRange.end?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="sticky top-16 z-40 flex items-center gap-8 px-8 py-4" style={{ background: '#f5f1ed', borderBottom: '1px solid rgba(44, 36, 25, 0.1)' }}>
        {['overview', 'seo', 'ads', 'gbp', 'notes'].map((tab) => {
          const labels: { [key: string]: string } = {
            overview: '📊 Overview',
            seo: '🔍 SEO',
            ads: '📢 Ads',
            gbp: '🗺️ GBP',
            notes: '📝 Notes',
          };

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="py-2 px-3 font-semibold text-sm transition border-b-2"
              style={{
                color: activeTab === tab ? '#c4704f' : '#5c5850',
                borderBottomColor: activeTab === tab ? '#c4704f' : 'transparent',
              }}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 pb-12">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Status Sections Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* What's Great */}
              <div className="bg-white rounded-2xl p-6 shadow-lg" style={{ border: '2px solid #10b981' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#d1fae5' }}>
                    <span style={{ color: '#10b981', fontSize: '20px' }}>✓</span>
                  </div>
                  <h3 className="font-bold" style={{ color: '#2c2419' }}>What's Great</h3>
                </div>
                <ul className="space-y-2 text-sm" style={{ color: '#5c5850' }}>
                  <li>✓ Strong SEO performance</li>
                  <li>✓ Consistent lead generation</li>
                  <li>✓ High Google Ads conversion</li>
                </ul>
              </div>

              {/* Needs Attention */}
              <div className="bg-white rounded-2xl p-6 shadow-lg" style={{ border: '2px solid #f59e0b' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#fef3c7' }}>
                    <span style={{ color: '#f59e0b', fontSize: '20px' }}>!</span>
                  </div>
                  <h3 className="font-bold" style={{ color: '#2c2419' }}>Needs Attention</h3>
                </div>
                <ul className="space-y-2 text-sm" style={{ color: '#5c5850' }}>
                  <li>• CPL trending upward</li>
                  <li>• GBP calls declining</li>
                  <li>• Form submissions low</li>
                </ul>
              </div>

              {/* We're Working On It */}
              <div className="bg-white rounded-2xl p-6 shadow-lg" style={{ border: '2px solid #3b82f6' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#dbeafe' }}>
                    <span style={{ color: '#3b82f6', fontSize: '18px' }}>⚙</span>
                  </div>
                  <h3 className="font-bold" style={{ color: '#2c2419' }}>We're Working On It</h3>
                </div>
                <ul className="space-y-2 text-sm" style={{ color: '#5c5850' }}>
                  <li>• Optimizing ad spend</li>
                  <li>• Testing new keywords</li>
                  <li>• Improving landing pages</li>
                </ul>
              </div>
            </div>

            {/* Key Performance Metrics */}
            <div>
              <h3 className="text-lg font-bold mb-4" style={{ color: '#2c2419' }}>Key Performance Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl p-6 shadow-lg transition hover:shadow-xl"
                    style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850' }}>
                      {stat.label}
                    </p>
                    <p className="text-3xl font-extrabold mb-4" style={{ color: '#2c2419' }}>
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
            </div>

            {/* Lead Distribution by Channel */}
            <div className="bg-white rounded-2xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
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

            {/* Daily Traffic & Leads Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Stats */}
              <div className="bg-white rounded-2xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
                <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>Daily Traffic & Leads Analysis</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: '#f9f7f4' }}>
                    <div>
                      <p className="text-xs font-semibold uppercase" style={{ color: '#9ca3af' }}>Avg Daily Leads</p>
                      <p className="text-2xl font-bold" style={{ color: '#c4704f' }}>
                        {Math.ceil((client.total_leads || 0) / 30)}
                      </p>
                    </div>
                    <span style={{ fontSize: '32px' }}>📈</span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: '#f9f7f4' }}>
                    <div>
                      <p className="text-xs font-semibold uppercase" style={{ color: '#9ca3af' }}>Avg Daily Ad Spend</p>
                      <p className="text-2xl font-bold" style={{ color: '#d9a854' }}>$125</p>
                    </div>
                    <span style={{ fontSize: '32px' }}>💰</span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: '#f9f7f4' }}>
                    <div>
                      <p className="text-xs font-semibold uppercase" style={{ color: '#9ca3af' }}>Avg Daily Sessions</p>
                      <p className="text-2xl font-bold" style={{ color: '#60a5fa' }}>152</p>
                    </div>
                    <span style={{ fontSize: '32px' }}>👥</span>
                  </div>
                </div>
              </div>

              {/* Trend Chart */}
              <div className="bg-white rounded-2xl p-6 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
                <h3 className="text-lg font-bold mb-4" style={{ color: '#2c2419' }}>
                  Daily Leads Trend (30 days)
                </h3>
                <div className="h-64 flex items-end gap-1">
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
              </div>
            </div>

            {/* 6-Month Lead Performance */}
            <div className="bg-white rounded-2xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <h3 className="text-lg font-bold mb-6" style={{ color: '#2c2419' }}>6-Month Lead Performance</h3>
              <div className="space-y-3">
                {['January', 'February', 'March', 'April', 'May', 'June'].map((month, i) => {
                  const leads = Math.floor(Math.random() * 200) + 50;
                  const maxLeads = 250;
                  return (
                    <div key={i}>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-semibold" style={{ color: '#2c2419' }}>{month}</span>
                        <span className="text-sm font-bold" style={{ color: '#c4704f' }}>{leads} leads</span>
                      </div>
                      <div className="w-full h-3 rounded-full" style={{ background: 'rgba(44, 36, 25, 0.1)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(leads / maxLeads) * 100}%`,
                            background: 'linear-gradient(90deg, #c4704f 0%, #d9a854 100%)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Channel Performance Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Google Ads Performance */}
              <div className="bg-white rounded-2xl p-6 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
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

              {/* SEO Performance */}
              <div className="bg-white rounded-2xl p-6 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
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

              {/* GBP Performance */}
              <div className="bg-white rounded-2xl p-6 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
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
          <div className="bg-white rounded-2xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
            <h2 className="text-2xl font-bold mb-6" style={{ color: '#2c2419' }}>
              SEO Performance
            </h2>
            <p style={{ color: '#5c5850' }}>SEO detailed metrics coming soon...</p>
          </div>
        )}

        {activeTab === 'ads' && (
          <div className="bg-white rounded-2xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
            <h2 className="text-2xl font-bold mb-6" style={{ color: '#2c2419' }}>
              Google Ads Performance
            </h2>
            <p style={{ color: '#5c5850' }}>Ads detailed metrics coming soon...</p>
          </div>
        )}

        {activeTab === 'gbp' && (
          <div className="bg-white rounded-2xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
            <h2 className="text-2xl font-bold mb-6" style={{ color: '#2c2419' }}>
              Google Business Profile
            </h2>
            <p style={{ color: '#5c5850' }}>GBP detailed metrics coming soon...</p>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="bg-white rounded-2xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
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
