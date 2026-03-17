'use client';

import { useEffect, useState } from 'react';
import { Search, AlertTriangle, TrendingDown, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { createClient } from '@supabase/supabase-js';
import DateRangePicker from '@/components/admin/DateRangePicker';
import AdminLayout from '@/components/admin/AdminLayout';
import { fmtNum, fmtCurrency } from '@/lib/format';

interface ServiceConfig {
  ga_property_id?: string;
  gads_customer_id?: string;
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
  prev_total_leads?: number;
  manual_form_fills?: number;
  top_keywords?: number;
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
  const [gbpClientSet, setGbpClientSet] = useState<Set<string>>(new Set());
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<'all' | 'both'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date();
    to.setDate(to.getDate() - 1);
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    return { from, to };
  });

  // On mount: use last available data date (not today) as the "to" anchor
  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
    supabase.from('client_metrics_summary')
      .select('date')
      .eq('period_type', 'daily')
      .order('date', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.date) {
          const to = new Date(data.date + 'T12:00:00');
          const from = new Date(to);
          from.setDate(from.getDate() - 30);
          setDateRange({ from, to });
        }
      });
  }, []);

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
        .select(`id, name, slug, city, contact_email, is_active, owner, has_ads, has_seo,
          service_configs (ga_property_id, gads_customer_id, gsc_site_url, callrail_account_id)`)
        .order('name', { ascending: true });

      if (clientsError) throw new Error(`Failed to fetch clients: ${clientsError.message}`);

      const { data: gbpRows } = await supabase.from('gbp_locations').select('client_id').eq('is_active', true);
      const gbpSet = new Set<string>((gbpRows || []).map((r: any) => r.client_id));
      setGbpClientSet(gbpSet);

      // Dynamic cutoff: latest date where GBP calls are confirmed in the DB.
      // This ensures trend only uses dates with complete API data (GBP lags 5-7d).
      const { data: latestGbpRow } = await supabase
        .from('client_metrics_summary')
        .select('date')
        .eq('period_type', 'daily')
        .gt('gbp_calls', 0)
        .order('date', { ascending: false })
        .limit(1)
        .single();
      const completeCutoff = latestGbpRow?.date || dateToStr;

      // Calculate previous period (same length, immediately before dateFrom)
      const periodMs = dateRange.to.getTime() - dateRange.from.getTime() + 86400000;
      const prevTo   = new Date(dateRange.from.getTime() - 86400000);
      const prevFrom = new Date(prevTo.getTime() - periodMs + 86400000);
      const prevFromStr = prevFrom.toISOString().split('T')[0];
      const prevToStr   = prevTo.toISOString().split('T')[0];

      // Include a month only if its LAST DAY falls within the date range.
      // This prevents double-counting when a 30D range straddles two months —
      // e.g. Feb 14→Mar 15: Feb's last day (Feb 28) is within range → include Feb;
      //   Mar's last day (Mar 31) is NOT within range → exclude Mar.
      // Fallback: if no complete month qualifies, use the midpoint month.
      const rangeMonths: string[] = [];
      const fromDate = new Date(dateFromStr + 'T00:00:00');
      const toDate   = new Date(dateToStr   + 'T00:00:00');
      const [fy, fm] = dateFromStr.split('-').map(Number);
      const [ty, tm] = dateToStr.split('-').map(Number);
      let ry = fy, rm = fm;
      while (ry < ty || (ry === ty && rm <= tm)) {
        const lastDayOfMonth = new Date(ry, rm, 0); // day-0 of next month = last day
        if (lastDayOfMonth >= fromDate && lastDayOfMonth <= toDate) {
          rangeMonths.push(`${ry}-${String(rm).padStart(2, '0')}`);
        }
        rm++; if (rm > 12) { rm = 1; ry++; }
        if (rangeMonths.length > 24) break;
      }
      // Fallback: range too short to contain any complete month → use midpoint month
      if (rangeMonths.length === 0) {
        const mid = new Date((fromDate.getTime() + toDate.getTime()) / 2);
        rangeMonths.push(`${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, '0')}`);
      }

      const [metricsRes, formRes, prevMetricsRes, fillsRes] = await Promise.all([
        supabase.from('client_metrics_summary')
          .select('client_id, total_leads, google_ads_conversions, gbp_calls, ad_spend, top_keywords, date')
          .gte('date', dateFromStr).lte('date', dateToStr).eq('period_type', 'daily'),
        supabase.from('ga4_events')
          .select('client_id, event_count')
          .gte('date', dateFromStr).lte('date', dateToStr)
          .ilike('event_name', '%success%'),
        supabase.from('client_metrics_summary')
          .select('client_id, total_leads')
          .gte('date', prevFromStr).lte('date', prevToStr).eq('period_type', 'daily'),
        supabase.from('manual_form_fills')
          .select('client_id, year_month, form_fills')
          .in('year_month', rangeMonths),
      ]);

      const prevMap: Record<string, number> = {};
      (prevMetricsRes.data || []).forEach((m: any) => {
        prevMap[m.client_id] = (prevMap[m.client_id] || 0) + (m.total_leads || 0);
      });

      // Build manual_form_fills map: clientId → total for selected months
      const fillsMap: Record<string, number> = {};
      (fillsRes.data || []).forEach((f: any) => {
        fillsMap[f.client_id] = (fillsMap[f.client_id] || 0) + (f.form_fills || 0);
      });

      const metricsMap: Record<string, any> = {};
      const init = () => ({ total_leads: 0, seo_form_submits: 0, gbp_calls: 0, ads_conversions: 0, ad_spend: 0, top_keywords: 0, latestKwDate: '', trendByDate: {} as Record<string, number> });

      (metricsRes.data || []).forEach((m: any) => {
        if (!metricsMap[m.client_id]) metricsMap[m.client_id] = init();
        metricsMap[m.client_id].total_leads += m.total_leads || 0;
        metricsMap[m.client_id].ads_conversions += m.google_ads_conversions || 0;
        // Use gbp_calls from summary (same source as total_leads) so both are always consistent
        metricsMap[m.client_id].gbp_calls += m.gbp_calls || 0;
        metricsMap[m.client_id].ad_spend += m.ad_spend || 0;
        // top_keywords: take from latest date that has a non-zero value (GSC lags 2-3 days)
        if ((m.top_keywords || 0) > 0 && (!metricsMap[m.client_id].latestKwDate || m.date >= metricsMap[m.client_id].latestKwDate)) {
          metricsMap[m.client_id].top_keywords = m.top_keywords;
          metricsMap[m.client_id].latestKwDate = m.date;
        }
        // Trend: ads_conversions + gbp_calls only (no form_fills — unreliable event naming).
        // Only include dates up to completeCutoff — ensures GBP API data is fully synced.
        if (m.date <= completeCutoff) {
          metricsMap[m.client_id].trendByDate[m.date] = (m.google_ads_conversions || 0) + (m.gbp_calls || 0);
        }
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
          total_leads: m.total_leads, prev_total_leads: prevMap[client.id] ?? null, seo_form_submits: m.seo_form_submits,
          manual_form_fills: fillsMap[client.id] || 0,
          top_keywords: m.top_keywords,
          gbp_calls: m.gbp_calls, ads_conversions: m.ads_conversions,
          ads_cpl: cpl, ad_spend: m.ad_spend, trendPoints,
          service_configs: Array.isArray(client.service_configs) ? client.service_configs : [],
          // Use has_ads / has_seo (explicit admin flags) as source of truth,
          // fall back to service_configs IDs for clients without the flag set
          services: {
            googleAds: client.has_ads ?? !!(cfg.gads_customer_id?.trim()),
            seo: client.has_seo ?? !!(cfg.gsc_site_url?.trim()),
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
      // Dynamic completeCutoff: latest date where GBP data is confirmed complete.
      // Both windows are anchored to this date → data integrity guaranteed.
      // Rollup now covers 20 days so prev7 (8-14d back from cutoff) always has fresh data.
      const { data: latestGbpAlert } = await supabase
        .from('client_metrics_summary')
        .select('date')
        .eq('period_type', 'daily')
        .gt('gbp_calls', 0)
        .order('date', { ascending: false })
        .limit(1)
        .single();
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      const cutoff = latestGbpAlert?.date
        ? new Date(latestGbpAlert.date + 'T12:00:00Z')
        : (() => { const d = new Date(dateRange.to); d.setDate(d.getDate() - 7); return d; })();
      const cur7End = latestGbpAlert?.date || fmt(cutoff);
      const cur7Start = new Date(cutoff); cur7Start.setDate(cutoff.getDate() - 6);
      const prev7End = new Date(cutoff); prev7End.setDate(cutoff.getDate() - 7);
      const prev7Start = new Date(cutoff); prev7Start.setDate(cutoff.getDate() - 13);

      const [curRes, prevRes, clientsRes] = await Promise.all([
        supabase.from('client_metrics_summary')
          .select('client_id, google_ads_conversions, gbp_calls, sessions').eq('period_type', 'daily')
          .gte('date', fmt(cur7Start)).lte('date', cur7End),
        supabase.from('client_metrics_summary')
          .select('client_id, google_ads_conversions, gbp_calls, sessions').eq('period_type', 'daily')
          .gte('date', fmt(prev7Start)).lte('date', fmt(prev7End)),
        supabase.from('clients').select('id, name').eq('is_active', true),
      ]);

      const agg = (rows: any[]) => {
        const m: Record<string, { leads: number; sessions: number }> = {};
        for (const r of rows || []) {
          if (!m[r.client_id]) m[r.client_id] = { leads: 0, sessions: 0 };
          // Leads = ads conversions + GBP calls (form_fills excluded — unreliable event naming)
          // Both sources are complete at completeCutoff by definition
          m[r.client_id].leads += (r.google_ads_conversions || 0) + (r.gbp_calls || 0);
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
        // Require meaningful prev baseline to avoid noise (small numbers = high % swings)
        const leadsAlert = lp <= -20 && p.leads >= 5 && (p.leads - c.leads) >= 3;
        const sessionsAlert = sp <= -30 && p.sessions >= 50;
        if (leadsAlert || sessionsAlert) {
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
    if (serviceFilter === 'both') matchesServiceFilter = !!(client.services?.seo && client.services?.googleAds);
    return matchesSearch && matchesServiceFilter && (showArchived || client.is_active !== false);
  });

  const totalLeads = filteredClients.reduce((s, c) => s + (c.total_leads || 0), 0);
  const totalGbpCalls = filteredClients.reduce((s, c) => s + (c.gbp_calls || 0), 0);
  const totalAdSpend = filteredClients.reduce((s, c) => s + (c.ad_spend || 0), 0);
  const totalAdsConversions = filteredClients.reduce((s, c) => s + (c.ads_conversions || 0), 0);
  const totalFormFills = filteredClients.reduce((s, c) => s + (c.manual_form_fills || 0), 0);
  const avgCpl = totalAdsConversions > 0 ? totalAdSpend / totalAdsConversions : 0;

  const getDaysDiff = () => Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000);
  const setPreset = (days: number) => {
    // Anchor to last available data date (already set in dateRange.to), not today
    const to = new Date(dateRange.to);
    const from = new Date(to); from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  return (
    <AdminLayout>
      {/* Sticky Header */}
      <div className="sticky top-14 md:top-0 z-30 px-6 py-3" style={{
        background: 'rgba(245,241,237,0.98)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44,36,25,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Date presets — sát calendar */}
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
          {isAdmin && (
            <button
              onClick={() => router.push('/admin-dashboard/clients/new')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', background: '#c4704f', color: '#fff',
                border: 'none', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              <PlusCircle size={14} />
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
            { label: 'Form Fills', value: fmtNum(totalFormFills) },
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
                {alerts.length} client{alerts.length > 1 ? 's' : ''} with significant metric drops (last 7d vs prev 7d)
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#b45309' }}>{alertsCollapsed ? 'Show ▾' : 'Hide ▴'}</span>
            </div>
            {!alertsCollapsed && (
              <div style={{ padding: '8px 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '4px' }}>
                {alerts.map(a => (
                  <div key={a.clientId}
                    onClick={() => router.push(`/admin-dashboard/${clients.find(c => c.id === a.clientId)?.slug || ''}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', transition: 'background 150ms' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <TrendingDown size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#2c2419', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                      {a.leadsPct <= -20 && (
                        <span style={{ fontSize: '11px', color: '#dc2626', background: '#fee2e2', padding: '2px 7px', borderRadius: '4px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          Leads {a.leadsPct}%
                        </span>
                      )}
                      {a.sessionsPct <= -30 && (
                        <span style={{ fontSize: '11px', color: '#d97706', background: '#fef3c7', padding: '2px 7px', borderRadius: '4px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          Traffic {a.sessionsPct}%
                        </span>
                      )}
                    </div>
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
                { label: 'SEO Only', color: '#f59e0b', count: clients.filter(c => c.is_active && c.services?.seo && !c.services?.googleAds).length },
                { label: 'Ads Only', color: '#3b82f6', count: clients.filter(c => c.is_active && c.services?.googleAds && !c.services?.seo).length },
                { label: 'Both Services', color: '#10b981', count: clients.filter(c => c.is_active && c.services?.googleAds && c.services?.seo).length },
              ].map(({ label, color, count }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#5c5850', fontSize: '13px' }}>{label}</span>
                  <span style={{ fontSize: '20px', fontWeight: 700, color }}>{count}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(44,36,25,0.08)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span style={{ color: '#2c2419', fontSize: '13px' }}>Active Total</span>
                <span style={{ fontSize: '20px', color: '#2c2419' }}>{clients.filter(c => c.is_active).length}</span>
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
                { label: 'GA Configured',  color: '#10b981', count: clients.filter(c => { const cfg = Array.isArray(c.service_configs) ? c.service_configs[0] : undefined; return cfg?.ga_property_id; }).length },
                { label: 'GSC Configured', color: '#3b82f6', count: clients.filter(c => { const cfg = Array.isArray(c.service_configs) ? c.service_configs[0] : undefined; return cfg?.gsc_site_url; }).length },
                { label: 'ADS Configured', color: '#d9a854', count: clients.filter(c => { const cfg = Array.isArray(c.service_configs) ? c.service_configs[0] : undefined; return cfg?.gads_customer_id; }).length },
                { label: 'GBP Configured', color: '#f59e0b', count: clients.filter(c => gbpClientSet.has(c.id)).length },
              ].map(({ label, color, count }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#5c5850', fontSize: '13px' }}>{label}</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color }}>
                    {count} ✓
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
                { id: 'all',  label: 'All Clients', count: clients.filter(c => c.is_active).length },
                { id: 'both', label: 'Ads + SEO',   count: clients.filter(c => c.is_active && c.services?.seo && c.services?.googleAds).length },
              ].map(f => (
                <button key={f.id} onClick={() => setServiceFilter(f.id as any)}
                  style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1.5px solid rgba(44,36,25,0.15)', background: serviceFilter === f.id ? '#2c2419' : 'transparent', color: serviceFilter === f.id ? '#fff' : '#5c5850', transition: 'all 150ms' }}>
                  {f.label} <span style={{ opacity: 0.6 }}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          <style>{`
            .client-table { table-layout: fixed; }
            .client-table td { padding: 12px 10px; vertical-align: middle; }
            .client-table th { padding: 8px 10px; }
            .client-table tbody tr { border-bottom: 1px solid rgba(44,36,25,0.05); transition: background 150ms; cursor: pointer; }
            .client-table tbody tr:hover { background: rgba(196,112,79,0.04); }
            .client-table tbody tr:last-child { border-bottom: none; }
            .col-divider { border-right: 1px solid rgba(44,36,25,0.08) !important; }
            .client-table .col-client { width: 20%; }
            .client-table .col-svc    { width: 6%; }
            .client-table .col-leads  { width: 8%; }
            .client-table .col-forms  { width: 7%; }
            .client-table .col-kw10   { width: 7%; }
            .client-table .col-calls  { width: 8%; }
            .client-table .col-conv   { width: 7%; }
            .client-table .col-cpl    { width: 7%; }
            .client-table .col-trend  { width: 20%; }
          `}</style>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#5c5850' }}>Loading...</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#c5221f' }}>{error}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="client-table w-full" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(44,36,25,0.1)' }}>
                    <th rowSpan={2} className="col-client" style={{ textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#5c5850', letterSpacing: '0.05em' }}>Client</th>
                    <th colSpan={3} className="col-divider" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#2c2419', borderBottom: '2.5px solid #2c2419', paddingBottom: '6px' }}>Overview</th>
                    <th colSpan={1} className="col-divider" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#b45309', borderBottom: '2.5px solid #b45309', paddingBottom: '6px' }}>SEO</th>
                    <th colSpan={1} className="col-divider" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#047857', borderBottom: '2.5px solid #047857', paddingBottom: '6px' }}>GBP</th>
                    <th colSpan={3} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', borderBottom: '2.5px solid #6b7280', paddingBottom: '6px' }}>Google Ads</th>
                  </tr>
                  <tr style={{ borderBottom: '1.5px solid rgba(44,36,25,0.1)' }}>
                    <th className="col-svc" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#5c5850' }}>Svc</th>
                    <th className="col-leads" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#2c2419' }}>Leads</th>
                    <th className="col-forms col-divider" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#2c2419' }}>Forms</th>
                    <th className="col-kw10 col-divider" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#b45309' }}>KW10</th>
                    <th className="col-calls col-divider" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#047857' }}>Calls</th>
                    <th className="col-conv" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>Conv</th>
                    <th className="col-cpl" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>CPL</th>
                    <th className="col-trend" title="Ads conversions + GBP calls per day (7-day rolling avg)" style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', cursor: 'help' }}>Leads Trend ↗</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map(client => {
                    const pts = client.trendPoints && client.trendPoints.length > 1 ? client.trendPoints : null;
                    // 7-day rolling average to smooth out daily spikes
                    const smoothed = pts ? pts.map((_, i) => {
                      const w = pts.slice(Math.max(0, i - 3), i + 4);
                      return w.reduce((a, b) => a + b, 0) / w.length;
                    }) : null;
                    const maxPt = smoothed ? Math.max(...smoothed, 0.1) : 1;
                    // Compare first-half avg vs last-half avg on original (for % accuracy)
                    const midIdx = pts ? Math.floor(pts.length / 2) : 0;
                    const firstAvg = pts && midIdx > 0 ? pts.slice(0, midIdx).reduce((a, b) => a + b, 0) / midIdx : 0;
                    const lastAvg = pts ? pts.slice(midIdx).reduce((a, b) => a + b, 0) / (pts.length - midIdx) : 0;
                    const lineColor = smoothed ? (lastAvg >= firstAvg ? '#10b981' : '#ef4444') : '#9ca3af';

                    return (
                      <tr key={client.id} onClick={() => router.push(`/admin-dashboard/${client.slug}`)}
                        style={{ opacity: client.is_active ? 1 : 0.55, background: client.is_active ? 'transparent' : '#faf7f4' }}>
                        <td className="col-client">
                          <div style={{ fontWeight: 600, fontSize: '13px', color: client.is_active ? '#2c2419' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
                          {client.owner && <div style={{ fontSize: '11px', color: '#8a7f74', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.owner}</div>}
                          {client.city && <div style={{ fontSize: '11px', color: '#c4c4c4', marginTop: '1px' }}>{client.city}</div>}
                        </td>
                        <td className="col-svc" style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', flexDirection: 'column', alignItems: 'center' }}>
                            {client.services?.googleAds && <span style={{ background: '#fff7ed', color: '#c2410c', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>Ads</span>}
                            {client.services?.seo && <span style={{ background: '#f0fdf4', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>SEO</span>}
                          </div>
                        </td>
                        <td className="col-leads" style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: '15px', color: '#c4704f' }}>{fmtNum(client.total_leads)}</div>
                        </td>
                        <td className="col-forms col-divider" style={{ textAlign: 'center', fontWeight: 600, fontSize: '13px', color: '#7c3aed' }}>
                          {client.manual_form_fills ? fmtNum(client.manual_form_fills) : <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                        <td className="col-kw10 col-divider" style={{ textAlign: 'center', fontWeight: 600, fontSize: '13px', color: '#b45309' }}>
                          {client.services?.seo && client.top_keywords ? fmtNum(client.top_keywords) : <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                        <td className="col-calls col-divider" style={{ textAlign: 'center', fontWeight: 600, fontSize: '13px', color: '#047857' }}>{fmtNum(client.gbp_calls)}</td>
                        <td className="col-conv" style={{ textAlign: 'center', fontWeight: 600, fontSize: '13px', color: '#6b7280' }}>{fmtNum(client.ads_conversions)}</td>
                        <td className="col-cpl" style={{ textAlign: 'center', fontWeight: 600, fontSize: '13px', color: '#6b7280' }}>{client.ads_cpl && client.ads_cpl > 0 ? fmtCurrency(client.ads_cpl, 0) : '—'}</td>
                        <td className="col-trend" style={{ textAlign: 'center' }}>
                          {smoothed ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <svg width="80" height="24" style={{ flexShrink: 0 }}>
                                <defs>
                                  <linearGradient id={`g-${client.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
                                    <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
                                  </linearGradient>
                                </defs>
                                <polygon points={`0,24 ${smoothed.map((v, i) => `${(i / (smoothed.length - 1)) * 80},${24 - (v / maxPt) * 22}`).join(' ')} 80,24`} fill={`url(#g-${client.id})`} />
                                <polyline points={smoothed.map((v, i) => `${(i / (smoothed.length - 1)) * 80},${24 - (v / maxPt) * 22}`).join(' ')} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {firstAvg > 0 && (
                                <span style={{ fontSize: '10px', fontWeight: 700, color: lastAvg >= firstAvg ? '#059669' : '#dc2626' }}>
                                  {lastAvg >= firstAvg ? '+' : ''}{Math.min(Math.abs(Math.round((lastAvg - firstAvg) / firstAvg * 100)), 999) * (lastAvg >= firstAvg ? 1 : -1)}%
                                </span>
                              )}
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
