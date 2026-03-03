'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';
import ServiceNotActive from '@/components/admin/ServiceNotActive';
import DateRangePicker from '@/components/admin/DateRangePicker';
import { createClient } from '@supabase/supabase-js';
import { fmtNum } from '@/lib/format';

interface ClientInfo {
  id: string;
  name: string;
  slug: string;
  city: string;
  services?: { googleLocalService?: boolean };
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// ── helpers ───────────────────────────────────────────────────────────────────

const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d; };

const pickVal = (a: any, b: any): number => {
  if (a != null && a > 0) return a;
  if (b != null && b > 0) return b;
  return a ?? b ?? 0;
};

function buildLast12Months() {
  const today = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 1 - (11 - i), 1);
    const y = d.getFullYear(), m = d.getMonth();
    const lastDate = new Date(y, m + 1, 0);
    return {
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      from: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      to: `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`,
    };
  });
}

function buildPrior12Months(current: ReturnType<typeof buildLast12Months>) {
  return current.map(m => {
    const [y, mo] = m.key.split('-').map(Number);
    const d = new Date(y, mo - 1 - 12, 1);
    const yr = d.getFullYear(), month = d.getMonth();
    const lastDate = new Date(yr, month + 1, 0);
    return {
      key: `${yr}-${String(month + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      from: `${yr}-${String(month + 1).padStart(2, '0')}-01`,
      to: `${yr}-${String(month + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`,
    };
  });
}

const calcChange = (curr: number, prev: number) => {
  if (prev === 0) return { pct: '—', type: 'neutral' as const };
  const v = (curr - prev) / prev * 100;
  return {
    pct: v > 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`,
    type: (v > 0 ? 'up' : v < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
  };
};

// ── component ─────────────────────────────────────────────────────────────────

export default function GBPPage() {
  const params = useParams();
  const clientSlug = params?.clientSlug as string;

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(true);

  // Date picker state (controls dynamic sections)
  const [selectedDays, setSelectedDays] = useState<7 | 30 | 90>(30);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = yesterday();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    return { from, to };
  });

  const handlePresetDays = (days: 7 | 30 | 90) => {
    setSelectedDays(days);
    const to = yesterday();
    const from = new Date(to);
    from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  // ── 12-month monthly data (STATIC — not affected by date picker) ──────────
  const [viewsChart, setViewsChart] = useState<{ month: string; views: number; clicks: number; directions: number }[]>([]);
  const [actionsChart, setActionsChart] = useState<{ month: string; calls: number }[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // ── period data (DYNAMIC — from date picker) ──────────────────────────────
  const [periodLoading, setPeriodLoading] = useState(false);
  const [pViews, setPViews] = useState(0);
  const [pCalls, setPCalls] = useState(0);
  const [pClicks, setPClicks] = useState(0);
  const [pDir, setPDir] = useState(0);
  const [pActions, setPActions] = useState(0);
  const [pNewReviews, setPNewReviews] = useState(0);
  const [prevpViews, setPrevpViews] = useState(0);
  const [prevpCalls, setPrevpCalls] = useState(0);
  const [prevpClicks, setPrevpClicks] = useState(0);
  const [prevpDir, setPrevpDir] = useState(0);
  const [latestReviews, setLatestReviews] = useState(0);
  const [latestRating, setLatestRating] = useState(0);
  const [periodDays, setPeriodDays] = useState(30);
  const [periodDataCount, setPeriodDataCount] = useState(0);

  // ── fetch client ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!clientSlug) return;
    fetch('/api/clients/list')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const found = data.clients.find((c: any) => c.slug === clientSlug);
          if (found) setClient(found);
        }
        setLoading(false);
      });
  }, [clientSlug]);

  // ── fetch location name ───────────────────────────────────────────────────
  useEffect(() => {
    if (!client) return;
    supabase.from('gbp_locations').select('location_name').eq('client_id', client.id).single()
      .then(({ data }) => { if (data) setLocationName(data.location_name); });
  }, [client]);

  // ── fetch latest reviews/rating (once per client, independent of date range) ──
  useEffect(() => {
    if (!client) return;
    // Try gbp_location_daily_metrics first (most accurate)
    supabase.from('gbp_location_daily_metrics')
      .select('total_reviews, average_rating')
      .eq('client_id', client.id)
      .gt('total_reviews', 0)
      .order('date', { ascending: false })
      .limit(1)
      .single()
      .then(({ data: det }) => {
        if (det && (det as any).total_reviews > 0) {
          setLatestReviews((det as any).total_reviews);
          setLatestRating((det as any).average_rating ?? 0);
        } else {
          // Fallback to client_metrics_summary
          supabase.from('client_metrics_summary')
            .select('gbp_reviews_count, gbp_rating_avg')
            .eq('client_id', client.id)
            .eq('period_type', 'daily')
            .gt('gbp_reviews_count', 0)
            .order('date', { ascending: false })
            .limit(1)
            .single()
            .then(({ data: sum }) => {
              if (sum && (sum as any).gbp_reviews_count > 0) {
                setLatestReviews((sum as any).gbp_reviews_count);
                setLatestRating((sum as any).gbp_rating_avg ?? 0);
              }
            });
        }
      });
  }, [client]);

  // ── fetch 12-month data (once per client) ─────────────────────────────────
  useEffect(() => {
    if (!client) return;
    setMonthlyLoading(true);
    const current12 = buildLast12Months();
    const prior12 = buildPrior12Months(current12);
    const overallFrom = prior12[0].from;
    const overallTo = current12[11].to;

    Promise.all([
      supabase.from('gbp_location_daily_metrics')
        .select('date, views, phone_calls, website_clicks, direction_requests')
        .eq('client_id', client.id).gte('date', overallFrom).lte('date', overallTo),
      supabase.from('client_metrics_summary')
        .select('date, gbp_profile_views, gbp_calls, gbp_website_clicks, gbp_directions')
        .eq('client_id', client.id).eq('period_type', 'daily')
        .gte('date', overallFrom).lte('date', overallTo),
    ]).then(([{ data: det }, { data: sum }]) => {
      const detMap = new Map<string, any>(); (det || []).forEach((r: any) => detMap.set(r.date, r));
      const sumMap = new Map<string, any>(); (sum || []).forEach((r: any) => sumMap.set(r.date, r));
      const allDates = Array.from(new Set([...(det || []).map((r: any) => r.date), ...(sum || []).map((r: any) => r.date)]));

      const buckets = new Map<string, { views: number; calls: number; clicks: number; directions: number }>();
      current12.forEach(m => buckets.set(m.key, { views: 0, calls: 0, clicks: 0, directions: 0 }));

      for (const date of allDates) {
        const mk = date.slice(0, 7);
        if (!buckets.has(mk)) continue;
        const d = detMap.get(date), s = sumMap.get(date);
        const v = pickVal(d?.views, s?.gbp_profile_views);
        const c = pickVal(d?.phone_calls, s?.gbp_calls);
        const cl = pickVal(d?.website_clicks, s?.gbp_website_clicks);
        const dir = pickVal(d?.direction_requests, s?.gbp_directions);
        if (v === 0 && c === 0 && cl === 0 && dir === 0) continue;
        const b = buckets.get(mk)!;
        b.views += v; b.calls += c; b.clicks += cl; b.directions += dir;
      }

      setViewsChart(current12.map(m => {
        const b = buckets.get(m.key)!;
        return { month: m.label, views: b.views, clicks: b.clicks, directions: b.directions };
      }));
      setActionsChart(current12.map(m => {
        const b = buckets.get(m.key)!;
        return { month: m.label, calls: b.calls };
      }));
      setMonthlyLoading(false);
    });
  }, [client]);

  // ── fetch period data (re-runs on date change) ────────────────────────────
  useEffect(() => {
    if (!client) return;
    setPeriodLoading(true);
    const effectiveTo = dateRange.to > yesterday() ? yesterday() : dateRange.to;
    const fromISO = dateRange.from.toISOString().split('T')[0];
    const toISO = effectiveTo.toISOString().split('T')[0];
    const days = Math.round((effectiveTo.getTime() - dateRange.from.getTime()) / 86400000);
    setPeriodDays(days);

    const prevTo = new Date(dateRange.from); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - days);
    const prevFromISO = prevFrom.toISOString().split('T')[0];
    const prevToISO = prevTo.toISOString().split('T')[0];

    Promise.all([
      // current period
      supabase.from('gbp_location_daily_metrics')
        .select('date, views, phone_calls, website_clicks, direction_requests, new_reviews_today, total_reviews, average_rating')
        .eq('client_id', client.id).gte('date', fromISO).lte('date', toISO),
      supabase.from('client_metrics_summary')
        .select('date, gbp_profile_views, gbp_calls, gbp_website_clicks, gbp_directions, gbp_reviews_new, gbp_reviews_count, gbp_rating_avg')
        .eq('client_id', client.id).eq('period_type', 'daily').gte('date', fromISO).lte('date', toISO),
      // previous period
      supabase.from('gbp_location_daily_metrics')
        .select('date, views, phone_calls, website_clicks, direction_requests')
        .eq('client_id', client.id).gte('date', prevFromISO).lte('date', prevToISO),
      supabase.from('client_metrics_summary')
        .select('date, gbp_profile_views, gbp_calls, gbp_website_clicks, gbp_directions')
        .eq('client_id', client.id).eq('period_type', 'daily').gte('date', prevFromISO).lte('date', prevToISO),
    ]).then(([{ data: det }, { data: sum }, { data: pDet }, { data: pSum }]) => {
      const detMap = new Map<string, any>(); (det || []).forEach((r: any) => detMap.set(r.date, r));
      const sumMap = new Map<string, any>(); (sum || []).forEach((r: any) => sumMap.set(r.date, r));

      const allDates = Array.from(new Set([...(det || []).map((r: any) => r.date), ...(sum || []).map((r: any) => r.date)])).sort();

      let totViews = 0, totCalls = 0, totClicks = 0, totDir = 0, totNewRev = 0, dataRows = 0;

      for (const date of allDates) {
        const d = detMap.get(date), s = sumMap.get(date);
        const v = pickVal(d?.views, s?.gbp_profile_views);
        const c = pickVal(d?.phone_calls, s?.gbp_calls);
        const cl = pickVal(d?.website_clicks, s?.gbp_website_clicks);
        const dir = pickVal(d?.direction_requests, s?.gbp_directions);
        if (v === 0 && c === 0 && cl === 0 && dir === 0) continue;
        totViews += v; totCalls += c; totClicks += cl; totDir += dir;
        totNewRev += pickVal(d?.new_reviews_today, s?.gbp_reviews_new);
        dataRows++;
      }

      setPViews(totViews); setPCalls(totCalls); setPClicks(totClicks); setPDir(totDir);
      setPActions(totCalls + totClicks + totDir); setPNewReviews(totNewRev);
      setPeriodDataCount(dataRows);

      // previous period
      const pDetMap = new Map<string, any>(); (pDet || []).forEach((r: any) => pDetMap.set(r.date, r));
      const pSumMap = new Map<string, any>(); (pSum || []).forEach((r: any) => pSumMap.set(r.date, r));
      const pAllDates = Array.from(new Set([...(pDet || []).map((r: any) => r.date), ...(pSum || []).map((r: any) => r.date)]));
      let pv = 0, pc = 0, pcl = 0, pd = 0;
      for (const date of pAllDates) {
        const d = pDetMap.get(date), s = pSumMap.get(date);
        pv += pickVal(d?.views, s?.gbp_profile_views);
        pc += pickVal(d?.phone_calls, s?.gbp_calls);
        pcl += pickVal(d?.website_clicks, s?.gbp_website_clicks);
        pd += pickVal(d?.direction_requests, s?.gbp_directions);
      }
      setPrevpViews(pv); setPrevpCalls(pc); setPrevpClicks(pcl); setPrevpDir(pd);
      setPeriodLoading(false);
    });
  }, [client, dateRange]);

  // ── guards ────────────────────────────────────────────────────────────────
  if (loading || !client) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #f3f3f3', borderTop: '3px solid #c4704f', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#2c2419', opacity: 0.6 }}>Loading…</p>
        </div>
        <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (client?.services?.googleLocalService === false) {
    return (
      <AdminLayout>
        <ClientTabBar clientSlug={clientSlug} clientName={client.name} clientCity={client.city} activeTab="gbp" />
        <ServiceNotActive serviceName="Google Business Profile" description="Contact our team to set up GBP tracking." />
      </AdminLayout>
    );
  }

  // ── derived ───────────────────────────────────────────────────────────────
  const momViews = calcChange(pViews, prevpViews);
  const momCalls = calcChange(pCalls, prevpCalls);
  const momClicks = calcChange(pClicks, prevpClicks);
  const momDir = calcChange(pDir, prevpDir);

  const engRate = pViews > 0 ? ((pActions / pViews) * 100).toFixed(2) : '0.00';
  const callConv = pViews > 0 ? ((pCalls / pViews) * 100).toFixed(2) : '0.00';
  const callsPct = pActions > 0 ? ((pCalls / pActions) * 100).toFixed(1) : '0';
  const clicksPct = pActions > 0 ? ((pClicks / pActions) * 100).toFixed(1) : '0';
  const dirPct = pActions > 0 ? ((pDir / pActions) * 100).toFixed(1) : '0';

  const noPeriodData = !periodLoading && pViews === 0 && pCalls === 0 && pClicks === 0 && pDir === 0;

  const momBadge = (mom: ReturnType<typeof calcChange>, suffix: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: mom.type === 'up' ? '#10b981' : mom.type === 'down' ? '#ef4444' : '#9ca3af' }}>
        {mom.type === 'up' ? '▲' : mom.type === 'down' ? '▼' : ''} {mom.pct}
      </span>
      <span style={{ fontSize: '10px', color: '#9ca3af' }}>{suffix}</span>
    </div>
  );

  const card = { background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' };
  const bigCard = { ...card, borderRadius: '24px', padding: '24px' };
  const spinner = (h = 240) => (
    <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '3px solid #f3f3f3', borderTop: '3px solid #c4704f', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} clientName={client.name} clientCity={client.city} activeTab="gbp" />
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── Date Controls (sticky, same as other tabs) ────────────────── */}
        <div className="sticky top-14 md:top-0 z-30 flex items-center justify-end gap-3 mb-6 px-8 py-3"
          style={{ background: 'rgba(245,241,237,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
          <div className="flex gap-1 p-1 rounded-full" style={{ background: 'rgba(44,36,25,0.05)' }}>
            {([7, 30, 90] as const).map(d => (
              <button key={d} onClick={() => handlePresetDays(d)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition"
                style={{ background: d === selectedDays ? '#fff' : 'transparent', color: d === selectedDays ? '#2c2419' : '#5c5850', cursor: 'pointer' }}>
                {d}d
              </button>
            ))}
          </div>
          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.15em' }}>LOCAL SEO</span>
          <h1 className="text-4xl font-black mt-2" style={{ color: '#2c2419', letterSpacing: '-0.02em' }}>Google Business Profile</h1>
          <p className="text-sm mt-2" style={{ color: '#9ca3af' }}>{locationName || 'Local visibility and customer engagement metrics'}</p>
        </div>

        {/* GBP data note */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '24px', padding: '8px 14px', background: 'rgba(217,168,84,0.08)', border: '1px solid rgba(217,168,84,0.25)', borderRadius: '8px', fontSize: '12px', color: '#92702a' }}>
          <span style={{ fontWeight: 700 }}>ℹ️ GBP data:</span>
          Phone calls = button taps (includes unanswered). Synced daily — days with no API response excluded automatically.
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 1 — MONTHLY TREND (FIXED 12 MONTHS, not date-range)
            ═══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: 0 }}>Monthly Performance</h2>
            <span style={{ fontSize: '11px', color: '#9ca3af', background: 'rgba(44,36,25,0.06)', padding: '2px 10px', borderRadius: '100px', fontWeight: 500 }}>
              Last 12 months · not affected by date filter
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Profile Views — line */}
            <div style={bigCard}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 4px 0' }}>Monthly Trend</p>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0' }}>Views · Clicks · Directions</h3>
              {monthlyLoading ? spinner(220) : (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={viewsChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,36,25,0.08)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#5c5850' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#5c5850' }} width={40} />
                      <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '8px', fontSize: '11px' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                      <Line type="monotone" dataKey="views" stroke="#9db5a0" strokeWidth={2.5} dot={{ r: 3, fill: '#9db5a0' }} name="Views" />
                      <Line type="monotone" dataKey="clicks" stroke="#d9a854" strokeWidth={2} dot={{ r: 2, fill: '#d9a854' }} name="Web Clicks" />
                      <Line type="monotone" dataKey="directions" stroke="#c4704f" strokeWidth={2} dot={{ r: 2, fill: '#c4704f' }} name="Directions" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Calls · Clicks · Directions — stacked bar */}
            <div style={bigCard}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 4px 0' }}>Monthly Actions</p>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0' }}>Phone Calls</h3>
              {monthlyLoading ? spinner(220) : (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={actionsChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,36,25,0.08)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#5c5850' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#5c5850' }} width={40} />
                      <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '8px', fontSize: '11px' }} />
                      <Bar dataKey="calls" name="Calls" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTIONS 2–5 — DYNAMIC (from date picker)
            ═══════════════════════════════════════════════════════════════ */}

        {noPeriodData ? (
          <div style={{ textAlign: 'center', padding: '48px', background: 'rgba(255,255,255,0.9)', borderRadius: 16, color: '#9ca3af' }}>
            <p style={{ fontSize: 15, marginBottom: 6 }}>No GBP data for this period</p>
            <p style={{ fontSize: 12 }}>Try selecting an earlier range — GBP data typically has a 3–7 day lag.</p>
          </div>
        ) : (
          <>
            {periodLoading ? spinner(200) : (
              <>
                {/* ── SECTION 2: Phone Calls — featured ──────────────────── */}
                <div style={{ ...bigCard, marginBottom: '20px', background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(157,181,160,0.04))', border: '1.5px solid rgba(16,185,129,0.18)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#5c5850', margin: 0 }}>Phone Calls</p>
                        <span title="Times customers tapped the call button — includes unanswered calls" style={{ fontSize: '11px', color: '#9ca3af', cursor: 'help' }}>ⓘ</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
                        <span style={{ fontSize: '56px', fontWeight: 900, color: '#10b981', lineHeight: 1, letterSpacing: '-0.02em' }}>{fmtNum(pCalls)}</span>
                        <div>
                          {momBadge(momCalls, `vs prev ${periodDays}d`)}
                          <p style={{ fontSize: '11px', color: '#5c5850', margin: '6px 0 0' }}>
                            Call conversion: <strong>{callConv}%</strong> of profile views
                          </p>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', minWidth: '260px' }}>
                      {[
                        { label: 'Share of Actions', val: `${callsPct}%`, color: '#10b981' },
                        { label: 'Avg / Day', val: periodDataCount > 0 ? (pCalls / periodDataCount).toFixed(1) : '0', color: '#10b981' },
                        { label: 'Call Conversion', val: `${callConv}%`, color: '#10b981' },
                      ].map(item => (
                        <div key={item.label} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                          <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600 }}>{item.label}</p>
                          <p style={{ fontSize: '20px', fontWeight: 700, color: item.color, margin: 0 }}>{item.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── SECTION 3: Views · Clicks · Directions ──────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '24px' }}>
                  {[
                    { label: 'Profile Views', val: pViews, mom: momViews, color: '#9db5a0', sub: `Avg ${periodDataCount > 0 ? Math.round(pViews / periodDataCount) : 0}/day` },
                    { label: 'Website Clicks', val: pClicks, mom: momClicks, color: '#d9a854', sub: `${clicksPct}% of actions` },
                    { label: 'Directions', val: pDir, mom: momDir, color: '#c4704f', sub: `${dirPct}% of actions` },
                  ].map(item => (
                    <div key={item.label} style={card}>
                      <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: 600, margin: '0 0 8px 0', textTransform: 'uppercase' }}>{item.label}</p>
                      <p style={{ fontSize: '32px', fontWeight: 700, color: item.color, margin: '0 0 6px 0' }}>{fmtNum(item.val)}</p>
                      {momBadge(item.mom, `vs prev ${periodDays}d`)}
                      <p style={{ fontSize: '10px', color: '#9ca3af', margin: '6px 0 0 0' }}>{item.sub}</p>
                    </div>
                  ))}
                </div>

                {/* ── SECTION 4: Action Breakdown + Reviews ───────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: latestReviews > 0 || latestRating > 0 ? '1fr 1fr' : '1fr', gap: '20px', marginBottom: '24px' }}>
                  {/* Action breakdown */}
                  <div style={bigCard}>
                    <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 4px 0' }}>Customer Actions</p>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0' }}>Total: {fmtNum(pActions)}</h3>
                    {[
                      { label: 'Phone Calls', val: pCalls, pct: callsPct, color: '#10b981' },
                      { label: 'Website Clicks', val: pClicks, pct: clicksPct, color: '#d9a854' },
                      { label: 'Direction Requests', val: pDir, pct: dirPct, color: '#c4704f' },
                    ].map(item => (
                      <div key={item.label} style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', color: '#5c5850' }}>{item.label}</span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: item.color }}>
                            {fmtNum(item.val)} <span style={{ fontWeight: 400, color: '#9ca3af' }}>({item.pct}%)</span>
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(44,36,25,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: '4px' }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                      <div style={{ background: 'rgba(16,185,129,0.06)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                        <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 2px 0', fontWeight: 600 }}>Engagement Rate</p>
                        <p style={{ fontSize: '20px', fontWeight: 700, color: '#10b981', margin: '0 0 2px 0' }}>{engRate}%</p>
                        <p style={{ fontSize: '9px', fontWeight: 600, margin: 0, color: parseFloat(engRate) >= 8 ? '#d9a854' : parseFloat(engRate) >= 3 ? '#10b981' : '#ef4444' }}>
                          {parseFloat(engRate) >= 8 ? 'Excellent' : parseFloat(engRate) >= 3 ? 'Good' : 'Below avg'}
                        </p>
                      </div>
                      <div style={{ background: 'rgba(217,168,84,0.06)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                        <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 2px 0', fontWeight: 600 }}>Call Conversion</p>
                        <p style={{ fontSize: '20px', fontWeight: 700, color: '#d9a854', margin: 0 }}>{callConv}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Reviews — only render if we have real data */}
                  {latestReviews > 0 || latestRating > 0 ? (
                    <div style={bigCard}>
                      <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 4px 0' }}>Reviews & Reputation</p>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0' }}>Customer Feedback</h3>
                      <div style={{ background: 'linear-gradient(135deg,rgba(217,168,84,0.15),rgba(196,112,79,0.12))', borderRadius: '14px', padding: '20px', textAlign: 'center', marginBottom: '16px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#5c5850', margin: '0 0 6px 0', textTransform: 'uppercase' }}>Average Rating</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '44px', fontWeight: 800, color: '#d9a854', lineHeight: 1 }}>{latestRating.toFixed(1)}</span>
                          <span style={{ fontSize: '20px', color: '#d9a854' }}>/ 5</span>
                        </div>
                        <div style={{ marginTop: '6px' }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <span key={s} style={{ fontSize: '18px', color: s <= Math.round(latestRating) ? '#d9a854' : '#e5e5e5' }}>★</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '10px', padding: '14px', borderLeft: '3px solid #10b981' }}>
                          <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600 }}>Total Reviews</p>
                          <p style={{ fontSize: '26px', fontWeight: 700, color: '#10b981', margin: 0 }}>{fmtNum(latestReviews)}</p>
                        </div>
                        {pNewReviews > 0 && (
                          <div style={{ background: 'rgba(157,181,160,0.08)', borderRadius: '10px', padding: '14px', borderLeft: '3px solid #9db5a0' }}>
                            <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600 }}>New (this period)</p>
                            <p style={{ fontSize: '26px', fontWeight: 700, color: '#9db5a0', margin: 0 }}>{fmtNum(pNewReviews)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* ── SECTION 5: Key Insights ──────────────────────────────── */}
                <div style={{ ...bigCard, marginBottom: '32px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 10px 0' }}>
                    GBP Key Insights
                  </p>
                  <p style={{ fontSize: '12px', color: '#5c5850', margin: 0, lineHeight: '1.7' }}>
                    In the last <strong>{periodDays} days</strong>, your Google Business Profile received <strong>{fmtNum(pViews)} profile views</strong> and generated{' '}
                    <strong>{fmtNum(pCalls)} phone calls</strong> — a <strong>{callConv}% call conversion rate</strong>.
                    Customers also visited your website <strong>{fmtNum(pClicks)} times</strong> and requested directions <strong>{fmtNum(pDir)} times</strong>.
                    Overall engagement rate: <strong>{engRate}%</strong>.
                    {latestRating > 0 && <> Business maintains a <strong>{latestRating.toFixed(1)}-star</strong> rating across <strong>{fmtNum(latestReviews)} reviews</strong>{pNewReviews > 0 ? `, with ${fmtNum(pNewReviews)} new this period` : ''}.</>}
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
