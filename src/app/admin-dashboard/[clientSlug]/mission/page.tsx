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

/* ─── Event type display config ─────────────── */
const EVENT_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  daily_metrics:            { icon: '📊', label: 'Daily Snapshot',       color: '#3b82f6' },
  weekly_summary_published: { icon: '📰', label: 'Weekly Digest',        color: '#8b5cf6' },
  ai_decision_logged:       { icon: '💡', label: 'AI Decision',          color: '#d9a854' },
  competitor_new_ad:        { icon: '🔍', label: 'Competitor Ad',        color: '#ef4444' },
  competitor_discovered:    { icon: '🕵️', label: 'Competitor Found',     color: '#f97316' },
  ai_workforce_daily_stats: { icon: '🤖', label: 'AI Workforce',         color: '#10b981' },
  search_terms_classified:  { icon: '🔎', label: 'Search Terms',         color: '#06b6d4' },
  ai_change:                { icon: '⚡', label: 'AI Made Change',       color: '#10b981' },
  staff_change:             { icon: '👤', label: 'Staff Made Change',    color: '#9db5a0' },
  anomaly_alert:            { icon: '🚨', label: 'Anomaly Detected',     color: '#ef4444' },
  phone_calls_analyzed:     { icon: '📞', label: 'Calls Analyzed',       color: '#c4704f' },
  test_pilot:               { icon: '🧪', label: 'Test Event',           color: '#6b7280' },
};

const SEV_COLORS: Record<string, string> = {
  success: '#10b981', warning: '#d9a854', critical: '#ef4444', info: '#6b7280',
};

/* ─── Thought stream — grounded in real work ── */
const THOUGHTS = [
  'Scanning Google Ads change history for all clients…',
  'Cross-referencing competitor ads with client keywords…',
  'Classifying search terms: converting vs wasteful…',
  'Calculating cost-per-lead trends week over week…',
  'Flagging CPL spikes above baseline threshold…',
  'Checking GBP profile views and call engagement…',
  'Auditing AI workforce activity — changes logged…',
  'Generating weekly digest for client review…',
  'Detecting new competitors in local ad auctions…',
  'Comparing impression share against prior 30 days…',
  'Analyzing CTR patterns across all campaigns…',
  'Correlating ad spend with conversion outcomes…',
  'Monitoring for anomalies in session data…',
  'Scoring search terms by relevance and revenue…',
  'Syncing all platform data to dashboard…',
];

