'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Search, UserPlus, AlertTriangle, TrendingDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import DateRangePicker from '@/components/admin/DateRangePicker';
import AdminLayout from '@/components/admin/AdminLayout';
import { fmtNum, fmtCurrency } from '@/lib/format';

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
  owner?: string;
  seo_form_submits?: number;
  gbp_calls?: number;
  ads_conversions?: number;
  ads_cpl?: number;
  ad_spend?: number;
  total_leads?: number;
  trendPoints?: number[];
  service_configs?: ServiceConfig[];
  services?: { googleAds: boolean; seo: boolean };
}

interface AlertItem {
  clientId: string;
  name: string;
  leadsPct: number;
  sessionsPct: number;
  curLeads: number;
  prevLeads: number;
  curSessions: number;
  prevSessions: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';

  const [clients, setClients] = useState<ClientWithMetrics[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<'all' | 'active' | 'both' | 'seo' | 'ads'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);

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
      fetchAlerts();
    }
  }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      );
      const dateFromStr = dateRange.from?.toISOString().split('T')[0] || '';
      const dateToStr = dateRange.to?.toISOString().split('T')[0] || '';

      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`id, name, slug, city, contact_email, is_active, owner,
          service_configs (ga_property_id, gads_customer_id, gbp_location_id, gsc_site_url, callrail_account_id)`)
        .order('name', { ascending: true });

      if (clientsError) throw new Error(`Failed to fetch clients: ${clientsError.message}`);

      const [metricsRes, gbpRes, formRes] = await Promise.all([
        supabase.from('client_metrics_summary')
          .select('client_id, total_leads, google_ads_conversions, ad_spend, date')
          .gte('date', dateFromStr).lte('date', dateToStr).eq('period_type', 'daily'),
        supabase.from('gbp_location_daily_metrics')
          .select('client_id, phone_calls, date')
          .gte('date', dateFromStr).lte('date', dateToStr),
        supabase.from('ga4_events')
          .select('client_id, event_count')
          .gte('date', dateFromStr).lte('date', dateToStr)
          .ilike('event_name', '%success%'),
      ]);

      const metricsMap: Record<string, any> = {};
      const init = () => ({ total_leads: 0, seo_form_submits: 0, gbp_calls: 0, ads_conversions: 0, ad_spend: 0, trendByDate: {} as Record<string, number> });

      (metricsRes.data || []).forEach((m: any) => {
        if (!metricsMap[m.client_id]) metricsMap[m.client_id] = init();
        metricsMap[m.client_id].total_leads += m.total_leads || 0;
        metricsMap[m.client_id].ads_conversions += m.google_ads_conversions || 0;
        metricsMap[m.client_id].ad_spend += m.ad_spend || 0;
        metricsMap[m.client_id].trendByDate[m.date] = m.total_leads || 0;
      });
      (gbpRes.data || []).forEach((g: any) => {
        if (!metricsMap[g.client_id]) metricsMap[g.client_id] = init();
        metricsMap[g.client_id].gbp_calls += g.phone_calls || 0;
      });
      (formRes.data || []).forEach((f: any) => {
        if (!metricsMap[f.client_id]) metricsMap[f.client_id] = init();
        metricsMap[f.client_id].seo_form_submits += f.event_count || 0;
      });

      const processed = (clientsData || []).map((client: any) => {
        const cfg = Array.isArray(client.service_configs) ? client.service_configs[0] : client.service_configs || {};
        const m = metricsMap[client.id] || init();
        const cpl = m.ads_conversions > 0 ? m.ad_spend / m.ads_conversions : 0;
        const trendPoints = Object.entries(m.trendByDate)
          .sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v as number);
        return {
          id: client.id, name: client.name, slug: client.slug, city: client.city,
          contact_email: client.contact_email, is_active: client.is_active, owner: client.owner,
          total_leads: m.total_leads, seo_form_submits: m.seo_form_submits,
          gbp_calls: m.gbp_calls, ads_conversions: m.ads_conversions,
          ads_cpl: cpl, ad_spend: m.ad_spend, trendPoints,
          service_configs: Array.isArray(client.service_configs) ? client.service_configs : [],
          services: {
            googleAds: !!(cfg.gads_customer_id?.trim()),
            seo: !!(cfg.gsc_site_url?.trim()),
          },
        };
      });

      setClients(processed);
    } catch (err) {
      setError(`Failed to load: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      );
      const today = new Date(dateRange.to);
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      const cur7End = fmt(today);
      const cur7Start = new Date(today); cur7Start.setDate(today.getDate() - 6);
      const prev7End = new Date(today); prev7End.setDate(today.getDate() - 7);
      const prev7Start = new Date(today); prev7Start.setDate(today.getDate() - 13);

      const [curRes, prevRes, clientsRes] = await Promise.all([
        supabase.from('client_metrics_summary')
          .select('client_id, total_leads, sessions').eq('period_type', 'daily')
          .gte('date', fmt(cur7Start)).lte('date', cur7End),
        supabase.from('client_metrics_summary')
          .select('client_id, total_leads, sessions').eq('period_type', 'daily')
          .gte('date', fmt(prev7Start)).lte('date', fmt(prev7End)),
        supabase.from('clients').select('id, name').eq('is_active', true),
      ]);

      const agg = (rows: any[]) => {
        const m: Record<string, { leads: number; sessions: number }> = {};
        for (const r of rows || []) {
          if (!m[r.client_id]) m[r.client_id] = { leads: 0, sessions: 0 };
          m[r.client_id].leads += r.total_leads || 0;
          m[r.client_id].sessions += r.sessions || 0;
        }
        return m;
      };

      const cur = agg(curRes.data || []);
      const prev = agg(prevRes.data || []);
      const nameMap: Record<string, string> = {};
      for (const c of clientsRes.data || []) nameMap[c.id] = c.name;

      const found: AlertItem[] = [];
      for (const [id, name] of Object.entries(nameMap)) {
        const c = cur[id] || { leads: 0, sessions: 0 };
        const p = prev[id] || { leads: 0, sessions: 0 };
        if (p.leads === 0 && p.sessions === 0) continue;
        const lp = p.leads > 0 ? Math.round(((c.leads - p.leads) / p.leads) * 100) : 0;
        const sp = p.sessions > 0 ? Math.round(((c.sessions - p.sessions) / p.sessions) * 100) : 0;
        if (lp <= -20 || sp <= -30) {
          found.push({ clientId: id, name, leadsPct: lp, sessionsPct: sp, curLeads: c.leads, prevLeads: p.leads, curSessions: c.sessions, prevSessions: p.sessions });
        }
      }
      setAlerts(found.sort((a, b) => a.leadsPct - b.leadsPct));
    } catch { /* silent */ }
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
    return matchesSearch && matchesServiceFilter && (showArchived || client.is_active !== false);
  });

  const totalLeads = clients.reduce((s, c) => s + (c.total_leads || 0), 0);
  const totalGbpCalls = clients.reduce((s, c) => s + (c.gbp_calls || 0), 0);
  const cplClients = clients.filter(c => c.ads_cpl && c.ads_cpl > 0);
  const avgCpl = cplClients.length > 0 ? cplClients.reduce((s, c) => s + (c.ads_cpl || 0), 0) / cplClients.length : 0;

  const getDaysDiff = () => Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000);
  const setPreset = (days: number) => {
    const to = new Date(); to.setDate(to.getDate() - 1);
    const from = new Date(to); from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  return (
    <AdminLayout>
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 px-6 py-3" style={{
        background: 'rgba(245,241,237,0.98)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44,36,25,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        {/* Date presets */}
        <div className="flex gap-1 bg-white/40 p-1 rounded-full backdrop-blur-md">
          {[{ label: '7D', days: 7 }, { label: '30D', days: 30 }, { label: '90D', days: 90 }].map(p => {
            const active = getDaysDiff() === p.days;
            return (
              <button key={p.label} onClick={() => setPreset(p.days)}
                className="px-3 py-1.5 text-xs font-semibold rounded-full transition-all"
                style={{ background: active ? '#c4704f' : 'transparent', color: active ? '#fff' : '#5c5850' }}>
                {p.label}
              </button>
            );
          })}
        </div>
        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        <div style={{ marginLeft: 'auto' }}>
          {isAdmin && (
            <button onClick={() => router.push('/admin-dashboard/clients/new')}
              className="flex items-center gap-2 hover:opacity-80 transition"
              style={{ background: '#c4704f', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <UserPlus className="w-4 h-4" />
              Add Client
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 24px 40px 24px' }}>
        {/* Hero */}
        <div style={{ background: 'linear-gradient(135deg, #cc8b65 0%, #d49a6a 100%)', color: 'white', padding: '48px 24px 64px', textAlign: 'center', marginLeft: '-24px', marginRight: '-24px' }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.2rem)', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 8px 0', fontFamily: '"Outfit", sans-serif' }}>
            Client Performance
          </h1>
          <p style={{ fontSize: '15px', opacity: 0.9, margin: 0 }}>Monitor and optimize client campaigns</p>
        </div>

        {/* Stats Grid */}
        <div style={{ marginTop: '-36px', position: 'relative', zIndex: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Active Clients', value: fmtNum(clients.filter(c => c.is_active).length) },
            { label: 'Total Leads', value: fmtNum(totalLeads) },
            { label: 'Avg CPL', value: avgCpl > 0 ? fmtCurrency(avgCpl, 0) : 'N/A' },
            { label: 'GBP Calls', value: fmtNum(totalGbpCalls) },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 10px 0' }}>{s.label}</p>
              <p style={{ fontSize: '2.2rem', fontWeight: 700, color: '#2c2419', margin: 0, fontFamily: '"Outfit", sans-serif' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Alert Section */}
        {alerts.length > 0 && (
          <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(245,158,11,0.08)' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', cursor: 'pointer', borderBottom: alertsCollapsed ? 'none' : '1px solid rgba(245,158,11,0.15)' }}
              onClick={() => setAlertsCollapsed(v => !v)}
            >
              <AlertTriangle size={16} style={{ color: '#d97706', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>
                {alerts.length} client{alerts.length > 1 ? 's' : ''} with significant metric drops (7-day comparison)
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#b45309' }}>{alertsCollapsed ? 'Show ▾' : 'Hide ▴'}</span>
            </div>
            {!alertsCollapsed && (
              <div style={{ padding: '8px 12px 12px' }}>
                {alerts.map(a => (
                  <div key={a.clientId}
                    onClick={() => router.push(`/admin-dashboard/${clients.find(c => c.id === a.clientId)?.slug || ''}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 8px', borderRadius: '8px', cursor: 'pointer', transition: 'background 150ms' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <TrendingDown size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#2c2419', minWidth: '180px' }}>{a.name}</span>
                    {a.leadsPct <= -20 && (
                      <span style={{ fontSize: '12px', color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>
                        Leads {a.prevLeads} → {a.curLeads} ({a.leadsPct}%)
                      </span>
                    )}
                    {a.sessionsPct <= -30 && (
                      <span style={{ fontSize: '12px', color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>
                        Traffic {fmtNum(a.prevSessions)} → {fmtNum(a.curSessions)} ({a.sessionsPct}%)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {/* Service Distribution */}
          <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 12px rgba(44,36,25,0.06)' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 16px 0' }}>Service Distribution</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'SEO Only', color: '#f59e0b', count: clients.filter(c => c.services?.seo && !c.services?.googleAds).length },
                { label: 'Ads Only', color: '#3b82f6', count: clients.filter(c => c.services?.googleAds && !c.services?.seo).length },
                { label: 'Both Services', color: '#10b981', count: clients.filter(c => c.services?.googleAds && c.services?.seo).length },
              ].map(({ label, color, count }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#5c5850', fontSize: '13px' }}>{label}</span>
                  <span style={{ fontSize: '20px', fontWeight: 700, color }}>{count}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(44,36,25,0.08)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span style={{ color: '#2c2419', fontSize: '13px' }}>Total</span>
                <span style={{ fontSize: '20px', color: '#2c2419' }}>{clients.length}</span>
              </div>
            </div>
          </div>

          {/* Contract Status */}
          <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 12px rgba(44,36,25,0.06)' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 16px 0' }}>Contract Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#5c5850', fontSize: '13px' }}>Active</span>
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>{clients.filter(c => c.is_active).length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#5c5850', fontSize: '13px' }}>Inactive</span>
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#ef4444' }}>{clients.filter(c => !c.is_active).length}</span>
              </div>
              <div style={{ borderTop: '1px solid rgba(44,36,25,0.08)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#5c5850', fontSize: '13px' }}>Churn Rate</span>
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#d9a854' }}>
                  {clients.length ? ((clients.filter(c => !c.is_active).length / clients.length) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 12px rgba(44,36,25,0.06)' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 16px 0' }}>Configuration</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'GA Configured', color: '#10b981', key: 'ga_property_id' },
                { label: 'GSC Configured', color: '#3b82f6', key: 'gsc_site_url' },
                { label: 'ADS Configured', color: '#d9a854', key: 'gads_customer_id' },
                { label: 'GBP Configured', color: '#f59e0b', key: 'gbp_location_id' },
              ].map(({ label, color, key }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#5c5850', fontSize: '13px' }}>{label}</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color }}>
                    {clients.filter(c => {
                      const cfg = Array.isArray(c.service_configs) ? c.service_configs[0] : undefined;
                      return cfg?.[key as keyof ServiceConfig];
                    }).length} ✓
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Client Table */}
        <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '20px', padding: '28px', boxShadow: '0 4px 24px rgba(44,36,25,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#2c2419', margin: '0 0 4px 0', fontFamily: '"Outfit", sans-serif' }}>All Clients</h2>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{filteredClients.length} of {clients.length} shown</p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#5c5850', fontWeight: 500 }}>
              <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}
                style={{ width: '13px', height: '13px', accentColor: '#c4704f', cursor: 'pointer' }} />
              Show Archived
            </label>
          </div>

          {/* Search + Filters */}
          <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', width: '16px', height: '16px' }} />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search clients..."
                style={{ width: '100%', paddingLeft: '40px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px', border: '1.5px solid transparent', borderRadius: '10px', background: '#f5f1ed', color: '#2c2419', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#c4704f'; }}
                onBlur={e => { e.currentTarget.style.background = '#f5f1ed'; e.currentTarget.style.borderColor = 'transparent'; }}
              />
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All', count: clients.length },
                { id: 'active', label: 'Active', count: clients.filter(c => c.is_active).length },
                { id: 'both', label: 'Both Services', count: clients.filter(c => c.services?.googleAds && c.services?.seo).length },
                { id: 'seo', label: 'SEO Only', count: clients.filter(c => c.services?.seo && !c.services?.googleAds).length },
                { id: 'ads', label: 'Ads Only', count: clients.filter(c => c.services?.googleAds && !c.services?.seo).length },
              ].map(f => (
                <button key={f.id} onClick={() => setServiceFilter(f.id as any)}
                  style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1.5px solid rgba(44,36,25,0.15)', background: serviceFilter === f.id ? '#2c2419' : 'transparent', color: serviceFilter === f.id ? '#fff' : '#5c5850', transition: 'all 150ms' }}>
                  {f.label} <span style={{ opacity: 0.6 }}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          <style>{`
            .client-table td { padding: 14px 10px; vertical-align: middle; }
            .client-table th { padding: 10px 10px; }
            .client-table tbody tr { border-bottom: 1px solid rgba(44,36,25,0.05); transition: background 150ms; cursor: pointer; }
            .client-table tbody tr:hover { background: rgba(196,112,79,0.04); }
            .client-table tbody tr:last-child { border-bottom: none; }
            .col-divider { border-right: 1px solid rgba(44,36,25,0.08) !important; }
          `}</style>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#5c5850' }}>Loading...</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#c5221f' }}>{error}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="client-table w-full" style={{ minWidth: '860px', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(44,36,25,0.1)' }}>
                    <th rowSpan={2} style={{ textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#5c5850', letterSpacing: '0.05em', minWidth: '180px' }}>Client</th>
                    <th colSpan={2} className="col-divider" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#2c2419', borderBottom: '2.5px solid #2c2419', paddingBottom: '6px' }}>Overview</th>
                    <th colSpan={1} className="col-divider" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#b45309', borderBottom: '2.5px solid #b45309', paddingBottom: '6px' }}>SEO</th>
                    <th colSpan={1} className="col-divider" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#047857', borderBottom: '2.5px solid #047857', paddingBottom: '6px' }}>GBP</th>
                    <th colSpan={3} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', borderBottom: '2.5px solid #6b7280', paddingBottom: '6px' }}>Google Ads</th>
                  </tr>
                  <tr style={{ borderBottom: '1.5px solid rgba(44,36,25,0.1)' }}>
                    <th style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#5c5850' }}>Services</th>
                    <th className="col-divider" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#2c2419' }}>Leads</th>
                    <th className="col-divider" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#b45309' }}>Forms</th>
                    <th className="col-divider" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#047857' }}>Calls</th>
                    <th style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>Conv</th>
                    <th style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>CPL</th>
                    <th style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map(client => {
                    const pts = client.trendPoints && client.trendPoints.length > 1 ? client.trendPoints : null;
                    const maxPt = pts ? Math.max(...pts, 1) : 1;
                    const firstPt = pts ? pts[0] : 0;
                    const lastPt = pts ? pts[pts.length - 1] : 0;
                    const trendPct = firstPt > 0 ? Math.round(((lastPt - firstPt) / firstPt) * 100) : 0;
                    const lineColor = pts ? (lastPt >= firstPt ? '#10b981' : '#ef4444') : '#9ca3af';

                    return (
                      <tr key={client.id} onClick={() => router.push(`/admin-dashboard/${client.slug}`)}
                        style={{ opacity: client.is_active ? 1 : 0.55, background: client.is_active ? 'transparent' : '#faf7f4' }}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: client.is_active ? '#2c2419' : '#9ca3af' }}>{client.name}</div>
                          {client.owner && <div style={{ fontSize: '11px', color: '#8a7f74', marginTop: '1px' }}>{client.owner}</div>}
                          <div style={{ fontSize: '11px', color: '#c4c4c4', marginTop: '1px' }}>@{client.slug}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {client.services?.googleAds && <span style={{ background: '#fff7ed', color: '#c2410c', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Ads</span>}
                            {client.services?.seo && <span style={{ background: '#f0fdf4', color: '#166534', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>SEO</span>}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '15px', color: '#c4704f', borderRight: '1px solid rgba(44,36,25,0.08)' }}>{fmtNum(client.total_leads)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '13px', color: '#b45309', borderRight: '1px solid rgba(44,36,25,0.08)' }}>{fmtNum(client.seo_form_submits)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '13px', color: '#047857', borderRight: '1px solid rgba(44,36,25,0.08)' }}>{fmtNum(client.gbp_calls)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '13px', color: '#6b7280' }}>{fmtNum(client.ads_conversions)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '13px', color: '#6b7280' }}>{client.ads_cpl && client.ads_cpl > 0 ? fmtCurrency(client.ads_cpl, 0) : '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          {pts ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <svg width="60" height="24">
                                <defs>
                                  <linearGradient id={`g-${client.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
                                    <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                                  </linearGradient>
                                </defs>
                                <polygon points={`0,24 ${pts.map((v, i) => `${(i / (pts.length - 1)) * 60},${24 - (v / maxPt) * 22}`).join(' ')} 60,24`} fill={`url(#g-${client.id})`} />
                                <polyline points={pts.map((v, i) => `${(i / (pts.length - 1)) * 60},${24 - (v / maxPt) * 22}`).join(' ')} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: lineColor }}>{trendPct > 0 ? '+' : ''}{trendPct}%</span>
                            </div>
                          ) : <span style={{ color: '#d1d5db', fontSize: '11px' }}>—</span>}
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
      </div>
    </AdminLayout>
  );
}
