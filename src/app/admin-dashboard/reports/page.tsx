'use client';

import { useEffect, useState, useMemo } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import DateRangePicker from '@/components/admin/DateRangePicker';
import { fmtNum, fmtCurrency, toLocalDateStr } from '@/lib/format';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, ArrowUp, ArrowDown,
  Users, Phone, DollarSign, MousePointer, Trophy, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  city: string;
  is_active: boolean;
  // current period
  leads: number;
  gbp_calls: number;
  sessions: number;
  ad_spend: number;
  cpl: number;
  // previous period
  prev_leads: number;
  prev_gbp_calls: number;
  prev_sessions: number;
  prev_ad_spend: number;
}

interface TrendPoint {
  date: string;
  leads: number;
  calls: number;
  sessions: number;
}

type SortKey = 'name' | 'city' | 'leads' | 'gbp_calls' | 'sessions' | 'ad_spend' | 'cpl';

function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur > 0 ? 100 : null;
  return ((cur - prev) / prev) * 100;
}

function StatusBadge({ cur, prev }: { cur: number; prev: number }) {
  const pct = pctChange(cur, prev);
  if (pct === null) return <span style={{ color: '#9ca3af', fontSize: '12px' }}>—</span>;
  if (pct > 5) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#10b981', fontSize: '12px', fontWeight: 600 }}>
        <ArrowUp size={11} /> {Math.abs(Math.round(pct))}%
      </span>
    );
  }
  if (pct < -5) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#ef4444', fontSize: '12px', fontWeight: 600 }}>
        <ArrowDown size={11} /> {Math.abs(Math.round(pct))}%
      </span>
    );
  }
  return <span style={{ color: '#9ca3af', fontSize: '12px', fontWeight: 500 }}>flat</span>;
}

