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
  // Optional enriched fields from newer API version
  stats?: { totalDays: number; uptime: string };
  nextActions?: { icon: string; label: string; time: string; type?: string }[];
  lastByType?: Record<string, string>; // event_type → occurred_at ISO
}

/* ─── Event config ───────────────────────────── */
const EVENT_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  daily_metrics:            { icon: '📊', label: 'Daily Snapshot',    color: '#3b82f6', bg: '#eff6ff' },
  weekly_summary_published: { icon: '📰', label: 'Weekly Digest',     color: '#8b5cf6', bg: '#f5f3ff' },
  ai_decision_logged:       { icon: '💡', label: 'AI Decision',       color: '#d97706', bg: '#fffbeb' },
  competitor_new_ad:        { icon: '🔍', label: 'Competitor Ad',     color: '#ef4444', bg: '#fef2f2' },
  competitor_discovered:    { icon: '🕵️', label: 'Competitor Found',  color: '#f97316', bg: '#fff7ed' },
  ai_workforce_daily_stats: { icon: '🤖', label: 'AI Workforce',      color: '#10b981', bg: '#ecfdf5' },
  search_terms_classified:  { icon: '🔎', label: 'Search Terms',      color: '#0891b2', bg: '#ecfeff' },
  ai_change:                { icon: '⚡', label: 'AI Change',         color: '#10b981', bg: '#ecfdf5' },
  staff_change:             { icon: '👤', label: 'Staff Change',      color: '#6b7280', bg: '#f9fafb' },
  anomaly_alert:            { icon: '🚨', label: 'Anomaly',           color: '#ef4444', bg: '#fef2f2' },
  client_task_submitted:    { icon: '📋', label: 'Client Request',    color: '#c4704f', bg: '#fdf4f0' },
};

const SEV: Record<string, { color: string; bg: string; label: string; border: string }> = {
  success:  { color: '#10b981', bg: '#ecfdf5', label: 'Win',      border: '#10b981' },
  warning:  { color: '#d97706', bg: '#fffbeb', label: 'Alert',    border: '#d97706' },
  critical: { color: '#ef4444', bg: '#fef2f2', label: 'Critical', border: '#ef4444' },
  info:     { color: '#6b7280', bg: '#f3f4f6', label: 'Info',     border: '#9ca3af' },
};

const CATEGORIES = [
  { key: 'all',          label: 'All Activity', icon: '◎' },
  { key: 'ai_workforce', label: 'AI Actions',   icon: '🤖' },
  { key: 'competitor',   label: 'Competitors',  icon: '🔍' },
  { key: 'account',      label: 'Changes',      icon: '⚡' },
  { key: 'performance',  label: 'Performance',  icon: '📊' },
];

