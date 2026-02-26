'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { Search, TrendingUp, TrendingDown, Activity, Users, UserPlus, Pencil, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import DateRangePicker from '@/components/admin/DateRangePicker';

interface ServiceConfig {
  ga_property_id?: string;
  gads_customer_id?: string;
  gbp_location_id?: string;
  gsc_site_url?: string;
  callrail_account_id?: string;
}

interface ClientWithMetrics {
  id: string;
  name: string;
  slug: string;
  city: string;
  contact_email?: string;
  is_active: boolean;
  seo_form_submits?: number;
  seo_top_keyword?: string;
  gbp_calls?: number;
  ads_conversions?: number;
  ads_cpl?: number;
  total_leads?: number;
  service_configs?: ServiceConfig[];
  services?: {
    googleAds: boolean;
    seo: boolean;
    googleLocalService: boolean;
    fbAds: boolean;
  };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientWithMetrics[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<'all' | 'active' | 'both' | 'seo' | 'ads'>('all');
  const [showArchived, setShowArchived] = useState(false);

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date();
    to.setDate(to.getDate() - 1);
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

      if (clientsError) throw new Error(`Failed to fetch clients: ${clientsError.message}`);

      const { data: metricsData, error: metricsError } = await supabase
        .from('client_metrics_summary')
        .select('client_id, total_leads, form_fills, google_ads_conversions, cpl, date')
        .gte('date', dateFromStr)
        .lte('date', dateToStr);

      if (metricsError) throw new Error(`Failed to fetch metrics: ${metricsError.message}`);

      const { data: gbpMetricsData } = await supabase
        .from('gbp_location_daily_metrics')
        .select('client_id, phone_calls, date')
        .gte('date', dateFromStr)
        .lte('date', dateToStr);

      const { data: formSuccessData } = await supabase
        .from('ga4_events')
        .select('client_id, event_count')
        .gte('date', dateFromStr)
        .lte('date', dateToStr)
        .or('event_name.ilike.%successful%,event_name.ilike.%success%');

      const metricsMap: { [key: string]: any } = {};
      (metricsData || []).forEach((metric: any) => {
        if (!metricsMap[metric.client_id]) {
          metricsMap[metric.client_id] = { total_leads: 0, seo_form_submits: 0, gbp_calls: 0, ads_conversions: 0, ads_cpl: 0, ads_cpl_count: 0 };
        }
        metricsMap[metric.client_id].total_leads += metric.total_leads || 0;
        metricsMap[metric.client_id].ads_conversions += metric.google_ads_conversions || 0;
        if (metric.cpl && metric.cpl > 0) {
          metricsMap[metric.client_id].ads_cpl += metric.cpl;
          metricsMap[metric.client_id].ads_cpl_count += 1;
        }
      });

      (gbpMetricsData || []).forEach((gbpMetric: any) => {
        if (!metricsMap[gbpMetric.client_id]) {
          metricsMap[gbpMetric.client_id] = { total_leads: 0, seo_form_submits: 0, gbp_calls: 0, ads_conversions: 0, ads_cpl: 0, ads_cpl_count: 0 };
        }
        metricsMap[gbpMetric.client_id].gbp_calls += gbpMetric.phone_calls || 0;
      });

      (formSuccessData || []).forEach((formEvent: any) => {
        if (!metricsMap[formEvent.client_id]) {
          metricsMap[formEvent.client_id] = { total_leads: 0, seo_form_submits: 0, gbp_calls: 0, ads_conversions: 0, ads_cpl: 0, ads_cpl_count: 0 };
        }
        metricsMap[formEvent.client_id].seo_form_submits += formEvent.event_count || 0;
      });

      const processedClients = (clientsData || []).map((client: any) => {
        const config = Array.isArray(client.service_configs) ? client.service_configs[0] : client.service_configs || {};
        const hasGoogleAds = !!(config.gads_customer_id && config.gads_customer_id.trim());
        const hasSeo = !!(config.gsc_site_url && config.gsc_site_url.trim());
        const clientMetrics = metricsMap[client.id] || { total_leads: 0, seo_form_submits: 0, gbp_calls: 0, ads_conversions: 0, ads_cpl: 0, ads_cpl_count: 0 };
        const avgCpl = clientMetrics.ads_cpl_count > 0 ? clientMetrics.ads_cpl / clientMetrics.ads_cpl_count : 0;

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
          service_configs: Array.isArray(client.service_configs) ? client.service_configs : [],
          services: {
            googleAds: hasGoogleAds,
            seo: hasSeo,
            googleLocalService: !!(config.gbp_location_id && config.gbp_location_id.trim()),
            fbAds: false,
          }
        };
      });

