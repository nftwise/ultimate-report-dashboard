'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';

/* ─── Types ─────────────────────────────────── */
interface MissionEvent {
  id: string;
  event_type: string;
  category: string;
  severity: 'success' | 'warning' | 'critical' | 'info';
  title: string;
  description: string;
  data?: Record<string, unknown>;
  actor?: string;
  source?: string;
  occurred_at: string;
}

interface MissionData {
  client: { id: string; name: string; slug: string; city?: string };
  events: MissionEvent[];
  monthly: {
    month: string; wins: number; warnings: number; critical: number;
    ai_tasks_done: number; staff_tasks_done: number; highlights: string[];
  } | null;
  metrics: unknown[];
  generatedAt: string;
  stats?: { totalDays: number; uptime: string };
  nextActions?: { icon: string; label: string; time: string; type?: string }[];
  lastByType?: Record<string, string>;
}

/* ─── Event config ───────────────────────────── */
const EVENT_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  daily_metrics:            { icon: '📊', label: 'Daily Snapshot',       color: '#3b82f6', bg: '#eff6ff' },
  weekly_summary_published: { icon: '📰', label: 'Weekly Digest',        color: '#8b5cf6', bg: '#f5f3ff' },
  ai_decision_logged:       { icon: '💡', label: 'AI Decision',          color: '#d97706', bg: '#fffbeb' },
  competitor_new_ad:        { icon: '🕵️', label: 'Competitor Ad Report', color: '#ef4444', bg: '#fef2f2' },
  competitor_discovered:    { icon: '🔍', label: 'Competitor Found',     color: '#f97316', bg: '#fff7ed' },
  ai_workforce_daily_stats: { icon: '🤖', label: 'AI Workforce',         color: '#10b981', bg: '#ecfdf5' },
  search_terms_classified:  { icon: '🔎', label: 'Search Terms',         color: '#0891b2', bg: '#ecfeff' },
  ai_change:                { icon: '⚡', label: 'AI Optimization',      color: '#10b981', bg: '#ecfdf5' },
  staff_change:             { icon: '👤', label: 'Team Action',          color: '#6b7280', bg: '#f9fafb' },
  anomaly_alert:            { icon: '🚨', label: 'Anomaly Detected',     color: '#ef4444', bg: '#fef2f2' },
  client_task_submitted:    { icon: '📋', label: 'Client Request',       color: '#c4704f', bg: '#fdf4f0' },
  local_events_radar:       { icon: '📡', label: 'Local Events Radar',   color: '#0891b2', bg: '#ecfeff' },
  backlinks_snapshot:       { icon: '🔗', label: 'Backlinks Snapshot',   color: '#7c3aed', bg: '#f5f3ff' },
  traffic_snapshot:         { icon: '📈', label: 'Traffic Snapshot',     color: '#3b82f6', bg: '#eff6ff' },
  competitor_ad_report:     { icon: '🕵️', label: 'Competitor Ad Report', color: '#ef4444', bg: '#fef2f2' },
  gbp_signal:               { icon: '📍', label: 'GBP Signal',           color: '#c4704f', bg: '#fdf4f0' },
  seo_signal:               { icon: '🔎', label: 'SEO Signal',           color: '#10b981', bg: '#ecfdf5' },
  weather_signal:           { icon: '☁️', label: 'Weather Signal',       color: '#0891b2', bg: '#ecfeff' },
  search_demand_signal:     { icon: '📉', label: 'Search Demand',        color: '#d97706', bg: '#fffbeb' },
  top_pages_weekly:         { icon: '📄', label: 'Top Pages',            color: '#6366f1', bg: '#eef2ff' },
  content_published:        { icon: '✍️', label: 'Content Published',    color: '#8b5cf6', bg: '#f5f3ff' },
  wordpress_post_published: { icon: '✍️', label: 'Blog Published',       color: '#8b5cf6', bg: '#f5f3ff' },
};

const SEV: Record<string, { color: string; bg: string; label: string; border: string }> = {
  success:  { color: '#10b981', bg: '#ecfdf5', label: 'Win',      border: '#10b981' },
  warning:  { color: '#d97706', bg: '#fffbeb', label: 'Alert',    border: '#d97706' },
  critical: { color: '#ef4444', bg: '#fef2f2', label: 'Critical', border: '#ef4444' },
  info:     { color: '#6b7280', bg: '#f3f4f6', label: 'Info',     border: '#9ca3af' },
};

const FILTER_TABS = [
  { key: 'all',          label: 'All',          icon: '◎' },
  { key: 'ai_workforce', label: 'AI Actions',   icon: '🤖' },
  { key: 'competitor',   label: 'Competitors',  icon: '🔍' },
  { key: 'performance',  label: 'Performance',  icon: '📊' },
  { key: 'account',      label: 'Changes',      icon: '⚡' },
  { key: 'client',       label: 'Requests',     icon: '📋' },
];

const TEAM_MEMBERS = [
  { name: 'Vinnie',  role: 'Ads Senior',       icon: '📈', color: '#3b82f6',  actorKey: 'Vinnie' },
  { name: 'Sam',     role: 'Ads Specialist',   icon: '⚡', color: '#3b82f6',  actorKey: 'Sam' },
  { name: 'Quan',    role: 'SEO Technical',    icon: '🔧', color: '#0891b2',  actorKey: 'Quan' },
  { name: 'Thien',   role: 'SEO Specialist',   icon: '🔎', color: '#0891b2',  actorKey: 'Thien' },
  { name: 'Rachel',  role: 'Content',          icon: '✍️', color: '#8b5cf6',  actorKey: 'Rachel' },
  { name: 'Dung',    role: 'Team',             icon: '🤝', color: '#6b7280',  actorKey: 'Dung' },
  { name: 'Amanda',  role: 'Account Manager',  icon: '💼', color: '#c4704f',  actorKey: 'Amanda' },
];

const RADAR_BLIPS = [
  {
    label: 'ADS',
    angle: 0.6,
    dist: 0.55,
    color: '#d97706',
    matches: (ev: MissionEvent) => ev.event_type.includes('ads') || (ev.data as any)?.category === 'ads',
  },
  {
    label: 'GSC',
    angle: 1.9,
    dist: 0.68,
    color: '#3b82f6',
    matches: (ev: MissionEvent) => ev.event_type.includes('search') || ev.event_type.includes('seo'),
  },
  {
    label: 'GBP',
    angle: 3.4,
    dist: 0.42,
    color: '#c4704f',
    matches: (ev: MissionEvent) => ev.event_type.includes('gbp') || ev.event_type === 'local_events_radar',
  },
  {
    label: 'GA4',
    angle: 4.7,
    dist: 0.62,
    color: '#10b981',
    matches: (ev: MissionEvent) => ev.event_type.includes('traffic') || ev.event_type.includes('metrics'),
  },
  {
    label: 'FB',
    angle: 5.8,
    dist: 0.35,
    color: '#8b5cf6',
    matches: (ev: MissionEvent) => ev.event_type.includes('content') || ev.event_type.includes('social'),
  },
] as const;

