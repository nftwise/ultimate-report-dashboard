'use client';

import { useEffect, useState } from 'react';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';

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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);

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

  // Helper function to get days in month
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  // Helper function to format date for calendar
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  // Helper function to check if date is in range
  const isDateInRange = (date: Date) => {
    return date >= dateRange.start && date <= dateRange.end;
  };

  // Helper function to check if date is start or end
  const isDateStart = (date: Date) => formatDate(date) === formatDate(dateRange.start);
  const isDateEnd = (date: Date) => formatDate(date) === formatDate(dateRange.end);

  // Handle date selection from calendar
  const handleDateClick = (day: number) => {
    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);

    if (selectingStart) {
      setDateRange({ start: selectedDate, end: dateRange.end });
      setSelectingStart(false);
    } else {
      if (selectedDate < dateRange.start) {
        setDateRange({ start: selectedDate, end: dateRange.start });
      } else {
        setDateRange({ start: dateRange.start, end: selectedDate });
      }
      setSelectingStart(true);
    }
  };

  // Get calendar days
  const getCalendarDays = () => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = getDaysInMonth(currentMonth);
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Previous month's days
    const prevMonthDays = getDaysInMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        date: new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, prevMonthDays - i)
      });
    }

    // Current month's days
    for (let i = 1; i <= lastDay; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i)
      });
    }

    // Next month's days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i)
      });
    }

    return days;
  };

  const calendarDays = getCalendarDays();
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-50" style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.1)' }}>
        <h1 className="text-2xl font-bold" style={{ color: '#2c2419' }}>Analytics</h1>
        <div className="text-right hidden sm:block">
          <div className="text-xs font-bold" style={{ color: '#2c2419' }}>Administrator</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: '#5c5850' }}>All Clients</div>
        </div>
      </nav>

      {/* Calendar Section */}
      <div className="py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
          {/* Date Range Display */}
          <div className="text-center mb-8">
            <p className="text-sm font-semibold mb-2" style={{ color: '#5c5850' }}>Selected Date Range</p>
            <div className="px-4 py-3 rounded-lg" style={{ background: '#f5f1ed', border: '2px solid #c4704f' }}>
              <p className="text-lg font-bold" style={{ color: '#2c2419' }}>
                {dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <p className="text-xs mt-3 font-medium" style={{ color: '#9ca3af' }}>
              {selectingStart ? 'Click to select start date' : 'Click to select end date'}
            </p>
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-xl p-6" style={{ border: '1px solid rgba(44, 36, 25, 0.1)' }}>
            {/* Month Header */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <span style={{ color: '#2c2419', fontSize: '20px' }}>‹</span>
              </button>
              <h3 className="text-lg font-bold" style={{ color: '#2c2419' }}>
                {monthName}
              </h3>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <span style={{ color: '#2c2419', fontSize: '20px' }}>›</span>
              </button>
            </div>

            {/* Day Labels */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className="text-center text-xs font-bold py-2" style={{ color: '#5c5850' }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((dayObj, idx) => {
                const isInRange = dayObj.isCurrentMonth && isDateInRange(dayObj.date);
                const isStart = dayObj.isCurrentMonth && isDateStart(dayObj.date);
                const isEnd = dayObj.isCurrentMonth && isDateEnd(dayObj.date);
                const isSelectable = dayObj.isCurrentMonth;

                return (
                  <button
                    key={idx}
                    onClick={() => isSelectable && handleDateClick(dayObj.day)}
                    disabled={!isSelectable}
                    className="py-3 text-sm font-semibold rounded-lg transition"
                    style={{
                      background:
                        isStart || isEnd
                          ? '#c4704f'
                          : isInRange
                          ? '#e8dfd7'
                          : '#f5f1ed',
                      color: isStart || isEnd ? '#fff' : '#2c2419',
                      opacity: dayObj.isCurrentMonth ? 1 : 0.3,
                      cursor: isSelectable ? 'pointer' : 'default',
                      border: isStart || isEnd ? '2px solid #a85a3a' : '1px solid rgba(44, 36, 25, 0.1)'
                    }}
                  >
                    {dayObj.day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

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
