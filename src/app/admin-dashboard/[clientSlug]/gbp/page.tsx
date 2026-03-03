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
import { createClient } from '@supabase/supabase-js';
import { fmtNum } from '@/lib/format';

interface ClientMetrics {
  id: string;
  name: string;
  slug: string;
  city: string;
  services?: { googleLocalService?: boolean };
}

interface MonthlyGBP {
  monthKey: string;   // "2025-03"
  monthLabel: string; // "Mar '25"
  views: number;
  calls: number;
  clicks: number;
  directions: number;
  actions: number;
  newReviews: number;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Compute last N full months as { from, to } date strings
function getLast12MonthsRange(): { start: string; end: string; months: { key: string; label: string; from: string; to: string }[] } {
  const today = new Date();
  // End = last day of previous month
  const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  const months: { key: string; label: string; from: string; to: string }[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - 1 - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-indexed
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0);
    const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    months.push({ key: `${year}-${String(month + 1).padStart(2, '0')}`, label, from: firstDay, to: lastDayStr });
  }

  // Prior 12 months (for YoY)
  const start = months[0].from;
  const end = months[11].to;
  return { start, end, months };
}

function getPrior12MonthsRange(currentMonths: { key: string; from: string; to: string }[]) {
  // Shift back by 12 months
  const months: { key: string; label: string; from: string; to: string }[] = [];
  for (const m of currentMonths) {
    const [y, mo] = m.key.split('-').map(Number);
    const d = new Date(y, mo - 1 - 12, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0);
    const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    months.push({ key: `${year}-${String(month + 1).padStart(2, '0')}`, label, from: firstDay, to: lastDayStr });
  }
  return months;
}

