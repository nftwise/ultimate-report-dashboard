'use client';

import { useEffect, useState } from 'react';
import { LogOut, Search } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

interface Client {
  id: string;
  slug: string;
  name: string;
  city: string;
  is_active: boolean;
}

const chartData = [
  { month: 'Aug', value: 74 },
  { month: 'Sep', value: 88 },
  { month: 'Oct', value: 94 },
  { month: 'Nov', value: 78 },
  { month: 'Dec', value: 59 },
  { month: 'Jan', value: 53 }
];

export default function AdminDashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients/list');
      const data = await response.json();
      setClients(data.clients || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalClients: clients.length,
    activeClients: clients.filter(c => c.is_active).length,
    totalLeads: 443,
    totalSpend: '$20,618'
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, var(--bg-primary) 0, var(--bg-secondary) 100%)' }} className="min-h-screen pb-20">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--chocolate)' }}>Analytics</h1>
        </div>

        <div className="hidden md:flex items-center px-4 py-2 rounded-full border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
          <svg className="w-4 h-4 text-[var(--text-secondary)] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>30 Days</span>
          <span className="mx-2 text-gray-300">|</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>90 Days</span>
          <span className="mx-2 text-gray-300">|</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Last Month</span>
          <div className="ml-4 bg-white px-3 py-1 rounded-full text-sm font-semibold shadow-sm" style={{ color: 'var(--text-primary)' }}>
            December 29, 2025 - January 28, 2026
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>seo@mychiropractice.com</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Admin</div>
          </div>
          <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold shadow-lg" style={{ backgroundColor: 'var(--accent)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{ background: 'linear-gradient(135deg, #cc8b65 0%, #d49a6a 100%)' }} className="text-white py-20 text-center">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-80 mb-2">Team Overview</p>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4">Client Performance</h1>
          <p className="opacity-80 font-medium">Dec 29 - Jan 28, 2026</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 z-10 relative" style={{ marginTop: '-60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', paddingLeft: '24px', paddingRight: '24px' }}>
          {[
            { label: 'TOTAL CLIENTS', value: stats.totalClients, change: '+12.5%', trend: 'up' },
            { label: 'TOTAL LEADS', value: stats.totalLeads, change: '+8.3%', trend: 'up' },
            { label: 'TOTAL AD SPEND', value: stats.totalSpend, change: '-2.1%', trend: 'down' },
            { label: 'AVG. COST PER LEAD', value: '$58', change: '-5.7%', trend: 'down' }
          ].map((stat, i) => (
            <div key={i} style={{ backgroundColor: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '24px', boxShadow: '0 4px 20px var(--shadow)', border: '1px solid var(--border-color)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }} className="hover:shadow-lg hover:-translate-y-1">
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>{stat.label}</p>
              <div className="text-4xl font-extrabold mb-4" style={{ color: 'var(--chocolate)' }}>{stat.value}</div>
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="inline-flex items-center gap-1" style={{ background: stat.trend === 'up' ? '#e6f4ea' : '#fce8e6', color: stat.trend === 'up' ? '#1e7e34' : '#c5221f', padding: '4px 12px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: '600' }}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {stat.trend === 'up' ?
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> :
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    }
                  </svg>
                  {stat.change}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>vs last month</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>5m ago</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-8">
        {/* Monthly Leads Trend Chart */}
        <div style={{ backgroundColor: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '24px', boxShadow: '0 4px 20px var(--shadow)', border: '1px solid var(--border-color)' }}>
          <div className="flex justify-between items-end mb-8">
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--chocolate)' }}>Monthly Leads Trend</h2>
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '10px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '10px' }} domain={[50, 100]} />
                <Line type="monotone" dataKey="value" stroke="#9db5a0" strokeWidth={3} dot={{ fill: '#fff', r: 6 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', marginTop: '32px', borderTop: '1px solid var(--border-color)', paddingTop: '24px', textAlign: 'center' }}>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Highest Month</div>
              <div className="text-xl font-bold" style={{ color: 'var(--coral)' }}>94</div>
              <div className="text-[10px] uppercase" style={{ color: 'var(--text-secondary)' }}>Oct</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Lowest Month</div>
              <div className="text-xl font-bold" style={{ color: 'var(--chocolate)' }}>53</div>
              <div className="text-[10px] uppercase" style={{ color: 'var(--text-secondary)' }}>Jan</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Average</div>
              <div className="text-xl font-bold" style={{ color: 'var(--sage)' }}>74</div>
              <div className="text-[10px] uppercase" style={{ color: 'var(--text-secondary)' }}>per month</div>
            </div>
          </div>
        </div>

        {/* Client Performance Table */}
        <section>
          <div style={{ background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-card)', boxShadow: '0 4px 6px var(--shadow), 0 12px 24px var(--shadow-brown)', padding: '32px' }}>
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
              <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--chocolate)' }}>Client Performance ({filteredClients.length})</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('table')}
                  style={{ background: viewMode === 'table' ? '#f3f4f6' : 'white', color: viewMode === 'table' ? 'var(--text-secondary)' : 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--bg-primary)] transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Table View
                </button>
                <button
                  onClick={() => setViewMode('card')}
                  style={{ background: viewMode === 'card' ? '#f3f4f6' : 'transparent', color: 'var(--text-secondary)' }}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-black/5 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Card View
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clients by name or slug..."
                style={{ background: 'var(--bg-primary)' }}
                className="block w-full pl-10 pr-3 py-3 border border-transparent rounded-xl leading-5 placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-2 focus:border-transparent sm:text-sm transition-all shadow-inner"
              />
            </div>

            {/* Table View */}
            {viewMode === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="w-1/6 pb-4 text-right font-bold" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client</th>
                      <th className="pb-4 text-right font-bold" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Services</th>
                      <th className="pb-4 text-right font-bold" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>City</th>
                      <th className="pb-4 text-right font-bold" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                      <th className="pb-4 text-right font-bold" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr key={client.id} className="group hover:bg-[var(--bg-primary)]/40 transition" style={{ borderBottom: '1px solid var(--border-color)', paddingTop: '20px', paddingBottom: '20px' }}>
                        <td className="py-5 pl-4">
                          <div className="font-bold" style={{ color: 'var(--chocolate)' }}>{client.name.toUpperCase()}</div>
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>@{client.slug}</div>
                        </td>
                        <td className="py-5">
                          <div className="flex gap-1 flex-wrap">
                            <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: '#fff8e1', color: '#b45309' }}>SEO</span>
                            <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: '#f3f4f6', color: '#374151' }}>ADS</span>
                          </div>
                        </td>
                        <td className="py-5 text-sm" style={{ color: 'var(--text-secondary)' }}>{client.city || '-'}</td>
                        <td className="py-5">
                          <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: client.is_active ? '#ecfdf5' : '#f3f4f6', color: client.is_active ? '#10b981' : '#6b7280', border: client.is_active ? '1px solid #d1fae5' : '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {client.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-5 text-right">
                          <button className="text-sm font-medium transition" style={{ color: 'var(--primary)' }}>
                            View →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Card View */}
            {viewMode === 'card' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {filteredClients.map((client) => (
                  <div key={client.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', transition: 'all 0.2s ease' }} className="hover:shadow-md">
                    <h4 className="font-bold" style={{ color: 'var(--chocolate)' }}>{client.name}</h4>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>@{client.slug}</p>
                    <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{client.city}</p>
                    <div className="flex gap-2 mt-3">
                      <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: '#fff8e1', color: '#b45309' }}>SEO</span>
                      <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: '#f3f4f6', color: '#374151' }}>ADS</span>
                    </div>
                    <button style={{ background: 'var(--primary)' }} className="mt-3 w-full text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
                      View Dashboard
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
