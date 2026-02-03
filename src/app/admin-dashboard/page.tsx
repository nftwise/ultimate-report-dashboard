'use client';

import { useEffect, useState } from 'react';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import DateRangePicker from '@/components/admin/DateRangePicker';
import ClientManagement from '@/components/admin/ClientManagement';

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
  const [serviceFilter, setServiceFilter] = useState<'all' | 'active' | 'both' | 'seo' | 'ads'>('all');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients'>('dashboard');

  // Date range state
  // Default: Yesterday to 30 days back (to match when data is typically available)
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    // Set end date to yesterday (data usually comes in by end of previous day)
    const to = new Date();
    to.setDate(to.getDate() - 1);

    // Set start date to 30 days before end date
    const from = new Date(to);
    from.setDate(from.getDate() - 30);

    return { from, to };
  });

  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      fetchData();
    }
  }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      const dateFromStr = dateRange.from?.toISOString().split('T')[0] || '';
      const dateToStr = dateRange.to?.toISOString().split('T')[0] || '';

      console.log('[Dashboard] Fetching data directly from Supabase:', { dateFromStr, dateToStr });

      // Fetch clients and their service configurations
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          slug,
          city,
          contact_email,
          is_active,
          service_configs (
            ga_property_id,
            gads_customer_id,
            gbp_location_id,
            gsc_site_url,
            callrail_account_id
          )
        `)
        .order('name', { ascending: true });

      if (clientsError) {
        throw new Error(`Failed to fetch clients: ${clientsError.message}`);
      }

      // Fetch metrics for the date range
      const { data: metricsData, error: metricsError } = await supabase
        .from('client_metrics_summary')
        .select('client_id, total_leads, form_fills, google_ads_conversions, cpl, date')
        .gte('date', dateFromStr)
        .lte('date', dateToStr);

      if (metricsError) {
        throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
      }

      // Fetch GBP phone calls
      const { data: gbpMetricsData, error: gbpError } = await supabase
        .from('gbp_location_daily_metrics')
        .select('client_id, phone_calls, date')
        .gte('date', dateFromStr)
        .lte('date', dateToStr);

      if (gbpError) {
        console.warn('Warning fetching GBP metrics:', gbpError.message);
      }

      // Build metrics map
      const metricsMap: { [key: string]: any } = {};
      (metricsData || []).forEach((metric: any) => {
        if (!metricsMap[metric.client_id]) {
          metricsMap[metric.client_id] = {
            total_leads: 0,
            seo_form_submits: 0,
            gbp_calls: 0,
            ads_conversions: 0,
            ads_cpl: 0,
            ads_cpl_count: 0
          };
        }
        metricsMap[metric.client_id].total_leads += metric.total_leads || 0;
        metricsMap[metric.client_id].seo_form_submits += metric.form_fills || 0;
        metricsMap[metric.client_id].ads_conversions += metric.google_ads_conversions || 0;
        if (metric.cpl && metric.cpl > 0) {
          metricsMap[metric.client_id].ads_cpl += metric.cpl;
          metricsMap[metric.client_id].ads_cpl_count += 1;
        }
      });

      // Add GBP phone calls
      (gbpMetricsData || []).forEach((gbpMetric: any) => {
        if (!metricsMap[gbpMetric.client_id]) {
          metricsMap[gbpMetric.client_id] = {
            total_leads: 0,
            seo_form_submits: 0,
            gbp_calls: 0,
            ads_conversions: 0,
            ads_cpl: 0,
            ads_cpl_count: 0
          };
        }
        metricsMap[gbpMetric.client_id].gbp_calls += gbpMetric.phone_calls || 0;
      });

      // Process clients with service configurations
      const processedClients = (clientsData || []).map((client: any) => {
        const config = Array.isArray(client.service_configs)
          ? client.service_configs[0]
          : client.service_configs || {};

        const hasGoogleAds = !!(config.gads_customer_id && config.gads_customer_id.trim());
        const hasSeo = !!(config.gsc_site_url && config.gsc_site_url.trim());

        const clientMetrics = metricsMap[client.id] || {
          total_leads: 0,
          seo_form_submits: 0,
          gbp_calls: 0,
          ads_conversions: 0,
          ads_cpl: 0,
          ads_cpl_count: 0
        };

        const avgCpl = clientMetrics.ads_cpl_count > 0
          ? clientMetrics.ads_cpl / clientMetrics.ads_cpl_count
          : 0;

        return {
          id: client.id,
          name: client.name,
          slug: client.slug,
          city: client.city,
          contact_email: client.contact_email,
          is_active: client.is_active,
          total_leads: clientMetrics.total_leads,
          seo_form_submits: clientMetrics.seo_form_submits,
          gbp_calls: clientMetrics.gbp_calls,
          ads_conversions: clientMetrics.ads_conversions,
          ads_cpl: avgCpl,
          services: {
            googleAds: hasGoogleAds,
            seo: hasSeo,
            googleLocalService: !!(config.gbp_location_id && config.gbp_location_id.trim()),
            fbAds: false,
          }
        };
      });

      setClients(processedClients);

      // Log service config distribution
      const withAds = processedClients.filter((c: any) => c.services?.googleAds).length;
      const withSeo = processedClients.filter((c: any) => c.services?.seo).length;
      const withBoth = processedClients.filter((c: any) => c.services?.googleAds && c.services?.seo).length;
      const adsOnly = processedClients.filter((c: any) => c.services?.googleAds && !c.services?.seo).length;
      const seoOnly = processedClients.filter((c: any) => c.services?.seo && !c.services?.googleAds).length;

      console.log('[Dashboard] Service config distribution:', {
        total: processedClients.length,
        withAds,
        withSeo,
        withBoth,
        adsOnly,
        seoOnly
      });
    } catch (err) {
      setError(`Failed to load clients: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('[Dashboard] Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.slug.toLowerCase().includes(searchQuery.toLowerCase());

    // Service type filter logic
    let matchesServiceFilter = true;
    if (serviceFilter !== 'all') {
      const hasAds = client.services?.googleAds || false;
      const hasSeo = client.services?.seo || false;

      if (serviceFilter === 'active') {
        matchesServiceFilter = client.is_active;
      } else if (serviceFilter === 'both') {
        matchesServiceFilter = hasAds && hasSeo;
      } else if (serviceFilter === 'seo') {
        matchesServiceFilter = hasSeo && !hasAds;
      } else if (serviceFilter === 'ads') {
        matchesServiceFilter = hasAds && !hasSeo;
      }
    }

    return matchesSearch && matchesServiceFilter;
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
    if (!dateRange.from || !dateRange.to) return 0;
    return Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
  };

  const setPresetRange = (days: number) => {
    // Use yesterday as end date (data typically available by end of previous day)
    const to = new Date();
    to.setDate(to.getDate() - 1);

    // Calculate start date from end date, not from today
    const from = new Date(to);
    from.setDate(from.getDate() - days);

    setDateRange({ from, to });
  };


  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
      <style>{`
        /* Navigation Enhanced Styling */
        nav {
          box-shadow: 0 4px 20px rgba(44, 36, 25, 0.05);
        }
      `}</style>
      {/* Sticky Navigation */}
      <nav className="sticky top-0 z-50 px-4 md:px-8 py-4" style={{
        background: 'rgba(245, 241, 237, 0.98)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44, 36, 25, 0.08)'
      }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black" style={{ color: '#2c2419' }}>Analytics</h1>

          {/* Admin Info */}
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold" style={{ color: '#2c2419' }}>Administrator</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: '#5c5850' }}>Dashboard</div>
          </div>
        </div>

        {/* Date/Filter Controls */}
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
              { label: '7D', days: 7 },
              { label: '30D', days: 30 },
              { label: '90D', days: 90 }
            ].map((preset) => {
              const isActive = getDaysDifference() === preset.days;
              return (
                <button
                  key={preset.label}
                  onClick={() => {
                    setPresetRange(preset.days);
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

          {/* Date Range Picker */}
          <div className="hidden md:block">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          </div>
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

      {/* Main Content with Sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '0', minHeight: 'calc(100vh - 300px)' }}>
        {/* SIDEBAR NAVIGATION */}
        <div style={{
          background: 'linear-gradient(180deg, #f9f7f4 0%, #f5f1ed 100%)',
          borderRight: '1px solid rgba(44, 36, 25, 0.1)',
          padding: '24px 0',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            style={{
              padding: '16px 20px',
              margin: '0 8px 8px 8px',
              background: activeTab === 'dashboard' ? 'rgba(196, 112, 79, 0.1)' : 'transparent',
              border: activeTab === 'dashboard' ? '2px solid #c4704f' : '2px solid transparent',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: activeTab === 'dashboard' ? '#c4704f' : '#5c5850',
              cursor: 'pointer',
              transition: 'all 200ms ease'
            }}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            style={{
              padding: '16px 20px',
              margin: '0 8px 8px 8px',
              background: activeTab === 'clients' ? 'rgba(196, 112, 79, 0.1)' : 'transparent',
              border: activeTab === 'clients' ? '2px solid #c4704f' : '2px solid transparent',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: activeTab === 'clients' ? '#c4704f' : '#5c5850',
              cursor: 'pointer',
              transition: 'all 200ms ease'
            }}
          >
            📋 Clients
          </button>
        </div>

        {/* MAIN CONTENT AREA */}
        <div style={{ overflowY: 'auto' }}>
          {/* Stats Grid (Overlapping) - Only show on Dashboard tab */}
          {activeTab === 'dashboard' && (
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
      )}

      {/* Main Content - Dashboard Tab */}
      {activeTab === 'dashboard' && (
      <main className="max-w-7xl mx-auto px-4 md:px-8 pb-12 md:pb-20">
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

            {/* Filter Buttons Row - Service Type Filters */}
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex gap-1 md:gap-2 flex-wrap">
                {[
                  { id: 'all', label: 'All Clients', color: '#5c5850', icon: '👥' },
                  { id: 'active', label: 'Active clients', color: '#10b981', icon: '✓' },
                  { id: 'both', label: 'Both Services', color: '#10b981', icon: '⭐' },
                  { id: 'seo', label: 'SEO Only', color: '#f59e0b', icon: '📈' },
                  { id: 'ads', label: 'Ads Only', color: '#3b82f6', icon: '💰' },
                ].map((filter) => {
                  // Count clients for each filter
                  let count = 0;
                  if (filter.id === 'all') {
                    count = clients.length;
                  } else if (filter.id === 'active') {
                    count = clients.filter(c => c.is_active).length;
                  } else if (filter.id === 'both') {
                    count = clients.filter(c => c.services?.googleAds && c.services?.seo).length;
                  } else if (filter.id === 'seo') {
                    count = clients.filter(c => c.services?.seo && !c.services?.googleAds).length;
                  } else if (filter.id === 'ads') {
                    count = clients.filter(c => c.services?.googleAds && !c.services?.seo).length;
                  }

                  return (
                    <button
                      key={filter.id}
                      onClick={() => setServiceFilter(filter.id as any)}
                      className="filter-button px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition flex items-center gap-2"
                      style={{
                        background: serviceFilter === filter.id ? filter.color : '#f9f7f4',
                        color: serviceFilter === filter.id ? '#fff' : filter.color,
                        border: `2px solid ${filter.color}30`
                      }}
                    >
                      <span>{filter.icon}</span>
                      <span>{filter.label}</span>
                      <span style={{
                        background: serviceFilter === filter.id ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '700'
                      }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
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
                    // Trend data: static placeholder (real data would come from detailed metrics API)
                    const trendData = [40, 45, 42, 48, 44, 46];
                    const maxTrend = Math.max(...trendData);
                    const trendColor = client.total_leads && client.total_leads > 0 ? '#10b981' : '#9ca3af';
                    // Calculate simple trend: compare last vs first value
                    const trendPercent = trendData.length > 1 ? Math.round(((trendData[trendData.length - 1] - trendData[0]) / trendData[0]) * 100) : 0;

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

                        {/* Google Ads CPL (Cost Per Conversion) */}
                        <td className="py-5 text-center">
                          <div className="font-semibold text-sm tabular-nums" style={{ color: '#6b7280' }}>
                            {client.ads_cpl && client.ads_cpl > 0
                              ? '$' + Math.round(client.ads_cpl)
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
                              {trendPercent > 0 ? '↑' : trendPercent < 0 ? '↓' : '→'} {Math.abs(trendPercent)}%
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
      )}

          {/* Client Management Tab */}
          {activeTab === 'clients' && (
            <div className="max-w-7xl mx-auto px-4 md:px-8 pb-12 md:pb-20 pt-12">
              <ClientManagement />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