/* ─── Helpers ────────────────────────────────── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function dateDivider(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = Math.floor((now.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getNextSchedule() {
  const now  = new Date();
  const vnOffset = 7 * 60; // UTC+7
  const toVN = (d: Date) => new Date(d.getTime() + (vnOffset - d.getTimezoneOffset()) * 60000);

  // Daily ads sync — today 9 PM VN (UTC 14:00)
  const todayAdsVN = new Date(now);
  todayAdsVN.setUTCHours(14, 0, 0, 0);
  if (todayAdsVN <= now) todayAdsVN.setUTCDate(todayAdsVN.getUTCDate() + 1);

  // Search Term Classification — next Monday (UTC 03:00)
  const nextMon = new Date(now);
  nextMon.setUTCHours(3, 0, 0, 0);
  const daysTilMon = (8 - nextMon.getUTCDay()) % 7 || 7;
  nextMon.setUTCDate(nextMon.getUTCDate() + daysTilMon);

  // Weekly Digest — next Sunday (UTC 10:00)
  const nextSun = new Date(now);
  nextSun.setUTCHours(10, 0, 0, 0);
  const daysTilSun = (7 - nextSun.getUTCDay()) % 7 || 7;
  nextSun.setUTCDate(nextSun.getUTCDate() + daysTilSun);

  // Monthly Archive — 1st of next month
  const nextFirst = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12, 0, 0));

  const fmtVN = (d: Date) => {
    const vn = toVN(d);
    const diff = Math.floor((d.getTime() - now.getTime()) / 3600000);
    if (diff < 24) return `Today ${vn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} VN`;
    if (diff < 48) return `Tomorrow ${vn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} VN`;
    return vn.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + vn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) + ' VN';
  };

  return [
    { icon: '⏱', label: 'Daily Ads Sync',              time: fmtVN(todayAdsVN) },
    { icon: '📋', label: 'Search Term Classification',  time: fmtVN(nextMon) },
    { icon: '📰', label: 'Weekly Digest',               time: fmtVN(nextSun) },
    { icon: '🗜', label: 'Monthly Archive',             time: nextFirst.toLocaleDateString([], { month: 'long', day: 'numeric' }) },
  ];
}

/* ─── Radar canvas ───────────────────────────── */
function RadarCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef  = useRef(0);
  const rafRef    = useRef<number>(0);

  const BLIPS = [
    { label: 'ADS', angle: 0.6,  dist: 0.55, color: '#d97706' },
    { label: 'GSC', angle: 1.9,  dist: 0.68, color: '#3b82f6' },
    { label: 'GBP', angle: 3.4,  dist: 0.42, color: '#c4704f' },
    { label: 'GA4', angle: 4.7,  dist: 0.62, color: '#10b981' },
    { label: 'FB',  angle: 5.8,  dist: 0.35, color: '#8b5cf6' },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 200, H = 200, cx = 100, cy = 100, r = 90;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#f0fdf4'; ctx.fill();
      ctx.strokeStyle = '#d1fae5'; ctx.lineWidth = 1.5; ctx.stroke();

      [0.33, 0.66, 1].forEach(f => {
        ctx.beginPath(); ctx.arc(cx, cy, r * f, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(16,185,129,0.15)'; ctx.lineWidth = 1; ctx.stroke();
      });

      ctx.strokeStyle = 'rgba(16,185,129,0.1)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();

      const a = angleRef.current;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a - Math.PI / 2.5, a, false); ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(16,185,129,0)');
      g.addColorStop(1, 'rgba(16,185,129,0.18)');
      ctx.fillStyle = g; ctx.fill(); ctx.restore();

      ctx.save();
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2;
      ctx.shadowColor = '#10b981'; ctx.shadowBlur = 6; ctx.stroke(); ctx.restore();

      BLIPS.forEach(blip => {
        const bx = cx + r * blip.dist * Math.cos(blip.angle);
        const by = cy + r * blip.dist * Math.sin(blip.angle);
        const diff = ((a - blip.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const pulse = diff < 0.6 ? 1 - diff / 0.6 : 0;

        ctx.save();
        ctx.beginPath(); ctx.arc(bx, by, 4 + pulse * 3, 0, Math.PI * 2);
        ctx.fillStyle = blip.color;
        ctx.shadowColor = blip.color; ctx.shadowBlur = 8 + pulse * 12;
        ctx.globalAlpha = 0.8 + pulse * 0.2; ctx.fill(); ctx.restore();

        ctx.save();
        ctx.font = 'bold 8px -apple-system,sans-serif';
        ctx.fillStyle = blip.color; ctx.globalAlpha = 0.9;
        ctx.fillText(blip.label, bx + 6, by + 3); ctx.restore();
      });

      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981'; ctx.fill();

      angleRef.current = (a + 0.018) % (Math.PI * 2);
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <canvas ref={canvasRef} width={200} height={200} style={{ borderRadius: '50%', display: 'block' }} />;
}

/* ─── Live Log (thought stream showing real events) ── */
function LiveLog({ events }: { events: MissionEvent[] }) {
  const [logIdx, setLogIdx] = useState(0);

  // Events sorted newest first
  const sorted = [...events].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  useEffect(() => {
    if (sorted.length === 0) return;
    const t = setInterval(() => setLogIdx(i => (i + 1) % Math.max(sorted.length, 1)), 2400);
    return () => clearInterval(t);
  }, [sorted.length]);

  if (sorted.length === 0) {
    return <div style={{ color: '#d1d5db', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>No activity yet</div>;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
      {[...Array(5)].map((_, i) => {
        // Line 0 = oldest shown (most faded), Line 4 = newest (bright + spinner)
        const evIdx = (logIdx - (4 - i) + sorted.length) % sorted.length;
        const ev    = sorted[evIdx];
        const isLast = i === 4;
        const op    = [0.18, 0.32, 0.50, 0.70, 1][i];
        const cfg   = EVENT_CONFIG[ev?.event_type] || { icon: '·', label: ev?.event_type, color: '#6b7280', bg: '#f3f4f6' };

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, opacity: op, transition: 'opacity 400ms' }}>
            {isLast
              ? <div style={{ width: 11, height: 11, border: '1.5px solid #d1fae5', borderTop: '1.5px solid #10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0, marginTop: 2 }} />
              : <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <span style={{ fontSize: 7, color: '#10b981', fontWeight: 900 }}>✓</span>
                </div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11 }}>{cfg.icon}</span>
                <span style={{ fontSize: 12, color: isLast ? '#2c2419' : '#6b7280', fontWeight: isLast ? 700 : 400, lineHeight: 1.3, flex: 1 }}>{ev?.title}</span>
                {isLast && <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{ev ? timeAgo(ev.occurred_at) : ''}</span>}
              </div>
            </div>
            {isLast && <span style={{ width: 7, height: 14, background: '#10b981', borderRadius: 1, flexShrink: 0, marginTop: 2, animation: 'blink 0.8s infinite', display: 'inline-block' }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Last Activity by Type chips ────────────── */
function LastByTypeRow({ events }: { events: MissionEvent[] }) {
  // Compute last occurrence of key event types from actual event data
  const KEY_TYPES: { key: string; icon: string; label: string }[] = [
    { key: 'ai_change',                icon: '🤖', label: 'AI Change' },
    { key: 'ai_decision_logged',       icon: '💡', label: 'AI Decision' },
    { key: 'competitor_new_ad',        icon: '🔍', label: 'Competitor' },
    { key: 'daily_metrics',            icon: '📊', label: 'Snapshot' },
    { key: 'weekly_summary_published', icon: '📰', label: 'Digest' },
    { key: 'search_terms_classified',  icon: '🔎', label: 'Search Terms' },
  ];

  const lastMap: Record<string, string> = {};
  for (const ev of events) {
    if (!lastMap[ev.event_type]) lastMap[ev.event_type] = ev.occurred_at;
  }

  const chips = KEY_TYPES.filter(t => lastMap[t.key]);
  if (chips.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
      {chips.map(t => (
        <div key={t.key} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(44,36,25,0.1)',
          borderRadius: 20, padding: '4px 12px',
          fontSize: 11, color: '#4b5563', fontWeight: 500,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <span>{t.icon}</span>
          <span style={{ fontWeight: 600 }}>{t.label}</span>
          <span style={{ color: '#9ca3af' }}>—</span>
          <span style={{ color: '#c4704f', fontWeight: 600 }}>{timeAgo(lastMap[t.key])}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Hermes Schedule panel ──────────────────── */
function HermesSchedule({ nextActions }: { nextActions?: { icon: string; label: string; time: string }[] }) {
  const schedule = nextActions && nextActions.length > 0 ? nextActions : getNextSchedule();

  return (
    <div style={{
      background: 'rgba(255,255,255,0.9)',
      border: '1px solid rgba(44,36,25,0.1)',
      borderRadius: 14, padding: '14px 18px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 14 }}>🗓</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#2c2419' }}>Hermes Schedule</span>
        <span style={{ fontSize: 9, background: '#eff6ff', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: '1px 7px', fontWeight: 700, marginLeft: 'auto' }}>UPCOMING</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {schedule.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#2c2419' }}>{item.label}</div>
            </div>
            <div style={{ fontSize: 10, color: '#c4704f', fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>{item.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Grouped Events List ────────────────────── */
function GroupedEvents({ events, isClientRole }: { events: MissionEvent[]; isClientRole: boolean }) {
  if (events.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#d1d5db', fontSize: 13 }}>
        No events in this category
      </div>
    );
  }

  // Group by date divider
  const groups: { divider: string; events: MissionEvent[] }[] = [];
  let currentDivider = '';

  for (const ev of events) {
    const div = dateDivider(ev.occurred_at);
    if (div !== currentDivider) {
      currentDivider = div;
      groups.push({ divider: div, events: [ev] });
    } else {
      groups[groups.length - 1].events.push(ev);
    }
  }

  return (
    <>
      {groups.map((group, gi) => (
        <div key={gi}>
          {/* Date divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            margin: gi === 0 ? '0 0 14px' : '14px 0',
          }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(44,36,25,0.06)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
              {group.divider}
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(44,36,25,0.06)' }} />
          </div>

          {group.events.map((ev, i) => {
            const cfg    = EVENT_CONFIG[ev.event_type] || { icon: '·', label: ev.event_type, color: '#6b7280', bg: '#f3f4f6' };
            const sev    = SEV[ev.severity] || SEV.info;
            const isLast = i === group.events.length - 1;
            const timeStr = new Date(ev.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={ev.id ?? `${gi}-${i}`} style={{ display: 'flex', gap: 0 }}>
                {/* Spine */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 12, flexShrink: 0 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: cfg.bg, border: `1.5px solid ${cfg.color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, flexShrink: 0,
                  }}>{cfg.icon}</div>
                  {!(isLast && gi === groups.length - 1) && (
                    <div style={{ width: 1, flex: 1, background: 'rgba(44,36,25,0.06)', minHeight: 12, margin: '4px 0' }} />
                  )}
                </div>

                {/* Content card */}
                <div style={{
                  flex: 1, paddingBottom: isLast ? 0 : 14,
                  borderLeft: `3px solid ${sev.border}33`,
                  paddingLeft: 10, marginLeft: -2,
                  borderRadius: '0 8px 8px 0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#2c2419', flex: 1, lineHeight: 1.3 }}>{ev.title}</span>
                    <span style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 6, flexShrink: 0,
                      background: sev.bg, color: sev.color, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: '0.4px',
                    }}>{sev.label}</span>
                  </div>
                  {ev.description && (
                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginBottom: 5 }}>{ev.description}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: cfg.color, fontWeight: 600, background: cfg.bg, padding: '1px 7px', borderRadius: 5 }}>{cfg.label}</span>
                    {!isClientRole && ev.actor && (
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>· {ev.actor}</span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#c9c5c0', fontWeight: 500 }}>{timeStr} · {timeAgo(ev.occurred_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

/* ─── Main ───────────────────────────────────── */
export default function MissionPage() {
  const params     = useParams();
  const clientSlug = (params?.clientSlug as string) || '';
  const { data: session } = useSession();
  const userRole   = (session?.user as any)?.role || '';
  const isClientRole = userRole === 'client';

  const [data,       setData]       = useState<MissionData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [filterCat,  setFilterCat]  = useState('all');
  const [taskText,   setTaskText]   = useState('');
  const [selTags,    setSelTags]    = useState<string[]>([]);
  const [taskState,  setTaskState]  = useState<'idle' | 'sending' | 'done'>('idle');

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

  /* ── Derived KPIs ── */
  const allEvents   = data.events;
  const aiActions   = allEvents.filter(e => e.source === 'hermes_cron' || e.event_type.startsWith('ai_')).length;
  const competitors = allEvents.filter(e => e.category === 'competitor').length;
  const wins        = allEvents.filter(e => e.severity === 'success').length;
  const alerts      = allEvents.filter(e => e.severity === 'warning' || e.severity === 'critical').length;
  const filtered    = filterCat === 'all' ? allEvents : allEvents.filter(e => e.category === filterCat);

  const lastUpdated = new Date(data.generatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Event type breakdown
  const breakdown = Object.entries(
    allEvents.reduce((acc, ev) => { acc[ev.event_type] = (acc[ev.event_type] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a).slice(0, 6);

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} clientName={data.client.name} clientCity={data.client.city} activeTab="mission" />

      <div style={{ padding: '24px 28px 60px', background: '#f9f7f4', minHeight: 'calc(100vh - 120px)' }}>

        {/* ── Hero header ── */}
        <div style={{ background: 'linear-gradient(135deg,#2c2419,#3d3228)', borderRadius: 18, padding: '24px 28px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
          {/* Background glow */}
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
                Mission Control — {data.client.name}
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '0 0 16px', lineHeight: 1.5, maxWidth: 560 }}>
                Hermes is your AI marketing agent, working autonomously every night while you sleep.
                It scans your ads, monitors competitors, cuts wasted spend, and logs every action here — so you always know exactly what&apos;s being done on your behalf.
              </p>
              {/* Value props */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { icon: '🤖', text: 'AI makes changes nightly' },
                  { icon: '🔍', text: 'Competitor intel 24/7' },
                  { icon: '💡', text: 'Every decision logged' },
                  { icon: '📰', text: 'Weekly digest for your team' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '5px 12px' }}>
                    <span style={{ fontSize: 13 }}>{icon}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: uptime stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
              <button onClick={fetchData} style={{
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', fontSize: 11, fontWeight: 600,
                padding: '7px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all 150ms',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
              >↻ Refresh</button>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{allEvents.length}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>actions logged</div>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Last sync {lastUpdated}</div>
            </div>
          </div>
        </div>

        {/* ── Team Section ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* AI Team */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(16,185,129,0.15)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg,#ecfdf5,#f0fdf4)', borderBottom: '1px solid rgba(16,185,129,0.1)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 3px rgba(16,185,129,0.2)', animation: 'pulse-ring 2s infinite' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#065f46' }}>AI Team — Hermes</span>
                <span style={{ marginLeft: 'auto', fontSize: 9, background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>ALWAYS ON</span>
              </div>
              <div style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { name: 'Queen Bee', role: 'Ads Strategist', icon: '👑', desc: 'Bids, budgets, campaign structure', actor: 'AI Queen Bee', color: '#d97706', bg: '#fffbeb' },
                  { name: 'Ads Bee',   role: 'Ads Optimizer',  icon: '⚡', desc: 'Keyword sculpting, negative lists', actor: 'AI Performance Tracker', color: '#3b82f6', bg: '#eff6ff' },
                  { name: 'SEO Bee',   role: 'Search Analyst', icon: '🔎', desc: 'Search term classification', actor: 'AI Search Term Classifier', color: '#0891b2', bg: '#ecfeff' },
                  { name: 'Writer Bee',role: 'Ad Copywriter',  icon: '✍️', desc: 'Headlines, RSA variants', actor: 'AI Creative Writer', color: '#8b5cf6', bg: '#f5f3ff' },
                ].map(({ name, role, icon, desc, actor, color, bg }) => {
                  const lastEvent = allEvents.find(e => e.actor === actor);
                  return (
                    <div key={name} style={{ background: bg, borderRadius: 12, padding: '11px 13px', border: `1px solid ${color}22` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <span style={{ fontSize: 16 }}>{icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#2c2419', lineHeight: 1 }}>{name}</div>
                          <div style={{ fontSize: 9, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{role}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.4, marginBottom: 6 }}>{desc}</div>
                      {lastEvent ? (
                        <div style={{ fontSize: 9, color: '#9ca3af', background: 'rgba(255,255,255,0.7)', borderRadius: 6, padding: '3px 7px' }}>
                          Last: {timeAgo(lastEvent.occurred_at)}
                        </div>
                      ) : (
                        <div style={{ fontSize: 9, color: '#d1d5db', background: 'rgba(255,255,255,0.7)', borderRadius: 6, padding: '3px 7px' }}>No data yet</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Human Team */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg,#fafaf9,#f5f1ed)', borderBottom: '1px solid rgba(44,36,25,0.06)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>👥</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#2c2419' }}>Human Team — MyChiropractice</span>
                <span style={{ marginLeft: 'auto', fontSize: 9, background: '#f3f4f6', color: '#6b7280', border: '1px solid rgba(44,36,25,0.1)', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>AVAILABLE</span>
              </div>
              <div style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { name: 'Amanda',  role: 'Account Manager',    icon: '🤝', color: '#c4704f', actor: 'Amanda (Account Manager)' },
                  { name: 'Vinnie',  role: 'Ads Senior',         icon: '📈', color: '#3b82f6', actor: 'Vinnie (Ads Senior)' },
                  { name: 'Sam',     role: 'Ads Specialist',     icon: '⚡', color: '#3b82f6', actor: 'Sam (Ads Specialist)' },
                  { name: 'Quan',    role: 'SEO Technical',      icon: '🔧', color: '#0891b2', actor: 'Quan (SEO Technical)' },
                  { name: 'Thien',   role: 'SEO Specialist',     icon: '🔎', color: '#0891b2', actor: 'Thien (SEO Specialist)' },
                  { name: 'Rachel',  role: 'Content Specialist', icon: '✍️', color: '#8b5cf6', actor: 'Rachel (Content)' },
                  { name: 'Lee',     role: 'Marketing Manager',  icon: '🎯', color: '#d97706', actor: 'Lee (Marketing Manager)' },
                  { name: 'Topaz',   role: 'Vice President',     icon: '⭐', color: '#d97706', actor: 'Topaz (VP)' },
                  { name: 'Kevin',   role: 'CEO',                icon: '👑', color: '#2c2419', actor: 'Kevin (CEO)' },
                ].map(({ name, role, icon, color, actor: actorName }) => {
                  const staffEvent = allEvents.find(e => e.actor === actorName);
                  return (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10, background: '#fafaf9', border: '1px solid rgba(44,36,25,0.06)' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${color}15`, border: `1.5px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#2c2419' }}>{name}</div>
                        <div style={{ fontSize: 9, color, fontWeight: 600 }}>{role}</div>
                        {staffEvent ? (
                          <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, lineHeight: 1.3,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            maxWidth: 120,
                          }}>
                            {timeAgo(staffEvent.occurred_at)} · {staffEvent.title.replace(/^[^\s]+\s/, '')}
                          </div>
                        ) : (
                          <div style={{ fontSize: 9, color: '#d1d5db', marginTop: 2 }}>No recent activity</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { icon: '🤖', label: 'AI Actions',    value: aiActions,   color: '#10b981', bg: '#ecfdf5', border: 'rgba(16,185,129,0.2)' },
            { icon: '🔍', label: 'Competitors',    value: competitors, color: '#ef4444', bg: '#fef2f2', border: 'rgba(239,68,68,0.2)' },
            { icon: '✅', label: 'Wins Logged',    value: wins,        color: '#d97706', bg: '#fffbeb', border: 'rgba(217,119,6,0.2)' },
            { icon: '⚠️',  label: 'Alerts Raised', value: alerts,      color: '#f97316', bg: '#fff7ed', border: 'rgba(249,115,22,0.2)' },
          ].map(({ icon, label, value, color, bg }) => (
            <div key={label} style={{
              background: '#fff', borderRadius: 14,
              border: '1px solid rgba(44,36,25,0.08)',
              padding: '16px 20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, background: bg, borderRadius: '0 14px 0 60px', opacity: 0.8 }} />
              <div style={{ fontSize: 20, marginBottom: 8, position: 'relative' }}>{icon}</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#2c2419', lineHeight: 1, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, transparent)`, opacity: 0.4 }} />
            </div>
          ))}
        </div>

        {/* ── Last Activity by Type chips ── */}
        <LastByTypeRow events={allEvents} />

        {/* ── Radar + Thought Stream + Breakdown ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 260px', gap: 14, marginBottom: 14 }}>

          {/* Radar + Schedule stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(44,36,25,0.08)', padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, alignSelf: 'flex-start' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse-ring 2s infinite', boxShadow: '0 0 0 3px rgba(16,185,129,0.15)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Scanning</span>
              </div>
              <RadarCanvas />
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[['ADS','#d97706'],['GSC','#3b82f6'],['GBP','#c4704f'],['GA4','#10b981'],['FB','#8b5cf6']].map(([l, c]) => (
                  <span key={l} style={{ fontSize: 9, fontWeight: 700, color: c as string }}>● {l}</span>
                ))}
              </div>
            </div>

            {/* Hermes Schedule */}
            <HermesSchedule nextActions={data.nextActions} />
          </div>

          {/* Live Log (thought stream) */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(44,36,25,0.08)', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#2c2419' }}>Hermes — Live Activity Log</span>
              <span style={{ fontSize: 9, background: '#ecfdf5', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>LIVE</span>
            </div>

            <LiveLog events={allEvents} />

            {/* Status footer */}
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#f9fafb', borderRadius: 10, border: '1px solid rgba(44,36,25,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 3px rgba(16,185,129,0.15)', animation: 'pulse-ring 2s infinite', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#2c2419' }}>Hermes AI — Online</div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>Autonomous 24/7 · {allEvents.length} events tracked</div>
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                {[['Tasks', aiActions], ['Wins', wins], ['Alerts', alerts]].map(([l, n]) => (
                  <div key={l as string} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#2c2419' }}>{n}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Work breakdown */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(44,36,25,0.08)', padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2c2419', marginBottom: 14 }}>Work Breakdown</div>
            {breakdown.length === 0 ? (
              <div style={{ color: '#d1d5db', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>No data</div>
            ) : (
              breakdown.map(([type, count]) => {
                const cfg = EVENT_CONFIG[type] || { icon: '·', label: type, color: '#6b7280', bg: '#f3f4f6' };
                const pct = Math.round((count / allEvents.length) * 100);
                return (
                  <div key={type} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span>{cfg.icon}</span>{cfg.label}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '1px 6px', borderRadius: 6 }}>{count}</span>
                    </div>
                    <div style={{ height: 4, background: '#f3f4f6', borderRadius: 4 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 4, opacity: 0.7, transition: 'width 600ms ease' }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Activity Timeline + Task Form ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 }}>

          {/* Timeline — unlimited scroll */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(44,36,25,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>

            {/* Filter tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(44,36,25,0.06)', padding: '0 16px', background: '#fafaf9' }}>
              {CATEGORIES.map(cat => {
                const count = cat.key === 'all' ? allEvents.length : allEvents.filter(e => e.category === cat.key).length;
                const active = filterCat === cat.key;
                return (
                  <button key={cat.key} onClick={() => setFilterCat(cat.key)} style={{
                    background: 'none', border: 'none',
                    borderBottom: `2px solid ${active ? '#c4704f' : 'transparent'}`,
                    color: active ? '#c4704f' : '#9ca3af',
                    fontSize: 11, fontWeight: active ? 700 : 500,
                    padding: '11px 12px 9px', cursor: 'pointer', transition: 'all 200ms',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 8, fontWeight: 700,
                      background: active ? 'rgba(196,112,79,0.1)' : '#f3f4f6',
                      color: active ? '#c4704f' : '#9ca3af',
                    }}>{count}</span>
                  </button>
                );
              })}
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', fontSize: 10, color: '#9ca3af', paddingRight: 4 }}>
                {filtered.length} events · scroll to see all
              </span>
            </div>

            {/* Events list — no maxHeight cap, unlimited scroll */}
            <div style={{ padding: '16px 18px' }}>
              <GroupedEvents events={filtered} isClientRole={isClientRole} />
            </div>
          </div>

          {/* Right: Hermes info card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'linear-gradient(135deg,#ecfdf5,#f0fdf4)', borderRadius: 14, border: '1px solid rgba(16,185,129,0.15)', padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46', marginBottom: 4 }}>🤖 What Hermes does every night</div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 12, lineHeight: 1.4 }}>
                While you sleep, Hermes runs a full sweep of your marketing — automatically, every night.
              </div>
              {[
                { icon: '📊', text: 'Pulls GA4, GSC, Ads & GBP data' },
                { icon: '🔍', text: 'Scans competitor ads in your area' },
                { icon: '⚡', text: 'Adjusts bids & adds negative keywords' },
                { icon: '🔎', text: 'Classifies search terms: keep vs cut' },
                { icon: '💡', text: 'Logs every decision with reasoning' },
                { icon: '🚨', text: 'Detects anomalies & alerts the team' },
                { icon: '📰', text: 'Publishes weekly digest for review' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ fontSize: 11, color: '#047857', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 13 }}>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(44,36,25,0.08)', padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Why this matters</div>
              <p style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.6, margin: 0 }}>
                Most agencies report once a month. Hermes logs every action in real time — so you see the work, not just the results. This is the first AI agent built specifically for chiropractic practices, running 24/7 so your marketing never stops optimizing.
              </p>
            </div>
          </div>
        </div>

        {/* ── Send Task to Hermes — Full Width Section ── */}
        <div style={{ marginTop: 14, background: '#fff', borderRadius: 18, border: '1.5px solid rgba(196,112,79,0.2)', boxShadow: '0 2px 12px rgba(196,112,79,0.08)', overflow: 'hidden' }}>
          {/* Section header */}
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
              /* ── Success state ── */
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
                {/* Left: quick tags + textarea */}
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

                {/* Right: what happens + submit */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', marginBottom: 10 }}>What happens next</div>
                    {[
                      { step: '1', text: 'Hermes logs your request immediately', color: '#10b981' },
                      { step: '2', text: 'Team receives a Telegram alert', color: '#3b82f6' },
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
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse-ring { 0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,0.15)} 50%{box-shadow:0 0 0 6px rgba(16,185,129,0.08)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:none} }
      `}</style>
    </AdminLayout>
  );
}
