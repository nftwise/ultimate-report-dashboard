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

interface MonthlyGBP {
  monthKey: string;
  monthLabel: string;
  views: number;
  calls: number;
  clicks: number;
  directions: number;
  newReviews: number;
}

interface DailyGBP {
  date: string;
  views: number;
  calls: number;
  clicks: number;
  directions: number;
  actions: number;
  newReviews: number;
  totalReviews: number;
  avgRating: number;
  businessPhotoViews: number;
  customerPhotoViews: number;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// ── helpers ──────────────────────────────────────────────────────────────────

function buildLast12Months(): { key: string; label: string; from: string; to: string }[] {
  const today = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - 1 - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const firstDay = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lastDayDate = new Date(y, m + 1, 0);
    const lastDay = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    months.push({ key: `${y}-${String(m + 1).padStart(2, '0')}`, label, from: firstDay, to: lastDay });
  }
  return months;
}

function buildPrior12Months(current: { key: string; from: string; to: string }[]): { key: string; label: string; from: string; to: string }[] {
  return current.map(m => {
    const [y, mo] = m.key.split('-').map(Number);
    const d = new Date(y, mo - 1 - 12, 1);
    const yr = d.getFullYear();
    const month = d.getMonth();
    const firstDay = `${yr}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDayDate = new Date(yr, month + 1, 0);
    const lastDay = `${yr}-${String(month + 1).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    return { key: `${yr}-${String(month + 1).padStart(2, '0')}`, label, from: firstDay, to: lastDay };
  });
}

const pickVal = (a: any, b: any): number => {
  if (a != null && a > 0) return a;
  if (b != null && b > 0) return b;
  return a ?? b ?? 0;
};

const yesterday = (): Date => { const d = new Date(); d.setDate(d.getDate() - 1); return d; };

// ── component ─────────────────────────────────────────────────────────────────

export default function GBPPage() {
  const params = useParams();
  const clientSlug = params?.clientSlug as string;

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(true);

  // Fixed 12-month monthly data
  const [monthlyData, setMonthlyData] = useState<MonthlyGBP[]>([]);
  const [prevMonthlyData, setPrevMonthlyData] = useState<MonthlyGBP[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Date-range period data
  const [selectedDays, setSelectedDays] = useState<7 | 30 | 90>(30);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = yesterday();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    return { from, to };
  });
  const [periodData, setPeriodData] = useState<DailyGBP[]>([]);
  const [prevPeriodData, setPrevPeriodData] = useState<DailyGBP[]>([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [latestReviews, setLatestReviews] = useState(0);
  const [latestRating, setLatestRating] = useState(0);

  const handlePreset = (days: 7 | 30 | 90) => {
    setSelectedDays(days);
    const to = yesterday();
    const from = new Date(to);
    from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  // ── fetch client ──────────────────────────────────────────────────────────

  useEffect(() => {
    const fetch_ = async () => {
      const res = await fetch('/api/clients/list');
      const data = await res.json();
      if (data.success) {
        const found = data.clients.find((c: any) => c.slug === clientSlug);
        if (found) setClient(found);
      }
      setLoading(false);
    };
    if (clientSlug) fetch_();
  }, [clientSlug]);

  // ── fetch location name ───────────────────────────────────────────────────

  useEffect(() => {
    if (!client) return;
    supabase.from('gbp_locations').select('location_name').eq('client_id', client.id).single()
      .then(({ data }) => { if (data) setLocationName(data.location_name); });
  }, [client]);

  // ── fetch 12-month monthly data ───────────────────────────────────────────

  useEffect(() => {
    if (!client) return;
    const fetch_ = async () => {
      setMonthlyLoading(true);
      try {
        const current12 = buildLast12Months();
        const prior12 = buildPrior12Months(current12);
        const overallFrom = prior12[0].from;
        const overallTo = current12[11].to;

        const [{ data: det }, { data: sum }] = await Promise.all([
          supabase.from('gbp_location_daily_metrics')
            .select('date, views, phone_calls, website_clicks, direction_requests')
            .eq('client_id', client.id).gte('date', overallFrom).lte('date', overallTo),
          supabase.from('client_metrics_summary')
            .select('date, gbp_profile_views, gbp_calls, gbp_website_clicks, gbp_directions')
            .eq('client_id', client.id).eq('period_type', 'daily')
            .gte('date', overallFrom).lte('date', overallTo),
        ]);

        const detMap = new Map<string, any>();
        (det || []).forEach((r: any) => detMap.set(r.date, r));
        const sumMap = new Map<string, any>();
        (sum || []).forEach((r: any) => sumMap.set(r.date, r));

        const allDates = Array.from(new Set([
          ...(det || []).map((r: any) => r.date),
          ...(sum || []).map((r: any) => r.date),
        ]));

        // Bucket by month
        const buckets = new Map<string, { views: number; calls: number; clicks: number; directions: number; newReviews: number }>();
        [...current12, ...prior12].forEach(m => buckets.set(m.key, { views: 0, calls: 0, clicks: 0, directions: 0, newReviews: 0 }));

        for (const date of allDates) {
          const mk = date.slice(0, 7);
          if (!buckets.has(mk)) continue;
          const d = detMap.get(date);
          const s = sumMap.get(date);
          const v = pickVal(d?.views, s?.gbp_profile_views);
          const c = pickVal(d?.phone_calls, s?.gbp_calls);
          const cl = pickVal(d?.website_clicks, s?.gbp_website_clicks);
          const dir = pickVal(d?.direction_requests, s?.gbp_directions);
          if (v === 0 && c === 0 && cl === 0 && dir === 0) continue;
          const b = buckets.get(mk)!;
          b.views += v; b.calls += c; b.clicks += cl; b.directions += dir;
        }

        setMonthlyData(current12.map(m => ({ monthKey: m.key, monthLabel: m.label, ...buckets.get(m.key)! })));
        setPrevMonthlyData(prior12.map(m => ({ monthKey: m.key, monthLabel: m.label, ...buckets.get(m.key)! })));
      } finally {
        setMonthlyLoading(false);
      }
    };
    fetch_();
  }, [client]);

  // ── fetch period data (date range) ────────────────────────────────────────

  useEffect(() => {
    if (!client) return;
    const fetch_ = async () => {
      setPeriodLoading(true);
      try {
        const effectiveTo = dateRange.to > yesterday() ? yesterday() : dateRange.to;
        const fromISO = dateRange.from.toISOString().split('T')[0];
        const toISO = effectiveTo.toISOString().split('T')[0];

        // Current period
        const [{ data: det }, { data: sum }] = await Promise.all([
          supabase.from('gbp_location_daily_metrics')
            .select('date, views, phone_calls, website_clicks, direction_requests, new_reviews_today, total_reviews, average_rating, business_photo_views, customer_photo_views')
            .eq('client_id', client.id).gte('date', fromISO).lte('date', toISO).order('date', { ascending: true }),
          supabase.from('client_metrics_summary')
            .select('date, gbp_profile_views, gbp_calls, gbp_website_clicks, gbp_directions, gbp_reviews_new, gbp_reviews_count, gbp_rating_avg')
            .eq('client_id', client.id).eq('period_type', 'daily')
            .gte('date', fromISO).lte('date', toISO).order('date', { ascending: true }),
        ]);

        const detMap = new Map<string, any>();
        (det || []).forEach((r: any) => detMap.set(r.date, r));
        const sumMap = new Map<string, any>();
        (sum || []).forEach((r: any) => sumMap.set(r.date, r));

        const allDates = Array.from(new Set([
          ...(det || []).map((r: any) => r.date),
          ...(sum || []).map((r: any) => r.date),
        ])).sort();

        let lastReviews = 0, lastRating = 0;

        const merged: DailyGBP[] = allDates.map(date => {
          const d = detMap.get(date);
          const s = sumMap.get(date);
          const views = pickVal(d?.views, s?.gbp_profile_views);
          const calls = pickVal(d?.phone_calls, s?.gbp_calls);
          const clicks = pickVal(d?.website_clicks, s?.gbp_website_clicks);
          const directions = pickVal(d?.direction_requests, s?.gbp_directions);
          const tr = d?.total_reviews ?? s?.gbp_reviews_count ?? 0;
          const avg = d?.average_rating ?? s?.gbp_rating_avg ?? 0;
          if (tr > 0) lastReviews = tr;
          if (avg > 0) lastRating = avg;
          return {
            date,
            views, calls, clicks, directions,
            actions: calls + clicks + directions,
            newReviews: pickVal(d?.new_reviews_today, s?.gbp_reviews_new),
            totalReviews: tr,
            avgRating: avg,
            businessPhotoViews: d?.business_photo_views ?? 0,
            customerPhotoViews: d?.customer_photo_views ?? 0,
          };
        }).filter(r => r.views > 0 || r.calls > 0 || r.clicks > 0 || r.directions > 0);

        setLatestReviews(lastReviews);
        setLatestRating(lastRating);
        setPeriodData(merged);

        // Previous period for MoM
        const periodDays = Math.round((effectiveTo.getTime() - dateRange.from.getTime()) / 86400000);
        const prevTo = new Date(dateRange.from); prevTo.setDate(prevTo.getDate() - 1);
        const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - periodDays);
        const [{ data: pDet }, { data: pSum }] = await Promise.all([
          supabase.from('gbp_location_daily_metrics')
            .select('date, views, phone_calls, website_clicks, direction_requests')
            .eq('client_id', client.id)
            .gte('date', prevFrom.toISOString().split('T')[0]).lte('date', prevTo.toISOString().split('T')[0]),
          supabase.from('client_metrics_summary')
            .select('date, gbp_profile_views, gbp_calls, gbp_website_clicks, gbp_directions')
            .eq('client_id', client.id).eq('period_type', 'daily')
            .gte('date', prevFrom.toISOString().split('T')[0]).lte('date', prevTo.toISOString().split('T')[0]),
        ]);
        const pDetMap = new Map<string, any>(); (pDet || []).forEach((r: any) => pDetMap.set(r.date, r));
        const pSumMap = new Map<string, any>(); (pSum || []).forEach((r: any) => pSumMap.set(r.date, r));
        const pAllDates = Array.from(new Set([...(pDet || []).map((r: any) => r.date), ...(pSum || []).map((r: any) => r.date)])).sort();
        const prevMerged: DailyGBP[] = pAllDates.map(date => {
          const d = pDetMap.get(date); const s = pSumMap.get(date);
          const views = pickVal(d?.views, s?.gbp_profile_views);
          const calls = pickVal(d?.phone_calls, s?.gbp_calls);
          const clicks = pickVal(d?.website_clicks, s?.gbp_website_clicks);
          const directions = pickVal(d?.direction_requests, s?.gbp_directions);
          return { date, views, calls, clicks, directions, actions: calls + clicks + directions, newReviews: 0, totalReviews: 0, avgRating: 0, businessPhotoViews: 0, customerPhotoViews: 0 };
        });
        setPrevPeriodData(prevMerged);
      } finally {
        setPeriodLoading(false);
      }
    };
    fetch_();
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

  // ── derived values (12-month) ─────────────────────────────────────────────

  const m12Views = monthlyData.reduce((s, m) => s + m.views, 0);
  const m12Calls = monthlyData.reduce((s, m) => s + m.calls, 0);
  const m12Clicks = monthlyData.reduce((s, m) => s + m.clicks, 0);
  const m12Dir = monthlyData.reduce((s, m) => s + m.directions, 0);
  const prev12Views = prevMonthlyData.reduce((s, m) => s + m.views, 0);
  const prev12Calls = prevMonthlyData.reduce((s, m) => s + m.calls, 0);
  const prev12Clicks = prevMonthlyData.reduce((s, m) => s + m.clicks, 0);
  const prev12Dir = prevMonthlyData.reduce((s, m) => s + m.directions, 0);

  // ── derived values (period) ───────────────────────────────────────────────

  const pViews = periodData.reduce((s, d) => s + d.views, 0);
  const pCalls = periodData.reduce((s, d) => s + d.calls, 0);
  const pClicks = periodData.reduce((s, d) => s + d.clicks, 0);
  const pDir = periodData.reduce((s, d) => s + d.directions, 0);
  const pActions = periodData.reduce((s, d) => s + d.actions, 0);
  const pNewReviews = periodData.reduce((s, d) => s + d.newReviews, 0);

  const prevpViews = prevPeriodData.reduce((s, d) => s + d.views, 0);
  const prevpCalls = prevPeriodData.reduce((s, d) => s + d.calls, 0);
  const prevpClicks = prevPeriodData.reduce((s, d) => s + d.clicks, 0);
  const prevpDir = prevPeriodData.reduce((s, d) => s + d.directions, 0);

  const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000);

  const engRate = pViews > 0 ? ((pActions / pViews) * 100).toFixed(2) : '0.00';
  const callConv = pViews > 0 ? ((pCalls / pViews) * 100).toFixed(2) : '0.00';
  const callsPct = pActions > 0 ? ((pCalls / pActions) * 100).toFixed(1) : '0';
  const clicksPct = pActions > 0 ? ((pClicks / pActions) * 100).toFixed(1) : '0';
  const dirPct = pActions > 0 ? ((pDir / pActions) * 100).toFixed(1) : '0';

  const calcMoM = (curr: number, prev: number) => {
    if (prev === 0) return { pct: '—', type: 'neutral' as const };
    const v = (curr - prev) / prev * 100;
    return { pct: v > 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`, type: (v > 0 ? 'up' : v < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral' };
  };
  const calcYoY = calcMoM;

  const momCalls = calcMoM(pCalls, prevpCalls);
  const momViews = calcMoM(pViews, prevpViews);
  const momClicks = calcMoM(pClicks, prevpClicks);
  const momDir = calcMoM(pDir, prevpDir);

  const yoyCalls = calcYoY(m12Calls, prev12Calls);
  const yoyViews = calcYoY(m12Views, prev12Views);

  const badge = (mom: { pct: string; type: 'up' | 'down' | 'neutral' }, suffix: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: mom.type === 'up' ? '#10b981' : mom.type === 'down' ? '#ef4444' : '#9ca3af' }}>
        {mom.type === 'up' ? '▲' : mom.type === 'down' ? '▼' : ''} {mom.pct}
      </span>
      <span style={{ fontSize: '10px', color: '#9ca3af' }}>{suffix}</span>
    </div>
  );

  const noMonthlyData = m12Views === 0 && m12Calls === 0;
  const noPeriodData = pViews === 0 && pCalls === 0 && pClicks === 0 && pDir === 0;

  const chartCard = (children: React.ReactNode) => ({
    background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(44,36,25,0.1)', borderRadius: '24px',
    padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)',
  });

  // chart data
  const viewsChart = monthlyData.map(m => ({ month: m.monthLabel, views: m.views }));
  const actionsChart = monthlyData.map(m => ({ month: m.monthLabel, calls: m.calls, clicks: m.clicks, directions: m.directions }));

  const spinner = (
    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '3px solid #f3f3f3', borderTop: '3px solid #c4704f', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} clientName={client.name} clientCity={client.city} activeTab="gbp" />
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Info note */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', padding: '8px 14px', background: 'rgba(217,168,84,0.08)', border: '1px solid rgba(217,168,84,0.25)', borderRadius: '8px', fontSize: '12px', color: '#92702a' }}>
          <span style={{ fontWeight: 700 }}>ℹ️ GBP data:</span>
          Phone calls = button taps (includes unanswered). Synced daily — days with no API response excluded automatically.
        </div>

        {/* Page header */}
        <div style={{ marginBottom: '28px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#5c5850' }}>LOCAL SEO</span>
          <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#2c2419', letterSpacing: '-0.02em', margin: '4px 0 4px 0' }}>Google Business Profile</h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>{locationName || 'Local visibility & engagement'}</p>
        </div>

        {/* ══════════════════════════════════════════════════════
            BLOCK A — FIXED 12-MONTH MONTHLY CHARTS
            ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2c2419' }}>Monthly Overview</span>
            <span style={{ fontSize: '11px', color: '#9ca3af', background: 'rgba(44,36,25,0.06)', padding: '2px 8px', borderRadius: '100px' }}>Last 12 months · fixed</span>
          </div>

          {noMonthlyData && !monthlyLoading && (
            <div style={{ textAlign: 'center', padding: '32px', background: 'rgba(255,255,255,0.9)', borderRadius: 12, color: '#9ca3af', marginBottom: '24px' }}>
              No GBP monthly data available yet.
            </div>
          )}

          {!noMonthlyData && (
            <>
              {/* YoY summary strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Views (12 mo)', val: m12Views, yoy: yoyViews, color: '#9db5a0' },
                  { label: 'Calls (12 mo)', val: m12Calls, yoy: yoyCalls, color: '#10b981' },
                  { label: 'Web Clicks (12 mo)', val: m12Clicks, yoy: calcYoY(m12Clicks, prev12Clicks), color: '#d9a854' },
                  { label: 'Directions (12 mo)', val: m12Dir, yoy: calcYoY(m12Dir, prev12Dir), color: '#c4704f' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '12px', padding: '14px 16px' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', fontWeight: 600, margin: '0 0 4px 0', textTransform: 'uppercase' }}>{item.label}</p>
                    <p style={{ fontSize: '24px', fontWeight: 700, color: item.color, margin: '0 0 4px 0' }}>{fmtNum(item.val)}</p>
                    {badge(item.yoy, 'vs prior year')}
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                {/* Views line */}
                <div style={chartCard(null)}>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 4px 0' }}>Monthly Trend</p>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0' }}>Profile Views</h3>
                  {monthlyLoading ? spinner : (
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={viewsChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,36,25,0.08)" />
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#5c5850' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#5c5850' }} width={40} />
                          <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '8px', fontSize: '11px' }} />
                          <Line type="monotone" dataKey="views" stroke="#9db5a0" strokeWidth={2.5} dot={{ r: 3, fill: '#9db5a0' }} name="Views" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Actions stacked bar */}
                <div style={chartCard(null)}>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 4px 0' }}>Monthly Actions</p>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0' }}>Calls · Clicks · Directions</h3>
                  {monthlyLoading ? spinner : (
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={actionsChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,36,25,0.08)" />
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#5c5850' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#5c5850' }} width={40} />
                          <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '8px', fontSize: '11px' }} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                          <Bar dataKey="calls" name="Calls" stackId="a" fill="#10b981" />
                          <Bar dataKey="clicks" name="Web Clicks" stackId="a" fill="#d9a854" />
                          <Bar dataKey="directions" name="Directions" stackId="a" fill="#c4704f" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════
            DIVIDER
            ══════════════════════════════════════════════════════ */}
        <div style={{ borderTop: '1px solid rgba(44,36,25,0.08)', margin: '8px 0 24px' }} />

        {/* ══════════════════════════════════════════════════════
            BLOCK B — DATE-RANGE PERIOD ANALYSIS
            ══════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2c2419' }}>Period Analysis</span>
            <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '10px' }}>Compare vs previous period</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: '100px', background: 'rgba(44,36,25,0.05)' }}>
              {([7, 30, 90] as const).map(d => (
                <button key={d} onClick={() => handlePreset(d)}
                  style={{ padding: '4px 12px', borderRadius: '100px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                    background: d === selectedDays ? '#fff' : 'transparent',
                    color: d === selectedDays ? '#2c2419' : '#5c5850' }}>
                  {d}d
                </button>
              ))}
            </div>
            <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
          </div>
        </div>

        {noPeriodData && !periodLoading && (
          <div style={{ textAlign: 'center', padding: '32px', background: 'rgba(255,255,255,0.9)', borderRadius: 12, color: '#9ca3af', marginBottom: '24px' }}>
            No GBP data for this period. Try selecting an earlier range — GBP data typically has a 3–7 day lag.
          </div>
        )}

        {periodLoading && (
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <div style={{ width: 28, height: 28, border: '3px solid #f3f3f3', borderTop: '3px solid #c4704f', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        )}

        {!periodLoading && !noPeriodData && (
          <>
            {/* ── PHONE CALLS — featured card ─────────────────────────── */}
            <div style={{ ...chartCard(null), marginBottom: '20px', background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(157,181,160,0.06))', border: '1.5px solid rgba(16,185,129,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#5c5850' }}>Phone Calls</span>
                    <span title="Times customers tapped the call button — includes unanswered calls" style={{ fontSize: '11px', color: '#9ca3af', cursor: 'help' }}>ⓘ</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                    <span style={{ fontSize: '52px', fontWeight: 900, color: '#10b981', lineHeight: 1, letterSpacing: '-0.02em' }}>{fmtNum(pCalls)}</span>
                    <div>
                      {badge(momCalls, `vs prev ${periodDays}d`)}
                      <p style={{ fontSize: '11px', color: '#5c5850', margin: '4px 0 0 0' }}>Call conversion: <strong>{callConv}%</strong> of views</p>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', minWidth: '280px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 2px 0', fontWeight: 600 }}>Share of Actions</p>
                    <p style={{ fontSize: '22px', fontWeight: 700, color: '#10b981', margin: 0 }}>{callsPct}%</p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 2px 0', fontWeight: 600 }}>Avg / Day</p>
                    <p style={{ fontSize: '22px', fontWeight: 700, color: '#10b981', margin: 0 }}>
                      {periodData.length > 0 ? (pCalls / periodData.length).toFixed(1) : '0'}
                    </p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 2px 0', fontWeight: 600 }}>12-Mo Total</p>
                    <p style={{ fontSize: '22px', fontWeight: 700, color: '#10b981', margin: 0 }}>{fmtNum(m12Calls)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── VIEWS · CLICKS · DIRECTIONS — grouped ──────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Profile Views', val: pViews, mom: momViews, color: '#9db5a0', sub: `Avg ${periodData.length > 0 ? Math.round(pViews / periodData.length) : 0}/day` },
                { label: 'Website Clicks', val: pClicks, mom: momClicks, color: '#d9a854', sub: `${clicksPct}% of actions` },
                { label: 'Directions', val: pDir, mom: momDir, color: '#c4704f', sub: `${dirPct}% of actions` },
              ].map(item => (
                <div key={item.label} style={chartCard(null)}>
                  <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: 600, margin: '0 0 8px 0', textTransform: 'uppercase' }}>{item.label}</p>
                  <p style={{ fontSize: '32px', fontWeight: 700, color: item.color, margin: '0 0 6px 0' }}>{fmtNum(item.val)}</p>
                  {badge(item.mom, `vs prev ${periodDays}d`)}
                  <p style={{ fontSize: '10px', color: '#9ca3af', margin: '6px 0 0 0' }}>{item.sub}</p>
                </div>
              ))}
            </div>

            {/* ── ACTION BREAKDOWN + REVIEWS ─────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              {/* Action breakdown */}
              <div style={chartCard(null)}>
                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 4px 0' }}>Actions</p>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0' }}>Total: {fmtNum(pActions)}</h3>
                {[
                  { label: 'Phone Calls', val: pCalls, pct: callsPct, color: '#10b981' },
                  { label: 'Website Clicks', val: pClicks, pct: clicksPct, color: '#d9a854' },
                  { label: 'Direction Requests', val: pDir, pct: dirPct, color: '#c4704f' },
                ].map(item => (
                  <div key={item.label} style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#5c5850', fontWeight: 500 }}>{item.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: item.color }}>{fmtNum(item.val)} <span style={{ fontWeight: 400, color: '#9ca3af' }}>({item.pct}%)</span></span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(44,36,25,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: '4px' }} />
                    </div>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
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

              {/* Reviews */}
              <div style={chartCard(null)}>
                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 4px 0' }}>Reviews & Reputation</p>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0' }}>Customer Feedback</h3>
                <div style={{ background: 'linear-gradient(135deg, rgba(217,168,84,0.15), rgba(196,112,79,0.12))', borderRadius: '14px', padding: '20px', textAlign: 'center', marginBottom: '16px' }}>
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
                  <div style={{ background: 'rgba(157,181,160,0.08)', borderRadius: '10px', padding: '14px', borderLeft: '3px solid #9db5a0' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600 }}>New (this period)</p>
                    <p style={{ fontSize: '26px', fontWeight: 700, color: '#9db5a0', margin: 0 }}>{fmtNum(pNewReviews)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key insights */}
            <div style={{ ...chartCard(null), marginBottom: '32px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 10px 0' }}>GBP Summary</p>
              <p style={{ fontSize: '12px', color: '#5c5850', margin: 0, lineHeight: '1.7' }}>
                In the last <strong>{periodDays} days</strong>, your profile received <strong>{fmtNum(pViews)} views</strong> ({badge(momViews, '')}) and generated <strong>{fmtNum(pCalls)} phone calls</strong> ({badge(momCalls, '')}) — a <strong>{callConv}% call conversion rate</strong>.
                Customers also clicked to your website <strong>{fmtNum(pClicks)} times</strong> and requested directions <strong>{fmtNum(pDir)} times</strong>. Overall engagement rate: <strong>{engRate}%</strong>.
                {latestRating > 0 && <> Business maintains a <strong>{latestRating.toFixed(1)}-star</strong> rating across <strong>{fmtNum(latestReviews)} reviews</strong>{pNewReviews > 0 ? `, with ${fmtNum(pNewReviews)} new this period` : ''}.</>}
              </p>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
