'use client';

import { useEffect, useState } from 'react';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ClientWithMetrics {
  id: string;
  name: string;
  slug: string;
  city: string;
  is_active: boolean;
  seo_form_submits?: number;
  seo_top_keyword?: string;
  gbp_calls?: number;
  ads_conversions?: number;
  ads_cpl?: number;
  total_leads?: number;
}

interface MonthlyData {
  month: string;
  total_leads: number;
  seo_forms: number;
  gbp_calls: number;
  ads_conversions: number;
}

export default function AdminDashboardPage() {
  const [clients, setClients] = useState<ClientWithMetrics[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  useEffect(() => {
    fetchData();
    fetchMonthlyData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/clients/list');
      const data = await response.json();

      if (data.success && data.clients) {
        setClients(data.clients);
      }
    } catch (err) {
      setError('Failed to load clients');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyData = async () => {
    try {
      setMonthlyLoading(true);
      const response = await fetch('/api/metrics/monthly-performance?daysBack=365');
      const data = await response.json();

      if (data.success && data.monthlyData) {
        setMonthlyData(data.monthlyData);
      }
    } catch (err) {
      console.error('Failed to load monthly data:', err);
    } finally {
      setMonthlyLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate aggregate stats
  const totalLeads = clients.reduce((sum, c) => sum + (c.total_leads || 0), 0);
  const totalSeoFormSubmits = clients.reduce((sum, c) => sum + (c.seo_form_submits || 0), 0);
  const totalGbpCalls = clients.reduce((sum, c) => sum + (c.gbp_calls || 0), 0);
  const totalAdsConversions = clients.reduce((sum, c) => sum + (c.ads_conversions || 0), 0);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-50" style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.1)' }}>
        <h1 className="text-2xl font-bold" style={{ color: '#2c2419' }}>Admin Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold" style={{ color: '#2c2419' }}>Administrator</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: '#5c5850' }}>All Clients</div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="text-white py-16 text-center" style={{ background: 'linear-gradient(135deg, #c4704f 0%, #d49a6a 100%)' }}>
        <div className="text-xs uppercase tracking-wider opacity-90 mb-2">TEAM OVERVIEW</div>
        <h1 className="text-5xl font-extrabold tracking-tight mb-2">Client Performance</h1>
        <p className="opacity-80 font-medium">Dec 29 - Jan 28, 2026</p>
      </div>

      {/* Stats Cards - Large Design */}
      <div className="max-w-7xl mx-auto px-4 relative z-10" style={{ marginTop: '-60px' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              label: 'TOTAL CLIENTS',
              value: clients.length,
              trend: '+12.5%',
              trendType: 'up',
              trendLabel: 'vs last month'
            },
            {
              label: 'TOTAL LEADS',
              value: totalLeads,
              trend: '+8.3%',
              trendType: 'up',
              trendLabel: 'vs last month'
            },
            {
              label: 'TOTAL AD SPEND',
              value: '$20,618',
              trend: '-2.1%',
              trendType: 'down',
              trendLabel: 'optimization'
            },
            {
              label: 'AVG. COST PER LEAD',
              value: '$58',
              trend: '-5.7%',
              trendType: 'down',
              trendLabel: 'efficiency'
            }
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-8 shadow-lg transition-all duration-300 ease-in-out hover:-translate-y-2 hover:shadow-xl cursor-pointer"
              style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#5c5850' }}>{stat.label}</p>
              <p className="text-4xl font-extrabold mb-4" style={{ color: '#2c2419' }}>{stat.value}</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1" style={{ color: stat.trendType === 'up' ? '#10b981' : '#ef4444' }}>
                  {stat.trendType === 'up' ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="text-sm font-semibold">{stat.trend}</span>
                </div>
                <span className="text-xs" style={{ color: '#9ca3af' }}>{stat.trendLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 mt-12 pb-12">
        {/* Monthly Leads Trend Chart */}
        <div className="bg-white rounded-3xl p-8 shadow-lg mb-12" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
          <h2 className="text-2xl font-extrabold mb-8" style={{ color: '#2c2419' }}>
            Monthly Leads Trend
          </h2>

          {/* Chart */}
          {monthlyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#5c5850' }}>Loading chart data...</div>
          ) : monthlyData.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      color: '#2c2419'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total_leads"
                    stroke="#9db5a0"
                    strokeWidth={3}
                    dot={{ fill: '#9db5a0', r: 6 }}
                    activeDot={{ r: 8 }}
                    name="Total Leads"
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Chart Summary Stats */}
              <div className="grid grid-cols-3 gap-8 mt-12 pt-8" style={{ borderTop: '1px solid rgba(44, 36, 25, 0.1)' }}>
                <div>
                  <p className="text-sm font-medium mb-2" style={{ color: '#9ca3af' }}>Highest Month</p>
                  <p className="text-3xl font-extrabold mb-1" style={{ color: '#c4704f' }}>94</p>
                  <p className="text-xs uppercase tracking-wider font-medium" style={{ color: '#5c5850' }}>OCT</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2" style={{ color: '#9ca3af' }}>Lowest Month</p>
                  <p className="text-3xl font-extrabold mb-1" style={{ color: '#2c2419' }}>53</p>
                  <p className="text-xs uppercase tracking-wider font-medium" style={{ color: '#5c5850' }}>JAN</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2" style={{ color: '#9ca3af' }}>Average</p>
                  <p className="text-3xl font-extrabold mb-1" style={{ color: '#d9a854' }}>74</p>
                  <p className="text-xs uppercase tracking-wider font-medium" style={{ color: '#5c5850' }}>PER MONTH</p>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#5c5850' }}>No data available for this period</div>
          )}
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-2xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-2xl font-extrabold" style={{ color: '#2c2419' }}>
              All Clients ({filteredClients.length}/{clients.length})
            </h2>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-3 w-5 h-5" style={{ color: '#9ca3af' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients by name or slug..."
              className="w-full pl-10 pr-4 py-3 border rounded-lg transition-all focus:outline-none focus:ring-2"
              style={{ background: '#f5f1ed', borderColor: 'rgba(44, 36, 25, 0.1)', color: '#2c2419' }}
            />
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#5c5850' }}>Loading clients...</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#c5221f' }}>{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.1)' }}>
                    <th className="text-left text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>Client Name</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>Total Leads</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>SEO Form Fill</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>Google Ads Conv.</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>CPL</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>GBP Calls</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      className="transition hover:bg-slate-50"
                      style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.05)' }}
                    >
                      <td className="py-4 px-2">
                        <div className="font-bold text-sm" style={{ color: '#2c2419' }}>{client.name}</div>
                        <div className="text-xs" style={{ color: '#5c5850' }}>@{client.slug}</div>
                      </td>
                      <td className="py-4 text-center font-bold text-lg" style={{ color: '#c4704f' }}>
                        {client.total_leads || 0}
                      </td>
                      <td className="py-4 text-center">
                        <div className="text-sm font-semibold" style={{ color: '#9db5a0' }}>{client.seo_form_submits || 0}</div>
                        <div className="text-xs" style={{ color: '#9ca3af' }}>
                          {(client.total_leads || 0) > 0 ? `${((client.seo_form_submits || 0) / (client.total_leads || 1) * 100).toFixed(0)}%` : '—'}
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        <div className="text-sm font-semibold" style={{ color: '#d9a854' }}>{client.ads_conversions || 0}</div>
                        <div className="text-xs" style={{ color: '#9ca3af' }}>
                          {(client.total_leads || 0) > 0 ? `${((client.ads_conversions || 0) / (client.total_leads || 1) * 100).toFixed(0)}%` : '—'}
                        </div>
                      </td>
                      <td className="py-4 text-center text-sm" style={{ color: '#5c5850' }}>
                        {(client.total_leads || 0) > 0 && (client.ads_conversions || 0) > 0
                          ? `$${(20618 / (client.ads_conversions || 1)).toFixed(0)}`
                          : '—'
                        }
                      </td>
                      <td className="py-4 text-center">
                        <div className="text-sm font-semibold" style={{ color: '#60a5fa' }}>{client.gbp_calls || 0}</div>
                        <div className="text-xs" style={{ color: '#9ca3af' }}>
                          {(client.total_leads || 0) > 0 ? `${((client.gbp_calls || 0) / (client.total_leads || 1) * 100).toFixed(0)}%` : '—'}
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        <span
                          className="text-xs font-bold px-3 py-1 rounded-full"
                          style={{
                            background: client.is_active ? '#ecfdf5' : '#f3f4f6',
                            color: client.is_active ? '#10b981' : '#6b7280',
                            border: client.is_active ? '1px solid #d1fae5' : '1px solid #e5e7eb'
                          }}
                        >
                          {client.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredClients.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#5c5850' }}>
                  No clients found
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
