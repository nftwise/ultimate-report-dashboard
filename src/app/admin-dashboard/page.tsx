'use client';

import { useEffect, useState } from 'react';
import { Search, TrendingUp, TrendingDown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import MonthlyLeadsTrendChart from '@/components/admin/MonthlyLeadsTrendChart';
import InsightCards from '@/components/admin/InsightCards';

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
  services?: {
    googleAds: boolean;
    seo: boolean;
    googleLocalService: boolean;
    fbAds: boolean;
  };
}

export default function AdminDashboardPage() {
  const [clients, setClients] = useState<ClientWithMetrics[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<'all' | 'good' | 'warning' | 'critical'>('all');

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

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.slug.toLowerCase().includes(searchQuery.toLowerCase());

    // Health status logic
    const cpl = client.ads_conversions && client.ads_conversions > 0
      ? 20618 / client.ads_conversions
      : 0;
    const cplTrend = cpl < 50 ? 'good' : cpl < 75 ? 'warning' : 'critical';

    if (healthFilter === 'all') return matchesSearch;
    return matchesSearch && cplTrend === healthFilter;
  });

  const totalLeads = clients.reduce((sum, c) => sum + (c.total_leads || 0), 0);
  const totalSeoFormSubmits = clients.reduce((sum, c) => sum + (c.seo_form_submits || 0), 0);
  const totalGbpCalls = clients.reduce((sum, c) => sum + (c.gbp_calls || 0), 0);
  const totalAdsConversions = clients.reduce((sum, c) => sum + (c.ads_conversions || 0), 0);

  // Calculate health status for each client
  const getClientHealth = (client: ClientWithMetrics) => {
    if (!client.is_active) return 'inactive';
    const cpl = client.ads_conversions && client.ads_conversions > 0
      ? 20618 / client.ads_conversions
      : 0;
    if (cpl < 50) return 'good';
    if (cpl < 75) return 'warning';
    return 'critical';
  };

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
      <style>{`
        /* Navigation Enhanced Styling */
        nav {
          box-shadow: 0 4px 20px rgba(44, 36, 25, 0.05);
        }
      `}</style>
      {/* Sticky Navigation */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-8 py-4" style={{
        background: 'rgba(245, 241, 237, 0.98)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44, 36, 25, 0.08)'
      }}>
        <h1 className="text-2xl font-black" style={{ color: '#2c2419' }}>Analytics</h1>

        <div className="flex items-center gap-2 md:gap-6">
          {/* Quick Select Buttons */}
          <style>{`
            .preset-button {
              transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
              position: relative;
              overflow: hidden;
            }
            .preset-button::after {
              content: '';
              position: absolute;
              inset: 0;
              background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, transparent 100%);
              opacity: 0;
              transition: opacity 200ms ease;
            }
            .preset-button:hover {
              transform: translateY(-2px);
            }
            .preset-button:active {
              transform: translateY(0);
            }
            .preset-button.active::after {
              opacity: 1;
            }
          `}</style>
          <div className="flex gap-1 md:gap-2 bg-white/40 p-1 rounded-full backdrop-blur-md">
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
                  className={`preset-button ${isActive ? 'active' : ''} px-3 md:px-4 py-2 text-xs md:text-sm font-semibold rounded-full`}
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
            <style>{`
              .date-button {
                transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
              }
              .date-button:hover {
                border-color: #d4805e;
                box-shadow: 0 4px 16px rgba(196, 112, 79, 0.2);
                transform: translateY(-2px);
              }
              .date-button:active {
                transform: translateY(0);
              }
            `}</style>
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="date-button flex items-center gap-2 px-3 md:px-6 py-2 rounded-full hidden md:flex"
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
        padding: 'clamp(60px, 15vw, 100px) 20px clamp(100px, 20vw, 140px)',
        textAlign: 'center',
        fontFamily: '"Outfit", sans-serif'
      }}>
        <h1 className="mb-4" style={{ fontSize: 'clamp(2rem, 7vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.02em', fontFamily: '"Outfit", sans-serif', lineHeight: 1.1 }}>
          Client Performance
        </h1>
        <p className="text-base md:text-lg opacity-90" style={{ fontFamily: '"Inter", sans-serif' }}>
          Monitor and optimize client campaigns across all channels
        </p>
      </div>

      {/* Stats Grid (Overlapping) */}
      <div className="max-w-7xl mx-auto px-4">
        <style>{`
          .stat-card {
            transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
          }
          .stat-card::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, rgba(196, 112, 79, 0.1) 0%, transparent 100%);
            border-radius: 24px;
            opacity: 0;
            transition: opacity 300ms ease;
          }
          .stat-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 20px 40px rgba(44, 36, 25, 0.15) !important;
            border-color: rgba(196, 112, 79, 0.2) !important;
          }
          .stat-card:hover::before {
            opacity: 1;
          }
        `}</style>
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
          ].map((stat, i) => {
            const trendColor = stat.trendType === 'up' ? '#10b981' : '#ef4444';
            const badgeBgColor = stat.trendType === 'up' ? '#e6f4ea' : '#fce8e6';

            return (
              <div
                key={i}
                className="stat-card rounded-3xl p-8"
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.08)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}
              >
                <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>
                  {stat.label}
                </p>
                <p className="text-5xl font-bold mb-4 tabular-nums" style={{ color: '#2c2419', fontFamily: '"Outfit", sans-serif' }}>
                  {stat.value}
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full tabular-nums"
                    style={{
                      background: badgeBgColor,
                      color: trendColor
                    }}
                  >
                    {stat.trend}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 pb-12 md:pb-20">
        {/* Monthly Leads Trend Chart */}
        <MonthlyLeadsTrendChart months={12} />

        {/* Insight Cards */}
        <InsightCards clients={clients} />

        {/* Data Table Section */}
        <style>{`
          .table-container {
            transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
          }
          .table-container::before {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(ellipse at top right, rgba(196, 112, 79, 0.05) 0%, transparent 100%);
            pointer-events: none;
            border-radius: 24px;
          }
        `}</style>
        <div className="table-container rounded-3xl p-8" style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(44, 36, 25, 0.08)',
          boxShadow: '0 8px 32px rgba(44, 36, 25, 0.08)'
        }}>
          <style>{`
            .client-count-badge {
              transition: all 200ms ease;
              background: linear-gradient(135deg, #f9f7f4 0%, #f0ece5 100%);
            }
          `}</style>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold" style={{ color: '#2c2419', fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.02em' }}>
                All Clients
              </h2>
              <p className="text-xs md:text-sm mt-1" style={{ color: '#9ca3af' }}>
                Manage and monitor {clients.length} active client{clients.length !== 1 ? 's' : ''}
              </p>
            </div>
            <span className="client-count-badge text-sm font-bold px-4 py-2 rounded-full" style={{ color: '#5c5850' }}>
              {filteredClients.length}/{clients.length}
            </span>
          </div>

          {/* Search Bar and Filters */}
          <div className="mb-8 space-y-4">
            <style>{`
              .search-input {
                transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
              }
              .search-input:focus {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(196, 112, 79, 0.15) !important;
              }

              .filter-button {
                transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
              }
              .filter-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(44, 36, 25, 0.1);
              }
            `}</style>
            <div className="relative">
              <Search className="absolute left-4 top-3.5 w-5 h-5" style={{ color: '#9ca3af' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clients by name..."
                className="search-input w-full pl-12 pr-4 py-3 border-2 rounded-full focus:outline-none"
                style={{
                  background: '#f5f1ed',
                  borderColor: 'transparent',
                  color: '#2c2419',
                  fontSize: '0.95rem',
                  fontFamily: '"Inter", sans-serif'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#c4704f';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(196, 112, 79, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = '#f5f1ed';
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Health Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'all', label: 'All', color: '#5c5850' },
                { id: 'good', label: 'Good', color: '#10b981' },
                { id: 'warning', label: 'Warning', color: '#f59e0b' },
                { id: 'critical', label: 'Critical', color: '#ef4444' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setHealthFilter(filter.id as any)}
                  className="filter-button px-4 py-2 rounded-full text-sm font-semibold transition"
                  style={{
                    background: healthFilter === filter.id ? filter.color : '#f9f7f4',
                    color: healthFilter === filter.id ? '#fff' : filter.color,
                    border: `2px solid ${filter.color}20`
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <style>{`
            /* Enhanced Table Styling */
            table {
              border-collapse: separate;
              border-spacing: 0;
            }

            table thead {
              position: sticky;
              top: 0;
              z-index: 10;
              background: rgba(245, 241, 237, 0.5);
              backdrop-filter: blur(4px);
            }

            table th {
              font-weight: 700;
              letter-spacing: 0.05em;
            }

            /* Enhanced Row Styling */
            table tbody tr {
              transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
              background-color: transparent;
            }

            table tbody tr:hover {
              background-color: rgba(196, 112, 79, 0.04);
              box-shadow: inset 0 0 0 1px rgba(196, 112, 79, 0.08);
              transform: translateY(-1px);
            }

            /* Cell Spacing and Alignment */
            table td {
              padding: 16px 12px;
              vertical-align: middle;
            }

            table th {
              padding: 16px 12px;
              background: transparent;
            }

            /* Row Separator Lines */
            table tbody tr {
              border-bottom: 1px solid rgba(44, 36, 25, 0.05);
            }

            table tbody tr:last-child {
              border-bottom: none;
            }

            /* Active/Hover Effects on Status Pills */
            table tbody tr:hover .status-pill {
              transform: scale(1.05);
              box-shadow: 0 2px 8px rgba(44, 36, 25, 0.12);
            }

            /* Smoother Interactions */
            table tbody tr * {
              transition: color 150ms ease, background-color 150ms ease;
            }
          `}</style>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#5c5850' }}>Loading clients...</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#c5221f' }}>{error}</div>
          ) : (
            <div className="overflow-x-auto -mx-8 md:mx-0 md:rounded-2xl" style={{ WebkitOverflowScrolling: 'touch' }}>
              <style>{`
                /* Smooth scrolling for mobile */
                @media (max-width: 768px) {
                  .overflow-x-auto {
                    margin-left: calc(-2rem - 32px);
                    margin-right: calc(-2rem - 32px);
                    padding-left: 2rem;
                    padding-right: 2rem;
                  }
                }
              `}</style>
              <table className="w-full" style={{ minWidth: '1000px' }}>
                <thead>
                  {/* Row 1: Section Group Headers */}
                  <tr style={{ borderBottom: '2px solid rgba(44, 36, 25, 0.1)' }}>
                    <th rowSpan={2} className="text-left text-xs font-bold uppercase tracking-wider py-4 pr-6" style={{ color: '#5c5850', minWidth: '200px', borderBottom: 'none' }}>Client</th>
                    <th colSpan={2} className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#2c2419', minWidth: '190px', borderBottom: '3px solid #2c2419' }}>Overview</th>
                    <th colSpan={1} className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#b45309', minWidth: '85px', borderBottom: '3px solid #b45309' }}>SEO</th>
                    <th colSpan={1} className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#047857', minWidth: '85px', borderBottom: '3px solid #047857' }}>GBP</th>
                    <th colSpan={3} className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#6b7280', minWidth: '255px', borderBottom: '3px solid #6b7280' }}>Google Ads</th>
                    <th colSpan={3} className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#5c5850', minWidth: '240px', borderBottom: 'none' }}>&nbsp;</th>
                  </tr>

                  {/* Row 2: Individual Metric Headers */}
                  <tr style={{ borderBottom: '2px solid rgba(44, 36, 25, 0.1)' }}>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#5c5850', minWidth: '95px', letterSpacing: '0.05em' }}>Services</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#2c2419', minWidth: '95px', letterSpacing: '0.05em' }}>Leads</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#b45309', minWidth: '85px', letterSpacing: '0.05em' }}>Forms</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#047857', minWidth: '85px', letterSpacing: '0.05em' }}>Calls</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#6b7280', minWidth: '75px', letterSpacing: '0.05em' }}>Conv</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#6b7280', minWidth: '75px', letterSpacing: '0.05em' }}>CPL</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#6b7280', minWidth: '85px', letterSpacing: '0.05em' }}>Trend 30d</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#5c5850', minWidth: '75px', letterSpacing: '0.05em' }}>Status</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#5c5850', minWidth: '75px', letterSpacing: '0.05em' }}>Health</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const health = getClientHealth(client);
                    const leadsTrend = Math.floor(Math.random() * 40 - 20); // Random trend -20 to +20
                    const trendColor = leadsTrend > 0 ? '#10b981' : leadsTrend < 0 ? '#ef4444' : '#9ca3af';

                    // Generate trend data for chart
                    const trendData = Array.from({ length: 6 }).map((_, i) => {
                      const base = 40 + Math.sin(i * 0.5) * 15;
                      return base + Math.random() * 20;
                    });
                    const maxTrend = Math.max(...trendData);

                    return (
                      <tr
                        key={client.id}
                        onClick={() => window.location.href = `/admin-dashboard/${client.slug}`}
                        className="table-row cursor-pointer"
                        style={{
                          borderBottom: '1px solid rgba(44, 36, 25, 0.05)',
                          opacity: client.is_active ? 1 : 0.65,
                          background: client.is_active ? 'transparent' : '#faf7f4'
                        }}
                      >
                        {/* Client Name */}
                        <td className="py-5 pr-6">
                          <div className="font-bold text-sm" style={{ color: client.is_active ? '#2c2419' : '#9ca3af' }}>
                            {client.name}
                          </div>
                          <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>@{client.slug}</div>
                        </td>

                        {/* Services */}
                        <td className="py-5 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {client.services?.googleAds && (
                              <span className="px-2 py-1 rounded-md text-xs font-semibold" style={{ background: '#fff7ed', color: '#c2410c' }}>
                                Ads
                              </span>
                            )}
                            {client.services?.seo && (
                              <span className="px-2 py-1 rounded-md text-xs font-semibold" style={{ background: '#f0fdf4', color: '#166534' }}>
                                SEO
                              </span>
                            )}
                            {client.services?.googleLocalService && (
                              <span className="px-2 py-1 rounded-md text-xs font-semibold" style={{ background: '#eff6ff', color: '#0c4a6e' }}>
                                GBP
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Total Leads (Overview) */}
                        <td className="py-5 text-center font-bold text-base tabular-nums" style={{ color: '#c4704f' }}>
                          {client.total_leads || 0}
                        </td>

                        {/* SEO Forms */}
                        <td className="py-5 text-center">
                          <div className="font-semibold text-sm tabular-nums" style={{ color: '#b45309' }}>
                            {client.seo_form_submits || 0}
                          </div>
                        </td>

                        {/* GBP Calls */}
                        <td className="py-5 text-center">
                          <div className="font-semibold text-sm tabular-nums" style={{ color: '#047857' }}>
                            {client.gbp_calls || 0}
                          </div>
                        </td>

                        {/* Google Ads Conversions */}
                        <td className="py-5 text-center">
                          <div className="font-semibold text-sm tabular-nums" style={{ color: '#6b7280' }}>
                            {client.ads_conversions || 0}
                          </div>
                        </td>

                        {/* Google Ads CPL (Cost Per Lead) */}
                        <td className="py-5 text-center">
                          <div className="font-semibold text-sm tabular-nums" style={{ color: '#6b7280' }}>
                            {client.ads_conversions && client.ads_conversions > 0
                              ? '$' + Math.round(20618 / client.ads_conversions)
                              : '—'}
                          </div>
                        </td>

                        {/* Trend Chart - Line Sparkline visualization */}
                        <td className="py-5 text-center">
                          <style>{`
                            .trend-sparkline {
                              transition: all 200ms ease;
                            }
                            table tbody tr:hover .trend-sparkline {
                              filter: drop-shadow(0 2px 6px ${trendColor}30);
                              transform: scale(1.05);
                            }
                          `}</style>
                          <div className="flex items-center justify-center gap-2">
                            <svg width="70" height="28" style={{ verticalAlign: 'middle' }} className="trend-sparkline">
                              <defs>
                                <linearGradient id={`grad-${client.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={trendColor} stopOpacity={0.25} />
                                  <stop offset="100%" stopColor={trendColor} stopOpacity={0.02} />
                                </linearGradient>
                                <filter id={`shadow-${client.id}`}>
                                  <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
                                </filter>
                              </defs>
                              {/* Gradient fill */}
                              <polygon
                                points={`0,28 ${trendData.map((val, i) => `${(i / (trendData.length - 1)) * 70},${28 - (val / maxTrend) * 28}`).join(' ')} 70,28`}
                                fill={`url(#grad-${client.id})`}
                              />
                              {/* Line */}
                              <polyline
                                points={trendData.map((val, i) => `${(i / (trendData.length - 1)) * 70},${28 - (val / maxTrend) * 28}`).join(' ')}
                                fill="none"
                                stroke={trendColor}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span className="text-xs font-bold whitespace-nowrap tabular-nums" style={{ color: trendColor, minWidth: '45px', letterSpacing: '-0.5px' }}>
                              {leadsTrend > 0 ? '↑' : leadsTrend < 0 ? '↓' : '→'} {Math.abs(leadsTrend)}%
                            </span>
                          </div>
                        </td>

                        {/* Status (Active/Inactive) */}
                        <td className="py-5 text-center">
                          <span className="status-pill text-xs font-bold px-2 py-1 rounded-full" style={{
                            background: client.is_active ? '#ecfdf5' : '#fee2e2',
                            color: client.is_active ? '#059669' : '#dc2626',
                            border: `1px solid ${client.is_active ? '#d1fae5' : '#fee2e2'}`
                          }}>
                            {client.is_active ? 'Active' : 'Off'}
                          </span>
                        </td>

                        {/* Health */}
                        <td className="py-5 text-center">
                          {health === 'inactive' ? (
                            <span className="text-xs font-bold px-2 py-1 rounded-full" style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fecaca'
                            }}>
                              Low
                            </span>
                          ) : health === 'good' ? (
                            <span className="text-xs font-bold px-2 py-1 rounded-full" style={{
                              background: '#ecfdf5',
                              color: '#059669',
                              border: '1px solid #d1fae5'
                            }}>
                              Good
                            </span>
                          ) : health === 'warning' ? (
                            <span className="text-xs font-bold px-2 py-1 rounded-full" style={{
                              background: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fde68a'
                            }}>
                              Fair
                            </span>
                          ) : (
                            <span className="text-xs font-bold px-2 py-1 rounded-full" style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fecaca'
                            }}>
                              Poor
                            </span>
                          )}
                        </td>

                      </tr>
                    );
                  })}
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
