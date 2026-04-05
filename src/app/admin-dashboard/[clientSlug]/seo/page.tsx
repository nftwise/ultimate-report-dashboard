'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DateRangePicker from '@/components/admin/DateRangePicker';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';
import SEOTrendChart from '@/components/admin/SEOTrendChart';
import ServiceNotActive from '@/components/admin/ServiceNotActive';
import { createClient } from '@supabase/supabase-js';
import { fmtNum, fmtPct } from '@/lib/format';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ClientMetrics {
  id: string;
  name: string;
  slug: string;
  city: string;
  services?: { seo?: boolean; googleAds?: boolean };
}

interface DailyMetrics {
  date: string;
  sessions?: number;
  users?: number;
  new_users?: number;
  returning_users?: number;
  sessions_desktop?: number;
  sessions_mobile?: number;
  blog_sessions?: number;
  top_landing_pages?: any;
  traffic_organic?: number;
  traffic_paid?: number;
  traffic_direct?: number;
  traffic_referral?: number;
  traffic_ai?: number;
  keywords_improved?: number;
  keywords_declined?: number;
  engagement_rate?: number;
  conversion_rate?: number;
  seo_impressions?: number;
  seo_clicks?: number;
  seo_ctr?: number;
  google_rank?: number;
  top_keywords?: any;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function SEOPage() {
  const params = useParams();
  const clientSlug = params?.clientSlug as string;

  const [client, setClient] = useState<ClientMetrics | null>(null);
  const [dailyData, setDailyData] = useState<DailyMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState<7 | 30 | 90 | null>(30);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date(); to.setDate(to.getDate() - 1);
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    return { from, to };
  });
  const [lastAvailableDate, setLastAvailableDate] = useState<Date | null>(null);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [topKeywords, setTopKeywords] = useState<any[]>([]);
  const [keywordRankBuckets, setKeywordRankBuckets] = useState<{ top5: number; top10: number; top11to20: number }>({ top5: 0, top10: 0, top11to20: 0 });
  const [keywordMovement, setKeywordMovement] = useState<{ improved: number; declined: number }>({ improved: 0, declined: 0 });
  const [prevPeriodMetrics, setPrevPeriodMetrics] = useState<{ sessions: number; users: number; ctr: number; seoClicks: number; organicVisits: number }>({ sessions: 0, users: 0, ctr: 0, seoClicks: 0, organicVisits: 0 });
  const [realConversions, setRealConversions] = useState<number>(0);

  const handlePresetDays = (days: 7 | 30 | 90) => {
    setSelectedDays(days);
    const to = lastAvailableDate ?? (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })();
    const from = new Date(to);
    from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  // Fetch client
  useEffect(() => {
    if (!clientSlug) return;
    fetch('/api/clients/list')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.clients) {
          const found = data.clients.find((c: any) => c.slug === clientSlug);
          if (found) setClient(found);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientSlug]);

  // Anchor date range to last available data date
  useEffect(() => {
    if (!client) return;
    supabase.from('client_metrics_summary')
      .select('date').eq('client_id', client.id).eq('period_type', 'daily')
      .order('date', { ascending: false }).limit(1).single()
      .then(({ data }) => {
        if (data?.date) {
          const to = new Date(data.date + 'T12:00:00');
          setLastAvailableDate(to);
          const from = new Date(to); from.setDate(from.getDate() - 30);
          setDateRange({ from, to });
        }
      });
  }, [client]);

  // Fetch daily metrics
  useEffect(() => {
    if (!client) return;
    const from = dateRange.from.toISOString().split('T')[0];
    const to = dateRange.to.toISOString().split('T')[0];
    supabase
      .from('client_metrics_summary')
      .select('date, sessions, users, new_users, returning_users, sessions_desktop, sessions_mobile, blog_sessions, traffic_organic, traffic_paid, traffic_direct, traffic_referral, traffic_ai, seo_impressions, seo_clicks, seo_ctr, google_rank, engagement_rate, conversion_rate, top_keywords')
      .eq('client_id', client.id)
      .eq('period_type', 'daily')
      .gte('date', from).lte('date', to)
      .order('date', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching SEO metrics:', error);
          setFetchError('Không thể tải dữ liệu. Vui lòng thử lại.');
        } else {
          setDailyData((data || []) as DailyMetrics[]);
          setFetchError(null);
        }
      });
  }, [client, dateRange]);

  // Fetch keyword rankings + top keywords
  useEffect(() => {
    if (!client) return;
    const from = dateRange.from.toISOString().split('T')[0];
    const to = dateRange.to.toISOString().split('T')[0];

    supabase.from('client_metrics_summary')
      .select('top_keywords')
      .eq('client_id', client.id).eq('period_type', 'daily')
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]?.top_keywords) setTopKeywords(data[0].top_keywords); });

    const fetchRankings = async () => {
      const { data: gscDailySummary } = await supabase.from('gsc_daily_summary')
        .select('top_keywords_count').eq('client_id', client.id)
        .gte('date', from).lte('date', to).order('date', { ascending: false }).limit(1);
      const accurateTop10 = gscDailySummary?.[0]?.top_keywords_count || 0;

      const { data: gscData } = await supabase.from('gsc_queries')
        .select('query, position').eq('client_id', client.id)
        .gte('date', from).lte('date', to).order('date', { ascending: false });

      if (gscData && gscData.length > 0) {
        const best = new Map<string, number>();
        for (const row of gscData) {
          const q = (row.query || '').toLowerCase();
          const pos = row.position || 999;
          if (!best.has(q) || pos < best.get(q)!) best.set(q, pos);
        }
        let top5 = 0, top10 = 0, top11to20 = 0;
        for (const pos of best.values()) {
          if (pos <= 5) top5++;
          if (pos <= 10) top10++;
          else if (pos <= 20) top11to20++;
        }
        setKeywordRankBuckets({ top5, top10: accurateTop10 || top10, top11to20 });
      } else {
        setKeywordRankBuckets({ top5: 0, top10: accurateTop10, top11to20: 0 });
      }
    };
    fetchRankings();
  }, [client, dateRange]);

  // Fetch prev period + keyword movement + real conversions
  useEffect(() => {
    if (!client) return;
    const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000);
    const prevTo = new Date(dateRange.from); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - periodDays);
    const prevFromISO = prevFrom.toISOString().split('T')[0];
    const prevToISO = prevTo.toISOString().split('T')[0];
    const fromISO = dateRange.from.toISOString().split('T')[0];
    const toISO = dateRange.to.toISOString().split('T')[0];

    const avgPos = (rows: any[]) => {
      const map = new Map<string, number[]>();
      for (const r of rows || []) {
        const q = (r.query || '').toLowerCase();
        if (!map.has(q)) map.set(q, []);
        map.get(q)!.push(r.position || 999);
      }
      const result = new Map<string, number>();
      for (const [q, positions] of map) result.set(q, positions.reduce((a, b) => a + b, 0) / positions.length);
      return result;
    };

    Promise.all([
      supabase.from('gsc_queries').select('query, position').eq('client_id', client.id).gte('date', prevFromISO).lte('date', prevToISO),
      supabase.from('gsc_queries').select('query, position').eq('client_id', client.id).gte('date', fromISO).lte('date', toISO),
      supabase.from('client_metrics_summary').select('sessions, users, seo_impressions, seo_clicks, traffic_organic').eq('client_id', client.id).eq('period_type', 'daily').gte('date', prevFromISO).lte('date', prevToISO),
      supabase.from('ga4_events').select('event_count').eq('client_id', client.id).gte('date', fromISO).lte('date', toISO).in('event_name', ['submit_form_successful', 'Appointment_Successful', 'call_from_web']),
    ]).then(([{ data: prevKW }, { data: currKW }, { data: prevMetrics }, { data: convData }]) => {
      const prevAvg = avgPos(prevKW || []);
      const currAvg = avgPos(currKW || []);
      let improved = 0, declined = 0;
      for (const [query, currPos] of currAvg) {
        const prevPos = prevAvg.get(query);
        if (prevPos !== undefined) {
          if (prevPos > currPos + 0.5) improved++;
          else if (currPos > prevPos + 0.5) declined++;
        }
      }
      setKeywordMovement({ improved, declined });

      const prevSessions = (prevMetrics || []).reduce((s, d) => s + (d.sessions || 0), 0);
      const prevUsers = (prevMetrics || []).reduce((s, d) => s + (d.users || 0), 0);
      const prevSeoClicks = (prevMetrics || []).reduce((s, d) => s + (d.seo_clicks || 0), 0);
      const prevOrganicVisits = (prevMetrics || []).reduce((s, d) => s + ((d as any).traffic_organic || 0), 0);
      const prevTotalImpressions = (prevMetrics || []).reduce((s, d) => s + ((d as any).seo_impressions || 0), 0);
      const prevCtr = prevTotalImpressions > 0 ? (prevSeoClicks / prevTotalImpressions) * 100 : 0;
      setPrevPeriodMetrics({ sessions: prevSessions, users: prevUsers, ctr: prevCtr, seoClicks: prevSeoClicks, organicVisits: prevOrganicVisits });
      setRealConversions((convData || []).reduce((s: number, d: any) => s + (d.event_count || 0), 0));
    });
  }, [client, dateRange]);

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
        <p style={{ color: '#2c2419' }}>Loading...</p>
      </div>
    );
  }

  if ((client as any).services?.seo === false) {
    return (
      <AdminLayout>
        <ClientTabBar clientSlug={clientSlug} clientName={client.name} clientCity={client.city} activeTab="seo" />
        <ServiceNotActive serviceName="SEO Analytics" description="Your account does not have SEO tracking configured. Contact our team to set up Google Search Console and start monitoring your organic search performance." />
      </AdminLayout>
    );
  }

  // ── Aggregates ────────────────────────────────────────────────────────────
  const totalVisits = dailyData.reduce((s, d: any) => s + (d.sessions || 0), 0);
  const totalUniqueVisitors = dailyData.reduce((s, d: any) => s + (d.users || 0), 0);
  const totalOrganicVisits = dailyData.reduce((s, d: any) => s + (d.traffic_organic || 0), 0);
  const totalImpressions = dailyData.reduce((s, d: any) => s + (d.seo_impressions || 0), 0);
  const totalClicks = dailyData.reduce((s, d: any) => s + (d.seo_clicks || 0), 0);
  const totalTrafficPaid = dailyData.reduce((s, d: any) => s + (d.traffic_paid || 0), 0);
  const totalTrafficDirect = dailyData.reduce((s, d: any) => s + (d.traffic_direct || 0), 0);
  const totalTrafficReferral = dailyData.reduce((s, d: any) => s + (d.traffic_referral || 0), 0);
  const totalTrafficAI = dailyData.reduce((s, d: any) => s + (d.traffic_ai || 0), 0);
  const totalAllTraffic = totalOrganicVisits + totalTrafficPaid + totalTrafficDirect + totalTrafficReferral + totalTrafficAI;
  const totalNewUsers = dailyData.reduce((s, d: any) => s + (d.new_users || 0), 0);
  const totalReturningUsers = dailyData.reduce((s, d: any) => s + (d.returning_users || 0), 0);
  const totalDesktopSessions = dailyData.reduce((s, d: any) => s + (d.sessions_desktop || 0), 0);
  const totalMobileSessions = dailyData.reduce((s, d: any) => s + (d.sessions_mobile || 0), 0);
  const totalBlogSessions = dailyData.reduce((s, d: any) => s + (d.blog_sessions || 0), 0);

  const avgCtrNum = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCtr = avgCtrNum > 0 ? fmtPct(avgCtrNum, 2) : '—';
  const totalSessionsForEngagement = dailyData.reduce((s, d: any) => s + (d.sessions || 0), 0);
  const avgEngagementRate = totalSessionsForEngagement > 0
    ? (dailyData.reduce((s, d: any) => s + ((d.engagement_rate || 0) * (d.sessions || 0)), 0) / totalSessionsForEngagement).toFixed(1)
    : '0.0';
  const rankDays = dailyData.filter((d: any) => d.google_rank);
  const avgGoogleRankValue = rankDays.length > 0
    ? rankDays.reduce((s, d: any) => s + (d.google_rank || 0), 0) / rankDays.length : 0;

  const keywordsNetChange = keywordMovement.improved - keywordMovement.declined;
  const hasAds = (client as any).services?.googleAds !== false;

  // ── MoM ──────────────────────────────────────────────────────────────────
  const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000);
  const prevPeriodEnd = new Date(dateRange.from); prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);
  const prevPeriodStart = new Date(prevPeriodEnd); prevPeriodStart.setDate(prevPeriodStart.getDate() - periodDays);
  const fmtD = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const prevLabel = `${fmtD(prevPeriodStart)} – ${fmtD(prevPeriodEnd)}`;

  const calcMoM = (curr: number, prev: number) => {
    if (prev === 0) return { pct: null, label: prevLabel };
    return { pct: ((curr - prev) / prev) * 100, label: prevLabel };
  };
  const visitsMoM = calcMoM(totalVisits, prevPeriodMetrics.sessions);
  const visitorsMoM = calcMoM(totalUniqueVisitors, prevPeriodMetrics.users);
  const ctrMoM = calcMoM(avgCtrNum, prevPeriodMetrics.ctr);
  const organicMoM = calcMoM(totalOrganicVisits, prevPeriodMetrics.organicVisits);

  const momBadge = (mom: { pct: number | null; label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: mom.pct === null ? '#9ca3af' : mom.pct >= 0 ? '#10b981' : '#ef4444' }}>
        {mom.pct === null ? '—' : `${mom.pct >= 0 ? '+' : ''}${mom.pct.toFixed(1)}%`}
      </span>
      <span style={{ fontSize: '9px', color: '#9ca3af' }}>vs {mom.label}</span>
    </div>
  );

  const lastDataDate = dailyData.length > 0 ? dailyData[dailyData.length - 1].date : null;

  // Traffic channels for distribution
  const trafficSourceData = [
    { name: 'Organic Search', value: totalOrganicVisits, color: '#9db5a0' },
    { name: 'Direct', value: totalTrafficDirect, color: '#a8a094' },
    ...(totalTrafficPaid > 0 ? [{ name: 'Paid Ads', value: totalTrafficPaid, color: '#c4704f' }] : []),
    { name: 'Referral', value: totalTrafficReferral, color: '#8b7355' },
    ...(totalTrafficAI > 0 ? [{ name: 'AI Assistants', value: totalTrafficAI, color: '#6b5b95' }] : []),
  ].filter(s => s.value > 0);

  const card = { background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' };
  const miniCard = { ...card, borderRadius: '16px', padding: '20px' };

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} clientName={client.name} clientCity={client.city} activeTab="seo" />
      {fetchError && (
        <div style={{
          background: 'rgba(196,112,79,0.1)',
          border: '1px solid #c4704f',
          borderRadius: '8px',
          padding: '12px 16px',
          margin: '16px 24px 0',
          color: '#8a4a2e',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          ⚠️ {fetchError}
          <button onClick={() => setFetchError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#8a4a2e', fontSize: '16px' }}>✕</button>
        </div>
      )}

      {/* Sticky date bar — justify-end, consistent with all other tabs */}
      <div className="sticky top-14 md:top-0 z-30 flex items-center justify-end gap-3 px-8 py-3"
        style={{ background: 'rgba(245,241,237,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
        {lastDataDate && (
          <span style={{ fontSize: '11px', color: '#9ca3af', marginRight: 'auto' }}>
            Data through {new Date(lastDataDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
        <div className="flex gap-1 p-1 rounded-full" style={{ background: 'rgba(44,36,25,0.05)' }}>
          {([7, 30, 90] as const).map(d => (
            <button key={d} onClick={() => handlePresetDays(d)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition"
              style={{ background: d === selectedDays ? '#fff' : 'transparent', color: d === selectedDays ? '#2c2419' : '#5c5850', cursor: 'pointer' }}>
              {d}d
            </button>
          ))}
        </div>
        <DateRangePicker dateRange={dateRange} onDateRangeChange={(r) => { setSelectedDays(null); setDateRange(r); }} />
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-10">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.15em' }}>SEO PERFORMANCE</span>
            <h1 className="text-4xl font-black mt-2" style={{ color: '#2c2419', letterSpacing: '-0.02em' }}>Search Performance</h1>
            <p className="text-sm mt-2" style={{ color: '#9ca3af' }}>How often patients find you on Google — and what they do next</p>
          </div>

          {/* ── KPI Cards ──────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {[
              {
                label: 'Website Visits',
                sub: 'Total visits from all sources',
                value: fmtNum(totalVisits),
                mom: visitsMoM,
                color: '#9db5a0',
              },
              {
                label: 'Unique Visitors',
                sub: 'Individual people who visited',
                value: fmtNum(totalUniqueVisitors),
                mom: visitorsMoM,
                color: '#c4704f',
              },
              {
                label: 'Google Search Visits',
                sub: 'Visitors from organic search',
                value: fmtNum(totalOrganicVisits),
                mom: organicMoM,
                color: '#d9a854',
              },
              {
                label: 'Click Rate',
                sub: 'Of Google searchers who clicked',
                value: avgCtr,
                mom: ctrMoM,
                color: '#2c2419',
              },
            ].map((kpi, i) => (
              <div key={i} style={miniCard}>
                <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: 600, margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{kpi.label}</p>
                <p style={{ fontSize: '10px', color: '#9ca3af', margin: '0 0 10px 0' }}>{kpi.sub}</p>
                <p style={{ fontSize: '32px', fontWeight: 700, color: kpi.color, margin: 0 }}>{kpi.value}</p>
                {momBadge(kpi.mom)}
              </div>
            ))}
          </div>

          {/* ── Key Insights ─────────────────────────────────────────── */}
          <div style={{ ...card, marginBottom: '32px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 10px 0' }}>SEO Summary</p>
            <p style={{ fontSize: '13px', color: '#5c5850', margin: 0, lineHeight: '1.8' }}>
              In the last <strong>{periodDays} days</strong>, your website appeared in Google search results{' '}
              <strong>{fmtNum(totalImpressions)} times</strong> and received{' '}
              <strong>{fmtNum(totalClicks)} clicks</strong> (click rate: <strong>{avgCtr}</strong>).{' '}
              Your site received <strong>{fmtNum(totalOrganicVisits)} visitors from Google Search</strong> out of{' '}
              <strong>{fmtNum(totalVisits)} total website visits</strong>.
              {keywordMovement.improved > 0 || keywordMovement.declined > 0 ? (
                <> Keyword rankings: <strong style={{ color: '#10b981' }}>{keywordMovement.improved} moved up</strong>{', '}
                <strong style={{ color: '#ef4444' }}>{keywordMovement.declined} moved down</strong> compared to the previous period.</>
              ) : null}
              {visitsMoM.pct !== null && visitsMoM.pct !== 0 ? (
                <> Overall visits are{' '}
                <strong style={{ color: visitsMoM.pct > 0 ? '#10b981' : '#ef4444' }}>
                  {visitsMoM.pct > 0 ? `up ${visitsMoM.pct.toFixed(1)}%` : `down ${Math.abs(visitsMoM.pct).toFixed(1)}%`}
                </strong>{' '}compared to {prevLabel}.</>) : null}
            </p>
          </div>

          {/* ── Trend Chart ──────────────────────────────────────────── */}
          <div style={{ ...card, marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '24px' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 6px 0' }}>Daily Trend</p>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#2c2419', margin: 0 }}>Search Visibility Over Time</h3>
              </div>
            </div>
            <SEOTrendChart data={dailyData} height={360} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(44,36,25,0.08)' }}>
              {[
                { label: 'Times Shown on Google', value: fmtNum(totalImpressions), color: '#c4704f', sub: 'Search impressions' },
                { label: 'Times Clicked', value: fmtNum(totalClicks), color: '#10b981', sub: 'From search results' },
                { label: 'Click Rate', value: avgCtr, color: '#d9a854', sub: avgCtrNum > 5 ? 'Excellent' : avgCtrNum > 2 ? 'Good' : avgCtrNum === 0 ? '—' : 'Needs work' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'rgba(44,36,25,0.02)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '10px', color: '#5c5850', fontWeight: 600, margin: '0 0 8px 0', textTransform: 'uppercase' }}>{s.label}</p>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: s.color, margin: '0 0 4px 0' }}>{s.value}</p>
                  <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>{s.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Visitor Journey (Funnel) ──────────────────────────────── */}
          <div style={{ ...card, marginBottom: '32px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 6px 0' }}>Patient Journey</p>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#2c2419', margin: '0 0 28px 0' }}>From Google Search to Contact Form</h3>
            {(() => {
              const s1 = totalVisits;
              const s2 = totalOrganicVisits;
              const s3 = realConversions;
              const maxVal = s1 || 1;
              const organicRate = s1 > 0 ? fmtPct((s2 / s1) * 100, 1) : '0%';
              const formRate = s2 > 0 ? fmtPct((s3 / s2) * 100, 2) : '0%';
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {[
                    { label: 'All Website Visits', value: s1, width: 100, color: '#9db5a0', sub: '' },
                    { label: 'Visits from Google Search', value: s2, width: s1 > 0 ? (s2 / maxVal) * 100 : 0, color: '#c4704f', sub: `${organicRate} of all visits` },
                    ...(s3 > 0 ? [{ label: 'Contact Forms Submitted', value: s3, width: s1 > 0 ? Math.max((s3 / maxVal) * 100, 1) : 0, color: '#10b981', sub: `${formRate} of Google visitors submitted a form` }] : []),
                  ].map((row, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#5c5850' }}>{row.label}</span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '22px', fontWeight: 700, color: row.color }}>{fmtNum(row.value)}</span>
                          {row.sub && <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>{row.sub}</p>}
                        </div>
                      </div>
                      <div style={{ width: '100%', height: '32px', background: 'rgba(44,36,25,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${row.width}%`, height: '100%', background: row.color, borderRadius: '8px', opacity: 0.85 }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', paddingTop: '16px', borderTop: '1px solid rgba(44,36,25,0.08)' }}>
                    <div style={{ background: 'rgba(157,181,160,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <p style={{ fontSize: '9px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600, textTransform: 'uppercase' }}>Avg Daily Visits</p>
                      <p style={{ fontSize: '20px', fontWeight: 700, color: '#9db5a0', margin: 0 }}>{dailyData.length > 0 ? fmtNum(Math.round(s1 / dailyData.length)) : 0}</p>
                    </div>
                    <div style={{ background: 'rgba(196,112,79,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <p style={{ fontSize: '9px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600, textTransform: 'uppercase' }}>Google Search Share</p>
                      <p style={{ fontSize: '20px', fontWeight: 700, color: '#c4704f', margin: 0 }}>{organicRate}</p>
                    </div>
                    <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <p style={{ fontSize: '9px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600, textTransform: 'uppercase' }}>Form Submission Rate</p>
                      <p style={{ fontSize: '20px', fontWeight: 700, color: '#10b981', margin: 0 }}>{s3 > 0 ? formRate : '—'}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Keyword Performance ──────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
            {/* Rankings */}
            <div style={card}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 6px 0' }}>Google Rankings</p>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0' }}>Where Your Keywords Rank</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Top 5', value: keywordRankBuckets.top5, color: '#10b981', sub: 'Most visible' },
                  { label: 'Top 10', value: keywordRankBuckets.top10, color: '#d9a854', sub: 'Page 1' },
                  { label: 'Pos 11–20', value: keywordRankBuckets.top11to20, color: '#c4704f', sub: 'Page 2' },
                ].map((b, i) => (
                  <div key={i} style={{ background: `rgba(${b.color === '#10b981' ? '16,185,129' : b.color === '#d9a854' ? '217,168,84' : '196,112,79'},0.08)`, borderRadius: '12px', padding: '14px', textAlign: 'center', borderTop: `3px solid ${b.color}` }}>
                    <p style={{ fontSize: '9px', fontWeight: 600, color: '#5c5850', margin: '0 0 4px 0', textTransform: 'uppercase' }}>{b.label}</p>
                    <p style={{ fontSize: '24px', fontWeight: 700, color: b.color, margin: '0 0 2px 0' }}>{b.value}</p>
                    <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>{b.sub}</p>
                  </div>
                ))}
              </div>
              {/* Avg position with context */}
              <div style={{ background: 'rgba(44,36,25,0.04)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 600, textTransform: 'uppercase' }}>Average Position</p>
                  <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>Lower = closer to #1 on Google</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '28px', fontWeight: 700, color: avgGoogleRankValue === 0 ? '#9ca3af' : avgGoogleRankValue <= 10 ? '#10b981' : avgGoogleRankValue <= 20 ? '#d9a854' : '#c4704f', margin: 0 }}>
                    {avgGoogleRankValue > 0 ? `#${avgGoogleRankValue.toFixed(1)}` : '—'}
                  </p>
                  {avgGoogleRankValue > 0 && (
                    <p style={{ fontSize: '9px', fontWeight: 600, color: avgGoogleRankValue <= 10 ? '#10b981' : avgGoogleRankValue <= 20 ? '#d9a854' : '#c4704f', margin: 0 }}>
                      {avgGoogleRankValue <= 10 ? 'Page 1' : avgGoogleRankValue <= 20 ? 'Page 2' : 'Page 3+'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Keyword movement */}
            <div style={card}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 6px 0' }}>Ranking Changes</p>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0' }}>Keywords Moving Up or Down</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <p style={{ fontSize: '10px', color: '#10b981', margin: '0 0 4px 0', fontWeight: 700 }}>↑ Moved Up</p>
                  <p style={{ fontSize: '28px', fontWeight: 700, color: '#10b981', margin: 0 }}>{keywordMovement.improved}</p>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <p style={{ fontSize: '10px', color: '#ef4444', margin: '0 0 4px 0', fontWeight: 700 }}>↓ Moved Down</p>
                  <p style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444', margin: 0 }}>{keywordMovement.declined}</p>
                </div>
                <div style={{ background: keywordsNetChange >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: `1px solid ${keywordsNetChange >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
                  <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: 700 }}>Net</p>
                  <p style={{ fontSize: '28px', fontWeight: 700, color: keywordsNetChange >= 0 ? '#10b981' : '#ef4444', margin: 0 }}>
                    {keywordsNetChange >= 0 ? '+' : ''}{keywordsNetChange}
                  </p>
                </div>
              </div>
              {/* Engagement Rate */}
              <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(44,36,25,0.08)' }}>
                <p style={{ fontSize: '10px', fontWeight: 600, color: '#5c5850', margin: '0 0 12px 0', textTransform: 'uppercase' }}>Visitor Engagement</p>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#5c5850' }}>Engagement Rate</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981' }}>{avgEngagementRate}%</span>
                      <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '6px' }}>
                        {parseFloat(avgEngagementRate) > 60 ? 'Excellent' : parseFloat(avgEngagementRate) > 40 ? 'Good' : 'Needs work'}
                      </span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(44,36,25,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(parseFloat(avgEngagementRate), 100)}%`, height: '100%', background: '#10b981', borderRadius: '4px' }} />
                  </div>
                  <p style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px' }}>% of visitors who stayed and interacted with your site</p>
                </div>
                {avgCtrNum > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>Click Rate (CTR)</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: avgCtrNum > 5 ? '#10b981' : avgCtrNum > 2 ? '#d9a854' : '#ef4444' }}>{avgCtr}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(44,36,25,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(avgCtrNum, 100)}%`, height: '100%', background: avgCtrNum > 5 ? '#10b981' : avgCtrNum > 2 ? '#d9a854' : '#c4704f', borderRadius: '4px' }} />
                    </div>
                    <p style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px' }}>% of people who saw your site on Google and clicked</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Visitor Breakdown ────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
            {/* New vs Returning + Device */}
            <div style={card}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 6px 0' }}>Visitor Profile</p>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: '0 0 20px 0' }}>Who's Visiting Your Site</h3>
              <p style={{ fontSize: '10px', fontWeight: 600, color: '#5c5850', margin: '0 0 10px 0', textTransform: 'uppercase' }}>New vs Returning Patients</p>
              {[
                { label: 'First-time visitors', value: totalNewUsers, total: totalUniqueVisitors, color: '#10b981' },
                { label: 'Returning visitors', value: totalReturningUsers, total: totalUniqueVisitors, color: '#c4704f' },
              ].map((item, idx) => (
                <div key={idx} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#5c5850', fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: item.color }}>
                      {fmtNum(item.value)} ({item.total > 0 ? fmtPct((item.value / item.total) * 100, 1) : '0%'})
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(44,36,25,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%`, height: '100%', background: item.color, borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
              <p style={{ fontSize: '10px', fontWeight: 600, color: '#5c5850', margin: '16px 0 10px 0', textTransform: 'uppercase' }}>Device Used</p>
              {[
                { label: 'Desktop / Laptop', value: totalDesktopSessions, color: '#d9a854' },
                { label: 'Mobile Phone', value: totalMobileSessions, color: '#9db5a0' },
              ].map((item, idx) => (
                <div key={idx} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#5c5850', fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: item.color }}>
                      {fmtNum(item.value)} ({totalVisits > 0 ? fmtPct((item.value / totalVisits) * 100, 1) : '0%'})
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(44,36,25,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${totalVisits > 0 ? (item.value / totalVisits) * 100 : 0}%`, height: '100%', background: item.color, borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Traffic Sources */}
            <div style={card}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 6px 0' }}>Traffic Sources</p>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: '0 0 16px 0' }}>How Visitors Found You</h3>
              {trafficSourceData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={trafficSourceData.filter(s => s.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {trafficSourceData.filter(s => s.value > 0).map((source, idx) => (
                          <Cell key={idx} fill={source.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '8px', fontSize: '11px' }}
                        formatter={(value: number, name: string) => [
                          `${fmtNum(value)} (${totalAllTraffic > 0 ? ((value / totalAllTraffic) * 100).toFixed(1) : '0'}%)`,
                          name
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                    {trafficSourceData.filter(s => s.value > 0).map((source, idx) => {
                      const pct = totalAllTraffic > 0 ? ((source.value / totalAllTraffic) * 100).toFixed(1) : '0';
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: source.color, flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', color: '#2c2419', fontWeight: 500 }}>{source.name}</span>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: source.color }}>{fmtNum(source.value)} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({pct}%)</span></span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p style={{ color: '#9ca3af', fontSize: '13px' }}>No traffic data for this period</p>
              )}
              {totalBlogSessions > 0 && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(44,36,25,0.08)' }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#5c5850', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Blog / Articles</p>
                  <div style={{ background: 'rgba(157,181,160,0.08)', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '12px', color: '#5c5850', margin: 0 }}>Blog visits</p>
                    <p style={{ fontSize: '20px', fontWeight: 700, color: '#9db5a0', margin: 0 }}>{fmtNum(totalBlogSessions)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}
