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

interface MissionMonthly {
  month: string;
  wins: number;
  warnings: number;
  critical: number;
  ai_tasks_done: number;
  staff_tasks_done: number;
  highlights: string[];
}

interface MissionMetric {
  date: string;
  [key: string]: unknown;
}

interface MissionData {
  client: { id: string; name: string; slug: string; city?: string };
  events: MissionEvent[];
  monthly: MissionMonthly | null;
  metrics: MissionMetric[];
  generatedAt: string;
}

/* ─── Hermes thought lines ───────────────────── */
const THOUGHTS = [
  'Analyzing GA4 session trends for anomalies…',
  'Cross-referencing GSC keyword rankings…',
  'Scanning Google Ads conversion data…',
  'Checking GBP profile engagement metrics…',
  'Evaluating Facebook Ads ROAS signals…',
  'Identifying top-performing landing pages…',
  'Calculating month-over-month lead velocity…',
  'Running competitor visibility sweep…',
  'Flagging conversion drop-off patterns…',
  'Correlating ad spend with organic growth…',
  'Monitoring GBP review sentiment…',
  'Auditing keyword cannibalization risks…',
  'Detecting session quality regressions…',
  'Scoring call-to-click conversion ratios…',
  'Synthesizing weekly performance snapshot…',
];

/* ─── Severity config ────────────────────────── */
const SEV_COLORS: Record<string, string> = {
  success:  '#10b981',
  warning:  '#d9a854',
  critical: '#ef4444',
  info:     '#6b7280',
};
const SEV_BG: Record<string, string> = {
  success:  'rgba(16,185,129,0.1)',
  warning:  'rgba(217,168,84,0.12)',
  critical: 'rgba(239,68,68,0.1)',
  info:     'rgba(107,114,128,0.1)',
};
const SEV_ICON: Record<string, string> = {
  success:  '✓',
  warning:  '⚠',
  critical: '✕',
  info:     'ℹ',
};

