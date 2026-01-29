'use client';

import { useEffect, useState } from 'react';
import { Search, TrendingUp, TrendingDown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

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

  // Date range state
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, [dateRange]);

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

  // Get days difference
  const getDaysDifference = () => {
    return Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Set date range by preset
  const setPresetRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateRange({ start, end });
    setShowCalendar(false);
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getCalendarDays = () => {
    const daysInMonth = getDaysInMonth(calendarMonth);
    const firstDay = getFirstDayOfMonth(calendarMonth);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const isDateSelected = (day: number) => {
    const checkDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    return (
      checkDate.toDateString() === dateRange.start.toDateString() ||
      checkDate.toDateString() === dateRange.end.toDateString()
    );
  };

  const isDateInRange = (day: number) => {
    const checkDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    return checkDate >= dateRange.start && checkDate <= dateRange.end;
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);

    if (clickedDate < dateRange.start) {
      setDateRange({ start: clickedDate, end: dateRange.end });
    } else if (clickedDate > dateRange.end) {
      setDateRange({ start: dateRange.start, end: clickedDate });
    } else {
      setDateRange({ start: clickedDate, end: clickedDate });
    }
    // Close calendar after selection
    setShowCalendar(false);
  };

  const calendarDays = getCalendarDays();
  const monthName = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4" style={{ background: '#f5f1ed', borderBottom: '1px solid rgba(44, 36, 25, 0.1)' }}>
        <h1 className="text-3xl font-black" style={{ color: '#2c2419' }}>Analytics</h1>

        <div className="flex items-center gap-6">
          {/* Quick Select Buttons */}
          <div className="flex gap-2">
            {[
              { label: '30 Days', days: 30 },
              { label: '90 Days', days: 90 },
              { label: 'Last Month', days: -1 }
            ].map((preset) => {
              const isActive = preset.days === -1 ? false : getDaysDifference() === preset.days;
              return (
                <button
                  key={preset.label}
                  onClick={() => {
                    if (preset.days === -1) {
                      const end = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
                      const start = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
                      setDateRange({ start, end });
                    } else {
                      setPresetRange(preset.days);
                    }
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded transition"
                  style={{
                    background: isActive ? '#c4704f' : 'transparent',
                    color: isActive ? '#fff' : '#5c5850'
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Date Range Box */}
          <div className="relative">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="flex items-center gap-3 px-6 py-3 rounded-lg transition"
              style={{
                background: '#fff',
                border: '2px solid #c4704f',
                color: '#2c2419'
              }}
            >
              <Calendar className="w-5 h-5" style={{ color: '#c4704f' }} />
              <span className="font-bold text-sm">
                {dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </button>

            {/* Calendar Popup */}
            {showCalendar && (
              <div className="absolute right-0 top-full mt-3 bg-white rounded-xl shadow-2xl p-8 z-50 w-96" style={{ border: '1px solid rgba(196, 112, 79, 0.2)', animation: 'fadeIn 0.15s ease-out' }}>
                <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-8">
                  <button
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                    className="p-2 hover:opacity-70 rounded transition"
                  >
                    <ChevronLeft className="w-6 h-6" style={{ color: '#c4704f' }} />
                  </button>
                  <h3 className="text-xl font-bold" style={{ color: '#2c2419', minWidth: '200px', textAlign: 'center' }}>
                    {monthName}
                  </h3>
                  <button
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                    className="p-2 hover:opacity-70 rounded transition"
                  >
                    <ChevronRight className="w-6 h-6" style={{ color: '#c4704f' }} />
                  </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="text-center text-xs font-bold py-3" style={{ color: '#9ca3af' }}>
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => day !== null && handleDayClick(day)}
                      disabled={day === null}
                      className="py-4 text-sm font-semibold rounded-lg transition-all duration-100"
                      style={{
                        background:
                          day === null
                            ? 'transparent'
                            : isDateSelected(day)
                            ? '#c4704f'
                            : isDateInRange(day)
                            ? '#f0e5dc'
                            : '#f9f7f4',
                        color: day !== null && isDateSelected(day) ? '#fff' : day !== null && isDateInRange(day) ? '#c4704f' : '#2c2419',
                        cursor: day !== null ? 'pointer' : 'default',
                        opacity: day !== null ? 1 : 0,
                        fontWeight: day !== null && isDateInRange(day) ? '600' : '500',
                        border: day !== null && isDateInRange(day) ? '1px solid #c4704f' : 'none'
                      }}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                {/* Selected Range Info */}
                <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(44, 36, 25, 0.1)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#5c5850' }}>Selected Range:</p>
                  <p className="text-sm font-bold" style={{ color: '#c4704f' }}>
                    {dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Admin Info */}
        <div className="text-right hidden sm:block">
          <div className="text-xs font-bold" style={{ color: '#2c2419' }}>Administrator</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: '#5c5850' }}>All Clients</div>
        </div>
      </nav>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 mt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
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
      <main className="max-w-7xl mx-auto px-4 pb-12">

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
