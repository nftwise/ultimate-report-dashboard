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

const SEV: Record<string, { color: string; bg: string; label: string }> = {
  success:  { color: '#10b981', bg: '#ecfdf5', label: 'Win' },
  warning:  { color: '#d97706', bg: '#fffbeb', label: 'Alert' },
  critical: { color: '#ef4444', bg: '#fef2f2', label: 'Critical' },
  info:     { color: '#6b7280', bg: '#f3f4f6', label: 'Info' },
};

const CATEGORIES = [
  { key: 'all',          label: 'All Activity', icon: '◎' },
  { key: 'ai_workforce', label: 'AI Actions',   icon: '🤖' },
  { key: 'competitor',   label: 'Competitors',  icon: '🔍' },
  { key: 'account',      label: 'Changes',      icon: '⚡' },
  { key: 'performance',  label: 'Performance',  icon: '📊' },
];

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
  const [thoughtIdx, setThoughtIdx] = useState(0);
  const [filterCat,  setFilterCat]  = useState('all');
  const [taskText,   setTaskText]   = useState('');
  const [selTags,    setSelTags]    = useState<string[]>([]);
  const [showModal,  setShowModal]  = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  // Cycle real event titles as thought stream
  const thoughtPool = data?.events?.map(e => e.title) || [];
  useEffect(() => {
    if (thoughtPool.length === 0) return;
    const t = setInterval(() => setThoughtIdx(i => (i + 1) % thoughtPool.length), 2200);
    return () => clearInterval(t);
  }, [thoughtPool.length]);

  const handleSubmit = async () => {
    if (!taskText.trim() && selTags.length === 0) return;
    setSubmitting(true);
    try {
      await fetch(`/api/mission/${clientSlug}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: selTags, text: taskText }),
      });
    } catch (_) {}
    setShowModal(true); setSubmitting(false); setTaskText(''); setSelTags([]);
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

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 3px rgba(16,185,129,0.15)', animation: 'pulse-ring 2s infinite' }} />
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#2c2419', margin: 0 }}>Mission Control</h1>
              <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>
                HERMES ONLINE
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
              AI agent working 24/7 for {data.client.name} · Last sync {lastUpdated}
            </p>
          </div>
          <button onClick={fetchData} style={{
            background: '#fff', border: '1px solid rgba(44,36,25,0.12)',
            color: '#2c2419', fontSize: 12, fontWeight: 600,
            padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 150ms',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* ── KPI cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { icon: '🤖', label: 'AI Actions',    value: aiActions,   color: '#10b981', bg: '#ecfdf5', border: 'rgba(16,185,129,0.2)' },
            { icon: '🔍', label: 'Competitors',    value: competitors, color: '#ef4444', bg: '#fef2f2', border: 'rgba(239,68,68,0.2)' },
            { icon: '✅', label: 'Wins Logged',    value: wins,        color: '#d97706', bg: '#fffbeb', border: 'rgba(217,119,6,0.2)' },
            { icon: '⚠️',  label: 'Alerts Raised', value: alerts,      color: '#f97316', bg: '#fff7ed', border: 'rgba(249,115,22,0.2)' },
          ].map(({ icon, label, value, color, bg, border }) => (
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

        {/* ── Radar + Thought Stream + Breakdown ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 260px', gap: 14, marginBottom: 14 }}>

          {/* Radar */}
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

          {/* Thought stream */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(44,36,25,0.08)', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#2c2419' }}>Hermes — Live Activity Log</span>
              <span style={{ fontSize: 9, background: '#ecfdf5', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>LIVE</span>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {thoughtPool.length === 0 ? (
                <div style={{ color: '#d1d5db', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>No activity yet</div>
              ) : (
                [...Array(5)].map((_, i) => {
                  const idx    = (thoughtIdx - 4 + i + thoughtPool.length) % Math.max(thoughtPool.length, 1);
                  const isLast = i === 4;
                  const op     = 0.2 + i * 0.2;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, opacity: isLast ? 1 : op }}>
                      {isLast
                        ? <div style={{ width: 10, height: 10, border: '1.5px solid #d1fae5', borderTop: '1.5px solid #10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0, marginTop: 3 }} />
                        : <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 3 }}>
                            <span style={{ fontSize: 7, color: '#10b981', fontWeight: 900 }}>✓</span>
                          </div>
                      }
                      <span style={{ fontSize: 12, color: isLast ? '#2c2419' : '#9ca3af', lineHeight: 1.4, fontWeight: isLast ? 600 : 400 }}>
                        {thoughtPool[idx]}
                      </span>
                      {isLast && <span style={{ width: 7, height: 14, background: '#10b981', borderRadius: 1, flexShrink: 0, marginTop: 3, animation: 'blink 0.8s infinite', display: 'inline-block' }} />}
                    </div>
                  );
                })
              )}
            </div>

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

          {/* Timeline */}
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
            </div>

            {/* Events list */}
            <div style={{ padding: '14px 18px', maxHeight: 520, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#d1d5db', fontSize: 13 }}>
                  No events in this category
                </div>
              ) : (
                filtered.map((ev, i) => {
                  const cfg = EVENT_CONFIG[ev.event_type] || { icon: '·', label: ev.event_type, color: '#6b7280', bg: '#f3f4f6' };
                  const sev = SEV[ev.severity] || SEV.info;
                  const date = new Date(ev.occurred_at);
                  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  const isLast  = i === filtered.length - 1;

                  return (
                    <div key={ev.id ?? i} style={{ display: 'flex', gap: 0 }}>
                      {/* Spine */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 12, flexShrink: 0 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          background: cfg.bg, border: `1.5px solid ${cfg.color}33`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, flexShrink: 0,
                        }}>{cfg.icon}</div>
                        {!isLast && <div style={{ width: 1, flex: 1, background: 'rgba(44,36,25,0.06)', minHeight: 10, margin: '4px 0' }} />}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 14 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#2c2419', flex: 1, lineHeight: 1.3 }}>{ev.title}</span>
                          <span style={{
                            fontSize: 9, padding: '2px 6px', borderRadius: 6, flexShrink: 0,
                            background: sev.bg, color: sev.color, fontWeight: 800,
                            textTransform: 'uppercase', letterSpacing: '0.4px',
                          }}>{sev.label}</span>
                        </div>
                        {ev.description && (
                          <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4, marginBottom: 4 }}>{ev.description}</div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, color: cfg.color, fontWeight: 600, background: cfg.bg, padding: '1px 6px', borderRadius: 5 }}>{cfg.label}</span>
                          {!isClientRole && ev.actor && (
                            <span style={{ fontSize: 10, color: '#9ca3af' }}>· {ev.actor}</span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#d1d5db' }}>{dateStr} {timeStr}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Task form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Send task card */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(196,112,79,0.2)', padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>🛰</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#2c2419' }}>Send Task to Hermes</span>
              </div>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 14px', lineHeight: 1.4 }}>
                Report an issue or request — Hermes logs it and notifies the team immediately.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {QUICK_TAGS.map(tag => {
                  const sel = selTags.includes(tag);
                  return (
                    <button key={tag} onClick={() => setSelTags(p => sel ? p.filter(t => t !== tag) : [...p, tag])} style={{
                      padding: '4px 10px', borderRadius: 20,
                      border: `1.5px solid ${sel ? '#c4704f' : 'rgba(44,36,25,0.12)'}`,
                      background: sel ? '#c4704f' : '#fff',
                      color: sel ? '#fff' : '#6b7280',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'all 200ms',
                    }}>
                      {tag}
                    </button>
                  );
                })}
              </div>

              <textarea rows={3} value={taskText} onChange={e => setTaskText(e.target.value)}
                placeholder="Describe your request…"
                style={{
                  width: '100%', padding: 10, borderRadius: 10,
                  border: '1.5px solid rgba(44,36,25,0.1)',
                  background: '#fafaf9', color: '#2c2419',
                  fontSize: 12, resize: 'none', fontFamily: 'inherit',
                  outline: 'none', lineHeight: 1.5, marginBottom: 10,
                  boxSizing: 'border-box', transition: 'border-color 200ms',
                }}
                onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#c4704f'; }}
                onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(44,36,25,0.1)'; }}
              />

              <button onClick={handleSubmit} disabled={submitting} style={{
                width: '100%', background: 'linear-gradient(135deg,#c4704f,#d4835f)',
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '10px 0', fontSize: 12, fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                opacity: submitting ? 0.7 : 1, boxShadow: '0 2px 8px rgba(196,112,79,0.25)',
              }}>
                {submitting
                  ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Sending…</>
                  : '🛰 Send to Hermes'
                }
              </button>
            </div>

            {/* Hermes info card */}
            <div style={{ background: 'linear-gradient(135deg,#ecfdf5,#f0fdf4)', borderRadius: 14, border: '1px solid rgba(16,185,129,0.15)', padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46', marginBottom: 10 }}>🤖 What Hermes does nightly</div>
              {[
                '📊 Pulls GA4, GSC, Ads, GBP data',
                '🔍 Scans competitor ads in your area',
                '⚡ Makes bid & keyword adjustments',
                '🔎 Classifies search terms: keep vs cut',
                '💡 Logs decisions & flags anomalies',
                '📰 Publishes weekly digest for your team',
              ].map(item => (
                <div key={item} style={{ fontSize: 11, color: '#047857', marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ flexShrink: 0 }}></span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirm Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 200ms' }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 380, width: '90%', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.15)', animation: 'slideUp 300ms cubic-bezier(0.34,1.56,0.64,1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🛰</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#2c2419', marginBottom: 6 }}>Task Received</div>
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginBottom: 16 }}>
              Hermes logged your request and notified the team. Updates will appear in the Activity Feed after the next sync.
            </div>
            <div style={{ background: '#fdf4f0', borderRadius: 12, padding: 14, marginBottom: 16, textAlign: 'left', borderLeft: '3px solid #c4704f' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#c4704f', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>Hermes</div>
              <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>Got it. I&apos;ll pull the relevant data and flag it for the team to review.</div>
            </div>
            <button onClick={() => setShowModal(false)} style={{ background: '#c4704f', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%', boxShadow: '0 2px 8px rgba(196,112,79,0.25)' }}>
              Got It
            </button>
          </div>
        </div>
      )}

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
