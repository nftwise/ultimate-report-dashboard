'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

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

export default function AdminDashboardPage() {
  const [clients, setClients] = useState<ClientWithMetrics[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
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
      <div className="text-white py-12 text-center" style={{ background: 'linear-gradient(135deg, #cc8b65 0%, #d49a6a 100%)' }}>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Client Overview</h1>
        <p className="opacity-80 font-medium text-sm">Monitor all clients performance</p>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 relative z-10" style={{ marginTop: '-40px' }}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'TOTAL CLIENTS', value: clients.length, color: '#c4704f' },
            { label: 'TOTAL LEADS', value: totalLeads, color: '#d9a854' },
            { label: 'SEO FORM SUBMITS', value: totalSeoFormSubmits, color: '#9db5a0' },
            { label: 'GBP CALLS', value: totalGbpCalls, color: '#5c5850' }
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-md" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850' }}>{stat.label}</p>
              <p className="text-3xl font-extrabold my-2" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>Updated now</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 mt-12 pb-12">
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
                    <th className="text-left text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>City</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>Total Leads</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>SEO Forms</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>GBP Calls</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>Ads Conv.</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider pb-4" style={{ color: '#5c5850' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      className="transition"
                      style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.05)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(44, 36, 25, 0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="py-4">
                        <div className="font-bold text-sm" style={{ color: '#2c2419' }}>{client.name}</div>
                        <div className="text-xs" style={{ color: '#5c5850' }}>@{client.slug}</div>
                      </td>
                      <td className="py-4 text-sm" style={{ color: '#5c5850' }}>{client.city || '-'}</td>
                      <td className="py-4 text-center font-semibold" style={{ color: '#c4704f' }}>{client.total_leads || 0}</td>
                      <td className="py-4 text-center" style={{ color: '#9db5a0' }}>{client.seo_form_submits || 0}</td>
                      <td className="py-4 text-center" style={{ color: '#d9a854' }}>{client.gbp_calls || 0}</td>
                      <td className="py-4 text-center" style={{ color: '#5c5850' }}>{client.ads_conversions || 0}</td>
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
