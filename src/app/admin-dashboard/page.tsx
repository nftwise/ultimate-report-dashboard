'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

interface Client {
  id: string;
  slug: string;
  name: string;
  city: string;
  is_active: boolean;
}

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
    <div className="min-h-screen pb-20" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-50" style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.1)' }}>
        <h1 className="text-2xl font-bold" style={{ color: '#2c2419' }}>Analytics</h1>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold" style={{ color: '#2c2419' }}>seo@mychiropractice.com</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: '#5c5850' }}>Admin</div>
          </div>
          <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold" style={{ backgroundColor: '#d9a854', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}>
            👤
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="text-white py-20 text-center" style={{ background: 'linear-gradient(135deg, #cc8b65 0%, #d49a6a 100%)' }}>
        <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-80 mb-2">Team Overview</p>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4">Client Performance</h1>
        <p className="opacity-80 font-medium">Dec 29 - Jan 28, 2026</p>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 relative z-10" style={{ marginTop: '-60px' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pl-6 pr-6">
          {[
            { label: 'TOTAL CLIENTS', value: stats.totalClients, change: '+12.5%', trend: 'up' },
            { label: 'TOTAL LEADS', value: stats.totalLeads, change: '+8.3%', trend: 'up' },
            { label: 'TOTAL AD SPEND', value: stats.totalSpend, change: '-2.1%', trend: 'down' },
            { label: 'AVG. COST PER LEAD', value: '$58', change: '-5.7%', trend: 'down' }
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-3xl p-6 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850' }}>{stat.label}</p>
              <p className="text-4xl font-extrabold my-4" style={{ color: '#2c2419' }}>{stat.value}</p>
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold" style={{ background: stat.trend === 'up' ? '#e6f4ea' : '#fce8e6', color: stat.trend === 'up' ? '#1e7e34' : '#c5221f' }}>
                  {stat.trend === 'up' ? '↑' : '↓'} {stat.change}
                </span>
                <span style={{ color: '#5c5850' }}>vs last month</span>
                <span style={{ color: '#5c5850', fontSize: '10px' }}>5m ago</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-8">
        {/* Monthly Leads Trend */}
        <div className="bg-white rounded-3xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
          <h2 className="text-3xl font-extrabold mb-6" style={{ color: '#2c2419' }}>Monthly Leads Trend</h2>
          <div className="h-80 mb-8 flex items-end justify-between">
            {[{ month: 'Aug', value: 74 }, { month: 'Sep', value: 88 }, { month: 'Oct', value: 94 }, { month: 'Nov', value: 78 }, { month: 'Dec', value: 59 }, { month: 'Jan', value: 53 }].map((data, i) => (
              <div key={i} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div className="w-8 rounded-t" style={{ height: `${(data.value / 94) * 100}%`, background: '#9db5a0' }}></div>
                <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>{data.month}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-8 border-t pt-6 text-center" style={{ borderColor: 'rgba(44, 36, 25, 0.1)' }}>
            <div>
              <p className="text-xs mb-1" style={{ color: '#5c5850' }}>Highest Month</p>
              <p className="text-xl font-bold" style={{ color: '#c4704f' }}>94</p>
              <p className="text-[10px] uppercase" style={{ color: '#5c5850' }}>Oct</p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: '#5c5850' }}>Lowest Month</p>
              <p className="text-xl font-bold" style={{ color: '#2c2419' }}>53</p>
              <p className="text-[10px] uppercase" style={{ color: '#5c5850' }}>Jan</p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: '#5c5850' }}>Average</p>
              <p className="text-xl font-bold" style={{ color: '#9db5a0' }}>74</p>
              <p className="text-[10px] uppercase" style={{ color: '#5c5850' }}>per month</p>
            </div>
          </div>
        </div>

        {/* Client Performance Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-3xl font-extrabold" style={{ color: '#2c2419' }}>Client Performance ({filteredClients.length})</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('table')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition"
                style={{ background: viewMode === 'table' ? '#f3f4f6' : 'white', color: '#5c5850', border: '1px solid rgba(44, 36, 25, 0.1)' }}
              >
                📋 Table View
              </button>
              <button
                onClick={() => setViewMode('card')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition"
                style={{ background: viewMode === 'card' ? '#f3f4f6' : 'transparent', color: '#5c5850' }}
              >
                🎴 Card View
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-3 w-5 h-5" style={{ color: '#9ca3af' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients by name or slug..."
              className="w-full pl-10 pr-4 py-3 border rounded-xl transition-all focus:outline-none focus:ring-2"
              style={{ background: '#f5f1ed', borderColor: 'rgba(44, 36, 25, 0.1)', color: '#2c2419' }}
            />
          </div>

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.1)' }}>
                    <th className="text-left text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>Client</th>
                    <th className="text-left text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>Services</th>
                    <th className="text-left text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>City</th>
                    <th className="text-left text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>Status</th>
                    <th className="text-left text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="transition" style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.1)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(44, 36, 25, 0.02)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td className="py-5">
                        <div className="font-bold" style={{ color: '#2c2419' }}>{client.name.toUpperCase()}</div>
                        <div className="text-xs" style={{ color: '#5c5850' }}>@{client.slug}</div>
                      </td>
                      <td className="py-5">
                        <span className="inline-block text-xs font-bold px-2 py-1 rounded mr-2" style={{ background: '#fff8e1', color: '#b45309' }}>SEO</span>
                        <span className="inline-block text-xs font-bold px-2 py-1 rounded" style={{ background: '#f3f4f6', color: '#374151' }}>ADS</span>
                      </td>
                      <td className="py-5" style={{ color: '#5c5850' }}>{client.city || '-'}</td>
                      <td className="py-5">
                        <span className="inline-block text-xs font-bold px-3 py-1 rounded-full" style={{ background: client.is_active ? '#ecfdf5' : '#f3f4f6', color: client.is_active ? '#10b981' : '#6b7280', border: client.is_active ? '1px solid #d1fae5' : '1px solid #e5e7eb' }}>
                          {client.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="py-5">
                        <a href="#" className="text-sm font-medium transition" style={{ color: '#c4704f' }}>View →</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Card View */}
          {viewMode === 'card' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClients.map((client) => (
                <div key={client.id} className="border rounded-lg p-4 transition hover:shadow-md" style={{ borderColor: 'rgba(44, 36, 25, 0.1)' }}>
                  <h4 className="font-bold" style={{ color: '#2c2419' }}>{client.name}</h4>
                  <p className="text-xs mt-1" style={{ color: '#5c5850' }}>@{client.slug}</p>
                  <p className="text-sm mt-2" style={{ color: '#5c5850' }}>{client.city}</p>
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: '#fff8e1', color: '#b45309' }}>SEO</span>
                    <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: '#f3f4f6', color: '#374151' }}>ADS</span>
                  </div>
                  <button className="w-full mt-3 py-2 rounded-lg text-sm font-medium text-white transition" style={{ background: '#c4704f' }}>
                    View Dashboard
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}