export default function AgencyReportsPage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('leads');
  const [sortAsc, setSortAsc] = useState(false);

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
  });

  useEffect(() => {
    fetchData(dateRange);
  }, [dateRange]);

  const fetchData = async (range: { from: Date; to: Date }) => {
    const dateFrom = toLocalDateStr(range.from);
    const dateTo = toLocalDateStr(range.to);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports-data?from=${dateFrom}&to=${dateTo}`);
      const payload = await res.json();
      if (!payload?.success) {
        console.error('[Reports] fetch failed:', payload?.error);
        return;
      }
      const clientsData = payload.clients || [];
      const currMetrics = payload.currMetrics || [];
      const prevMetrics = payload.prevMetrics || [];
      const trendData = payload.trendData || [];

      // Aggregate current metrics by client
      const currMap: Record<string, { leads: number; gbp_calls: number; sessions: number; ad_spend: number; ads_conv: number; fb_spend: number; fb_leads: number }> = {};
      (currMetrics || []).forEach((m: any) => {
        if (!currMap[m.client_id]) currMap[m.client_id] = { leads: 0, gbp_calls: 0, sessions: 0, ad_spend: 0, ads_conv: 0, fb_spend: 0, fb_leads: 0 };
        currMap[m.client_id].leads += m.total_leads || 0;
        currMap[m.client_id].gbp_calls += m.gbp_calls || 0;
        currMap[m.client_id].sessions += m.sessions || 0;
        currMap[m.client_id].ad_spend += m.ad_spend || 0;
        currMap[m.client_id].ads_conv += m.google_ads_conversions || 0;
        currMap[m.client_id].fb_spend += m.fb_spend || 0;
        currMap[m.client_id].fb_leads += m.fb_leads || 0;
      });

      // Aggregate previous metrics by client
      const prevMap: Record<string, { leads: number; gbp_calls: number; sessions: number; ad_spend: number; fb_spend: number }> = {};
      (prevMetrics || []).forEach((m: any) => {
        if (!prevMap[m.client_id]) prevMap[m.client_id] = { leads: 0, gbp_calls: 0, sessions: 0, ad_spend: 0, fb_spend: 0 };
        prevMap[m.client_id].leads += m.total_leads || 0;
        prevMap[m.client_id].gbp_calls += m.gbp_calls || 0;
        prevMap[m.client_id].sessions += m.sessions || 0;
        prevMap[m.client_id].ad_spend += m.ad_spend || 0;
        prevMap[m.client_id].fb_spend += m.fb_spend || 0;
      });

      // Build client rows
      const rows: ClientRow[] = clientsData.map((c: any) => {
        const cur = currMap[c.id] || { leads: 0, gbp_calls: 0, sessions: 0, ad_spend: 0, ads_conv: 0 };
        const prev = prevMap[c.id] || { leads: 0, gbp_calls: 0, sessions: 0, ad_spend: 0 };
        const cpl = cur.ads_conv > 0 ? cur.ad_spend / cur.ads_conv : 0;
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          city: c.city || '',
          is_active: c.is_active,
          leads: cur.leads,
          gbp_calls: cur.gbp_calls,
          sessions: cur.sessions,
          ad_spend: cur.ad_spend,
          cpl,
          prev_leads: prev.leads,
          prev_gbp_calls: prev.gbp_calls,
          prev_sessions: prev.sessions,
          prev_ad_spend: prev.ad_spend,
        };
      });

      setClients(rows);

      // Aggregate trend by date (all clients combined)
      const trendMap: Record<string, { leads: number; calls: number; sessions: number }> = {};
      (trendData || []).forEach((m: any) => {
        if (!trendMap[m.date]) trendMap[m.date] = { leads: 0, calls: 0, sessions: 0 };
        trendMap[m.date].leads += m.total_leads || 0;
        trendMap[m.date].calls += m.gbp_calls || 0;
        trendMap[m.date].sessions += m.sessions || 0;
      });

      // Group by week for readability
      const weekMap: Record<string, { leads: number; calls: number; sessions: number; count: number }> = {};
      Object.entries(trendMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, vals]) => {
        const d = new Date(date + 'T12:00:00');
        const dayOfWeek = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const weekKey = toLocalDateStr(monday);
        if (!weekMap[weekKey]) weekMap[weekKey] = { leads: 0, calls: 0, sessions: 0, count: 0 };
        weekMap[weekKey].leads += vals.leads;
        weekMap[weekKey].calls += vals.calls;
        weekMap[weekKey].sessions += vals.sessions;
        weekMap[weekKey].count += 1;
      });

      const trendPoints: TrendPoint[] = Object.entries(weekMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date: date.slice(5), // MM-DD format
          leads: vals.leads,
          calls: vals.calls,
          sessions: Math.round(vals.sessions / 7), // avg daily sessions
        }));

      setTrend(trendPoints);
    } finally {
      setLoading(false);
    }
  };

  // Totals
  const totals = useMemo(() => {
    const t = clients.reduce(
      (acc, c) => ({
        leads: acc.leads + c.leads,
        gbp_calls: acc.gbp_calls + c.gbp_calls,
        sessions: acc.sessions + c.sessions,
        ad_spend: acc.ad_spend + c.ad_spend,
      }),
      { leads: 0, gbp_calls: 0, sessions: 0, ad_spend: 0 }
    );
    const totalAdsConv = clients.reduce((acc, c) => acc + (c.cpl > 0 ? c.ad_spend / c.cpl : 0), 0);
    const avgCpl = totalAdsConv > 0 ? t.ad_spend / totalAdsConv : 0;
    return { ...t, avgCpl };
  }, [clients]);

  // Sorted clients
  const sorted = useMemo(() => {
    return [...clients].sort((a, b) => {
      let va: any = a[sortKey];
      let vb: any = b[sortKey];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [clients, sortKey, sortAsc]);

  // Top/Bottom performers by leads
  const topPerformers = useMemo(
    () => [...clients].sort((a, b) => b.leads - a.leads).slice(0, 5),
    [clients]
  );
  const bottomPerformers = useMemo(
    () => [...clients].filter(c => c.leads > 0).sort((a, b) => a.leads - b.leads).slice(0, 5),
    [clients]
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span style={{ color: '#d1c9be', marginLeft: 4 }}>↕</span>;
    return <span style={{ color: '#c4704f', marginLeft: 4 }}>{sortAsc ? '↑' : '↓'}</span>;
  };

  const cardStyle = {
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(10px)',
    borderRadius: 12,
    padding: '20px 24px',
    border: '1px solid rgba(44,36,25,0.08)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#9ca3af',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    background: 'rgba(249,247,244,0.8)',
    borderBottom: '1px solid rgba(44,36,25,0.08)',
    cursor: 'pointer',
    userSelect: 'none',
  };

  const tdStyle: React.CSSProperties = {
    padding: '11px 14px',
    fontSize: '13px',
    color: '#2c2419',
    borderBottom: '1px solid rgba(44,36,25,0.05)',
    whiteSpace: 'nowrap',
  };

  if (loading) {
    return (
      <AdminLayout>
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '3px solid #f3f3f3', borderTop: '3px solid #c4704f', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#2c2419', opacity: 0.6 }}>Loading agency report...</p>
          </div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#2c2419', margin: 0, letterSpacing: '-0.02em' }}>
              Agency Report
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9ca3af' }}>
              Performance overview across all {clients.length} active clients
            </p>
          </div>
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>

        {/* ── TIER 1: Top KPI Summary Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
          {[
            {
              label: 'Total Leads',
              value: fmtNum(totals.leads),
              icon: <Users size={18} />,
              color: '#c4704f',
              bg: 'rgba(196,112,79,0.08)',
            },
            {
              label: 'Total Ad Spend',
              value: fmtCurrency(totals.ad_spend, 0),
              icon: <DollarSign size={18} />,
              color: '#d9a854',
              bg: 'rgba(217,168,84,0.08)',
            },
            {
              label: 'Total GBP Calls',
              value: fmtNum(totals.gbp_calls),
              icon: <Phone size={18} />,
              color: '#9db5a0',
              bg: 'rgba(157,181,160,0.12)',
            },
            {
              label: 'Avg CPL',
              value: totals.avgCpl > 0 ? fmtCurrency(totals.avgCpl, 0) : '—',
              icon: <TrendingUp size={18} />,
              color: '#6b7280',
              bg: 'rgba(107,114,128,0.08)',
            },
            {
              label: 'Total Sessions',
              value: fmtNum(totals.sessions),
              icon: <MousePointer size={18} />,
              color: '#8b5cf6',
              bg: 'rgba(139,92,246,0.08)',
            },
          ].map(kpi => (
            <div key={kpi.label} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af' }}>
                  {kpi.label}
                </span>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: kpi.bg, color: kpi.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {kpi.icon}
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#2c2419', letterSpacing: '-0.02em' }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── TIER 2: Trend Chart ── */}
        <div style={{ ...cardStyle, marginBottom: 28 }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#2c2419', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            All-Client Trends (Last 90 Days · Weekly)
          </h2>
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 20px' }}>
            Leads, GBP Calls, and Avg Daily Sessions aggregated across all clients
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend} margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,36,25,0.08)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="leads" name="Leads" stroke="#c4704f" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="calls" name="GBP Calls" stroke="#9db5a0" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sessions" name="Avg Daily Sessions" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── TIER 3: Top/Bottom Performers ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
          {/* Top 5 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trophy size={14} />
              </span>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#2c2419', margin: 0 }}>
                Top 5 by Leads
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topPerformers.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? '#d9a854' : 'rgba(44,36,25,0.06)', color: i === 0 ? '#fff' : '#9ca3af', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/admin-dashboard/${c.slug}`} style={{ fontSize: '13px', fontWeight: 600, color: '#2c2419', textDecoration: 'none' }}>
                      {c.name}
                    </Link>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{c.city}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>{fmtNum(c.leads)}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>leads</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom 5 / Needs Attention */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={14} />
              </span>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#2c2419', margin: 0 }}>
                Needs Attention (Lowest Leads)
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bottomPerformers.length === 0
                ? <p style={{ fontSize: '13px', color: '#9ca3af' }}>No data available</p>
                : bottomPerformers.map((c, i) => {
                    const pct = pctChange(c.leads, c.prev_leads);
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link href={`/admin-dashboard/${c.slug}`} style={{ fontSize: '13px', fontWeight: 600, color: '#2c2419', textDecoration: 'none' }}>
                            {c.name}
                          </Link>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>{c.city}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>{fmtNum(c.leads)}</div>
                          {pct !== null && (
                            <div style={{ fontSize: '11px', color: pct < 0 ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                              {pct < 0 ? <ArrowDown size={10} /> : <ArrowUp size={10} />}
                              {Math.abs(Math.round(pct))}% vs prev
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>

        {/* ── TIER 4: Client Performance Table ── */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#2c2419', margin: 0 }}>
              All Clients — Performance Table
            </h2>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '3px 0 0' }}>
              Click any column header to sort · Status shows change vs prior period
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {(
                    [
                      { key: 'name', label: 'Client' },
                      { key: 'city', label: 'City' },
                      { key: 'leads', label: 'Leads' },
                      { key: 'gbp_calls', label: 'GBP Calls' },
                      { key: 'sessions', label: 'Sessions' },
                      { key: 'ad_spend', label: 'Ad Spend' },
                      { key: 'cpl', label: 'CPL' },
                    ] as { key: SortKey; label: string }[]
                  ).map(col => (
                    <th key={col.key} style={thStyle} onClick={() => handleSort(col.key)}>
                      {col.label}<SortIcon col={col.key} />
                    </th>
                  ))}
                  <th style={{ ...thStyle, cursor: 'default' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, idx) => {
                  const rowBg = idx % 2 === 0 ? 'transparent' : 'rgba(249,247,244,0.5)';
                  const nameColor = c.leads > 0 ? '#2c2419' : '#9ca3af';
                  return (
                    <tr key={c.id} style={{ background: rowBg }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        <Link
                          href={`/admin-dashboard/${c.slug}`}
                          style={{ color: nameColor, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td style={{ ...tdStyle, color: '#6b7280', fontSize: '12px' }}>{c.city}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>
                        <span style={{ color: c.leads > 0 ? '#2c2419' : '#d1c9be' }}>{fmtNum(c.leads)}</span>
                      </td>
                      <td style={tdStyle}>{fmtNum(c.gbp_calls)}</td>
                      <td style={tdStyle}>{fmtNum(c.sessions)}</td>
                      <td style={tdStyle}>{c.ad_spend > 0 ? fmtCurrency(c.ad_spend, 0) : '—'}</td>
                      <td style={tdStyle}>{c.cpl > 0 ? fmtCurrency(c.cpl, 0) : '—'}</td>
                      <td style={tdStyle}>
                        <StatusBadge cur={c.leads} prev={c.prev_leads} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr style={{ background: 'rgba(196,112,79,0.04)', borderTop: '2px solid rgba(196,112,79,0.15)' }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#c4704f' }} colSpan={2}>TOTAL</td>
                  <td style={{ ...tdStyle, fontWeight: 800, color: '#c4704f' }}>{fmtNum(totals.leads)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtNum(totals.gbp_calls)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtNum(totals.sessions)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtCurrency(totals.ad_spend, 0)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{totals.avgCpl > 0 ? fmtCurrency(totals.avgCpl, 0) : '—'}</td>
                  <td style={tdStyle} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
