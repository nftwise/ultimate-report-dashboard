'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import DateRangePicker from '@/components/admin/DateRangePicker';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';
import { COLORS, MS_PER_DAY } from '@/lib/design-tokens';
import { fmtNum, fmtCurrency, toLocalDateStr } from '@/lib/format';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer } from 'recharts';
import { Users, Globe, DollarSign, Target, Phone, FileText, Settings, BarChart2, RefreshCw } from 'lucide-react';

const ChartSkeleton = () => (
  <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#9ca3af', fontSize: '13px' }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
    Loading chart…
  </div>
);

const SkeletonCard = () => (
  <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: 16, padding: 20, border: '1px solid rgba(44,36,25,0.08)', animation: 'pulse 1.5s infinite' }}>
    <div style={{ height: 8, width: '40%', background: '#e5e7eb', borderRadius: 4, marginBottom: 10 }} />
    <div style={{ height: 7, width: '70%', background: '#f3f4f6', borderRadius: 4, marginBottom: 14 }} />
    <div style={{ height: 28, width: '45%', background: '#e5e7eb', borderRadius: 4 }} />
  </div>
);

function EmptyState({ source, hasConfig }: { source: string; hasConfig: boolean }) {
  if (!hasConfig) return (
    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
      <Settings size={28} style={{ opacity: 0.4, display: 'block', margin: '0 auto 10px' }} />
      <p style={{ margin: '0 0 4px', fontSize: 14 }}>{source} is not connected yet.</p>
      <p style={{ fontSize: 12, margin: 0 }}>Contact admin to configure this integration.</p>
    </div>
  );
  return (
    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
      <BarChart2 size={28} style={{ opacity: 0.4, display: 'block', margin: '0 auto 10px' }} />
      <p style={{ margin: '0 0 4px', fontSize: 14 }}>No data for this period.</p>
      <p style={{ fontSize: 12, margin: 0 }}>Try selecting a different date range.</p>
    </div>
  );
}

const SixMonthBarChart = dynamic(() => import('@/components/admin/SixMonthBarChart'), { ssr: false, loading: ChartSkeleton });
const DailyTrafficLineChart = dynamic(() => import('@/components/admin/DailyTrafficLineChart'), { ssr: false, loading: ChartSkeleton });

// ── Design tokens ──────────────────────────────────────────────────────────
const FF = { serif: "'Fraunces', Georgia, serif", outfit: "'Outfit', sans-serif", mono: "'JetBrains Mono', monospace", sans: "'Inter', sans-serif" };
const C2 = {
  choc: '#2c2419', coral: '#c4704f', gold: '#d9a854', sage: '#9db5a0', emerald: '#10b981',
  text2: '#5c5850', muted: '#9ca3af',
  borderSoft: 'rgba(44,36,25,0.08)', borderMed: 'rgba(44,36,25,0.14)',
  upBg: 'rgba(157,181,160,0.18)', upFg: '#4a6b4e', downBg: 'rgba(196,112,79,0.15)', downFg: '#8a4a2e', neutBg: 'rgba(92,88,80,0.1)', neutFg: '#5c5850',
};
const CARD = { background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: 16, boxShadow: '0 4px 20px rgba(44,36,25,0.06)' };

function SectionHead({ title, italic: it, meta }: { title: string; italic: string; meta?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, margin: '26px 0 13px' }}>
      <h3 style={{ fontFamily: FF.serif, fontWeight: 500, fontSize: 21, color: C2.choc, letterSpacing: '-0.01em', margin: 0 }}>
        {title} <em style={{ fontStyle: 'italic', color: C2.coral, fontWeight: 400 }}>{it}</em>
      </h3>
      {meta && <span style={{ fontSize: 11, color: C2.muted, fontFamily: FF.mono, letterSpacing: '0.05em', flexShrink: 0 }}>{meta}</span>}
    </div>
  );
}

function TrendBadge({ mom }: { mom: { pct: string; type: 'up'|'down'|'neutral' } }) {
  if (mom.pct === '—') return <span style={{ fontSize: 11, color: C2.muted }}>—</span>;
  const bg = mom.type === 'up' ? C2.upBg : mom.type === 'down' ? C2.downBg : C2.neutBg;
  const fg = mom.type === 'up' ? C2.upFg : mom.type === 'down' ? C2.downFg : C2.neutFg;
  const arrow = mom.type === 'up' ? '▲' : mom.type === 'down' ? '▼' : '●';
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color: fg }}>{arrow} {mom.pct}</span>;
}

interface ClientMetrics {
  id: string;
  name: string;
  slug: string;
  city: string;
  notes?: string | null;
  total_leads?: number;
  form_fills?: number;
  gbp_calls?: number;
  ads_conversions?: number;
  services?: {
    googleAds: boolean;
    seo: boolean;
    googleLocalService: boolean;
  };
}

