'use client';

import { useEffect, useState } from 'react';
import { LogOut, Search, BarChart3, TrendingUp, AlertCircle, Zap, Grid, List } from 'lucide-react';

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

  const getStatusBadge = (status: string) => {
    return status === 'GOOD' ? 'bg-green-100 text-green-700' :
           status === 'CRITICAL' ? 'bg-red-100 text-red-700' :
           'bg-yellow-100 text-yellow-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-400 to-amber-500 sticky top-0 z-30 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-sm font-semibold text-amber-900 tracking-wider">ANALYTICS</h1>
              <p className="text-xs text-amber-900/60 mt-1">Dashboard Performance</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-amber-900 font-medium">
                Dec 29, 2025 - Jan 28, 2026
              </span>
              <button
                onClick={() => window.location.href = '/login'}
                className="flex items-center gap-2 px-3 py-1.5 text-white bg-white/20 hover:bg-white/30 rounded-lg transition text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-amber-400 to-amber-500 py-12 text-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold tracking-widest opacity-90">TEAM OVERVIEW</p>
          <h2 className="text-5xl font-bold mt-2">Client Performance</h2>
          <p className="text-amber-100 mt-2">Dec 29 - Jan 28, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 -mt-6 relative z-10">
          {[
            { label: 'TOTAL CLIENTS', value: stats.totalClients, change: '+12.5%', icon: '👥' },
            { label: 'TOTAL LEADS', value: stats.totalLeads, change: '+8.3%', icon: '📞' },
            { label: 'TOTAL AD SPEND', value: stats.totalSpend, change: '-2.1%', icon: '💰' },
            { label: 'AVG. COST PER LEAD', value: '$58', change: '-5.7%', icon: '📊' }
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-3xl font-bold text-slate-900 mt-3">{stat.value}</p>
              <p className="text-xs text-orange-600 mt-2">{stat.change}</p>
            </div>
          ))}
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients by name or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
        </div>

        {/* Table Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h3 className="text-xl font-bold text-slate-900">
              Client Performance ({filteredClients.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition ${viewMode === 'table' ? 'bg-blue-100 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <List className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 rounded-lg transition ${viewMode === 'card' ? 'bg-blue-100 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Table */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">CLIENT</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">SERVICES</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">CITY</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">STATUS</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client, idx) => (
                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-900">{client.name}</p>
                          <p className="text-xs text-slate-500">@{client.slug}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <span className="inline-block bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium">SEO</span>
                          <span className="inline-block bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">ADS</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{client.city || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${client.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                          {client.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium transition">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {filteredClients.map((client, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition">
                  <h4 className="font-bold text-slate-900">{client.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">@{client.slug}</p>
                  <p className="text-sm text-slate-600 mt-2">{client.city}</p>
                  <div className="flex gap-2 mt-3">
                    <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium">SEO</span>
                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">ADS</span>
                  </div>
                  <button className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition">
                    View Dashboard
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