export default function GBPPage() {
  const params = useParams();
  const clientSlug = params?.clientSlug as string;

  const [client, setClient] = useState<ClientMetrics | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyGBP[]>([]);
  const [prevMonthlyData, setPrevMonthlyData] = useState<MonthlyGBP[]>([]);
  const [latestReviews, setLatestReviews] = useState(0);
  const [latestRating, setLatestRating] = useState(0);
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Fetch client
  useEffect(() => {
    const fetchClient = async () => {
      try {
        const response = await fetch('/api/clients/list');
        const data = await response.json();
        if (data.success && data.clients) {
          const found = data.clients.find((c: any) => c.slug === clientSlug);
          if (found) setClient(found);
        }
      } catch (e) {
        console.error('Error fetching client:', e);
      } finally {
        setLoading(false);
      }
    };
    if (clientSlug) fetchClient();
  }, [clientSlug]);

  // Fetch GBP data
  useEffect(() => {
    if (!client) return;

    const fetchData = async () => {
      setDataLoading(true);
      try {
        const { months } = getLast12MonthsRange();
        const priorMonths = getPrior12MonthsRange(months);

        // Fetch location name
        const { data: locData } = await supabase
          .from('gbp_locations')
          .select('location_name')
          .eq('client_id', client.id)
          .single();
        if (locData) setLocationName(locData.location_name);

        // Date range: cover both current + prior 12 months in one query
        const overallFrom = priorMonths[0].from;
        const overallTo = months[11].to;

        // Fetch from gbp_location_daily_metrics
        const { data: detailedData } = await supabase
          .from('gbp_location_daily_metrics')
          .select('date, views, direction_requests, phone_calls, website_clicks, new_reviews_today, total_reviews, average_rating')
          .eq('client_id', client.id)
          .gte('date', overallFrom)
          .lte('date', overallTo)
          .order('date', { ascending: true });

        // Fetch from client_metrics_summary
        const { data: summaryData } = await supabase
          .from('client_metrics_summary')
          .select('date, gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views, gbp_reviews_new, gbp_reviews_count, gbp_rating_avg')
          .eq('client_id', client.id)
          .eq('period_type', 'daily')
          .gte('date', overallFrom)
          .lte('date', overallTo)
          .order('date', { ascending: true });

        // Build maps
        const detMap = new Map<string, any>();
        (detailedData || []).forEach((r: any) => detMap.set(r.date, r));
        const sumMap = new Map<string, any>();
        (summaryData || []).forEach((r: any) => sumMap.set(r.date, r));

        // Get all dates
        const allDates = Array.from(new Set([
          ...(detailedData || []).map((r: any) => r.date),
          ...(summaryData || []).map((r: any) => r.date),
        ])).sort();

        const pickVal = (a: any, b: any) => {
          if (a != null && a > 0) return a;
          if (b != null && b > 0) return b;
          return a ?? b ?? 0;
        };

        // Aggregate into month buckets
        const monthBuckets = new Map<string, { views: number; calls: number; clicks: number; directions: number; newReviews: number }>();
        const allMonthKeys = new Set([...months.map(m => m.key), ...priorMonths.map(m => m.key)]);
        allMonthKeys.forEach(k => monthBuckets.set(k, { views: 0, calls: 0, clicks: 0, directions: 0, newReviews: 0 }));

        let lastReviews = 0;
        let lastRating = 0;

        for (const date of allDates) {
          const monthKey = date.slice(0, 7);
          if (!monthBuckets.has(monthKey)) continue;
          const det = detMap.get(date);
          const sum = sumMap.get(date);

          const views = pickVal(det?.views, sum?.gbp_profile_views);
          const calls = pickVal(det?.phone_calls, sum?.gbp_calls);
          const clicks = pickVal(det?.website_clicks, sum?.gbp_website_clicks);
          const directions = pickVal(det?.direction_requests, sum?.gbp_directions);
          const newReviews = pickVal(det?.new_reviews_today, sum?.gbp_reviews_new);

          // Skip all-zero days (no real GBP data)
          if (views === 0 && calls === 0 && clicks === 0 && directions === 0) continue;

          const bucket = monthBuckets.get(monthKey)!;
          bucket.views += views;
          bucket.calls += calls;
          bucket.clicks += clicks;
          bucket.directions += directions;
          bucket.newReviews += newReviews;

          // Track latest reviews/rating
          const tr = det?.total_reviews ?? sum?.gbp_reviews_count ?? 0;
          const avg = det?.average_rating ?? sum?.gbp_rating_avg ?? 0;
          if (tr > 0) lastReviews = tr;
          if (avg > 0) lastRating = avg;
        }

        setLatestReviews(lastReviews);
        setLatestRating(lastRating);

        // Build current 12 months
        const current: MonthlyGBP[] = months.map(m => {
          const b = monthBuckets.get(m.key) || { views: 0, calls: 0, clicks: 0, directions: 0, newReviews: 0 };
          return {
            monthKey: m.key,
            monthLabel: m.label,
            ...b,
            actions: b.calls + b.clicks + b.directions,
          };
        });
        setMonthlyData(current);

        // Build prior 12 months (for YoY)
        const prior: MonthlyGBP[] = priorMonths.map(m => {
          const b = monthBuckets.get(m.key) || { views: 0, calls: 0, clicks: 0, directions: 0, newReviews: 0 };
          return {
            monthKey: m.key,
            monthLabel: m.label,
            ...b,
            actions: b.calls + b.clicks + b.directions,
          };
        });
        setPrevMonthlyData(prior);

      } catch (e) {
        console.error('Error fetching GBP data:', e);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [client]);

  if (loading || !client) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #f3f3f3', borderTop: '3px solid #c4704f', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#2c2419', opacity: 0.6 }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (client?.services?.googleLocalService === false) {
    return (
      <AdminLayout>
        <ClientTabBar clientSlug={clientSlug} clientName={client?.name} clientCity={client?.city} activeTab="gbp" />
        <ServiceNotActive
          serviceName="Google Business Profile"
          description="Your account does not have Google Business Profile configured. Contact our team to set up GBP tracking and monitor your local search presence."
        />
      </AdminLayout>
    );
  }

  // Aggregate totals — last 12 months
  const totalViews = monthlyData.reduce((s, m) => s + m.views, 0);
  const totalCalls = monthlyData.reduce((s, m) => s + m.calls, 0);
  const totalClicks = monthlyData.reduce((s, m) => s + m.clicks, 0);
  const totalDirections = monthlyData.reduce((s, m) => s + m.directions, 0);
  const totalActions = monthlyData.reduce((s, m) => s + m.actions, 0);
  const totalNewReviews = monthlyData.reduce((s, m) => s + m.newReviews, 0);

  // Prior 12 months totals (YoY)
  const prevViews = prevMonthlyData.reduce((s, m) => s + m.views, 0);
  const prevCalls = prevMonthlyData.reduce((s, m) => s + m.calls, 0);
  const prevClicks = prevMonthlyData.reduce((s, m) => s + m.clicks, 0);
  const prevDirections = prevMonthlyData.reduce((s, m) => s + m.directions, 0);

  const calcYoY = (curr: number, prev: number) => {
    if (prev === 0) return { pct: '—', type: 'neutral' as const };
    const val = (curr - prev) / prev * 100;
    const pct = val.toFixed(1);
    const isUp = val > 0;
    return { pct: isUp ? `+${pct}%` : `${pct}%`, type: (isUp ? 'up' : val === 0 ? 'neutral' : 'down') as 'up' | 'down' | 'neutral' };
  };

  const yoyViews = calcYoY(totalViews, prevViews);
  const yoyCalls = calcYoY(totalCalls, prevCalls);
  const yoyClicks = calcYoY(totalClicks, prevClicks);
  const yoyDirections = calcYoY(totalDirections, prevDirections);

  // Derived rates
  const engagementRate = totalViews > 0 ? ((totalActions / totalViews) * 100).toFixed(2) : '0.00';
  const callConversionRate = totalViews > 0 ? ((totalCalls / totalViews) * 100).toFixed(2) : '0.00';
  const phoneCallsPercent = totalActions > 0 ? ((totalCalls / totalActions) * 100).toFixed(1) : '0';
  const webClicksPercent = totalActions > 0 ? ((totalClicks / totalActions) * 100).toFixed(1) : '0';
  const directionsPercent = totalActions > 0 ? ((totalDirections / totalActions) * 100).toFixed(1) : '0';

  const noData = totalViews === 0 && totalCalls === 0 && totalClicks === 0 && totalDirections === 0;

  // Chart data: monthly
  const viewsChartData = monthlyData.map(m => ({ month: m.monthLabel, views: m.views }));
  const actionsChartData = monthlyData.map(m => ({
    month: m.monthLabel,
    calls: m.calls,
    clicks: m.clicks,
    directions: m.directions,
  }));

  const badgeStyle = (type: 'up' | 'down' | 'neutral') => ({
    fontSize: '11px',
    fontWeight: 600 as const,
    color: type === 'up' ? '#10b981' : type === 'down' ? '#ef4444' : '#9ca3af',
  });

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} clientName={client?.name} clientCity={client?.city} activeTab="gbp" />

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Data note */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', padding: '8px 14px', background: 'rgba(217,168,84,0.08)', border: '1px solid rgba(217,168,84,0.25)', borderRadius: '8px', fontSize: '12px', color: '#92702a' }}>
          <span style={{ fontWeight: 700 }}>ℹ️ GBP data:</span>
          Phone calls reflect button taps (includes unanswered). Data synced daily — days with no API response are automatically excluded.
        </div>

        {/* Page Header */}
        <div style={{ marginBottom: '28px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.15em', color: '#5c5850' }}>LOCAL SEO</span>
          <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#2c2419', letterSpacing: '-0.02em', margin: '4px 0 4px 0' }}>
            Google Business Profile
          </h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
            {locationName || 'Local visibility & engagement'} · Last 12 months
          </p>
        </div>

        {/* Empty state */}
        {!dataLoading && noData && (
          <div style={{ textAlign: 'center', padding: '48px', background: 'rgba(255,255,255,0.9)', borderRadius: 12, margin: '24px 0', color: '#2c2419', opacity: 0.6 }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>No GBP data available</p>
            <p style={{ fontSize: 13 }}>GBP data typically has a 3–7 day lag. Check back soon or verify the GBP location is configured.</p>
          </div>
        )}

        {/* Loading overlay */}
        {dataLoading && (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #f3f3f3', borderTop: '3px solid #c4704f', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: '#9ca3af', fontSize: '13px' }}>Loading 12-month data…</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!dataLoading && !noData && (
          <>
            {/* TIER 1: KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              {/* Profile Views */}
              <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: 600, margin: '0 0 8px 0', textTransform: 'uppercase' as const }}>Profile Views</p>
                <p style={{ fontSize: '32px', fontWeight: 700, color: '#2c2419', margin: '0 0 4px 0' }}>{fmtNum(totalViews)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={badgeStyle(yoyViews.type)}>
                    {yoyViews.type === 'up' ? '▲' : yoyViews.type === 'down' ? '▼' : ''} {yoyViews.pct}
                  </span>
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>vs prior year</span>
                </div>
              </div>

              {/* Phone Calls */}
              <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: 600, margin: 0, textTransform: 'uppercase' as const }}>Phone Calls</p>
                  <span title="Times customers tapped the call button (includes unanswered)" style={{ fontSize: '11px', color: '#9ca3af', cursor: 'help' }}>ⓘ</span>
                </div>
                <p style={{ fontSize: '32px', fontWeight: 700, color: '#10b981', margin: '0 0 4px 0' }}>{fmtNum(totalCalls)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={badgeStyle(yoyCalls.type)}>
                    {yoyCalls.type === 'up' ? '▲' : yoyCalls.type === 'down' ? '▼' : ''} {yoyCalls.pct}
                  </span>
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>vs prior year</span>
                </div>
              </div>

              {/* Website Clicks */}
              <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: 600, margin: '0 0 8px 0', textTransform: 'uppercase' as const }}>Website Clicks</p>
                <p style={{ fontSize: '32px', fontWeight: 700, color: '#d9a854', margin: '0 0 4px 0' }}>{fmtNum(totalClicks)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={badgeStyle(yoyClicks.type)}>
                    {yoyClicks.type === 'up' ? '▲' : yoyClicks.type === 'down' ? '▼' : ''} {yoyClicks.pct}
                  </span>
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>vs prior year</span>
                </div>
              </div>

              {/* Directions */}
              <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: 600, margin: '0 0 8px 0', textTransform: 'uppercase' as const }}>Directions</p>
                <p style={{ fontSize: '32px', fontWeight: 700, color: '#c4704f', margin: '0 0 4px 0' }}>{fmtNum(totalDirections)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={badgeStyle(yoyDirections.type)}>
                    {yoyDirections.type === 'up' ? '▲' : yoyDirections.type === 'down' ? '▼' : ''} {yoyDirections.pct}
                  </span>
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>vs prior year</span>
                </div>
              </div>
            </div>

            {/* TIER 2: Monthly Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              {/* Views — Line Chart */}
              <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 4px 0' }}>Monthly Trend</p>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0' }}>Profile Views</h3>
                <div style={{ height: '240px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={viewsChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,36,25,0.08)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#5c5850' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#5c5850' }} width={40} />
                      <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '8px', fontSize: '11px' }} />
                      <Line type="monotone" dataKey="views" stroke="#9db5a0" strokeWidth={2.5} dot={{ r: 3, fill: '#9db5a0' }} name="Views" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Actions — Stacked Bar */}
              <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 4px 0' }}>Monthly Actions</p>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0' }}>Calls · Clicks · Directions</h3>
                <div style={{ height: '240px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={actionsChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,36,25,0.08)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#5c5850' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#5c5850' }} width={40} />
                      <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '8px', fontSize: '11px' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar dataKey="calls" name="Calls" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="clicks" name="Web Clicks" stackId="a" fill="#d9a854" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="directions" name="Directions" stackId="a" fill="#c4704f" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* TIER 3: Analysis */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              {/* Customer Actions Breakdown */}
              <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>Customer Actions</p>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0', letterSpacing: '-0.02em' }}>How Customers Interact</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', borderTop: '3px solid #10b981' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600 }}>Phone Calls</p>
                    <p style={{ fontSize: '22px', fontWeight: 700, color: '#10b981', margin: 0 }}>{fmtNum(totalCalls)}</p>
                  </div>
                  <div style={{ background: 'rgba(217,168,84,0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', borderTop: '3px solid #d9a854' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600 }}>Web Clicks</p>
                    <p style={{ fontSize: '22px', fontWeight: 700, color: '#d9a854', margin: 0 }}>{fmtNum(totalClicks)}</p>
                  </div>
                  <div style={{ background: 'rgba(196,112,79,0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', borderTop: '3px solid #c4704f' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600 }}>Directions</p>
                    <p style={{ fontSize: '22px', fontWeight: 700, color: '#c4704f', margin: 0 }}>{fmtNum(totalDirections)}</p>
                  </div>
                </div>

                {/* Distribution bars */}
                <p style={{ fontSize: '10px', fontWeight: 600, color: '#5c5850', margin: '0 0 12px 0', textTransform: 'uppercase' as const }}>Action Distribution</p>
                {[
                  { label: 'Phone Calls', pct: phoneCallsPercent, color: '#10b981' },
                  { label: 'Website Clicks', pct: webClicksPercent, color: '#d9a854' },
                  { label: 'Direction Requests', pct: directionsPercent, color: '#c4704f' },
                ].map(item => (
                  <div key={item.label} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>{item.label}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: item.color }}>{item.pct}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(44,36,25,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                ))}

                {/* Engagement metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                  <div style={{ background: 'rgba(16,185,129,0.06)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600 }}>Engagement Rate</p>
                    <p style={{ fontSize: '22px', fontWeight: 700, color: '#10b981', margin: '0 0 2px 0' }}>{engagementRate}%</p>
                    <p style={{ fontSize: '9px', fontWeight: 600, margin: 0, color: parseFloat(engagementRate) >= 8 ? '#d9a854' : parseFloat(engagementRate) >= 3 ? '#10b981' : '#ef4444' }}>
                      {parseFloat(engagementRate) >= 8 ? 'Excellent' : parseFloat(engagementRate) >= 3 ? 'Good' : 'Below avg'}
                    </p>
                  </div>
                  <div style={{ background: 'rgba(217,168,84,0.06)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600 }}>Call Conversion</p>
                    <p style={{ fontSize: '22px', fontWeight: 700, color: '#d9a854', margin: '0 0 2px 0' }}>{callConversionRate}%</p>
                    <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>Calls / Views</p>
                  </div>
                </div>
              </div>

              {/* Reviews & Reputation */}
              <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>Reviews & Reputation</p>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0', letterSpacing: '-0.02em' }}>Customer Feedback</h3>

                {/* Rating */}
                <div style={{ background: 'linear-gradient(135deg, rgba(217,168,84,0.15), rgba(196,112,79,0.15))', borderRadius: '16px', padding: '24px', textAlign: 'center', marginBottom: '20px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#5c5850', margin: '0 0 8px 0', textTransform: 'uppercase' as const }}>Average Rating</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '48px', fontWeight: 700, color: '#d9a854' }}>{latestRating.toFixed(1)}</span>
                    <span style={{ fontSize: '24px', color: '#d9a854' }}>/ 5</span>
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <span key={star} style={{ fontSize: '20px', color: star <= Math.round(latestRating) ? '#d9a854' : '#e5e5e5' }}>★</span>
                    ))}
                  </div>
                </div>

                {/* Review Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid #10b981' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600 }}>Total Reviews</p>
                    <p style={{ fontSize: '28px', fontWeight: 700, color: '#10b981', margin: 0 }}>{fmtNum(latestReviews)}</p>
                  </div>
                  <div style={{ background: 'rgba(157,181,160,0.08)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid #9db5a0' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600 }}>New Reviews</p>
                    <p style={{ fontSize: '28px', fontWeight: 700, color: '#9db5a0', margin: 0 }}>{fmtNum(totalNewReviews)}</p>
                    <p style={{ fontSize: '9px', color: '#9ca3af', margin: '4px 0 0 0' }}>Last 12 months</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Insights */}
            <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)', marginBottom: '32px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 12px 0' }}>GBP Key Insights — Last 12 Months</p>
              <p style={{ fontSize: '12px', color: '#5c5850', margin: 0, lineHeight: '1.6' }}>
                Your Google Business Profile received <strong>{fmtNum(totalViews)} profile views</strong> with an engagement rate of <strong>{engagementRate}%</strong> (
                {yoyViews.pct !== '—' ? `${yoyViews.pct} vs prior year` : 'no prior year data'}).{' '}
                Customers took <strong>{fmtNum(totalActions)} actions</strong>: <strong>{fmtNum(totalCalls)} phone calls</strong> ({phoneCallsPercent}%),{' '}
                <strong>{fmtNum(totalClicks)} website visits</strong> ({webClicksPercent}%), and <strong>{fmtNum(totalDirections)} direction requests</strong> ({directionsPercent}%).
                {latestRating > 0 && (
                  <> Business rating is <strong>{latestRating.toFixed(1)} / 5</strong> based on <strong>{fmtNum(latestReviews)} reviews</strong>
                  {totalNewReviews > 0 && <>, with <strong>{fmtNum(totalNewReviews)} new reviews</strong> in the past 12 months</>}.</>
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