      setClients(processedClients);
    } catch (err) {
      setError(`Failed to load clients: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.slug.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesServiceFilter = true;
    if (serviceFilter !== 'all') {
      const hasAds = client.services?.googleAds || false;
      const hasSeo = client.services?.seo || false;
      if (serviceFilter === 'active') matchesServiceFilter = client.is_active;
      else if (serviceFilter === 'both') matchesServiceFilter = hasAds && hasSeo;
      else if (serviceFilter === 'seo') matchesServiceFilter = hasSeo && !hasAds;
      else if (serviceFilter === 'ads') matchesServiceFilter = hasAds && !hasSeo;
    }

    const matchesArchived = showArchived || client.is_active !== false;

    return matchesSearch && matchesServiceFilter && matchesArchived;
  });

  const totalLeads = clients.reduce((sum, c) => sum + (c.total_leads || 0), 0);
  const totalGbpCalls = clients.reduce((sum, c) => sum + (c.gbp_calls || 0), 0);

  const cplClients = clients.filter(c => c.ads_cpl && c.ads_cpl > 0);
  const avgCpl = cplClients.length > 0
    ? cplClients.reduce((sum, c) => sum + (c.ads_cpl || 0), 0) / cplClients.length
    : 0;
  const avgCplDisplay = avgCpl > 0 ? '$' + Math.round(avgCpl) : 'N/A';

  const getClientHealth = (client: ClientWithMetrics) => {
    if (!client.is_active) return 'inactive';
    const cpl = client.ads_conversions && client.ads_conversions > 0 ? 20618 / client.ads_conversions : 0;
    if (cpl < 50) return 'good';
    if (cpl < 75) return 'warning';
    return 'critical';
  };

  const getDaysDifference = () => {
    if (!dateRange.from || !dateRange.to) return 0;
    return Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
  };

  const setPresetRange = (days: number) => {
    const to = new Date();
    to.setDate(to.getDate() - 1);
    const from = new Date(to);
    from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
      <style>{`nav { box-shadow: 0 4px 20px rgba(44, 36, 25, 0.05); }`}</style>

      {/* Sticky Navigation */}
      <nav className="sticky top-0 z-50 px-4 md:px-8 py-4" style={{
        background: 'rgba(245, 241, 237, 0.98)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44, 36, 25, 0.08)'
      }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black" style={{ color: '#2c2419' }}>Analytics</h1>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold" style={{ color: '#2c2419' }}>Administrator</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: '#5c5850' }}>Dashboard</div>
            </div>
            <button
              onClick={() => router.push('/admin-dashboard/users')}
              className="flex items-center gap-1.5 hover:opacity-70 transition"
              style={{
                border: '1px solid rgba(44,36,25,0.15)',
                color: '#5c5850',
                background: 'transparent',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Users className="w-3.5 h-3.5" />
              Users
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-1.5 hover:opacity-70 transition"
              style={{
                border: '1px solid rgba(196,112,79,0.3)',
                color: '#c4704f',
                background: 'transparent',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          <style>{`
            .preset-button { transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; }
            .preset-button::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%); opacity: 0; transition: opacity 200ms ease; }
            .preset-button:hover { transform: translateY(-2px); }
            .preset-button:active { transform: translateY(0); }
            .preset-button.active::after { opacity: 1; }
          `}</style>
          <div className="flex gap-1 md:gap-2 bg-white/40 p-1 rounded-full backdrop-blur-md">
            {[{ label: '7D', days: 7 }, { label: '30D', days: 30 }, { label: '90D', days: 90 }].map((preset) => {
              const isActive = getDaysDifference() === preset.days;
              return (
                <button
                  key={preset.label}
                  onClick={() => setPresetRange(preset.days)}
                  className={`preset-button ${isActive ? 'active' : ''} px-3 md:px-4 py-2 text-xs md:text-sm font-semibold rounded-full`}
                  style={{ background: isActive ? '#c4704f' : 'transparent', color: isActive ? '#fff' : '#5c5850' }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
            <button
              onClick={() => router.push('/admin-dashboard/clients/new')}
              className="flex items-center gap-2 hover:opacity-80 transition"
              style={{
                background: '#c4704f',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <UserPlus className="w-4 h-4" />
              Add Client
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content with Sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '0', minHeight: 'calc(100vh - 80px)' }}>
        {/* SIDEBAR */}
        <div style={{
          background: 'linear-gradient(180deg, #f9f7f4 0%, #f5f1ed 100%)',
          borderRight: '1px solid rgba(44, 36, 25, 0.1)',
          padding: '24px 0',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <button
            onClick={() => {}}
            style={{
              padding: '16px 20px',
              margin: '0 8px 8px 8px',
              background: 'rgba(196, 112, 79, 0.1)',
              border: '2px solid #c4704f',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#c4704f',
              cursor: 'pointer',
              transition: 'all 200ms ease'
            }}
          >
            📊 Dashboard
          </button>

          {/* Clients */}
          <button
            onClick={() => router.push('/admin-dashboard/clients')}
            style={{
              padding: '14px 20px',
              margin: '0 8px 8px 8px',
              background: 'transparent',
              border: '2px solid transparent',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#5c5850',
              cursor: 'pointer',
              transition: 'all 200ms ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(44,36,25,0.05)';
              (e.currentTarget as HTMLButtonElement).style.color = '#2c2419';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#5c5850';
            }}
          >
            <Users size={15} />
            Clients
          </button>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(44,36,25,0.08)', margin: '8px 16px' }} />

          {/* Cron Monitor */}
          <button
            onClick={() => router.push('/admin-dashboard/cron-monitor')}
            style={{
              padding: '14px 20px',
              margin: '0 8px 8px 8px',
              background: 'transparent',
              border: '2px solid transparent',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#5c5850',
              cursor: 'pointer',
              transition: 'all 200ms ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(44,36,25,0.05)';
              (e.currentTarget as HTMLButtonElement).style.color = '#2c2419';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#5c5850';
            }}
          >
            <Activity size={15} />
            Cron Monitor
          </button>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ overflowY: 'auto', background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
          {/* Hero */}
          <div style={{
            background: 'linear-gradient(135deg, #cc8b65 0%, #d49a6a 100%)',
            color: 'white',
            padding: '60px 20px 80px 20px',
            textAlign: 'center',
            fontFamily: '"Outfit", sans-serif'
          }}>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 12px 0' }}>
              Client Performance
            </h1>
            <p style={{ fontSize: '16px', opacity: 0.9, fontFamily: '"Inter", sans-serif', margin: 0 }}>
              Monitor and optimize client campaigns across all channels
            </p>
          </div>

          {/* Stats Grid */}
          <div className="max-w-7xl mx-auto px-4" style={{ marginTop: '-40px', position: 'relative', zIndex: 10 }}>
            <style>{`
              .stat-card { transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
              .stat-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(196,112,79,0.1) 0%, transparent 100%); border-radius: 24px; opacity: 0; transition: opacity 300ms ease; }
              .stat-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(44,36,25,0.15) !important; border-color: rgba(196,112,79,0.2) !important; }
              .stat-card:hover::before { opacity: 1; }
            `}</style>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 -mt-20 mb-12 relative z-10">
              {[
                { label: 'Total Clients', value: clients.length, trend: '+12.5%', trendType: 'up' },
                { label: 'Total Leads', value: totalLeads, trend: '+8.3%', trendType: 'up' },
                { label: 'Avg CPL', value: avgCplDisplay, trend: '', trendType: 'down' },
                { label: 'GBP Calls', value: totalGbpCalls, trend: '+3.2%', trendType: 'up' },
              ].map((stat, i) => {
                const trendColor = stat.trendType === 'up' ? '#10b981' : '#ef4444';
                const badgeBg = stat.trendType === 'up' ? '#e6f4ea' : '#fce8e6';
                return (
                  <div key={i} className="stat-card rounded-3xl p-8" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.08)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>{stat.label}</p>
                    <p className="text-5xl font-bold mb-4 tabular-nums" style={{ color: '#2c2419', fontFamily: '"Outfit", sans-serif' }}>{stat.value}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full tabular-nums" style={{ background: badgeBg, color: trendColor }}>{stat.trend}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="max-w-7xl mx-auto px-4 md:px-8 mt-12 mb-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Service Distribution */}
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.08)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)', transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-8px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 40px rgba(44,36,25,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(44,36,25,0.08)'; }}>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-6" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>📊 Service Distribution</h3>
                <div className="space-y-4">
                  {[
                    { label: 'SEO Only', color: '#f59e0b', count: clients.filter(c => c.services?.seo && !c.services?.googleAds).length },
                    { label: 'Ads Only', color: '#3b82f6', count: clients.filter(c => c.services?.googleAds && !c.services?.seo).length },
                    { label: 'Both Services', color: '#10b981', count: clients.filter(c => c.services?.googleAds && c.services?.seo).length },
                  ].map(({ label, color, count }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span style={{ color: '#5c5850', fontSize: '14px' }}>{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold" style={{ color }}>{count}</span>
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>({clients.length ? ((count / clients.length) * 100).toFixed(0) : 0}%)</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid rgba(44,36,25,0.1)', paddingTop: '12px', marginTop: '12px' }}>
                    <div className="flex justify-between items-center font-bold">
                      <span style={{ color: '#2c2419' }}>Total Clients</span>
                      <span className="text-2xl" style={{ color: '#2c2419' }}>{clients.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contract Status */}
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.08)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)', transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-8px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 40px rgba(44,36,25,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(44,36,25,0.08)'; }}>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-6" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>📋 Contract Status</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span style={{ color: '#5c5850', fontSize: '14px' }}>Active</span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold" style={{ color: '#10b981' }}>{clients.filter(c => c.is_active).length}</span>
                      <span style={{ color: '#9ca3af', fontSize: '12px' }}>({clients.length ? ((clients.filter(c => c.is_active).length / clients.length) * 100).toFixed(0) : 0}%)</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: '#5c5850', fontSize: '14px' }}>Inactive</span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold" style={{ color: '#ef4444' }}>{clients.filter(c => !c.is_active).length}</span>
                      <span style={{ color: '#9ca3af', fontSize: '12px' }}>({clients.length ? ((clients.filter(c => !c.is_active).length / clients.length) * 100).toFixed(0) : 0}%)</span>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(44,36,25,0.1)', paddingTop: '12px', marginTop: '12px' }}>
                    <div className="flex justify-between items-center">
                      <span style={{ color: '#5c5850', fontSize: '14px' }}>Churn Rate</span>
                      <span className="text-2xl font-bold" style={{ color: '#d9a854' }}>
                        {clients.length ? ((clients.filter(c => !c.is_active).length / clients.length) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuration Status */}
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.08)', boxShadow: '0 4px 20px rgba(44,36,25,0.08)', transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-8px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 40px rgba(44,36,25,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(44,36,25,0.08)'; }}>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-6" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>⚙️ Configuration Status</h3>
                <div className="space-y-4">
                  {[
                    { label: 'GA Configured', color: '#10b981', key: 'ga_property_id' },
                    { label: 'GSC Configured', color: '#3b82f6', key: 'gsc_site_url' },
                    { label: 'GBP Configured', color: '#f59e0b', key: 'gbp_location_id' },
                    { label: 'ADS Configured', color: '#d9a854', key: 'gads_customer_id' },
                  ].map(({ label, color, key }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span style={{ color: '#5c5850', fontSize: '14px' }}>{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold" style={{ color }}>
                          {clients.filter(c => { const cfg = Array.isArray(c.service_configs) ? c.service_configs[0] : undefined; return cfg?.[key as keyof ServiceConfig]; }).length}
                        </span>
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>✓</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Client Table */}
          <main className="max-w-7xl mx-auto px-4 md:px-8 pb-12 md:pb-20">
            <style>{`
              .table-container { transition: all 300ms cubic-bezier(0.4,0,0.2,1); position: relative; }
              .table-container::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at top right, rgba(196,112,79,0.05) 0%, transparent 100%); pointer-events: none; border-radius: 24px; }
            `}</style>
            <div className="table-container rounded-3xl p-8" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.08)', boxShadow: '0 8px 32px rgba(44,36,25,0.08)' }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold" style={{ color: '#2c2419', fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.02em' }}>All Clients</h2>
                  <p className="text-xs md:text-sm mt-1" style={{ color: '#9ca3af' }}>Manage and monitor {clients.length} client{clients.length !== 1 ? 's' : ''}</p>
                </div>
                <span className="text-sm font-bold px-4 py-2 rounded-full" style={{ background: 'linear-gradient(135deg, #f9f7f4 0%, #f0ece5 100%)', color: '#5c5850' }}>
                  {filteredClients.length}/{clients.length}
                </span>
              </div>

              {/* Search & Filters */}
              <div className="mb-8 space-y-4">
                <style>{`
                  .search-input { transition: all 200ms cubic-bezier(0.4,0,0.2,1); }
                  .search-input:focus { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(196,112,79,0.15) !important; }
                  .filter-button { transition: all 150ms cubic-bezier(0.4,0,0.2,1); }
                  .filter-button:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(44,36,25,0.1); }
                `}</style>
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 w-5 h-5" style={{ color: '#9ca3af' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search clients by name..."
                    className="search-input w-full pl-12 pr-4 py-3 border-2 rounded-full focus:outline-none"
                    style={{ background: '#f5f1ed', borderColor: 'transparent', color: '#2c2419', fontSize: '0.95rem' }}
                    onFocus={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#c4704f'; }}
                    onBlur={e => { e.currentTarget.style.background = '#f5f1ed'; e.currentTarget.style.borderColor = 'transparent'; }}
                  />
                </div>
                <div className="flex gap-1 md:gap-2 flex-wrap">
                  {[
                    { id: 'all', label: 'All Clients', color: '#5c5850', icon: '👥', count: clients.length },
                    { id: 'active', label: 'Active', color: '#10b981', icon: '✓', count: clients.filter(c => c.is_active).length },
                    { id: 'both', label: 'Both Services', color: '#10b981', icon: '⭐', count: clients.filter(c => c.services?.googleAds && c.services?.seo).length },
                    { id: 'seo', label: 'SEO Only', color: '#f59e0b', icon: '📈', count: clients.filter(c => c.services?.seo && !c.services?.googleAds).length },
                    { id: 'ads', label: 'Ads Only', color: '#3b82f6', icon: '💰', count: clients.filter(c => c.services?.googleAds && !c.services?.seo).length },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setServiceFilter(filter.id as any)}
                      className="filter-button px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold flex items-center gap-2"
                      style={{ background: serviceFilter === filter.id ? filter.color : '#f9f7f4', color: serviceFilter === filter.id ? '#fff' : filter.color, border: `2px solid ${filter.color}30` }}
                    >
                      <span>{filter.icon}</span>
                      <span>{filter.label}</span>
                      <span style={{ background: serviceFilter === filter.id ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }}>
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#5c5850', fontWeight: 500, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={e => setShowArchived(e.target.checked)}
                    style={{ width: '14px', height: '14px', accentColor: '#c4704f', cursor: 'pointer' }}
                  />
                  Show Archived
                </label>
              </div>

              <style>{`
                table { border-collapse: separate; border-spacing: 0; }
                table thead { position: sticky; top: 0; z-index: 10; background: rgba(245,241,237,0.5); backdrop-filter: blur(4px); }
                table th { font-weight: 700; letter-spacing: 0.05em; }
                table tbody tr { transition: all 200ms cubic-bezier(0.4,0,0.2,1); background-color: transparent; }
                table tbody tr:hover { background-color: rgba(196,112,79,0.04); box-shadow: inset 0 0 0 1px rgba(196,112,79,0.08); transform: translateY(-1px); }
                table td { padding: 16px 12px; vertical-align: middle; }
                table th { padding: 16px 12px; background: transparent; }
                table tbody tr { border-bottom: 1px solid rgba(44,36,25,0.05); }
                table tbody tr:last-child { border-bottom: none; }
                table tbody tr:hover .status-pill { transform: scale(1.05); box-shadow: 0 2px 8px rgba(44,36,25,0.12); }
                table tbody tr * { transition: color 150ms ease, background-color 150ms ease; }
              `}</style>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#5c5850' }}>Loading clients...</div>
              ) : error ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#c5221f' }}>{error}</div>
              ) : (
                <div className="overflow-x-auto -mx-8 md:mx-0 md:rounded-2xl" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="w-full" style={{ minWidth: '1000px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(44,36,25,0.1)' }}>
                        <th rowSpan={2} className="text-left text-xs font-bold uppercase tracking-wider py-4 pr-6" style={{ color: '#5c5850', minWidth: '200px', borderBottom: 'none' }}>Client</th>
                        <th colSpan={2} className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#2c2419', minWidth: '190px', borderBottom: '3px solid #2c2419' }}>Overview</th>
                        <th colSpan={1} className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#b45309', minWidth: '85px', borderBottom: '3px solid #b45309' }}>SEO</th>
                        <th colSpan={1} className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#047857', minWidth: '85px', borderBottom: '3px solid #047857' }}>GBP</th>
                        <th colSpan={3} className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#6b7280', minWidth: '255px', borderBottom: '3px solid #6b7280' }}>Google Ads</th>
                        <th colSpan={4} className="text-center text-xs font-bold uppercase tracking-wider py-4" style={{ color: '#5c5850', minWidth: '280px', borderBottom: 'none' }}>&nbsp;</th>
                      </tr>
                      <tr style={{ borderBottom: '2px solid rgba(44,36,25,0.1)' }}>
                        <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#5c5850', minWidth: '95px' }}>Services</th>
                        <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#2c2419', minWidth: '95px' }}>Leads</th>
                        <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#b45309', minWidth: '85px' }}>Forms</th>
                        <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#047857', minWidth: '85px' }}>Calls</th>
                        <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#6b7280', minWidth: '75px' }}>Conv</th>
                        <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#6b7280', minWidth: '75px' }}>CPL</th>
                        <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#6b7280', minWidth: '85px' }}>Trend 30d</th>
                        <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#5c5850', minWidth: '75px' }}>Status</th>
                        <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#5c5850', minWidth: '75px' }}>Health</th>
                        <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-2" style={{ color: '#5c5850', minWidth: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.map((client) => {
                        const health = getClientHealth(client);
                        const trendData = [40, 45, 42, 48, 44, 46];
                        const maxTrend = Math.max(...trendData);
                        const trendColor = client.total_leads && client.total_leads > 0 ? '#10b981' : '#9ca3af';
                        const trendPercent = trendData.length > 1 ? Math.round(((trendData[trendData.length - 1] - trendData[0]) / trendData[0]) * 100) : 0;

                        return (
                          <tr
                            key={client.id}
                            onClick={() => window.location.href = `/admin-dashboard/${client.slug}`}
                            className="cursor-pointer"
                            style={{ borderBottom: '1px solid rgba(44,36,25,0.05)', opacity: client.is_active ? 1 : 0.65, background: client.is_active ? 'transparent' : '#faf7f4' }}
                          >
                            <td className="py-5 pr-6">
                              <div className="font-bold text-sm" style={{ color: client.is_active ? '#2c2419' : '#9ca3af' }}>{client.name}</div>
                              <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>@{client.slug}</div>
                            </td>
                            <td className="py-5 text-center">
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                {client.services?.googleAds && <span className="px-2 py-1 rounded-md text-xs font-semibold" style={{ background: '#fff7ed', color: '#c2410c' }}>Ads</span>}
                                {client.services?.seo && <span className="px-2 py-1 rounded-md text-xs font-semibold" style={{ background: '#f0fdf4', color: '#166534' }}>SEO</span>}
                                {client.services?.googleLocalService && <span className="px-2 py-1 rounded-md text-xs font-semibold" style={{ background: '#eff6ff', color: '#0c4a6e' }}>GBP</span>}
                              </div>
                            </td>
                            <td className="py-5 text-center font-bold text-base tabular-nums" style={{ color: '#c4704f' }}>{client.total_leads || 0}</td>
                            <td className="py-5 text-center"><div className="font-semibold text-sm tabular-nums" style={{ color: '#b45309' }}>{client.seo_form_submits || 0}</div></td>
                            <td className="py-5 text-center"><div className="font-semibold text-sm tabular-nums" style={{ color: '#047857' }}>{client.gbp_calls || 0}</div></td>
                            <td className="py-5 text-center"><div className="font-semibold text-sm tabular-nums" style={{ color: '#6b7280' }}>{client.ads_conversions || 0}</div></td>
                            <td className="py-5 text-center"><div className="font-semibold text-sm tabular-nums" style={{ color: '#6b7280' }}>{client.ads_cpl && client.ads_cpl > 0 ? '$' + Math.round(client.ads_cpl) : '—'}</div></td>
                            <td className="py-5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <svg width="70" height="28" style={{ verticalAlign: 'middle' }}>
                                  <defs>
                                    <linearGradient id={`grad-${client.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={trendColor} stopOpacity={0.25} />
                                      <stop offset="100%" stopColor={trendColor} stopOpacity={0.02} />
                                    </linearGradient>
                                  </defs>
                                  <polygon points={`0,28 ${trendData.map((val, i) => `${(i / (trendData.length - 1)) * 70},${28 - (val / maxTrend) * 28}`).join(' ')} 70,28`} fill={`url(#grad-${client.id})`} />
                                  <polyline points={trendData.map((val, i) => `${(i / (trendData.length - 1)) * 70},${28 - (val / maxTrend) * 28}`).join(' ')} fill="none" stroke={trendColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span className="text-xs font-bold whitespace-nowrap tabular-nums" style={{ color: trendColor, minWidth: '45px' }}>
                                  {trendPercent > 0 ? '↑' : trendPercent < 0 ? '↓' : '→'} {Math.abs(trendPercent)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-5 text-center">
                              <span className="status-pill text-xs font-bold px-2 py-1 rounded-full" style={{ background: client.is_active ? '#ecfdf5' : '#fee2e2', color: client.is_active ? '#059669' : '#dc2626', border: `1px solid ${client.is_active ? '#d1fae5' : '#fee2e2'}` }}>
                                {client.is_active ? 'Active' : 'Off'}
                              </span>
                            </td>
                            <td className="py-5 text-center">
                              <span className="text-xs font-bold px-2 py-1 rounded-full" style={{
                                background: health === 'good' ? '#ecfdf5' : health === 'warning' ? '#fef3c7' : '#fee2e2',
                                color: health === 'good' ? '#059669' : health === 'warning' ? '#b45309' : '#dc2626',
                                border: `1px solid ${health === 'good' ? '#d1fae5' : health === 'warning' ? '#fde68a' : '#fecaca'}`
                              }}>
                                {health === 'good' ? 'Good' : health === 'warning' ? 'Fair' : 'Poor'}
                              </span>
                            </td>
                            <td className="py-5 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/admin-dashboard/clients/${client.id}/edit`);
                                }}
                                className="hover:opacity-70 transition"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#c4704f',
                                  padding: '4px',
                                }}
                                title="Edit client"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredClients.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#5c5850' }}>No clients found</div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