/* ─── Radar canvas ───────────────────────────── */
function RadarCanvas({ width = 280, height = 280 }: { width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef  = useRef(0);
  const rafRef    = useRef<number>(0);

  const BLIPS = [
    { label: 'GA4', angle: 0.4,  dist: 0.55, color: '#10b981' },
    { label: 'GSC', angle: 1.8,  dist: 0.70, color: '#3b82f6' },
    { label: 'ADS', angle: 3.2,  dist: 0.45, color: '#d9a854' },
    { label: 'GBP', angle: 4.8,  dist: 0.60, color: '#c4704f' },
    { label: 'FB',  angle: 5.9,  dist: 0.35, color: '#8b5cf6' },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = width / 2;
    const cy = height / 2;
    const r  = Math.min(cx, cy) - 8;

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      // Background circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10,26,18,0.95)';
      ctx.fill();

      // Rings
      [0.25, 0.5, 0.75, 1].forEach(f => {
        ctx.beginPath();
        ctx.arc(cx, cy, r * f, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(16,185,129,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Cross-hairs
      ctx.strokeStyle = 'rgba(16,185,129,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();

      // Sweep gradient
      const sweep = angleRef.current;
      void 0; // sweep rendered via arc slice below

      // Draw sweep as filled arc slice
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, sweep - Math.PI / 3, sweep, false);
      ctx.closePath();
      const sweepFill = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      sweepFill.addColorStop(0, 'rgba(16,185,129,0.0)');
      sweepFill.addColorStop(1, 'rgba(16,185,129,0.18)');
      ctx.fillStyle = sweepFill;
      ctx.fill();
      ctx.restore();

      // Sweep leading edge
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(sweep), cy + r * Math.sin(sweep));
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();

      // Blips
      BLIPS.forEach(blip => {
        const bx = cx + r * blip.dist * Math.cos(blip.angle);
        const by = cy + r * blip.dist * Math.sin(blip.angle);

        // Determine pulse intensity based on sweep proximity
        const diff = ((sweep - blip.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const pulse = diff < 0.5 ? 1 - diff / 0.5 : 0;

        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, 4 + pulse * 3, 0, Math.PI * 2);
        ctx.fillStyle = blip.color;
        ctx.shadowColor = blip.color;
        ctx.shadowBlur = 8 + pulse * 12;
        ctx.globalAlpha = 0.7 + pulse * 0.3;
        ctx.fill();
        ctx.restore();

        // Label
        ctx.save();
        ctx.font = 'bold 9px -apple-system, sans-serif';
        ctx.fillStyle = blip.color;
        ctx.globalAlpha = 0.8;
        ctx.fillText(blip.label, bx + 7, by + 3);
        ctx.restore();
      });

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();

      angleRef.current = (sweep + 0.018) % (Math.PI * 2);
      rafRef.current   = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ borderRadius: '50%', display: 'block' }}
    />
  );
}

/* ─── Main Page ──────────────────────────────── */
export default function MissionPage() {
  const params = useParams();
  const clientSlug = (params?.clientSlug as string) || '';
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || '';
  const isClientRole = userRole === 'client';

  const [data,       setData]       = useState<MissionData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [thoughtIdx, setThoughtIdx] = useState(0);
  const [taskText,   setTaskText]   = useState('');
  const [selTags,    setSelTags]    = useState<string[]>([]);
  const [showModal,  setShowModal]  = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* Fetch data */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/mission/${clientSlug}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [clientSlug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Thought stream cycling */
  useEffect(() => {
    const t = setInterval(() => {
      setThoughtIdx(i => (i + 1) % THOUGHTS.length);
    }, 2200);
    return () => clearInterval(t);
  }, []);

  /* Task submission */
  const handleSubmit = async () => {
    if (!taskText.trim() && selTags.length === 0) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 900)); // simulate
    setShowModal(true);
    setSubmitting(false);
    setTaskText('');
    setSelTags([]);
  };

  const QUICK_TAGS = ['Review Ads', 'SEO audit', 'GBP update', 'Content ideas', 'Competitor check', 'Report needed'];

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40,
            border: '3px solid rgba(16,185,129,0.2)',
            borderTop: '3px solid #10b981',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#10b981', fontSize: '12px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Initializing Hermes…
          </p>
        </div>
        <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !data) {
    return (
      <AdminLayout>
        <ClientTabBar clientSlug={clientSlug} activeTab="mission" />
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#ef4444' }}>
          Failed to load Mission Control: {error}
        </div>
      </AdminLayout>
    );
  }

  /* ── KPI aggregation ── */
  const eventsThisMonth = data.events.length;
  const aiTasksDone     = data.monthly?.ai_tasks_done  ?? 0;
  const wins            = data.monthly?.wins            ?? 0;
  const alerts          = (data.monthly?.warnings ?? 0) + (data.monthly?.critical ?? 0);
  const highlights: string[] = data.monthly?.highlights ?? [];

  const kpis = [
    { icon: '📡', label: 'Events This Month', value: eventsThisMonth, color: '#3b82f6',  glow: '#3b82f6' },
    { icon: '🤖', label: 'AI Tasks Done',      value: aiTasksDone,    color: '#10b981',  glow: '#10b981' },
    { icon: '🏆', label: 'Wins',               value: wins,           color: '#d9a854',  glow: '#d9a854' },
    { icon: '⚠️',  label: 'Alerts',             value: alerts,         color: '#c4704f',  glow: '#c4704f' },
  ];

  const lastUpdated = new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} clientName={data.client.name} clientCity={data.client.city} activeTab="mission" />

      {/* Dark mission wrapper */}
      <div style={{ background: '#0f1117', minHeight: 'calc(100vh - 120px)', padding: '0 0 60px' }}>

        {/* ── Header strip ── */}
        <div style={{
          background: 'rgba(15,17,23,0.98)',
          borderBottom: '1px solid rgba(16,185,129,0.1)',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: '#10b981',
            boxShadow: '0 0 8px #10b981',
            animation: 'pulse-glow 2s infinite',
          }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#e8e4df', letterSpacing: '0.04em' }}>
              MISSION CONTROL · {data.client.name.toUpperCase()}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
              Last refreshed at {lastUpdated}
            </div>
          </div>
          <button
            onClick={fetchData}
            style={{
              marginLeft: 'auto',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.25)',
              color: '#10b981',
              fontSize: '11px', fontWeight: 700,
              padding: '6px 16px', borderRadius: '8px',
              cursor: 'pointer', transition: 'all 150ms',
              letterSpacing: '0.04em',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.1)'; }}
          >
            ↻ Refresh
          </button>
        </div>

        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 28px 0' }}>

          {/* ── KPI cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {kpis.map(({ icon, label, value, color, glow }) => (
              <div
                key={label}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '16px 18px',
                  position: 'relative', overflow: 'hidden',
                  transition: 'all 300ms', cursor: 'default',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
              >
                <div style={{
                  position: 'absolute', top: -20, right: -20,
                  width: 80, height: 80, borderRadius: '50%',
                  background: glow, opacity: 0.12, filter: 'blur(20px)',
                }} />
                <div style={{ fontSize: 18, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4, fontWeight: 600 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* ── Radar + Thought Stream ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, marginBottom: 20 }}>

            {/* Radar */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(16,185,129,0.15)',
              borderRadius: 16,
              padding: '20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#10b981',
                textTransform: 'uppercase', letterSpacing: '1.5px',
                marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#10b981',
                  boxShadow: '0 0 8px #10b981', display: 'inline-block',
                  animation: 'pulse-glow 2s infinite',
                }} />
                HERMES SCANNING
              </div>
              <RadarCanvas width={260} height={260} />
              <div style={{ marginTop: 14, display: 'flex', gap: 14, justifyContent: 'center' }}>
                {[
                  { label: 'GA4', color: '#10b981' },
                  { label: 'GSC', color: '#3b82f6' },
                  { label: 'ADS', color: '#d9a854' },
                  { label: 'GBP', color: '#c4704f' },
                  { label: 'FB',  color: '#8b5cf6' },
                ].map(({ label, color }) => (
                  <span key={label} style={{ fontSize: 10, fontWeight: 700, color }}>● {label}</span>
                ))}
              </div>
            </div>

            {/* Thought Stream */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: '20px',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 16 }}>
                Agent Thought Stream — Live
              </div>

              {/* Visible lines */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...Array(5)].map((_, i) => {
                  const idx     = (thoughtIdx - 4 + i + THOUGHTS.length) % THOUGHTS.length;
                  const isLast  = i === 4;
                  const opacity = 0.2 + i * 0.2;
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        opacity: isLast ? 1 : opacity,
                        fontSize: 12,
                        color: isLast ? '#fff' : 'rgba(232,228,223,0.6)',
                        transition: 'opacity 400ms',
                      }}
                    >
                      {isLast ? (
                        <div style={{
                          width: 10, height: 10,
                          border: '1.5px solid rgba(16,185,129,0.3)',
                          borderTop: '1.5px solid #10b981',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                          flexShrink: 0, marginTop: 2,
                        }} />
                      ) : (
                        <span style={{ color: '#10b981', fontSize: 11, flexShrink: 0, marginTop: 2 }}>✓</span>
                      )}
                      <span>{THOUGHTS[idx]}</span>
                      {isLast && (
                        <span style={{
                          display: 'inline-block', width: 8, height: 14,
                          background: '#10b981', marginLeft: 3,
                          animation: 'blink 0.8s infinite',
                          borderRadius: 1, flexShrink: 0, marginTop: 2,
                          verticalAlign: 'middle',
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Hermes status bar */}
              <div style={{
                marginTop: 20,
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.15)',
                borderRadius: 10, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#10b981',
                  boxShadow: '0 0 8px #10b981', animation: 'pulse-glow 2s infinite',
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>Hermes AI — Online</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                    Monitoring {data.client.name} · 24/7
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, marginLeft: 'auto' }}>
                  {[
                    { n: aiTasksDone, l: 'Tasks' },
                    { n: wins,        l: 'Wins'  },
                    { n: alerts,      l: 'Alerts' },
                  ].map(({ n, l }) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{n}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Activity Feed + Monthly Summary ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, marginBottom: 20 }}>

            {/* Activity Feed */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: 18,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                  📋 Activity Feed
                </span>
                <span style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 7,
                  background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontWeight: 600,
                }}>
                  {data.events.length} events
                </span>
              </div>

              {data.events.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                  No events recorded yet
                </div>
              ) : (
                <div style={{ maxHeight: 420, overflowY: 'auto', scrollbarWidth: 'none' }}>
                  {data.events.map((ev, i) => {
                    const sevColor = SEV_COLORS[ev.severity] || '#6b7280';
                    const sevBg    = SEV_BG[ev.severity]    || 'rgba(107,114,128,0.1)';
                    const sevIcon  = SEV_ICON[ev.severity]  || '·';
                    const ts = new Date(ev.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateStr = new Date(ev.occurred_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
                    return (
                      <div
                        key={ev.id ?? i}
                        style={{
                          display: 'flex', gap: 10,
                          padding: '8px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        {/* Severity badge */}
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: sevBg, border: `1px solid ${sevColor}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginTop: 1,
                          fontSize: 9, fontWeight: 800, color: sevColor,
                        }}>
                          {sevIcon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(232,228,223,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ev.title}
                            </span>
                            <span style={{
                              fontSize: 9, padding: '1px 5px', borderRadius: 5,
                              background: sevBg, color: sevColor, fontWeight: 700,
                              flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.4px',
                            }}>
                              {ev.severity}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
                            {ev.description}
                          </div>
                          {!isClientRole && ev.source && (
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>
                              Source: {ev.source} {ev.actor && `· ${ev.actor}`}
                            </div>
                          )}
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>{ts}</div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)' }}>{dateStr}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Monthly Summary */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: 18,
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 14 }}>
                📅 Monthly Summary
              </div>

              {!data.monthly ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                  No summary for this month yet
                </div>
              ) : (
                <>
                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                    {[
                      { label: 'Wins',      value: data.monthly.wins,           color: '#10b981' },
                      { label: 'Warnings',  value: data.monthly.warnings,        color: '#d9a854' },
                      { label: 'Critical',  value: data.monthly.critical,        color: '#ef4444' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: `1px solid ${color}22`,
                        borderRadius: 10, padding: '10px 8px', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 3 }}>
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI / Staff tasks */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {[
                      { label: 'AI Tasks Done',    value: data.monthly.ai_tasks_done,    color: '#10b981' },
                      { label: 'Staff Tasks Done',  value: data.monthly.staff_tasks_done, color: '#6b7280' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{
                        flex: 1, background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 10, padding: '10px 12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Highlights */}
                  {highlights.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                        Highlights
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {highlights.map((h, i) => (
                          <div key={i} style={{
                            background: 'rgba(217,168,84,0.07)',
                            border: '1px solid rgba(217,168,84,0.15)',
                            borderRadius: 8, padding: '8px 11px',
                          }}>
                            <span style={{ fontSize: 11, color: 'rgba(232,228,223,0.7)', lineHeight: 1.4 }}>{h}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Client Task Submission ── */}
          <div style={{
            background: 'rgba(196,112,79,0.06)',
            border: '1.5px solid rgba(196,112,79,0.2)',
            borderRadius: 14, padding: 20,
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(232,228,223,0.95)', marginBottom: 3 }}>
              Send a Task to Hermes
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
              Describe what you need — Hermes will pick it up and get to work.
            </div>

            {/* Quick tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 13 }}>
              {QUICK_TAGS.map(tag => {
                const selected = selTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => setSelTags(p => selected ? p.filter(t => t !== tag) : [...p, tag])}
                    style={{
                      padding: '6px 12px', borderRadius: 20,
                      border: `1.5px solid ${selected ? '#c4704f' : 'rgba(255,255,255,0.1)'}`,
                      background: selected ? '#c4704f' : 'rgba(255,255,255,0.04)',
                      color: selected ? '#fff' : 'rgba(255,255,255,0.5)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 200ms',
                    }}
                    onMouseEnter={e => { if (!selected) { (e.currentTarget as HTMLElement).style.borderColor = '#c4704f'; (e.currentTarget as HTMLElement).style.color = '#c4704f'; } }}
                    onMouseLeave={e => { if (!selected) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; } }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <textarea
              rows={3}
              placeholder="Describe your request… e.g. 'Can you check why leads dropped last week?'"
              value={taskText}
              onChange={e => setTaskText(e.target.value)}
              style={{
                width: '100%', padding: 11, borderRadius: 10,
                border: '1.5px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: '#e8e4df', fontSize: 12, resize: 'none',
                fontFamily: 'inherit', outline: 'none', lineHeight: 1.5,
                marginBottom: 12, transition: 'border-color 200ms',
              }}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#c4704f'; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
            />

            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #c4704f, #d4835f)',
                color: '#fff', border: 'none', borderRadius: 10,
                padding: 11, fontSize: 13, fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 300ms',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: submitting ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!submitting) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(196,112,79,0.35)'; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
            >
              {submitting ? (
                <>
                  <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Sending to Hermes…
                </>
              ) : (
                <>🛰 Send to Hermes</>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* ── Confirmation Modal ── */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 200ms',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: '#1a1a1f',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: 30,
              maxWidth: 400, width: '90%',
              textAlign: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
              animation: 'slideUp 300ms cubic-bezier(0.34,1.56,0.64,1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 44, marginBottom: 10 }}>🛰</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
              Hermes Received Your Task
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: 16 }}>
              The request has been queued. Hermes is analyzing and will begin processing shortly.
            </div>
            <div style={{
              background: 'rgba(196,112,79,0.08)',
              borderRadius: 12, padding: 13, marginBottom: 16,
              textAlign: 'left', borderLeft: '3px solid #c4704f',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#c4704f', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>
                Hermes Response
              </div>
              <div style={{ fontSize: 12, color: 'rgba(232,228,223,0.8)', lineHeight: 1.5 }}>
                Task acknowledged. I&apos;ll analyze the data and surface actionable insights in the Activity Feed within the next sync cycle.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse-glow 2s infinite' }} />
              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Hermes is on it</span>
            </div>
            <button
              onClick={() => setShowModal(false)}
              style={{
                background: '#c4704f', color: '#fff', border: 'none',
                borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', width: '100%', transition: 'background 200ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#a85d3f'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#c4704f'; }}
            >
              Got It
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 6px #10b981} 50%{box-shadow:0 0 16px #10b981,0 0 32px rgba(16,185,129,0.3)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(30px) scale(0.95)} to{opacity:1;transform:none} }
      `}</style>
    </AdminLayout>
  );
}