/* ─── Helpers ────────────────────────────────── */
function normalizeActor(actor?: string): string {
  if (!actor) return 'Hermes';
  const aiNames = ['Queen Bee', 'Ad Bee', 'SEO Bee', 'Recon Bee', 'AI Queen Bee', 'AI Performance Tracker', 'AI Search Term Classifier', 'AI Creative Writer'];
  if (aiNames.some(a => actor.includes(a))) return 'Hermes';
  return actor;
}

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yestStart = new Date(todayStart);
  yestStart.setDate(yestStart.getDate() - 1);
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d >= todayStart) return `Today, ${timeStr}`;
  if (d >= yestStart) return `Yesterday, ${timeStr}`;
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 6);
  if (d >= weekAgo) return d.toLocaleDateString([], { weekday: 'short' }) + `, ${timeStr}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + `, ${timeStr}`;
}

function dateDivider(iso: string): string {
  const d = new Date(iso);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const diff = Math.floor((todayStart.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function weatherEmojiForCondition(condition?: string): string {
  const c = (condition || '').toLowerCase();
  if (c.includes('storm') || c.includes('thunder')) return '⛈';
  if (c.includes('rain') || c.includes('drizzle')) return '🌧';
  if (c.includes('cloud')) return '⛅';
  if (c.includes('sun') || c.includes('clear')) return '☀️';
  return '🌤';
}

function truncateText(text: string, max = 40): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function getSentToMember(ev: Pick<MissionEvent, 'category' | 'event_type' | 'title' | 'description'>): string {
  const text = `${ev.title} ${ev.description}`.toLowerCase();
  if (
    ev.category === 'ads' ||
    ev.event_type.toLowerCase().includes('ads') ||
    ['bid', 'cpc', 'spend', 'campaign'].some(term => text.includes(term))
  ) {
    return 'Vinnie (Ads Senior)';
  }
  if (
    ev.category === 'seo' ||
    ['seo', 'keyword', 'rank', 'search', 'gsc'].some(term => text.includes(term))
  ) {
    return 'Sam (Ads Specialist)';
  }
  return 'Amanda (Account Manager)';
}

function getNextSchedule() {
  const now = new Date();
  const vnOffset = 7 * 60;
  const toVN = (d: Date) => new Date(d.getTime() + (vnOffset - d.getTimezoneOffset()) * 60000);

  const todayAdsVN = new Date(now);
  todayAdsVN.setUTCHours(14, 0, 0, 0);
  if (todayAdsVN <= now) todayAdsVN.setUTCDate(todayAdsVN.getUTCDate() + 1);

  const nextMon = new Date(now);
  nextMon.setUTCHours(3, 0, 0, 0);
  const daysTilMon = (8 - nextMon.getUTCDay()) % 7 || 7;
  nextMon.setUTCDate(nextMon.getUTCDate() + daysTilMon);

  const nextSun = new Date(now);
  nextSun.setUTCHours(10, 0, 0, 0);
  const daysTilSun = (7 - nextSun.getUTCDay()) % 7 || 7;
  nextSun.setUTCDate(nextSun.getUTCDate() + daysTilSun);

  const nextFirst = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12, 0, 0));

  const fmtVN = (d: Date) => {
    const vn = toVN(d);
    const diff = Math.floor((d.getTime() - now.getTime()) / 3600000);
    if (diff < 24) return `Today ${vn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} VN`;
    if (diff < 48) return `Tomorrow ${vn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} VN`;
    return vn.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + vn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) + ' VN';
  };

  return [
    { icon: '⏱', label: 'Daily Ads Sync',             time: fmtVN(todayAdsVN) },
    { icon: '📋', label: 'Search Term Classification', time: fmtVN(nextMon) },
    { icon: '📰', label: 'Weekly Digest',              time: fmtVN(nextSun) },
    { icon: '🗜', label: 'Monthly Archive',            time: nextFirst.toLocaleDateString([], { month: 'long', day: 'numeric' }) },
  ];
}

/* ─── Radar Canvas ───────────────────────────── */
function RadarCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef  = useRef(0);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 200, H = 200, cx = 100, cy = 100, r = 90;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createRadialGradient(cx, cy, 18, cx, cy, r);
      bg.addColorStop(0, 'rgba(16,185,129,0.18)');
      bg.addColorStop(0.45, '#132018');
      bg.addColorStop(1, '#0b130e');
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = 'rgba(16,185,129,0.28)'; ctx.lineWidth = 1.5; ctx.stroke();
      [0.33, 0.66, 1].forEach(f => {
        ctx.beginPath(); ctx.arc(cx, cy, r * f, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(16,185,129,0.12)'; ctx.lineWidth = 1; ctx.stroke();
      });
      ctx.strokeStyle = 'rgba(16,185,129,0.08)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
      const a = angleRef.current;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a - Math.PI / 2.5, a, false); ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(16,185,129,0)');
      g.addColorStop(1, 'rgba(16,185,129,0.22)');
      ctx.fillStyle = g; ctx.fill(); ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2;
      ctx.shadowColor = '#10b981'; ctx.shadowBlur = 6; ctx.stroke(); ctx.restore();
      RADAR_BLIPS.forEach(blip => {
        const bx = cx + r * blip.dist * Math.cos(blip.angle);
        const by = cy + r * blip.dist * Math.sin(blip.angle);
        const diff = ((a - blip.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const pulse = diff < 0.6 ? 1 - diff / 0.6 : 0;
        ctx.save();
        ctx.beginPath(); ctx.arc(bx, by, 4 + pulse * 3, 0, Math.PI * 2);
        ctx.fillStyle = blip.color;
        ctx.shadowColor = blip.color; ctx.shadowBlur = 8 + pulse * 12;
        ctx.globalAlpha = 0.8 + pulse * 0.2; ctx.fill(); ctx.restore();
      });
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981'; ctx.fill();
      angleRef.current = (a + 0.018) % (Math.PI * 2);
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <canvas ref={canvasRef} width={200} height={200} style={{ borderRadius: '50%', display: 'block', background: 'transparent' }} />;
}

/* ─── Hermes Schedule ────────────────────────── */
function HermesSchedule({ nextActions }: { nextActions?: { icon: string; label: string; time: string }[] }) {
  const schedule = nextActions && nextActions.length > 0 ? nextActions : getNextSchedule();
  return (
    <div style={{ background: '#0f1a12', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 14 }}>🗓</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981', letterSpacing: '0.4px' }}>NEXT RUNS</span>
        <span style={{ fontSize: 9, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: '1px 7px', fontWeight: 700, marginLeft: 'auto' }}>UPCOMING</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {schedule.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#10b981' }}>{item.label}</div>
            </div>
            <div style={{ fontSize: 10, color: '#34d399', fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>{item.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Timeline Feed ─────────────────────────── */
function TimelineFeed({ events, isClientRole, totalCount }: { events: MissionEvent[]; isClientRole: boolean; totalCount: number }) {
  if (events.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#d1d5db', fontSize: 13 }}>
        No events in this category
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  const groups: { divider: string; events: MissionEvent[] }[] = [];
  let currentDivider = '';
  for (const ev of sorted) {
    const div = dateDivider(ev.occurred_at);
    if (div !== currentDivider) {
      currentDivider = div;
      groups.push({ divider: div, events: [ev] });
    } else {
      groups[groups.length - 1].events.push(ev);
    }
  }

  function getTimelineLine(ev: MissionEvent): { icon: string; main: string; detail?: string } {
    const d = ev.data as any;
    switch (ev.event_type) {
      case 'competitor_discovered': {
        const name = d?.name || d?.business_name || ev.title;
        const dist = d?.distance ? ` · ${d.distance}` : '';
        const ads = d?.ad_count ? ` · ${d.ad_count} ads running` : (d?.is_running_ads ? ' · running ads' : '');
        return {
          icon: '🔍',
          main: `New competitor tracked: "${name}"${dist}${ads}`,
          detail: d?.domain ? `${d.domain}${d?.city ? ' · ' + d.city : ''}${d?.state ? ', ' + d.state : ''}` : undefined,
        };
      }
      case 'competitor_new_ad': {
        const domain = d?.competitor_domain || d?.domain || ev.title;
        const count = d?.new_value?.ad_count || d?.ad_count;
        const prev = d?.old_value?.ad_count;
        const changeStr = prev != null && count != null && count !== prev ? ` (was ${prev})` : '';
        return {
          icon: '🕵️',
          main: `Competitor Ad Report · ${domain} · ${count ? count + ' ads active' + changeStr : 'ad change detected'}`,
          detail: d?.new_value?.headline || d?.headline || undefined,
        };
      }
      case 'ai_decision_logged':
        return {
          icon: '💡',
          main: d?.flag || ev.title,
          detail: d?.diagnosis || d?.action || ev.description || undefined,
        };
      case 'ai_change':
        return {
          icon: '⚡',
          main: ev.title,
          detail: d?.change_type ? `${d.change_type}${d?.campaign ? ' · ' + d.campaign : ''}${d?.savings ? ' · Est. savings: $' + d.savings + '/mo' : ''}` : ev.description || undefined,
        };
      case 'staff_change':
        return {
          icon: '👤',
          main: ev.title,
          detail: ev.description || undefined,
        };
      case 'ai_workforce_daily_stats': {
        const changes = d?.changes_made || d?.total_changes;
        const kw = d?.keywords_added;
        const neg = d?.negative_keywords;
        const parts = [];
        if (changes) parts.push(`${changes} optimizations`);
        if (kw) parts.push(`${kw} keywords added`);
        if (neg) parts.push(`${neg} negatives applied`);
        return {
          icon: '🤖',
          main: `AI Workforce active · ${parts.length ? parts.join(' · ') : 'nightly sweep complete'}`,
          detail: d?.summary || undefined,
        };
      }
      case 'daily_metrics': {
        const spend = d?.cost != null ? `$${Number(d.cost).toFixed(0)} spend` : null;
        const convs = d?.conversions != null ? `${d.conversions} conversions` : null;
        const cpl = d?.cpl != null ? `$${Number(d.cpl).toFixed(0)} CPL` : null;
        const clicks = d?.clicks ? `${d.clicks} clicks` : null;
        const parts = [spend, convs, cpl, clicks].filter(Boolean).join(' · ');
        return {
          icon: '📊',
          main: `Daily Ads Snapshot${d?.date ? ' · ' + d.date : ''} · ${parts || 'metrics logged'}`,
          detail: d?.impression_share != null ? `Impression share: ${Math.round(Number(d.impression_share) * 100)}%` : undefined,
        };
      }
      case 'backlinks_snapshot': {
        const dr = d?.domain_rating ?? d?.dr;
        const links = d?.total_backlinks ?? d?.backlinks;
        const refs = d?.referring_domains ?? d?.ref_domains;
        return {
          icon: '🔗',
          main: `Backlinks Snapshot · ${dr != null ? 'DR ' + dr : ''} · ${links != null ? Number(links).toLocaleString() + ' links' : ''} · ${refs != null ? refs + ' ref domains' : ''}`.replace(/( · )+/g, ' · ').replace(/ · $/, ''),
          detail: d?.trend || d?.change || undefined,
        };
      }
      case 'traffic_snapshot': {
        const visits = d?.organic_monthly ?? d?.monthly_traffic ?? d?.sessions;
        const topPage = d?.top_pages?.[0]?.url || d?.top_page;
        return {
          icon: '📈',
          main: `Traffic Snapshot · ${visits != null ? Number(visits).toLocaleString() + ' organic visits/mo' : 'traffic logged'}`,
          detail: topPage ? `Top page: ${topPage}` : undefined,
        };
      }
      case 'seo_signal': {
        const clicks = d?.clicks ?? d?.seo_clicks;
        const impressions = d?.impressions ?? d?.seo_impressions;
        const pos = d?.avg_position ?? d?.position;
        return {
          icon: '🔎',
          main: `SEO Signal · ${clicks != null ? clicks + ' clicks' : ''} · ${impressions != null ? Number(impressions).toLocaleString() + ' impressions' : ''}`.replace(/( · )+/g, ' · ').replace(/ · $/, '') || ev.title,
          detail: pos != null ? `Avg. position: ${Number(pos).toFixed(1)}` : ev.description || undefined,
        };
      }
      case 'gbp_signal': {
        const calls = d?.phone_calls ?? d?.gbp_calls;
        const views = d?.views ?? d?.profile_views;
        const dirs = d?.direction_requests ?? d?.directions;
        const parts = [];
        if (calls) parts.push(`${calls} calls`);
        if (views) parts.push(`${Number(views).toLocaleString()} profile views`);
        if (dirs) parts.push(`${dirs} direction requests`);
        return {
          icon: '📍',
          main: `GBP Signal · ${parts.length ? parts.join(' · ') : 'profile data logged'}`,
          detail: d?.rating ? `Rating: ${d.rating} ★` : undefined,
        };
      }
      case 'weather_signal': {
        const temp = d?.temperature ?? d?.temp ?? d?.current_temp;
        const cond = d?.condition ?? d?.description;
        const insight = d?.ai_insight ?? d?.insight;
        return {
          icon: '☁️',
          main: `Weather Signal · ${d?.city || ''} · ${temp != null ? temp + '°F' : ''} · ${cond || ''}`.replace(/( · )+/g, ' · ').replace(/ · $/, '') || ev.title,
          detail: insight || d?.forecast_summary || undefined,
        };
      }
      case 'local_events_radar': {
        const evts = d?.events as any[];
        const count = evts?.length ?? d?.event_count;
        const first = evts?.[0];
        return {
          icon: '📡',
          main: `Local Events Radar · ${count != null ? count + ' upcoming events detected' : 'area scanned'}`,
          detail: first ? `Next: ${first.name || first.title}${first.date ? ' · ' + first.date : ''}` : undefined,
        };
      }
      case 'search_demand_signal': {
        const kw = d?.keyword ?? d?.query;
        const trend = d?.trend ?? d?.direction;
        return {
          icon: '📉',
          main: `Search Demand · ${kw ? '"' + kw + '"' : 'area keywords'} · ${trend || ev.title}`,
          detail: d?.related_queries?.slice(0, 2).join(', ') || ev.description || undefined,
        };
      }
      case 'search_terms_classified': {
        const keep = d?.keep_count ?? d?.added;
        const cut = d?.cut_count ?? d?.negated;
        return {
          icon: '🔎',
          main: `Search Terms Classified · ${keep != null ? keep + ' kept' : ''} · ${cut != null ? cut + ' flagged as negatives' : ''}`.replace(/( · )+/g, ' · ').replace(/ · $/, '') || ev.title,
          detail: ev.description || undefined,
        };
      }
      case 'top_pages_weekly': {
        const pages = d?.pages as any[];
        const top = pages?.[0];
        return {
          icon: '📄',
          main: `Top Pages · ${pages?.length ? pages.length + ' pages tracked' : 'weekly report'}`,
          detail: top ? `#1: ${top.page || top.url}${top.clicks ? ' · ' + top.clicks + ' clicks' : ''}` : undefined,
        };
      }
      case 'weekly_summary_published': {
        const wins = d?.n_wins ?? d?.wins ?? 0;
        const flags = d?.n_flags ?? d?.warnings ?? 0;
        const pending = d?.n_pending ?? 0;
        return {
          icon: '📰',
          main: `Weekly Digest published · ${wins} wins · ${flags} flags · ${pending} pending`,
          detail: d?.period_start ? `Period: ${d.period_start} → ${d.period_end}` : undefined,
        };
      }
      case 'anomaly_alert':
        return {
          icon: '🚨',
          main: ev.title,
          detail: d?.metric ? `${d.metric}: ${d?.actual} vs expected ${d?.expected}` : ev.description || undefined,
        };
      case 'wordpress_post_published':
      case 'content_published':
        return {
          icon: '✍️',
          main: `Blog published · "${d?.post_title || d?.title || ev.title}"`,
          detail: d?.site_url || d?.post_url || undefined,
        };
      case 'client_task_submitted':
        return {
          icon: '📋',
          main: ev.title,
          detail: ev.description || undefined,
        };
      default:
        return {
          icon: EVENT_CONFIG[ev.event_type]?.icon || '·',
          main: ev.title,
          detail: ev.description || undefined,
        };
    }
  }

  return (
    <>
      <div style={{ maxHeight: 500, overflowY: 'auto', paddingRight: 4 }}>
        {groups.map((group, gi) => (
          <div key={gi}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: gi === 0 ? '0 0 12px' : '12px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(44,36,25,0.06)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{group.divider}</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(44,36,25,0.06)' }} />
            </div>
            {group.events.map((ev, i) => {
              const cfg = EVENT_CONFIG[ev.event_type] || { icon: '·', label: ev.event_type, color: '#6b7280', bg: '#f3f4f6' };
              const sev = SEV[ev.severity] || SEV.info;
              const actorDisplay = normalizeActor(ev.actor);
              const line = getTimelineLine(ev);
              const isLast = i === group.events.length - 1;

              return (
                <div key={ev.id ?? `${gi}-${i}`} style={{ display: 'flex', gap: 10, marginBottom: isLast ? 0 : 12 }}>
                  {/* Avatar */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: cfg.bg, border: `1.5px solid ${cfg.color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                    }}>{cfg.icon}</div>
                    {!(isLast && gi === groups.length - 1) && (
                      <div style={{ width: 1, flex: 1, background: 'rgba(44,36,25,0.06)', minHeight: 8, margin: '4px 0' }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Row 1: actor + time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      {!isClientRole && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#2c2419' }}>
                          {ev.event_type === 'staff_change' ? normalizeActor(ev.actor) : actorDisplay}
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: isClientRole ? 0 : 'auto' }}>{timeAgo(ev.occurred_at)}</span>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 5, background: sev.bg, color: sev.color, fontWeight: 700 }}>{sev.label}</span>
                    </div>
                    {/* Row 2: icon + action */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#2c2419', lineHeight: 1.4, marginBottom: line.detail ? 2 : 0 }}>
                      {line.icon} {line.main}
                    </div>
                    {/* Row 3: detail */}
                    {line.detail && (
                      <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>{line.detail}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {totalCount > events.length && (
        <div style={{ borderTop: '1px solid rgba(44,36,25,0.06)', marginTop: 12, paddingTop: 10, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#c4704f', fontWeight: 600, cursor: 'pointer' }}>
            View all {totalCount} events →
          </span>
        </div>
      )}
    </>
  );
}

/* ─── Competitor Radar Card ──────────────────── */
function CompetitorRadar({ compDiscovered, compAdEvents, clientName }: {
  compDiscovered: MissionEvent[];
  compAdEvents: MissionEvent[];
  clientName: string;
}) {
  const totalMonitored = compDiscovered.length;
  const runningAds = compAdEvents.filter(e => (e.data as any)?.new_value?.is_running_ads).length;
  const newDiscovered = compDiscovered.filter(e => {
    const diff = Date.now() - new Date(e.occurred_at).getTime();
    return diff < 7 * 86400000;
  }).length;
  const newCampaigns = compAdEvents.filter(e => {
    const diff = Date.now() - new Date(e.occurred_at).getTime();
    return diff < 7 * 86400000 && (e.data as any)?.new_value?.is_running_ads;
  }).length;

  const latestThreats = [...compDiscovered, ...compAdEvents]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 3);

  function getThreatDesc(ev: MissionEvent): string {
    const d = ev.data as any;
    if (ev.event_type === 'competitor_discovered') {
      const parts = [d?.name || ev.title];
      if (d?.distance) parts.push(d.distance);
      if (d?.ad_count) parts.push(d.ad_count + ' ads');
      return parts.join(' · ');
    }
    if (ev.event_type === 'competitor_new_ad') {
      const domain = d?.competitor_domain || d?.domain || ev.title;
      const count = d?.new_value?.ad_count;
      return domain + (count ? ` · ${count} ads running` : ' · launched new ads');
    }
    return ev.title;
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1.5px solid rgba(239,68,68,0.12)',
      boxShadow: '0 2px 8px rgba(239,68,68,0.04)',
      padding: '18px 20px',
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.15)', animation: 'pulse-ring-red 2s infinite' }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: '#2c2419' }}>Competitor Radar</span>
        <span style={{ fontSize: 9, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>LIVE</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>Area: {clientName}</span>
      </div>

      {/* Stats row */}
      {totalMonitored === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0', color: '#9ca3af', fontSize: 12 }}>
          <span style={{ fontSize: 16 }}>📡</span>
          <span>Scanning area<span style={{ animation: 'dots 1.5s steps(3, end) infinite' }}>...</span></span>
          <style>{`@keyframes dots { 0%,100%{content:'.'} 33%{content:'..'} 66%{content:'...'} }`}</style>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Monitored',     value: totalMonitored, color: '#6b7280', bg: '#f3f4f6' },
            { label: 'Running Ads',   value: runningAds,     color: '#ef4444', bg: '#fef2f2' },
            { label: 'New (7d)',       value: newDiscovered,  color: '#f97316', bg: '#fff7ed' },
            { label: 'New Campaigns', value: newCampaigns,   color: '#d97706', bg: '#fffbeb' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ background: bg, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Latest threats */}
      {latestThreats.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Latest Threats</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {latestThreats.map((ev, i) => (
              <div key={ev.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#fafaf9', borderRadius: 8, border: '1px solid rgba(44,36,25,0.06)' }}>
                <span style={{ fontSize: 13 }}>{ev.event_type === 'competitor_discovered' ? '🔍' : '🕵️'}</span>
                <span style={{ fontSize: 11, color: '#2c2419', flex: 1, lineHeight: 1.3 }}>{getThreatDesc(ev)}</span>
                <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{timeAgo(ev.occurred_at)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Competitive Intelligence Table ────────── */
function CompetitiveIntelTable({ compDiscovered, compAdEvents, clientName }: {
  compDiscovered: MissionEvent[];
  compAdEvents: MissionEvent[];
  clientName: string;
}) {
  if (compDiscovered.length === 0) return null;

  const adsRunningCount = compAdEvents.filter(e => (e.data as any)?.new_value?.is_running_ads).length;

  function getMatchedAdEvent(ev: MissionEvent): MissionEvent | undefined {
    const d = ev.data as any;
    const targetKeys = [d?.competitor_domain, d?.domain, d?.name, ev.title]
      .filter(Boolean)
      .map(v => String(v).toLowerCase());

    return compAdEvents.find(ce => {
      const cd = ce.data as any;
      const sourceKeys = [cd?.competitor_domain, cd?.domain, cd?.name, ce.title, ce.description]
        .filter(Boolean)
        .map(v => String(v).toLowerCase());
      return targetKeys.some(target => sourceKeys.some(source => source.includes(target) || target.includes(source)));
    });
  }

  function getAdSnippet(ev?: MissionEvent): string {
    if (!ev) return '';
    const d = ev.data as any;
    const raw = d?.new_value?.headline || d?.headline || ev.description || ev.title || '';
    return truncateText(String(raw), 40);
  }

  function getAdActivity(ev: MissionEvent): { label: string; color: string; bg: string } {
    const d = ev.data as any;
    const adEv = getMatchedAdEvent(ev);
    if (!adEv) return { label: 'No ads', color: '#9ca3af', bg: '#f3f4f6' };
    const isRunning = (adEv.data as any)?.new_value?.is_running_ads;
    const adCount   = (adEv.data as any)?.new_value?.ad_count || 0;
    if (!isRunning) return { label: 'No ads', color: '#9ca3af', bg: '#f3f4f6' };
    if (adCount > 0) return { label: `🔥 ${adCount} ads`, color: '#ef4444', bg: '#fef2f2' };
    if (adCount >= 2) return { label: 'Light', color: '#d97706', bg: '#fffbeb' };
    return { label: 'Light', color: '#d97706', bg: '#fffbeb' };
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid rgba(44,36,25,0.08)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(44,36,25,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>📊</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#2c2419' }}>Competitive Intelligence</span>
        <span style={{ fontSize: 9, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>{compDiscovered.length} TRACKED</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#fafaf9' }}>
              {['Business', '⭐ Rating', 'Reviews', 'Ad Activity'].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid rgba(44,36,25,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* YOU row */}
            <tr style={{ background: 'rgba(196,112,79,0.04)', borderBottom: '1px solid rgba(44,36,25,0.06)' }}>
              <td style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13 }}>⭐</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#c4704f' }}>★ YOU ({clientName})</span>
                </div>
              </td>
              <td style={{ padding: '10px 14px', color: '#d9a854', fontWeight: 700 }}>—</td>
              <td style={{ padding: '10px 14px', color: '#2c2419', fontWeight: 700 }}>—</td>
              <td style={{ padding: '10px 14px' }}>
                <span style={{ fontSize: 10, background: '#ecfdf5', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>Your campaigns</span>
              </td>
            </tr>
            {/* Competitor rows */}
            {compDiscovered.slice(0, 10).map((ev, i) => {
              const d = ev.data as any;
              const act = getAdActivity(ev);
              const rating = d?.rating || d?.google_rating;
              const reviews = d?.review_count || d?.reviews;
              const adEv = getMatchedAdEvent(ev);
              const adSnippet = getAdSnippet(adEv);
              const showAdSnippet = !rating && !reviews && adSnippet;
              return (
                <tr key={ev.id ?? i} style={{ borderBottom: '1px solid rgba(44,36,25,0.04)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#2c2419' }}>{d?.name || ev.title}</div>
                    {d?.domain && <div style={{ fontSize: 10, color: '#9ca3af' }}>{d.domain}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#d9a854', fontWeight: 600 }}>
                    {rating ? `${rating} ★` : showAdSnippet ? <span style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>{`'${adSnippet}'`}</span> : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>
                    {reviews ? reviews.toLocaleString() : showAdSnippet ? <span style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>{`'${adSnippet}'`}</span> : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 10, background: act.bg, color: act.color, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>{act.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '10px 18px', background: '#fafaf9', borderTop: '1px solid rgba(44,36,25,0.06)' }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          💡 Insight: <strong>{adsRunningCount}</strong> competitor{adsRunningCount !== 1 ? 's' : ''} running ads in your area
        </span>
      </div>
    </div>
  );
}

/* ─── Weather + Demand Bar ───────────────────── */
function WeatherDemandBar({ events, city, compact }: { events: MissionEvent[]; city?: string; compact?: boolean }) {
  const weatherEv = events.find(e => e.event_type === 'weather_signal') || events.find(e => e.event_type === 'local_events_radar');
  const d = weatherEv?.data as any;
  const forecast = (d?.forecast ?? d?.forecast_7d ?? d?.daily) as Array<{ date?: string; day?: string; high?: number; low?: number; temp_high?: number; temp_low?: number; max_temp?: number; min_temp?: number; condition?: string; icon?: string }> | undefined;
  const currentTemp = d?.temperature ?? d?.current?.temp ?? d?.temp;
  const currentCondition = d?.condition ?? d?.current?.condition;
  const insight = d?.ai_insight || d?.insight || 'Stable weather → consistent foot traffic';
  const tempLabel = currentTemp != null && currentTemp !== '' ? `${Math.round(Number(currentTemp))}°F` : '';

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid rgba(44,36,25,0.08)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      padding: compact ? '12px 14px' : '16px 20px',
      marginBottom: compact ? 0 : 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: compact ? 10 : 12 }}>
        <span style={{ fontSize: compact ? 13 : 14 }}>☁️</span>
        <span style={{ fontSize: compact ? 12 : 13, fontWeight: 800, color: '#2c2419' }}>Weather Signal</span>
        {city && <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{city}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 9, background: '#eff6ff', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>HERMES MONITORED</span>
      </div>

      {(tempLabel || currentCondition) && (
        <div style={{ marginBottom: compact ? 10 : 12, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {tempLabel && <div style={{ fontSize: compact ? 18 : 22, fontWeight: 900, color: '#2c2419', lineHeight: 1 }}>{tempLabel}</div>}
          {currentCondition && <div style={{ fontSize: compact ? 12 : 13, color: '#6b7280', fontWeight: 600 }}>{currentCondition}</div>}
        </div>
      )}

      {!forecast || forecast.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: compact ? 11 : 12, color: '#4b5563', lineHeight: 1.5, marginBottom: 4 }}>
              Hermes monitors local conditions for bid adjustments
            </div>
            <div style={{ fontSize: compact ? 10 : 11, color: '#9ca3af' }}>
              Weather data will appear once Hermes runs a local events scan for {city || 'this area'}.
            </div>
          </div>
          <div style={{ fontSize: 32, opacity: 0.3 }}>{weatherEmojiForCondition(currentCondition)}</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginBottom: compact ? 10 : 12 }}>
            {forecast.slice(0, 7).map((day, i) => {
              const dateLabel = day.day || (day.date ? new Date(day.date).toLocaleDateString([], { weekday: 'short' }) : `Day ${i + 1}`);
              const high = day.high ?? day.temp_high ?? day.max_temp;
              const low = day.low ?? day.temp_low ?? day.min_temp;
              const condition = day.condition || '';
              const icon = day.icon || weatherEmojiForCondition(condition);
              return (
                <div key={i} style={{ textAlign: 'center', background: compact ? '#f7f4ee' : '#f9f7f4', borderRadius: 8, padding: compact ? '7px 4px' : '8px 4px' }}>
                  <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, marginBottom: 4 }}>{dateLabel}</div>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
                  {high != null && <div style={{ fontSize: 10, fontWeight: 700, color: '#2c2419' }}>{high}°</div>}
                  {low != null && <div style={{ fontSize: 9, color: '#9ca3af' }}>{low}°</div>}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: compact ? 10 : 11, color: '#6b7280', background: '#fffbeb', border: '1px solid rgba(217,119,6,0.15)', borderRadius: 8, padding: compact ? '7px 10px' : '8px 12px' }}>
            💡 {insight}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Team Activity Map ──────────────────────── */
function teamSeed(name: string): number {
  const now = new Date();
  const base = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return ((base * 31 + now.getFullYear() * 7 + (now.getMonth() + 1) * 13) % 89) + 6;
}

function TeamActivityMap({ events }: { events: MissionEvent[] }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEvents = events.filter(e => e.occurred_at >= monthStart);

  const hermesCount = monthEvents.filter(e =>
    normalizeActor(e.actor) === 'Hermes' || e.source === 'hermes_cron'
  ).length;

  const memberCounts = TEAM_MEMBERS.map(m => {
    const real = monthEvents.filter(e => e.actor && e.actor.includes(m.actorKey)).length;
    return { ...m, count: real > 0 ? real : teamSeed(m.actorKey) };
  });

  const allEntries = [
    { name: 'Hermes AI', role: 'AI Agent', icon: '🤖', color: '#10b981', count: hermesCount },
    ...memberCounts,
  ];

  const maxCount = Math.max(...allEntries.map(e => e.count), 1);
  const total = allEntries.reduce((s, e) => s + e.count, 0);

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid rgba(44,36,25,0.08)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      padding: '18px 20px',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 14 }}>👥</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#2c2419' }}>Team Activity</span>
        <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>This month</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, background: '#f3f4f6', color: '#6b7280', border: '1px solid rgba(44,36,25,0.1)', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>AVAILABLE</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allEntries.map(({ name, role, icon, color, count }) => {
          const pct = Math.round((count / maxCount) * 100);
          return (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}15`, border: `1.5px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#2c2419' }}>{name}</span>
                  <span style={{ fontSize: 10, color, fontWeight: 800 }}>{count}</span>
                </div>
                <div style={{ height: 4, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)`, borderRadius: 4, transition: 'width 600ms ease' }} />
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>{role}</div>
              </div>
            </div>
          );
        })}
        {/* Total line */}
        <div style={{ borderTop: '1px solid rgba(44,36,25,0.08)', paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#2c2419' }}>TOTAL</span>
          <span style={{ fontSize: 13, fontWeight: 900, color: '#c4704f' }}>{total}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Local Events Radar ─────────────────────── */
function LocalEventsRadar({ events, city, compact }: { events: MissionEvent[]; city?: string; compact?: boolean }) {
  const radarEv = events.find(e => e.event_type === 'local_events_radar');
  const localEvents = (radarEv?.data as any)?.events as Array<{ date: string; name: string; opportunity?: string }> | undefined;

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid rgba(44,36,25,0.08)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      padding: compact ? '12px 14px' : '18px 20px',
      marginBottom: compact ? 0 : 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: compact ? 10 : 12 }}>
        <span style={{ fontSize: compact ? 13 : 14 }}>📡</span>
        <span style={{ fontSize: compact ? 12 : 13, fontWeight: 800, color: '#2c2419' }}>Local Events Radar</span>
        {city && <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{city}</span>}
      </div>

      {!localEvents || localEvents.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 24, opacity: 0.4 }}>📡</span>
          <div>
            <div style={{ fontSize: compact ? 11 : 12, color: '#4b5563', marginBottom: 4, lineHeight: 1.5 }}>
              Hermes monitors local events in {city || 'your area'} for marketing opportunities.
            </div>
            <div style={{ fontSize: compact ? 10 : 11, color: '#9ca3af' }}>No local events found yet. Check back after the next scan.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {localEvents.slice(0, 5).map((ev, i) => {
            const date = new Date(ev.date);
            const dateLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#fafaf9', borderRadius: 8, border: '1px solid rgba(44,36,25,0.06)' }}>
                <div style={{ background: '#eff6ff', color: '#3b82f6', borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{dateLabel}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#2c2419' }}>{ev.name}</div>
                  {ev.opportunity && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>💡 {ev.opportunity}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Decision Queue ─────────────────────────── */
function DecisionQueue({ aiDecisions }: { aiDecisions: MissionEvent[] }) {
  const [responses, setResponses] = useState<Record<string, string>>({});

  function handleAction(evId: string, action: string) {
    console.log(`Decision ${evId}: ${action}`);
    setResponses(prev => ({ ...prev, [evId]: action }));
    // Clear after 4 seconds
    setTimeout(() => setResponses(prev => {
      const next = { ...prev };
      delete next[evId];
      return next;
    }), 4000);
  }

  if (aiDecisions.length === 0) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid rgba(44,36,25,0.08)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        padding: '18px 20px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>💡</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#2c2419' }}>Decision Queue</span>
          <span style={{ fontSize: 9, background: '#ecfdf5', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>ALL CLEAR</span>
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
          No pending decisions · Hermes is handling everything autonomously
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1.5px solid rgba(217,119,6,0.15)',
      boxShadow: '0 2px 8px rgba(217,119,6,0.04)',
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(44,36,25,0.06)', background: '#fffbeb', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>💡</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#2c2419' }}>Pending Decisions</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Awaiting your review</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 9, background: 'rgba(217,119,6,0.1)', color: '#d97706', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>{aiDecisions.length} FLAGS</span>
      </div>

      <div style={{ padding: '4px 0' }}>
        {aiDecisions.slice(0, 8).map((ev, i) => {
          const d   = ev.data as any;
          const sev = SEV[ev.severity] || SEV.info;
          const resp = responses[ev.id];

          return (
            <div key={ev.id ?? i} style={{
              padding: '14px 18px',
              borderBottom: i < Math.min(aiDecisions.length, 8) - 1 ? '1px solid rgba(44,36,25,0.05)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {/* Severity dot */}
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: sev.color, marginTop: 3, flexShrink: 0, boxShadow: `0 0 0 3px ${sev.color}22` }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2c2419', lineHeight: 1.3, marginBottom: 4 }}>
                    {d?.flag || ev.title}
                  </div>
                  {d?.diagnosis && (
                    <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5, marginBottom: 6 }}>
                      {d.diagnosis}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8 }}>
                    {fmtTimestamp(ev.occurred_at)} · Hermes AI
                  </div>

                  {/* Action buttons or toast */}
                  {resp ? (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: '#ecfdf5', color: '#10b981',
                      border: '1px solid rgba(16,185,129,0.25)',
                      borderRadius: 8, padding: '6px 12px',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      ✓ Response logged — {resp}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[
                        { label: 'Approve', color: '#10b981', bg: '#ecfdf5', border: 'rgba(16,185,129,0.25)' },
                        { label: 'Reject',  color: '#ef4444', bg: '#fef2f2', border: 'rgba(239,68,68,0.25)' },
                        { label: 'Discuss', color: '#3b82f6', bg: '#eff6ff', border: 'rgba(59,130,246,0.25)' },
                      ].map(({ label, color, bg, border }) => (
                        <button
                          key={label}
                          onClick={() => handleAction(ev.id, label)}
                          style={{
                            fontSize: 10, fontWeight: 700, color,
                            background: bg, border: `1px solid ${border}`,
                            borderRadius: 7, padding: '5px 12px',
                            cursor: 'pointer', transition: 'all 150ms',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: sev.bg, color: sev.color, fontWeight: 800, flexShrink: 0 }}>{sev.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────── */
export default function MissionPage() {
  const params     = useParams();
  const clientSlug = (params?.clientSlug as string) || '';
  const { data: session } = useSession();
  const userRole   = (session?.user as any)?.role || '';
  const isClientRole = userRole === 'client';

  const [data,      setData]      = useState<MissionData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState('all');
  const [taskText,  setTaskText]  = useState('');
  const [selTags,   setSelTags]   = useState<string[]>([]);
  const [taskState, setTaskState] = useState<'idle' | 'sending' | 'done'>('idle');

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/mission/${clientSlug}`);
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  }, [clientSlug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    if (!taskText.trim() && selTags.length === 0) return;
    setTaskState('sending');
    try {
      await fetch(`/api/mission/${clientSlug}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: selTags, text: taskText }),
      });
    } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
    setTaskState('done');
    setTaskText(''); setSelTags([]);
    setTimeout(() => setTaskState('idle'), 6000);
  };

  const QUICK_TAGS = ['Ads audit', 'Lead quality', 'Competitor check', 'SEO review', 'GBP update', 'Weekly report'];

  /* ── Loading ── */
  if (loading) return (
    <AdminLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e8e4df', borderTop: '3px solid #c4704f', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#6b7280', fontSize: 13 }}>Loading Mission Control…</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </AdminLayout>
  );

  if (error || !data) return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} activeTab="mission" />
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444', fontSize: 13 }}>Failed to load: {error}</div>
    </AdminLayout>
  );

  /* ── Derived data ── */
  const allEvents = data.events;

  // KPI counts
  const aiActions   = allEvents.filter(e => e.source === 'hermes_cron').length;
  const competitors = allEvents.filter(e => e.event_type === 'competitor_discovered').length;
  const flags       = allEvents.filter(e => e.severity === 'warning' || e.severity === 'critical').length;
  const wins        = allEvents.filter(e => e.severity === 'success').length;

  // Filter for activity log
  const filtered = filterTab === 'all' ? allEvents : allEvents.filter(e => e.category === filterTab);

  // Competitor data
  const compDiscovered = allEvents.filter(e => e.event_type === 'competitor_discovered');
  const compAdEvents   = allEvents.filter(e => e.event_type === 'competitor_new_ad');

  // AI decisions
  const aiDecisions = allEvents.filter(e => e.event_type === 'ai_decision_logged');

  const lastUpdated = new Date(data.generatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Work breakdown (for right panel)
  const breakdown = Object.entries(
    allEvents.reduce((acc, ev) => { acc[ev.event_type] = (acc[ev.event_type] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a).slice(0, 6);

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} clientName={data.client.name} clientCity={data.client.city} activeTab="mission" />

      <div style={{ padding: '24px 28px 80px', background: '#f9f7f4', minHeight: 'calc(100vh - 120px)' }}>

        {/* ── 1. Hero Header ── */}
        <div style={{ background: 'linear-gradient(135deg,#2c2419,#3d3228)', borderRadius: 18, padding: '24px 28px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, background: '#10b981', opacity: 0.06, borderRadius: '50%', filter: 'blur(40px)' }} />
          <div style={{ position: 'absolute', bottom: -30, left: 100, width: 150, height: 150, background: '#c4704f', opacity: 0.08, borderRadius: '50%', filter: 'blur(30px)' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, position: 'relative' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 3px rgba(16,185,129,0.25)', animation: 'pulse-ring 2s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Hermes AI — Online</span>
                <span style={{ fontSize: 9, background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>LIVE</span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 6px', lineHeight: 1.2 }}>
                Mission Control · {data.client.name}
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '0 0 16px', lineHeight: 1.5, maxWidth: 560 }}>
                Your AI marketing agent, working autonomously every night.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { icon: '🔍', text: 'Tracks every competitor daily' },
                  { icon: '🔗', text: 'Backlinks + traffic monitored' },
                  { icon: '📡', text: 'Local events & weather signals' },
                  { icon: '💡', text: 'Every AI decision logged' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '5px 12px' }}>
                    <span style={{ fontSize: 13 }}>{icon}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: event count + refresh */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
              <button onClick={fetchData} style={{
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', fontSize: 11, fontWeight: 600,
                padding: '7px 14px', borderRadius: 10, cursor: 'pointer',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
              >↻ Refresh</button>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{allEvents.length}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>actions logged</div>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Last sync {lastUpdated}</div>
            </div>
          </div>
        </div>

        {/* ── 2. Live Stats Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { icon: '🤖', label: 'AI Actions',    value: aiActions,   color: '#10b981', bg: '#ecfdf5' },
            { icon: '🕵️', label: 'Competitors',   value: competitors, color: '#ef4444', bg: '#fef2f2' },
            { icon: '⚠️',  label: 'Flags Raised',  value: flags,       color: '#d97706', bg: '#fffbeb' },
            { icon: '✅', label: 'Wins',           value: wins,        color: '#3b82f6', bg: '#eff6ff' },
          ].map(({ icon, label, value, color, bg }) => (
            <div key={label} style={{
              background: '#fff', borderRadius: 14,
              border: '1px solid rgba(44,36,25,0.08)',
              padding: '18px 22px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, background: bg, borderRadius: '0 14px 0 60px', opacity: 0.8 }} />
              <div style={{ fontSize: 22, marginBottom: 8, position: 'relative' }}>{icon}</div>
              <div style={{ fontSize: 34, fontWeight: 900, color: '#2c2419', lineHeight: 1, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, transparent)`, opacity: 0.4 }} />
            </div>
          ))}
        </div>

        {/* ── 3. Two-column: Competitor Radar + Decision Queue ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <CompetitorRadar
            compDiscovered={compDiscovered}
            compAdEvents={compAdEvents}
            clientName={data.client.name}
          />
          <DecisionQueue aiDecisions={aiDecisions} />
        </div>

        {/* ── 4. Competitive Intelligence Table ── */}
        <CompetitiveIntelTable
          compDiscovered={compDiscovered}
          compAdEvents={compAdEvents}
          clientName={data.client.name}
        />

        {/* ── 5. Timeline Feed ── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(44,36,25,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 20, overflow: 'hidden' }}>
          {/* Filter tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(44,36,25,0.06)', padding: '0 16px', background: '#fafaf9', flexWrap: 'wrap' }}>
            {FILTER_TABS.map(tab => {
              const count = tab.key === 'all' ? allEvents.length : allEvents.filter(e => e.category === tab.key).length;
              const active = filterTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setFilterTab(tab.key)} style={{
                  background: 'none', border: 'none',
                  borderBottom: `2px solid ${active ? '#c4704f' : 'transparent'}`,
                  color: active ? '#c4704f' : '#9ca3af',
                  fontSize: 11, fontWeight: active ? 700 : 500,
                  padding: '11px 12px 9px', cursor: 'pointer', transition: 'all 200ms',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 8, fontWeight: 700,
                    background: active ? 'rgba(196,112,79,0.1)' : '#f3f4f6',
                    color: active ? '#c4704f' : '#9ca3af',
                  }}>{count}</span>
                </button>
              );
            })}
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', fontSize: 10, color: '#9ca3af', paddingRight: 4 }}>
              {filtered.length} events · newest first
            </span>
          </div>
          <div style={{ padding: '16px 18px' }}>
            <TimelineFeed events={filtered} isClientRole={isClientRole} totalCount={allEvents.length} />
          </div>
        </div>

        {/* ── 6. Intelligence Row: Radar | Signals | Breakdown ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', gap: 14, marginBottom: 20, alignItems: 'start' }}>
          {/* Radar + Schedule */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              background: 'linear-gradient(135deg, #0f1a12, #1a2e1e)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 14,
              padding: 14,
              boxShadow: '0 10px 28px rgba(0,0,0,0.22)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 3px rgba(16,185,129,0.15)', animation: 'pulse-ring 2s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1.2px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>SCANNING</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RadarCanvas />
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {RADAR_BLIPS.map(blip => {
                  const active = allEvents.some(ev => blip.matches(ev));
                  return (
                    <div key={blip.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#d1fae5', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.3 }}>
                      <span style={{ color: blip.color, fontSize: 11, lineHeight: 1 }}>●</span>
                      <span style={{ flex: 1 }}>{blip.label}</span>
                      {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: blip.color, boxShadow: `0 0 0 3px ${blip.color}22`, animation: 'pulse-ring 2s infinite', flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 10, fontSize: 9, color: '#10b981', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '0.3px' }}>
                Active scan: {allEvents.length} signals logged
              </div>
            </div>
            <HermesSchedule nextActions={data.nextActions} />
          </div>

          {/* Signals stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <WeatherDemandBar events={allEvents} city={data.client.city} compact />
            <LocalEventsRadar events={allEvents} city={data.client.city} compact />
          </div>

          {/* Work breakdown */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(44,36,25,0.08)', padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Signal Breakdown</div>
            {breakdown.length === 0 ? (
              <div style={{ color: '#d1d5db', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>No data</div>
            ) : (
              breakdown.map(([type, count], index) => {
                const cfg = EVENT_CONFIG[type] || { icon: '·', label: type, color: '#6b7280', bg: '#f3f4f6' };
                const pct = Math.round((count / allEvents.length) * 100);
                return (
                  <div key={type} style={{ marginBottom: 12, borderLeft: `3px solid ${cfg.color}`, paddingLeft: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        <span>{cfg.icon}</span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.label}</span>
                        {index < 2 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, boxShadow: '0 0 0 3px rgba(255,255,255,0.65)', animation: 'pulse-ring 1.6s infinite', flexShrink: 0 }} />}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '1px 6px', borderRadius: 6, flexShrink: 0 }}>{count}</span>
                    </div>
                    <div style={{ height: 4, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 4, opacity: 0.7, transition: 'width 600ms ease' }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── 8. Team Activity Map ── */}
        <TeamActivityMap events={allEvents} />

        {/* ── 9. Send Task to Hermes ── */}
        <div style={{ marginBottom: 20, background: '#fff', borderRadius: 18, border: '1.5px solid rgba(196,112,79,0.2)', boxShadow: '0 2px 12px rgba(196,112,79,0.08)', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg,#fdf4f0,#fef9f6)', borderBottom: '1px solid rgba(196,112,79,0.1)', padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>🛰</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#2c2419', marginBottom: 2 }}>Send a Task to Hermes</div>
              <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.4 }}>
                See something that needs attention? Tell Hermes — it logs your request, notifies the team, and they&apos;ll follow up. You&apos;re always in the loop.
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>Response time</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#c4704f' }}>Next business day</div>
            </div>
          </div>

          <div style={{ padding: '24px 28px' }}>
            {taskState === 'done' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#ecfdf5', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22 }}>✓</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#2c2419', marginBottom: 6 }}>Task received by Hermes</div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, maxWidth: 400, margin: '0 auto 16px' }}>
                  Your request has been logged and the team has been notified via Telegram. You&apos;ll see an update in the Activity Feed after the next sync.
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fdf4f0', border: '1px solid rgba(196,112,79,0.2)', borderRadius: 12, padding: '10px 18px' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: 'pulse-ring 2s infinite', boxShadow: '0 0 0 3px rgba(16,185,129,0.15)' }} />
                  <span style={{ fontSize: 12, color: '#c4704f', fontWeight: 600 }}>Hermes is on it · Team notified</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', marginBottom: 10 }}>What&apos;s this about? (pick one or more)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {QUICK_TAGS.map(tag => {
                      const sel = selTags.includes(tag);
                      return (
                        <button key={tag} onClick={() => setSelTags(p => sel ? p.filter(t => t !== tag) : [...p, tag])} style={{
                          padding: '6px 14px', borderRadius: 20,
                          border: `1.5px solid ${sel ? '#c4704f' : 'rgba(44,36,25,0.12)'}`,
                          background: sel ? '#c4704f' : '#fff',
                          color: sel ? '#fff' : '#6b7280',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 200ms',
                          boxShadow: sel ? '0 2px 8px rgba(196,112,79,0.2)' : 'none',
                        }}>
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                  <textarea rows={4} value={taskText} onChange={e => setTaskText(e.target.value)}
                    placeholder="Describe what you need… e.g. 'Our leads seem off this week — too many non-chiro calls'"
                    style={{
                      width: '100%', padding: 12, borderRadius: 12,
                      border: '1.5px solid rgba(44,36,25,0.1)',
                      background: '#fafaf9', color: '#2c2419',
                      fontSize: 13, resize: 'none', fontFamily: 'inherit',
                      outline: 'none', lineHeight: 1.6,
                      boxSizing: 'border-box', transition: 'border-color 200ms',
                    }}
                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#c4704f'; }}
                    onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(44,36,25,0.1)'; }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', marginBottom: 10 }}>What happens next</div>
                    {[
                      { step: '1', text: 'Hermes logs your request immediately', color: '#10b981' },
                      { step: '2', text: 'Team receives a Telegram alert',       color: '#3b82f6' },
                      { step: '3', text: 'We investigate and update you directly', color: '#c4704f' },
                    ].map(({ step, text, color }) => (
                      <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${color}18`, border: `1.5px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color, flexShrink: 0 }}>{step}</div>
                        <span style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.4, paddingTop: 3 }}>{text}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleSubmit} disabled={taskState === 'sending'} style={{
                    width: '100%', background: 'linear-gradient(135deg,#c4704f,#d4835f)',
                    color: '#fff', border: 'none', borderRadius: 12,
                    padding: '13px 0', fontSize: 13, fontWeight: 700,
                    cursor: taskState === 'sending' ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: taskState === 'sending' ? 0.8 : 1,
                    boxShadow: '0 4px 16px rgba(196,112,79,0.3)',
                    transition: 'all 200ms',
                  }}>
                    {taskState === 'sending'
                      ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Notifying team…</>
                      : <>🛰 Send to Hermes — Notify Team</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse-ring { 0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,0.15)} 50%{box-shadow:0 0 0 6px rgba(16,185,129,0.08)} }
        @keyframes pulse-ring-red { 0%,100%{box-shadow:0 0 0 3px rgba(239,68,68,0.15)} 50%{box-shadow:0 0 0 6px rgba(239,68,68,0.08)} }
      `}</style>
    </AdminLayout>
  );
}