/* ─── Radar ─────────────────────────────────── */
function RadarCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef  = useRef(0);
  const rafRef    = useRef<number>(0);

  const BLIPS = [
    { label: 'ADS', angle: 0.6,  dist: 0.55, color: '#d9a854' },
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
    const W = 260, H = 260;
    const cx = W / 2, cy = H / 2, r = 118;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8,20,14,0.98)'; ctx.fill();

      [0.25, 0.5, 0.75, 1].forEach(f => {
        ctx.beginPath(); ctx.arc(cx, cy, r * f, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(16,185,129,0.10)'; ctx.lineWidth = 1; ctx.stroke();
      });

      ctx.strokeStyle = 'rgba(16,185,129,0.06)'; ctx.lineWidth = 1;
      [[cx - r, cy, cx + r, cy], [cx, cy - r, cx, cy + r]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });

      const a = angleRef.current;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a - Math.PI / 2.5, a, false); ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(16,185,129,0)'); g.addColorStop(1, 'rgba(16,185,129,0.22)');
      ctx.fillStyle = g; ctx.fill(); ctx.restore();

      ctx.save();
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2;
      ctx.shadowColor = '#10b981'; ctx.shadowBlur = 10; ctx.stroke(); ctx.restore();

      BLIPS.forEach(blip => {
        const bx = cx + r * blip.dist * Math.cos(blip.angle);
        const by = cy + r * blip.dist * Math.sin(blip.angle);
        const diff = ((a - blip.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const pulse = diff < 0.6 ? 1 - diff / 0.6 : 0;

        ctx.save();
        ctx.beginPath(); ctx.arc(bx, by, 4 + pulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = blip.color; ctx.shadowColor = blip.color;
        ctx.shadowBlur = 10 + pulse * 16; ctx.globalAlpha = 0.7 + pulse * 0.3;
        ctx.fill(); ctx.restore();

        ctx.save();
        ctx.font = 'bold 9px -apple-system,sans-serif';
        ctx.fillStyle = blip.color; ctx.globalAlpha = 0.85;
        ctx.fillText(blip.label, bx + 7, by + 3); ctx.restore();
      });

      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981'; ctx.fill();

      angleRef.current = (a + 0.018) % (Math.PI * 2);
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <canvas ref={canvasRef} width={260} height={260} style={{ borderRadius: '50%', display: 'block' }} />;
}

/* ─── Timeline item ─────────────────────────── */
function TimelineItem({ ev, isClientRole, isLast }: { ev: MissionEvent; isClientRole: boolean; isLast: boolean }) {
  const cfg = EVENT_CONFIG[ev.event_type] || { icon: '·', label: ev.event_type, color: '#6b7280' };
  const sevColor = SEV_COLORS[ev.severity] || '#6b7280';
  const date = new Date(ev.occurred_at);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div style={{ display: 'flex', gap: 0 }}>
      {/* Timeline spine */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: `${cfg.color}18`, border: `1.5px solid ${cfg.color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13,
        }}>{cfg.icon}</div>
        {!isLast && <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.05)', minHeight: 12, margin: '4px 0' }} />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(232,228,223,0.9)', flex: 1 }}>
            {ev.title}
          </span>
          <span style={{
            fontSize: 8, padding: '2px 5px', borderRadius: 4, flexShrink: 0,
            background: `${sevColor}18`, color: sevColor, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>{ev.severity}</span>
        </div>

        {ev.description && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.4, marginBottom: 3 }}>
            {ev.description}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: cfg.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {cfg.label}
          </span>
          {!isClientRole && ev.actor && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>· {ev.actor}</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.18)', flexShrink: 0 }}>
            {dateStr} {timeStr}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Category filter tabs ───────────────────── */
const CATEGORIES = [
  { key: 'all',          label: 'All',          icon: '◎' },
  { key: 'ai_workforce', label: 'AI Actions',   icon: '🤖' },
  { key: 'competitor',   label: 'Competitors',  icon: '🔍' },
  { key: 'account',      label: 'Changes',      icon: '⚡' },
  { key: 'performance',  label: 'Performance',  icon: '📊' },
];

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
    } finally {
      setLoading(false);
    }
  }, [clientSlug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Cycle through real events from Hermes (not fake thoughts)
  const thoughtPool = data ? data.events.map(e => e.title) : THOUGHTS;
  useEffect(() => {
    const pool = data ? data.events.map(e => e.title) : THOUGHTS;
    const t = setInterval(() => setThoughtIdx(i => (i + 1) % pool.length), 2200);
    return () => clearInterval(t);
  }, [data]);

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

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e0f' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '2.5px solid rgba(16,185,129,0.15)', borderTop: '2.5px solid #10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 14px' }} />
        <p style={{ color: '#10b981', fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Initializing Hermes…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !data) return (
    <AdminLayout><ClientTabBar clientSlug={clientSlug} activeTab="mission" />
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444', fontSize: 13 }}>Failed to load: {error}</div>
    </AdminLayout>
  );

  /* ── Derived counts directly from events (monthly table may be empty) ── */
  const allEvents    = data.events;
  const aiActions    = allEvents.filter(e => e.source === 'hermes_cron' || e.event_type.startsWith('ai_')).length;
  const competitors  = allEvents.filter(e => e.category === 'competitor').length;
  const wins         = allEvents.filter(e => e.severity === 'success').length;
  const alerts       = allEvents.filter(e => e.severity === 'warning' || e.severity === 'critical').length;

  const filtered = filterCat === 'all' ? allEvents : allEvents.filter(e => e.category === filterCat);
  const lastUpdated = new Date(data.generatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} clientName={data.client.name} clientCity={data.client.city} activeTab="mission" />

      <div style={{ background: '#0a0e0f', minHeight: 'calc(100vh - 120px)', paddingBottom: 60 }}>

        {/* ── Header ── */}
        <div style={{ background: 'rgba(10,14,15,0.98)', borderBottom: '1px solid rgba(16,185,129,0.1)', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981', animation: 'pulse-glow 2s infinite', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#e8e4df', letterSpacing: '0.06em' }}>
              MISSION CONTROL · {data.client.name.toUpperCase()}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
              Hermes AI — online 24/7 · Last sync {lastUpdated}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{allEvents.length} events tracked</span>
            <button onClick={fetchData} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 8, cursor: 'pointer' }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '22px 28px 0' }}>

          {/* ── KPI strip ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { icon: '🤖', label: 'AI Actions',     value: aiActions,   color: '#10b981' },
              { icon: '🔍', label: 'Competitors',     value: competitors, color: '#ef4444' },
              { icon: '✅', label: 'Wins Logged',     value: wins,        color: '#d9a854' },
              { icon: '⚠️',  label: 'Alerts Raised',  value: alerts,      color: '#f97316' },
            ].map(({ icon, label, value, color }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '14px 16px', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: -16, right: -16, width: 64, height: 64, borderRadius: '50%', background: color, opacity: 0.1, filter: 'blur(16px)' }} />
                <div style={{ fontSize: 16, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* ── Radar + Thought Stream ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, marginBottom: 16 }}>

            {/* Radar */}
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', display: 'inline-block', animation: 'pulse-glow 2s infinite' }} />
                Hermes Scanning
              </div>
              <RadarCanvas />
              <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[['ADS','#d9a854'],['GSC','#3b82f6'],['GBP','#c4704f'],['GA4','#10b981'],['FB','#8b5cf6']].map(([l, c]) => (
                  <span key={l} style={{ fontSize: 9, fontWeight: 700, color: c }}>● {l}</span>
                ))}
              </div>
            </div>

            {/* Thought stream */}
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 16 }}>
                Hermes — Live Thought Stream
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[...Array(6)].map((_, i) => {
                  const idx    = (thoughtIdx - 5 + i + thoughtPool.length) % Math.max(thoughtPool.length, 1);
                  const isLast = i === 5;
                  const op     = 0.12 + i * 0.18;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, opacity: isLast ? 1 : op }}>
                      {isLast
                        ? <div style={{ width: 10, height: 10, border: '1.5px solid rgba(16,185,129,0.4)', borderTop: '1.5px solid #10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0, marginTop: 2 }} />
                        : <span style={{ color: '#10b981', fontSize: 10, flexShrink: 0, marginTop: 2 }}>✓</span>
                      }
                      <span style={{ fontSize: 12, color: isLast ? '#e8e4df' : 'rgba(232,228,223,0.6)', lineHeight: 1.4 }}>
                        {thoughtPool[idx]}
                      </span>
                      {isLast && <span style={{ display: 'inline-block', width: 7, height: 13, background: '#10b981', borderRadius: 1, flexShrink: 0, marginTop: 3, animation: 'blink 0.8s infinite' }} />}
                    </div>
                  );
                })}
              </div>

              {/* Status bar */}
              <div style={{ marginTop: 18, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse-glow 2s infinite', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>Hermes AI — Online</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>Monitoring {data.client.name} · Autonomous 24/7</div>
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                  {[['AI Actions', aiActions], ['Wins', wins], ['Alerts', alerts]].map(([l, n]) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{n}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Activity Timeline + Task form ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

            {/* Timeline */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>

              {/* Filter tabs */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px' }}>
                {CATEGORIES.map(cat => {
                  const count = cat.key === 'all' ? allEvents.length : allEvents.filter(e => e.category === cat.key).length;
                  const active = filterCat === cat.key;
                  return (
                    <button key={cat.key} onClick={() => setFilterCat(cat.key)} style={{
                      background: 'none', border: 'none', borderBottom: `2px solid ${active ? '#10b981' : 'transparent'}`,
                      color: active ? '#10b981' : 'rgba(255,255,255,0.3)',
                      fontSize: 11, fontWeight: active ? 700 : 500,
                      padding: '12px 14px 10px', cursor: 'pointer', transition: 'all 200ms',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                      <span style={{ fontSize: 9, background: active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)', color: active ? '#10b981' : 'rgba(255,255,255,0.25)', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Events */}
              <div style={{ padding: '16px 18px', maxHeight: 560, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                {filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No events in this category</div>
                ) : (
                  filtered.map((ev, i) => (
                    <TimelineItem key={ev.id ?? i} ev={ev} isClientRole={isClientRole} isLast={i === filtered.length - 1} />
                  ))
                )}
              </div>
            </div>

            {/* Right panel: stats + task form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Event type breakdown */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
                  Work Breakdown
                </div>
                {Object.entries(
                  allEvents.reduce((acc, ev) => {
                    const key = ev.event_type;
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                )
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 7)
                  .map(([type, count]) => {
                    const cfg = EVENT_CONFIG[type] || { icon: '·', label: type, color: '#6b7280' };
                    const pct = Math.round((count / allEvents.length) * 100);
                    return (
                      <div key={type} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: 'rgba(232,228,223,0.7)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{cfg.icon}</span> {cfg.label}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{count}</span>
                        </div>
                        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 2, opacity: 0.7 }} />
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Task submission */}
              <div style={{ background: 'rgba(196,112,79,0.05)', border: '1.5px solid rgba(196,112,79,0.18)', borderRadius: 14, padding: 16, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(232,228,223,0.9)', marginBottom: 3 }}>
                  Send Task to Hermes
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 13, lineHeight: 1.4 }}>
                  Report an issue or request — Hermes logs it and notifies the team.
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 11 }}>
                  {QUICK_TAGS.map(tag => {
                    const sel = selTags.includes(tag);
                    return (
                      <button key={tag} onClick={() => setSelTags(p => sel ? p.filter(t => t !== tag) : [...p, tag])} style={{
                        padding: '4px 10px', borderRadius: 20,
                        border: `1.5px solid ${sel ? '#c4704f' : 'rgba(255,255,255,0.1)'}`,
                        background: sel ? '#c4704f' : 'rgba(255,255,255,0.03)',
                        color: sel ? '#fff' : 'rgba(255,255,255,0.45)',
                        fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'all 200ms',
                      }}>
                        {tag}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  rows={3} value={taskText}
                  onChange={e => setTaskText(e.target.value)}
                  placeholder="Describe what you need…"
                  style={{
                    width: '100%', padding: 10, borderRadius: 9,
                    border: '1.5px solid rgba(255,255,255,0.07)',
                    background: 'rgba(255,255,255,0.03)',
                    color: '#e8e4df', fontSize: 11, resize: 'none',
                    fontFamily: 'inherit', outline: 'none', lineHeight: 1.5,
                    marginBottom: 10, transition: 'border-color 200ms',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#c4704f'; }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
                />

                <button onClick={handleSubmit} disabled={submitting} style={{
                  width: '100%', background: 'linear-gradient(135deg,#c4704f,#d4835f)',
                  color: '#fff', border: 'none', borderRadius: 9,
                  padding: '10px 0', fontSize: 12, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  opacity: submitting ? 0.7 : 1,
                }}>
                  {submitting
                    ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Sending…</>
                    : <>🛰 Send to Hermes</>
                  }
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 200ms' }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#131820', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 28, maxWidth: 380, width: '90%', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.7)', animation: 'slideUp 300ms cubic-bezier(0.34,1.56,0.64,1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🛰</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Task Received</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5, marginBottom: 14 }}>
              Hermes has logged your request and notified the team. You&apos;ll see updates in the Activity Feed after the next sync.
            </div>
            <div style={{ background: 'rgba(196,112,79,0.08)', borderRadius: 10, padding: 12, marginBottom: 16, textAlign: 'left', borderLeft: '3px solid #c4704f' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#c4704f', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>Hermes</div>
              <div style={{ fontSize: 11, color: 'rgba(232,228,223,0.75)', lineHeight: 1.5 }}>
                Got it. I&apos;ll pull the relevant data and flag it for the team to review.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center', marginBottom: 14 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse-glow 2s infinite' }} />
              <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>Hermes is on it</span>
            </div>
            <button onClick={() => setShowModal(false)} style={{ background: '#c4704f', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              Got It
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 6px #10b981} 50%{box-shadow:0 0 18px #10b981,0 0 36px rgba(16,185,129,0.25)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(28px) scale(0.95)} to{opacity:1;transform:none} }
      `}</style>
    </AdminLayout>
  );
}