interface DailyMetrics {
  date: string;
  total_leads: number;
  form_fills: number;
  gbp_calls: number;
  gbp_profile_views?: number;
  gbp_website_clicks?: number;
  gbp_direction_requests?: number;
  google_ads_conversions: number;
  sessions?: number;
  seo_impressions?: number;
  seo_clicks?: number;
  seo_ctr?: number;
  traffic_organic?: number;
  traffic_paid?: number;
  traffic_direct?: number;
  traffic_referral?: number;
  traffic_ai?: number;
  ads_impressions?: number;
  ads_clicks?: number;
  ads_ctr?: number;
  ad_spend?: number;
  cpl?: number;
  budget_utilization?: number;
}

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const clientSlug = params?.clientSlug as string;

  const [client, setClient] = useState<ClientMetrics | null>(null);
  const [dailyData, setDailyData] = useState<DailyMetrics[]>([]);
  const [prevData, setPrevData] = useState<{ leads: number; sessions: number; adSpend: number; adsCv: number; seoClicks: number; gbpCalls: number; formFills: number }>({ leads: 0, sessions: 0, adSpend: 0, adsCv: 0, seoClicks: 0, gbpCalls: 0, formFills: 0 });
  const [manualFormFills, setManualFormFills] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<7 | 30 | 90 | null>(30);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date(); to.setDate(to.getDate() - 1);
    const from = new Date(to); from.setDate(from.getDate() - 30);
    return { from, to };
  });
  const [lastAvailableDate, setLastAvailableDate] = useState<Date | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [latestGbpRating, setLatestGbpRating] = useState(0);

  const handlePresetDays = (days: 7 | 30 | 90) => {
    setSelectedDays(days);
    const to = lastAvailableDate ?? (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })();
    const from = new Date(to); from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  const handleDateRangeChange = (newRange: { from: Date; to: Date }) => {
    setSelectedDays(null);
    setDateRange(newRange);
  };

  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/clients/list');
        const data = await response.json();
        if (data.success && data.clients) {
          const foundClient = data.clients.find((c: any) => c.slug === clientSlug);
          if (foundClient) setClient(foundClient);
        }
      } catch (error) {
        console.error('Error fetching client:', error);
      } finally {
        setLoading(false);
      }
    };
    if (clientSlug) fetchClient();
  }, [clientSlug]);

  // Bootstrap: fetch lastAvailableDate + latestGbpRating in a single API call
  useEffect(() => {
    if (!client) return;
    fetch(`/api/portal/overview?clientId=${encodeURIComponent(client.id)}`)
      .then(r => r.json())
      .then((data: any) => {
        if (!data?.success) return;
        if (data.lastAvailableDate) {
          const to = new Date(data.lastAvailableDate + 'T12:00:00');
          setLastAvailableDate(to);
          const from = new Date(to); from.setDate(from.getDate() - 30);
          setDateRange({ from, to });
        }
        if (data.latestGbpRating > 0) setLatestGbpRating(data.latestGbpRating);
      })
      .catch(err => console.error('[Overview bootstrap]', err));
  }, [client]);

  const fetchDailyMetrics = async () => {
    if (!client) return;
    setChartLoading(true);
    try {
      const dateFromISO = toLocalDateStr(dateRange.from);
      const dateToISO = toLocalDateStr(dateRange.to);

      const url = `/api/portal/overview?clientId=${encodeURIComponent(client.id)}&from=${dateFromISO}&to=${dateToISO}`;
      const res = await fetch(url);
      const payload = await res.json();

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load data');
      }

      setDailyData((payload.daily || []) as DailyMetrics[]);
      setManualFormFills(payload.manualFormFills || 0);
      setPrevData({
        leads:     payload.prevPeriod?.leads     || 0,
        sessions:  payload.prevPeriod?.sessions  || 0,
        adSpend:   payload.prevPeriod?.adSpend   || 0,
        adsCv:     payload.prevPeriod?.adsCv     || 0,
        seoClicks: payload.prevPeriod?.seoClicks || 0,
        gbpCalls:  payload.prevPeriod?.gbpCalls  || 0,
        formFills: payload.prevPeriod?.formFills || 0,
      });
      setFetchError(null);
      // Only mark refreshed when we actually got rows back
      if ((payload.daily || []).length > 0) setLastRefreshed(new Date());
    } catch (error: any) {
      console.error('[Client Details] Error:', error);
      setFetchError(error?.message || 'Unable to load data. Please try again.');
      setDailyData([]);
    } finally {
      setChartLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchDailyMetrics(); }, [client, dateRange.from, dateRange.to]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p style={{ color: '#2c2419' }}>Loading...</p>
        </div>
      </AdminLayout>
    );
  }

  // After loading completes but no client matched the slug → 404 state.
  if (!client) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex flex-col items-center justify-center" style={{ padding: '40px 20px' }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <div style={{ fontSize: 56, fontFamily: FF.serif, fontWeight: 500, color: C2.coral, lineHeight: 1, marginBottom: 12 }}>
              404
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: C2.choc, marginBottom: 8 }}>
              Client not found
            </h1>
            <p style={{ color: C2.text2, fontSize: 14, marginBottom: 20 }}>
              No active client matches the slug <code style={{ background: 'rgba(44,36,25,0.06)', padding: '2px 6px', borderRadius: 4, fontFamily: FF.mono }}>{clientSlug}</code>.
              It may have been renamed or deactivated.
            </p>
            <button
              onClick={() => router.push('/admin-dashboard')}
              style={{ background: C2.coral, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              ← Back to dashboard
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // ── Aggregates ─────────────────────────────────────────────────────────────
  const totalFormFills    = dailyData.reduce((s: number, d: any) => s + (d.form_fills || 0), 0);
  const totalGbpCalls     = dailyData.reduce((s: number, d: any) => s + (d.gbp_calls || 0), 0);
  const totalGbpWebsiteClicks = dailyData.reduce((s: number, d: any) => s + (d.gbp_website_clicks || 0), 0);
  const totalGbpDirections    = dailyData.reduce((s: number, d: any) => s + (d.gbp_direction_requests || 0), 0);
  const totalAdsConversions   = dailyData.reduce((s: number, d: any) => s + (d.google_ads_conversions || 0), 0);
  const verifiedFormFills = manualFormFills > 0 ? manualFormFills : totalFormFills;
  const totalLeads   = verifiedFormFills + totalAdsConversions + totalGbpCalls;
  const adSpend      = dailyData.reduce((s: number, d: any) => s + (d.ad_spend || 0), 0);
  const costPerLead  = totalAdsConversions > 0 ? Math.round((adSpend / totalAdsConversions) * 100) / 100 : 0;
  const sessions     = dailyData.reduce((s: number, d: any) => s + (d.sessions || 0), 0);
  const seoImpressions = dailyData.reduce((s: number, d: any) => s + (d.seo_impressions || 0), 0);
  const seoClicks    = dailyData.reduce((s: number, d: any) => s + (d.seo_clicks || 0), 0);
  const seoCtr       = seoImpressions > 0 ? ((seoClicks / seoImpressions) * 100).toFixed(2) : '0.00';
  const adsClicks    = dailyData.reduce((s: number, d: any) => s + (d.ads_clicks || 0), 0);
  const adsImpressions = dailyData.reduce((s: number, d: any) => s + (d.ads_impressions || 0), 0);
  const adsCtr       = adsImpressions > 0 ? ((adsClicks / adsImpressions) * 100).toFixed(2) : '0.00';
  const trafficOrganic = dailyData.reduce((s: number, d: any) => s + (d.traffic_organic || 0), 0);
  const trafficAi    = dailyData.reduce((s: number, d: any) => s + (d.traffic_ai || 0), 0);
  const trafficPaid  = dailyData.reduce((s: number, d: any) => s + (d.traffic_paid || 0), 0);
  const trafficDirect = dailyData.reduce((s: number, d: any) => s + (d.traffic_direct || 0), 0);
  const trafficReferral = dailyData.reduce((s: number, d: any) => s + (d.traffic_referral || 0), 0);
  const totalTraffic = trafficOrganic + trafficPaid + trafficDirect + trafficReferral + trafficAi;

  // Default-deny: only show service section when explicitly configured.
  // `!== false` would treat undefined as "yes", showing GBP for clients
  // who haven't set it up yet.
  const hasAds = client.services?.googleAds === true;
  const hasSeo = client.services?.seo === true;
  const hasGbp = client.services?.googleLocalService === true;

  // ── MoM ───────────────────────────────────────────────────────────────────
  const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / MS_PER_DAY);
  const calcMoM = (curr: number, prev: number, invert = false) => {
    if (prev === 0) return { pct: '—', type: 'neutral' as const };
    const raw = (curr - prev) / prev * 100;
    const isPos = raw > 0;
    const type = Math.abs(raw) < 0.01 ? 'neutral' : (invert ? (raw < 0 ? 'up' : 'down') : (raw > 0 ? 'up' : 'down'));
    return { pct: isPos ? `+${raw.toFixed(1)}%` : `${raw.toFixed(1)}%`, type: type as 'up' | 'down' | 'neutral' };
  };

  const prevPeriodEnd   = new Date(dateRange.from); prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);
  const prevPeriodStart = new Date(prevPeriodEnd);   prevPeriodStart.setDate(prevPeriodStart.getDate() - periodDays);
  const fmtD = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const prevLabel = `${fmtD(prevPeriodStart)} – ${fmtD(prevPeriodEnd)}`;

  const prevCpl          = prevData.adsCv > 0 ? prevData.adSpend / prevData.adsCv : 0;
  const leadTrendData    = calcMoM(totalLeads, prevData.leads);
  const sessionsTrendData = calcMoM(sessions, prevData.sessions);
  const adSpendTrendData = calcMoM(adSpend, prevData.adSpend, true);
  const cplTrendData     = calcMoM(costPerLead, prevCpl, true);
  const gbpCallsTrendData = calcMoM(totalGbpCalls, prevData.gbpCalls);
  const formFillsTrendData = calcMoM(totalFormFills, prevData.formFills);
  const leadTrend = leadTrendData.pct;
  const isTrendUp = leadTrendData.type === 'up';

  // ── KPI card helper ────────────────────────────────────────────────────────
  const kpiCard = (accentColor: string, iconBg: string, iconFg: string, icon: React.ReactNode, label: string, desc: string, value: string, mom: ReturnType<typeof calcMoM>, compare: string, extra?: React.ReactNode) => (
    <div className="kpi-card-wrap" style={{ ...CARD, padding: '18px 18px 16px', position: 'relative', overflow: 'hidden', transition: 'transform 200ms, box-shadow 200ms' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accentColor }} />
      <div style={{ width: 30, height: 30, borderRadius: 8, background: iconBg, color: iconFg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        {icon}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.10em', color: C2.text2, fontFamily: FF.mono, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 10, color: C2.muted, marginBottom: 10, lineHeight: 1.4 }}>{desc}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' as const, marginBottom: 5 }}>
        <span style={{ fontFamily: FF.outfit, fontWeight: 800, fontSize: 34, lineHeight: 1, letterSpacing: '-0.025em', color: C2.choc }}>{value}</span>
        <TrendBadge mom={mom} />
      </div>
      <div style={{ fontSize: 10, color: C2.muted, fontFamily: FF.mono }}>{compare}</div>
      {extra}
    </div>
  );

  // ── Channel detail cards ───────────────────────────────────────────────────
  const channelDefs = [
    ...(hasAds ? [{
      title: 'Google Ads', accent: C2.coral,
      iconBg: 'rgba(196,112,79,0.10)', iconFg: C2.coral,
      metrics: [
        { label: 'Inquiries', value: fmtNum(totalAdsConversions) },
        { label: 'Ad Clicks', value: fmtNum(adsClicks) },
        { label: 'Amount Spent', value: fmtCurrency(adSpend, 0) },
        { label: 'Click Rate', value: `${adsCtr}%` },
      ],
    }] : []),
    ...(hasSeo ? [{
      title: 'Google Search (SEO)', accent: C2.sage,
      iconBg: 'rgba(157,181,160,0.18)', iconFg: '#4a6b4e',
      metrics: [
        { label: 'Link Clicks', value: fmtNum(seoClicks) },
        { label: 'Impressions', value: fmtNum(seoImpressions) },
        { label: 'Click Rate', value: `${seoCtr}%` },
        { label: 'Organic Visitors', value: trafficOrganic > 0 ? fmtNum(trafficOrganic) : '—' },
      ],
    }] : []),
    ...((hasGbp || totalGbpCalls > 0) ? [{
      title: 'Google Business Profile', accent: C2.gold,
      iconBg: 'rgba(217,168,84,0.18)', iconFg: '#8a6a2e',
      metrics: [
        { label: 'Phone Calls', value: fmtNum(totalGbpCalls) },
        { label: 'Website Clicks', value: fmtNum(totalGbpWebsiteClicks) },
        { label: 'Direction Requests', value: fmtNum(totalGbpDirections) },
        { label: 'Star Rating', value: latestGbpRating > 0 ? `★ ${latestGbpRating.toFixed(1)}` : '—' },
      ],
    }] : []),
  ];

  // ── Donut chart data ───────────────────────────────────────────────────────
  const donutChannels = [
    ...(hasAds ? [{ label: 'Google Ads', sublabel: 'ad inquiries', value: totalAdsConversions, color: C2.coral }] : []),
    ...(hasSeo ? [{ label: 'Website Forms', sublabel: manualFormFills > 0 ? 'verified fills' : 'form events', value: manualFormFills > 0 ? manualFormFills : totalFormFills, color: C2.sage }] : []),
    ...((hasGbp || totalGbpCalls > 0) ? [{ label: 'Google Business', sublabel: 'phone calls', value: totalGbpCalls, color: C2.gold }] : []),
  ];
  const donutTotal = donutChannels.reduce((s, c) => s + c.value, 0);

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} clientName={client.name} clientCity={client.city} activeTab="overview" />

      {/* ── Sticky filter bar ──────────────────────────────────────── */}
      <div className="sticky top-14 md:top-0 z-30" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '9px 20px', background: 'rgba(245,241,237,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
        <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {dailyData.length > 0 && (
            <span style={{ fontSize: 11, color: C2.muted, fontFamily: FF.mono }}>
              Data through {new Date(dailyData[dailyData.length - 1].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {lastRefreshed && <span style={{ fontSize: 11, color: C2.emerald }}>· Updated just now</span>}
        </div>
        <button onClick={() => fetchDailyMetrics()} disabled={chartLoading}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(196,112,79,0.08)', border: '1px solid rgba(196,112,79,0.2)', borderRadius: 20, padding: '5px 12px', cursor: chartLoading ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, color: C2.coral }}
          onMouseEnter={e => { if (!chartLoading) { (e.currentTarget as HTMLElement).style.background = C2.coral; (e.currentTarget as HTMLElement).style.color = '#fff'; }}}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(196,112,79,0.08)'; (e.currentTarget as HTMLElement).style.color = C2.coral; }}>
          <RefreshCw size={11} style={{ animation: chartLoading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
        <div style={{ display: 'flex', gap: 2, background: 'rgba(44,36,25,0.05)', padding: 3, borderRadius: 999 }}>
          {([7, 30, 90] as const).map(d => (
            <button key={d} onClick={() => handlePresetDays(d)} style={{ padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 150ms', background: d === selectedDays ? '#fff' : 'transparent', color: d === selectedDays ? C2.choc : C2.text2, boxShadow: d === selectedDays ? '0 1px 4px rgba(44,36,25,0.08)' : 'none' }}>{d}d</button>
          ))}
        </div>
        <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div style={{ padding: '24px 28px 60px', maxWidth: 1400, margin: '0 auto' }}>
        <style>{`
          @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
          @keyframes pdot { 0%{box-shadow:0 0 0 0 rgba(16,185,129,.6)} 70%{box-shadow:0 0 0 6px rgba(16,185,129,0)} 100%{box-shadow:0 0 0 0 rgba(16,185,129,0)} }
          .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:6px; }
          .main-2col { display:grid; grid-template-columns:1.618fr 1fr; gap:16px; align-items:start; margin-top:26px; }
          .kpi-card-wrap:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(44,36,25,0.12),0 1px 4px rgba(44,36,25,0.05) !important; }
          .tbl-row:hover { background:rgba(44,36,25,0.02) !important; }
          @media(max-width:1100px){ .main-2col{grid-template-columns:1fr;} }
          @media(max-width:860px){ .kpi-grid{grid-template-columns:1fr 1fr;} }
          @media(max-width:560px){ .kpi-grid{grid-template-columns:1fr;} }
          @media(max-width:600px){ .dash-pad{padding:16px 14px 48px !important;} }
        `}</style>

        {/* Page header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C2.muted, fontFamily: FF.mono, marginBottom: 10, letterSpacing: '0.02em' }}>
            Clients
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            {client.name}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            <span style={{ color: C2.choc, fontWeight: 600 }}>Overview</span>
          </div>
          <h1 style={{ fontFamily: FF.serif, fontWeight: 500, fontSize: 'clamp(24px, 3vw, 36px)', letterSpacing: '-0.025em', color: C2.choc, lineHeight: 1.05, margin: 0 }}>
            Performance <em style={{ fontStyle: 'italic', color: C2.coral, fontWeight: 300 }}>Dashboard</em>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: C2.text2 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: C2.emerald, animation: 'pdot 2s infinite', flexShrink: 0 }} />
            {dailyData.length > 0
              ? `Data through ${new Date(dailyData[dailyData.length - 1].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${client.city || ''}`
              : 'Loading data…'}
          </div>
        </div>

        {/* Error banner */}
        {fetchError && (
          <div style={{ background: 'rgba(196,112,79,0.1)', border: '1px solid #c4704f', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#8a4a2e', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
            ⚠️ {fetchError}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => { setFetchError(null); fetchDailyMetrics(); }} style={{ background: '#c4704f', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 600 }}>Retry</button>
              <button onClick={() => setFetchError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a4a2e', fontSize: 16 }}>✕</button>
            </div>
          </div>
        )}

        {/* ── KPI section ───────────────────────────────────────────── */}
        <SectionHead title="Marketing" italic="Overview" meta={`vs ${prevLabel}`} />

        <div className="kpi-grid">
          {chartLoading ? (
            <>{[0,1,2,3].map(i => <SkeletonCard key={i} />)}</>
          ) : (<>
            {/* Patient Inquiries */}
            {kpiCard(C2.coral, 'rgba(196,112,79,0.10)', C2.coral, <Users size={15}/>,
              'Patient Inquiries', 'Phone + forms + Google Ads',
              fmtNum(totalLeads), leadTrendData, `vs ${fmtNum(prevData.leads)} prev period`)}

            {/* Website Visitors */}
            {kpiCard(C2.sage, 'rgba(157,181,160,0.18)', '#4a6b4e', <Globe size={15}/>,
              'Website Visitors', 'All sessions from every source',
              fmtNum(sessions), sessionsTrendData, `vs ${fmtNum(prevData.sessions)} prev period`)}

            {/* Ad Spend or Form Fills */}
            {hasAds
              ? kpiCard(C2.gold, 'rgba(217,168,84,0.18)', '#8a6a2e', <DollarSign size={15}/>,
                  'Ad Spend', 'Spent on Google Ads this period',
                  fmtCurrency(adSpend, 0), adSpendTrendData, `vs ${fmtCurrency(prevData.adSpend, 0)} prev period`)
              : kpiCard(C2.sage, 'rgba(157,181,160,0.18)', '#4a6b4e', <FileText size={15}/>,
                  'Form Fills', manualFormFills > 0 ? 'Verified · spam filtered' : 'GA4 events (manual not entered)',
                  manualFormFills > 0 ? fmtNum(manualFormFills) : fmtNum(totalFormFills),
                  formFillsTrendData, `vs ${fmtNum(prevData.formFills)} prev period`,
                  manualFormFills === 0 && totalFormFills > 0 ? <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 4 }}>⚠ Showing GA4 events</div> : null)
            }

            {/* Cost Per Lead or GBP Calls */}
            {hasAds
              ? kpiCard(C2.choc, 'rgba(44,36,25,0.08)', C2.choc, <Target size={15}/>,
                  'Cost Per Inquiry', 'Avg ad cost per patient inquiry',
                  costPerLead > 0 ? fmtCurrency(costPerLead) : '—',
                  cplTrendData, prevCpl > 0 ? `vs ${fmtCurrency(prevCpl)} prev period` : 'no prior data')
              : (hasGbp || totalGbpCalls > 0)
                ? kpiCard(C2.gold, 'rgba(217,168,84,0.18)', '#8a6a2e', <Phone size={15}/>,
                    'Google Phone Calls', 'Taps on Google Business phone',
                    fmtNum(totalGbpCalls), gbpCallsTrendData, `vs ${fmtNum(prevData.gbpCalls)} prev period`)
                : null}
          </>)}
        </div>

        {/* Empty state */}
        {!chartLoading && dailyData.length === 0 && (
          <div style={{ ...CARD, padding: 32, marginTop: 16 }}>
            <EmptyState source="Analytics" hasConfig={hasSeo || hasAds || hasGbp || totalGbpCalls > 0} />
          </div>
        )}

        {/* ── Daily activity chart ─────────────────────────────────── */}
        <SectionHead title="Daily" italic="Activity" />
        <div style={{ ...CARD, padding: '18px 20px 20px' }}>
          <div style={{ background: 'rgba(44,36,25,0.02)', borderRadius: 10, padding: '14px 14px 10px' }}>
            {chartLoading ? <ChartSkeleton /> : dailyData.length > 0 ? (
              <DailyTrafficLineChart data={dailyData} />
            ) : (
              <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C2.muted }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.5}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                <span style={{ fontSize: 13 }}>No data for this date range</span>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <div style={{ padding: '12px 14px', background: 'rgba(157,181,160,0.10)', borderRadius: 10, borderLeft: `3px solid ${C2.sage}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: C2.text2, fontFamily: FF.mono, marginBottom: 3 }}>Avg. Daily Visitors</div>
              <div style={{ fontFamily: FF.outfit, fontWeight: 800, fontSize: 22, color: C2.sage, letterSpacing: '-0.02em' }}>{fmtNum(Math.round(sessions / Math.max(dailyData.length, 1)))}</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(217,168,84,0.10)', borderRadius: 10, borderLeft: `3px solid ${C2.gold}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: C2.text2, fontFamily: FF.mono, marginBottom: 3 }}>Avg. Daily Inquiries</div>
              <div style={{ fontFamily: FF.outfit, fontWeight: 800, fontSize: 22, color: C2.gold, letterSpacing: '-0.02em' }}>{fmtNum(Math.round(totalLeads / Math.max(dailyData.length, 1)))}</div>
            </div>
          </div>
        </div>

        {/* ── 2-column: trends + sidebar ──────────────────────────── */}
        <div className="main-2col">

          {/* LEFT: Monthly trend + SEO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Monthly trend bar chart */}
            <div style={{ ...CARD, padding: '18px 20px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: C2.coral, fontFamily: FF.mono, marginBottom: 3 }}>Monthly Progress</div>
                  <div style={{ fontFamily: FF.serif, fontWeight: 500, fontSize: 19, color: C2.choc, letterSpacing: '-0.01em' }}>
                    Inquiries <em style={{ fontStyle: 'italic', color: C2.coral, fontWeight: 400 }}>Trend</em>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: FF.outfit, fontWeight: 800, fontSize: 26, color: isTrendUp ? '#4a6b4e' : C2.coral, letterSpacing: '-0.025em', lineHeight: 1 }}>
                    {leadTrendData.type === 'neutral' ? '—' : `${isTrendUp ? '↑' : '↓'} ${Math.abs(isNaN(parseFloat(leadTrend)) ? 0 : parseFloat(leadTrend))}%`}
                  </div>
                  <div style={{ fontSize: 10, color: C2.muted, marginTop: 2 }}>vs previous period</div>
                </div>
              </div>
              <div style={{ background: 'rgba(44,36,25,0.02)', borderRadius: 10, padding: 14 }}>
                {chartLoading ? <ChartSkeleton /> : dailyData.length > 0 ? (
                  <SixMonthBarChart data={dailyData} />
                ) : (
                  <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C2.muted }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.5}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                    <span style={{ fontSize: 13 }}>No data for this date range</span>
                  </div>
                )}
              </div>
            </div>

            {/* SEO Analytics */}
            {hasSeo && (
              <div style={{ ...CARD, padding: '18px 20px 20px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: C2.sage, fontFamily: FF.mono, marginBottom: 3 }}>Google Traffic</div>
                <div style={{ fontFamily: FF.serif, fontWeight: 500, fontSize: 19, color: C2.choc, letterSpacing: '-0.01em', marginBottom: 14 }}>
                  How Patients <em style={{ fontStyle: 'italic', color: C2.coral, fontWeight: 400 }}>Find You</em>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'Shown on Google', value: seoImpressions > 0 ? fmtNum(seoImpressions) : '—', color: C2.sage },
                    { label: 'Clicked Your Link', value: seoClicks > 0 ? fmtNum(seoClicks) : '—', color: C2.gold },
                    { label: 'Click Rate', value: seoCtr !== '0.00' ? `${seoCtr}%` : '—', color: C2.coral },
                    { label: 'Search Visitors', value: trafficOrganic > 0 ? fmtNum(trafficOrganic) : '—', color: C2.choc },
                  ].map((m, i) => (
                    <div key={i} style={{ padding: '12px 14px', background: 'rgba(44,36,25,0.02)', borderRadius: 10, borderLeft: `3px solid ${m.color}` }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: C2.text2, fontFamily: FF.mono, marginBottom: 5 }}>{m.label}</div>
                      <div style={{ fontFamily: FF.outfit, fontWeight: 800, fontSize: 20, color: m.color, letterSpacing: '-0.02em' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
                {trafficAi > 0 && (
                  <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg,rgba(44,36,25,0.04),rgba(44,36,25,0.02))', borderRadius: 10, border: '1px solid rgba(44,36,25,0.08)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: C2.choc }}>Visitors from AI Tools (ChatGPT, Perplexity, Claude)</div>
                    <div style={{ display: 'flex', gap: 28 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C2.text2, fontFamily: FF.mono, letterSpacing: '0.1em', marginBottom: 3 }}>Sessions</div>
                        <div style={{ fontFamily: FF.outfit, fontWeight: 800, fontSize: 20, color: C2.coral }}>{fmtNum(trafficAi)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C2.text2, fontFamily: FF.mono, letterSpacing: '0.1em', marginBottom: 3 }}>% of All Traffic</div>
                        <div style={{ fontFamily: FF.outfit, fontWeight: 800, fontSize: 20, color: C2.coral }}>{totalTraffic > 0 ? ((trafficAi / totalTraffic) * 100).toFixed(1) : '0'}%</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Lead Sources donut + Channel cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Lead Sources Donut */}
            <div style={{ ...CARD, padding: '18px 20px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: C2.coral, fontFamily: FF.mono, marginBottom: 3 }}>Inquiry Sources</div>
              <div style={{ fontFamily: FF.serif, fontWeight: 500, fontSize: 19, color: C2.choc, letterSpacing: '-0.01em', marginBottom: 14 }}>
                Where Inquiries <em style={{ fontStyle: 'italic', color: C2.coral, fontWeight: 400 }}>Come From</em>
              </div>

              {/* Donut chart */}
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={donutChannels.length > 0 && donutTotal > 0 ? donutChannels : [{ label: 'No data', sublabel: '', value: 1, color: 'rgba(44,36,25,0.08)' }]}
                      cx="50%" cy="50%" innerRadius={52} outerRadius={80}
                      paddingAngle={donutChannels.length > 1 ? 3 : 0}
                      dataKey="value" strokeWidth={0}
                    >
                      {(donutChannels.length > 0 && donutTotal > 0 ? donutChannels : [{ color: 'rgba(44,36,25,0.08)' }]).map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    {donutTotal > 0 && (
                      <PieTooltip
                        contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                        formatter={(v: any, _: any, props: any) => [`${fmtNum(v)} (${Math.round((v / donutTotal) * 100)}%)`, props.payload?.label]}
                      />
                    )}
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontFamily: FF.outfit, fontWeight: 800, fontSize: 28, color: C2.choc, lineHeight: 1 }}>{fmtNum(donutTotal)}</div>
                  <div style={{ fontSize: 9, color: C2.muted, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.12em' }}>total</div>
                </div>
              </div>

              {/* Legend */}
              {donutTotal > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {donutChannels.map((ch, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(245,241,237,0.5)', borderRadius: 8, transition: 'background 150ms' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: ch.color, display: 'inline-block', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C2.choc }}>{ch.label}</div>
                          <div style={{ fontSize: 10, color: C2.muted }}>{ch.sublabel}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: FF.outfit, fontWeight: 700, fontSize: 16, color: C2.choc }}>{fmtNum(ch.value)}</div>
                        <div style={{ fontSize: 10, color: C2.muted, fontFamily: FF.mono }}>{Math.round((ch.value / Math.max(donutTotal, 1)) * 100)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* MoM per channel */}
              {(() => {
                const srcs = [
                  ...((hasGbp || totalGbpCalls > 0) ? [{ label: 'GBP Calls', curr: totalGbpCalls, prev: prevData.gbpCalls, color: C2.gold }] : []),
                  ...(hasSeo ? [{ label: 'Form Fills', curr: verifiedFormFills, prev: prevData.formFills, color: C2.sage }] : []),
                  ...(hasAds ? [{ label: 'Google Ads', curr: totalAdsConversions, prev: prevData.adsCv, color: C2.coral }] : []),
                ];
                if (srcs.length === 0) return null;
                return (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(44,36,25,0.08)' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: C2.text2, fontFamily: FF.mono, marginBottom: 8 }}>vs Previous Period</div>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${srcs.length}, 1fr)`, gap: 6 }}>
                      {srcs.map((sc, idx) => {
                        const rawPct = sc.prev > 0 ? ((sc.curr - sc.prev) / sc.prev) * 100 : null;
                        const isUp = rawPct !== null && rawPct > 0;
                        const isDown = rawPct !== null && rawPct < 0;
                        const deltaColor = isUp ? C2.emerald : isDown ? '#ef4444' : C2.muted;
                        return (
                          <div key={idx} style={{ padding: '8px 6px', background: 'rgba(44,36,25,0.02)', borderRadius: 8, border: '1px solid rgba(44,36,25,0.06)', textAlign: 'center' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, margin: '0 auto 4px' }} />
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C2.text2, fontFamily: FF.mono, marginBottom: 3 }}>{sc.label}</div>
                            <div style={{ fontFamily: FF.outfit, fontWeight: 800, fontSize: 16, color: C2.choc, lineHeight: 1 }}>{fmtNum(sc.curr)}</div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: deltaColor, marginTop: 2 }}>
                              {rawPct === null ? '—' : `${isUp ? '▲' : '▼'} ${isUp ? '+' : ''}${rawPct.toFixed(1)}%`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Channel detail cards */}
            {channelDefs.map((ch, i) => (
              <div key={i} style={{ ...CARD, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: ch.accent }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: ch.iconBg, color: ch.iconFg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      {ch.accent === C2.coral && <><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></>}
                      {ch.accent === C2.sage  && <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>}
                      {ch.accent === C2.gold  && <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>}
                    </svg>
                  </div>
                  <div style={{ fontFamily: FF.serif, fontWeight: 500, fontSize: 15, color: C2.choc, letterSpacing: '-0.01em', flex: 1 }}>{ch.title}</div>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 7px', background: 'rgba(16,185,129,0.12)', color: C2.emerald, borderRadius: 999 }}>Active</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C2.borderSoft, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C2.borderSoft}`, marginTop: 10 }}>
                  {ch.metrics.map((m, j) => (
                    <div key={j} style={{ background: 'rgba(245,241,237,0.5)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: C2.text2, fontFamily: FF.mono, marginBottom: 3 }}>{m.label}</div>
                      <div style={{ fontFamily: FF.outfit, fontWeight: 800, fontSize: 18, color: C2.choc, lineHeight: 1, letterSpacing: '-0.02em' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Channel Efficiency Table ─────────────────────────────── */}
        {(hasAds || hasSeo || hasGbp || totalGbpCalls > 0) && (
          <>
            <SectionHead title="Channel" italic="Efficiency" />
            <div style={{ ...CARD, padding: '18px 20px 20px' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C2.borderMed}`, background: 'rgba(245,241,237,0.4)' }}>
                      {['Channel', 'Leads', 'Est. Cost', 'Cost / Lead'].map((h, i) => (
                        <th key={i} style={{ padding: '10px 14px', textAlign: i === 0 ? 'left' : 'right', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: C2.text2, fontFamily: FF.mono }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...(hasAds ? [{ channel: 'Google Ads', dot: C2.coral, leads: totalAdsConversions, cost: adSpend > 0 ? fmtCurrency(adSpend, 0) : '—', cpl: totalAdsConversions > 0 && adSpend > 0 ? fmtCurrency(adSpend / totalAdsConversions, 0) : '—', hasCpl: totalAdsConversions > 0 && adSpend > 0 }] : []),
                      ...(hasSeo ? [{ channel: 'SEO / Organic', dot: C2.sage, leads: verifiedFormFills, cost: '—', cpl: '—', hasCpl: false }] : []),
                      ...((hasGbp || totalGbpCalls > 0) ? [{ channel: 'Google Business Profile', dot: C2.gold, leads: totalGbpCalls, cost: '—', cpl: '—', hasCpl: false }] : []),
                    ].map((row, i, arr) => (
                      <tr key={i} className="tbl-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${C2.borderSoft}` : 'none', transition: 'background 150ms' }}>
                        <td style={{ padding: '13px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.dot, flexShrink: 0, display: 'inline-block' }} />
                            <span style={{ fontWeight: 600, color: C2.choc }}>{row.channel}</span>
                          </div>
                        </td>
                        <td style={{ padding: '13px 14px', textAlign: 'right', fontFamily: FF.mono, fontWeight: 600, color: C2.choc }}>{fmtNum(row.leads)}</td>
                        <td style={{ padding: '13px 14px', textAlign: 'right', fontFamily: FF.mono, fontWeight: row.cost === '—' ? 400 : 600, color: row.cost === '—' ? C2.muted : C2.choc }}>{row.cost}</td>
                        <td style={{ padding: '13px 14px', textAlign: 'right' }}>
                          {row.hasCpl
                            ? <span style={{ background: 'rgba(196,112,79,0.08)', color: C2.coral, fontWeight: 700, padding: '3px 9px', borderRadius: 6, fontSize: 13, fontFamily: FF.mono }}>{row.cpl}</span>
                            : <span style={{ color: C2.muted }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 11, color: C2.muted, marginTop: 14, fontStyle: 'italic', borderTop: `1px solid ${C2.borderSoft}`, paddingTop: 10 }}>
                SEO and GBP have no direct cost shown here — they are funded through your monthly retainer.
              </p>
            </div>
          </>
        )}

      </div>
    </AdminLayout>
  );
}
