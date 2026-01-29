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
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      fetchData();
    }
  }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const dateFromStr = dateRange.start?.toISOString().split('T')[0] || '';
      const dateToStr = dateRange.end?.toISOString().split('T')[0] || '';

      const params = new URLSearchParams();
      if (dateFromStr) params.append('dateFrom', dateFromStr);
      if (dateToStr) params.append('dateTo', dateToStr);

      const response = await fetch(`/api/clients/list?${params.toString()}`);
      const data = await response.json();

      if (data.success && data.clients) {
        setClients(data.clients);
      } else {
        setError(data.error || 'Failed to load clients');
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

  const totalLeads = clients.reduce((sum, c) => sum + (c.total_leads || 0), 0);
  const totalSeoFormSubmits = clients.reduce((sum, c) => sum + (c.seo_form_submits || 0), 0);
  const totalGbpCalls = clients.reduce((sum, c) => sum + (c.gbp_calls || 0), 0);
  const totalAdsConversions = clients.reduce((sum, c) => sum + (c.ads_conversions || 0), 0);

  const getDaysDifference = () => {
    if (!dateRange.start || !dateRange.end) return 0;
    return Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const setPresetRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateRange({ start, end });
    setShowCalendar(false);
  };

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

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const isDateSelected = (day: number) => {
    const checkDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    return (
      (dateRange.start && checkDate.toDateString() === dateRange.start.toDateString()) ||
      (dateRange.end && checkDate.toDateString() === dateRange.end.toDateString())
    );
  };

  const isDateInRange = (day: number) => {
    const checkDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    if (!dateRange.start || !dateRange.end) return false;
    return checkDate >= dateRange.start && checkDate <= dateRange.end;
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);

    if (!dateRange.start) {
      setDateRange({ start: clickedDate, end: null });
    } else if (!dateRange.end) {
      if (clickedDate < dateRange.start) {
        setDateRange({ start: clickedDate, end: dateRange.start });
      } else {
        setDateRange({ start: dateRange.start, end: clickedDate });
      }
      setShowCalendar(false);
    } else {
      setDateRange({ start: clickedDate, end: null });
    }
  };

  const calendarDays = getCalendarDays();
  const monthName = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
      {/* Sticky Navigation */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4" style={{
        background: 'rgba(245, 241, 237, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44, 36, 25, 0.1)'
      }}>
        <h1 className="text-2xl font-black" style={{ color: '#2c2419' }}>Analytics</h1>

        <div className="flex items-center gap-6">
          {/* Quick Select Buttons */}
          <div className="flex gap-2">
            {[
              { label: '30D', days: 30 },
              { label: '90D', days: 90 },
              { label: 'MTD', days: -1 }
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
                  className="px-4 py-2 text-sm font-semibold rounded-full transition"
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

          {/* Date Range Pill */}
          <div className="relative">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="flex items-center gap-2 px-6 py-2 rounded-full transition"
              style={{
                background: '#fff',
                border: '2px solid #c4704f',
                color: '#2c2419'
              }}
            >
              <Calendar className="w-4 h-4" style={{ color: '#c4704f' }} />
              <span className="text-sm font-semibold">
                {dateRange.start ? dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Start'} - {dateRange.end ? dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'End'}
              </span>
            </button>

            {/* Calendar Popup */}
            {showCalendar && (
              <div className="absolute right-0 top-full mt-3 bg-white rounded-3xl shadow-2xl p-8 z-50 w-96" style={{ border: '1px solid rgba(196, 112, 79, 0.2)', animation: 'fadeIn 0.15s ease-out' }}>
                <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-8">
                  <button
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                    className="p-2 hover:opacity-70 rounded-full transition"
                  >
                    <ChevronLeft className="w-6 h-6" style={{ color: '#c4704f' }} />
                  </button>
                  <h3 className="text-lg font-bold" style={{ color: '#2c2419', minWidth: '200px', textAlign: 'center' }}>
                    {monthName}
                  </h3>
                  <button
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                    className="p-2 hover:opacity-70 rounded-full transition"
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
                <style>{`
                  .calendar-day {
                    transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
                  }
                  .calendar-day:not(:disabled):hover {
                    background-color: #f3e8df !important;
                    transform: translateY(-2px) !important;
                    box-shadow: 0 4px 12px rgba(196, 112, 79, 0.12) !important;
                  }
                  .calendar-day:not(:disabled):active {
                    transform: translateY(0) !important;
                  }
                `}</style>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => day !== null && handleDayClick(day)}
                      disabled={day === null}
                      className="calendar-day w-12 h-12 text-sm font-semibold rounded-lg flex items-center justify-center"
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
                        border: day !== null && isDateInRange(day) ? '2px solid #c4704f' : '1px solid rgba(44, 36, 25, 0.08)',
                        boxShadow: day !== null && (isDateSelected(day) || isDateInRange(day)) ? '0 2px 8px rgba(196, 112, 79, 0.15)' : 'none',
                      }}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                {/* Selected Range Info */}
                <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(44, 36, 25, 0.1)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#5c5850' }}>
                    {!dateRange.start ? '👆 Click to select start date' : !dateRange.end ? '👆 Click to select end date' : '✓ Date range selected'}
                  </p>
                  <p className="text-sm font-bold" style={{ color: '#c4704f' }}>
                    {dateRange.start ? dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'} - {dateRange.end ? dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Admin Info */}
        <div className="text-right hidden sm:block">
          <div className="text-xs font-bold" style={{ color: '#2c2419' }}>Administrator</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: '#5c5850' }}>Dashboard</div>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #cc8b65 0%, #d49a6a 100%)',
        color: 'white',
        padding: '80px 20px 120px',
        textAlign: 'center'
      }}>
        <h1 className="text-5xl font-black mb-4" style={{ letterSpacing: '-0.02em' }}>
          Client Performance
        </h1>
        <p className="text-lg opacity-90">
          Monitor and optimize client campaigns across all channels
        </p>
      </div>

      {/* Stats Grid (Overlapping) */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 -mt-20 mb-12 relative z-10">
          {[
            {
              label: 'Total Clients',
              value: clients.length,
              trend: '+12.5%',
              trendType: 'up',
            },
            {
              label: 'Total Leads',
              value: totalLeads,
              trend: '+8.3%',
              trendType: 'up',
            },
            {
              label: 'Avg CPL',
              value: '$58',
              trend: '-5.7%',
              trendType: 'down',
            },
            {
              label: 'GBP Calls',
              value: totalGbpCalls,
              trend: '+3.2%',
              trendType: 'up',
            }
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white rounded-3xl p-8 shadow-lg transition hover:shadow-xl cursor-pointer"
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
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pb-12">
        {/* Data Table Section */}
        <div className="bg-white rounded-3xl p-8 shadow-lg" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h2 className="text-3xl font-extrabold" style={{ color: '#2c2419' }}>
              All Clients
            </h2>
            <span className="text-sm font-semibold px-4 py-2 rounded-full" style={{ background: '#f9f7f4', color: '#5c5850' }}>
              {filteredClients.length} of {clients.length}
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative mb-8">
            <Search className="absolute left-4 top-4 w-5 h-5" style={{ color: '#9ca3af' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients by name..."
              className="w-full pl-12 pr-4 py-3 border-2 rounded-full transition-all focus:outline-none"
              style={{ background: '#f5f1ed', borderColor: 'transparent', color: '#2c2419' }}
            />
          </div>

          <style>{`
            table tbody tr {
              transition: background-color 150ms ease-out;
            }
            table tbody tr:hover {
              background-color: #faf7f4;
            }
          `}</style>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#5c5850' }}>Loading clients...</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#c5221f' }}>{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(44, 36, 25, 0.1)' }}>
                    <th className="text-left text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#5c5850' }}>Client</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#5c5850' }}>Leads</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#5c5850' }}>Ads Conv</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#5c5850' }}>SEO Form</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#5c5850' }}>GBP Calls</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#5c5850' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      onClick={() => window.location.href = `/admin-dashboard/${client.slug}`}
                      className="transition cursor-pointer"
                      style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.05)' }}
                    >
                      <td className="py-5 px-2">
                        <div className="font-bold" style={{ color: '#c4704f' }}>
                          {client.name}
                        </div>
                        <div className="text-xs" style={{ color: '#5c5850' }}>@{client.slug}</div>
                      </td>
                      <td className="py-5 text-center font-bold text-lg" style={{ color: '#c4704f' }}>
                        {client.total_leads || 0}
                      </td>
                      <td className="py-5 text-center">
                        <div className="text-sm font-semibold" style={{ color: '#d9a854' }}>{client.ads_conversions || 0}</div>
                      </td>
                      <td className="py-5 text-center">
                        <div className="text-sm font-semibold" style={{ color: '#9db5a0' }}>{client.seo_form_submits || 0}</div>
                      </td>
                      <td className="py-5 text-center">
                        <div className="text-sm font-semibold" style={{ color: '#60a5fa' }}>{client.gbp_calls || 0}</div>
                      </td>
                      <td className="py-5 text-center">
                        <span
                          className="text-xs font-bold px-3 py-1 rounded-full inline-block"
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
