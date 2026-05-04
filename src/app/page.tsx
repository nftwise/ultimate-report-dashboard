'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LogIn, ShieldCheck, Zap, Database, Activity, ArrowRight, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

const C = {
  chocolate:  '#2c2419',
  coral:      '#c4704f',
  coralDeep:  '#a85a3d',
  gold:       '#d9a854',
  sage:       '#9db5a0',
  emerald:    '#10b981',
  cream:      '#f5f1ed',
  paperWarm:  '#f9f5ee',
  textSecond: '#5c5850',
  textMuted:  '#9ca3af',
  borderSoft: 'rgba(44,36,25,0.08)',
  borderMed:  'rgba(44,36,25,0.14)',
};

const fraunces = "'Fraunces', Georgia, serif";
const outfit   = "'Outfit', sans-serif";
const mono     = "'JetBrains Mono', 'SFMono-Regular', monospace";
const inter    = "'Inter', sans-serif";

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, style: { opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity .7s ease, transform .7s ease' } as React.CSSProperties };
}

function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const { ref, style: rs } = useReveal();
  return <div ref={ref} style={{ ...rs, transitionDelay: `${delay}s`, ...style }}>{children}</div>;
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: light ? C.gold : C.coral, marginBottom: 16 }}>
      {children}
    </div>
  );
}

function Spark({ data, color, id }: { data: number[]; color: string; id: string }) {
  const W = 120, H = 28;
  const max = Math.max(...data), min = Math.min(...data);
  const xs = data.map((_, i) => (i / (data.length - 1)) * W);
  const ys = data.map(v => H - ((v - min) / (max - min || 1)) * (H - 4) - 2);
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 28, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path + ` L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LineChart() {
  const W = 480, H = 130;
  const pts = [18, 24, 29, 22, 35, 38, 31, 42, 39, 44, 41, 47];
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * W);
  const ys = pts.map(p => H - 8 - ((p - 10) / 42) * (H - 20));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const months = ['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb'];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 24}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="lcg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.coral} stopOpacity="0.35" />
          <stop offset="100%" stopColor={C.coral} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[20,50,80,110].map(y => <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="rgba(44,36,25,0.06)" strokeDasharray="3 4" />)}
      <path d={path + ` L${W},${H} L0,${H} Z`} fill="url(#lcg)" />
      <path d={path} fill="none" stroke={C.coral} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {[0,3,6,9,11].map(i => (
        <g key={i}>
          <circle cx={xs[i]} cy={ys[i]} r="8" fill={C.coral} opacity="0.2" />
          <circle cx={xs[i]} cy={ys[i]} r="4" fill="#fff" stroke={C.coral} strokeWidth="2" />
        </g>
      ))}
      {months.filter((_, i) => i % 2 === 0).map((m, i) => (
        <text key={m} x={xs[i * 2]} y={H + 18} textAnchor="middle" fontSize="10" fill={C.textMuted} fontFamily={mono} letterSpacing="0.05em">{m}</text>
      ))}
    </svg>
  );
}

function DonutChart() {
  const segs = [
    { label: 'Google Ads',  pct: 48, color: C.coral     },
    { label: 'Organic SEO', pct: 30, color: C.sage      },
    { label: 'Google Maps', pct: 15, color: C.gold      },
    { label: 'Facebook',    pct: 7,  color: C.chocolate },
  ];
  const CIRC = 502.65, R = 80, cx = 110, cy = 110;
  let offset = 0;
  const circles = segs.map(s => { const dash = (s.pct / 100) * CIRC; const el = { dash, offset, ...s }; offset += dash; return el; });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 220, height: 220, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(44,36,25,0.06)" strokeWidth="32" />
          {circles.map(s => <circle key={s.label} cx={cx} cy={cy} r={R} fill="none" stroke={s.color} strokeWidth="32" strokeDasharray={`${s.dash} ${CIRC}`} strokeDashoffset={-s.offset} />)}
        </svg>
        <div style={{ position: 'absolute', textAlign: 'center' }}>
          <div style={{ fontFamily: outfit, fontWeight: 800, fontSize: 48, color: C.chocolate, lineHeight: 1, letterSpacing: '-0.02em' }}>61</div>
          <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.textSecond, marginTop: 6 }}>Total leads</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minWidth: 160 }}>
        {segs.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
              <span style={{ fontFamily: inter, fontSize: 13, color: C.chocolate, fontWeight: 500 }}>{s.label}</span>
            </div>
            <span style={{ fontFamily: outfit, fontSize: 18, fontWeight: 700, color: C.chocolate }}>{s.pct}%</span>
          </div>
        ))}
        <div style={{ fontFamily: mono, fontSize: 10, color: C.textMuted, marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${C.borderMed}`, textAlign: 'center', letterSpacing: '0.05em' }}>
          Industry avg: 45% paid · 30% organic · 25% maps
        </div>
      </div>
    </div>
  );
}

// ─── Elegant Dashboard Snapshot ───────────────────────────────────────────────
function ElegantDash() {
  const kpis = [
    { label: 'New Leads',   value: '47',    trend: '+52% vs avg 31', trendUp: true,  color: C.coral,   data: [22,28,31,27,35,38,42,47], id:'d1' },
    { label: 'Ad Spend',    value: '$3,840', trend: 'This month',    trendUp: null,  color: C.gold,    data: [3200,3100,3600,3400,3800,3750,3900,3840], id:'d2' },
    { label: 'Cost / Lead', value: '$38',   trend: '12% below avg',  trendUp: true,  color: C.sage,    data: [61,55,52,58,48,44,41,38], id:'d3' },
    { label: 'Phone Calls', value: '94',    trend: '+8 vs last mo',  trendUp: true,  color: C.emerald, data: [72,68,80,77,85,88,89,94], id:'d4' },
  ];
  const channels = [
    { label: 'Google Ads', color: C.coral,     pct: 48 },
    { label: 'Organic SEO',color: C.sage,      pct: 30 },
    { label: 'Google Maps', color: C.gold,     pct: 15 },
    { label: 'Facebook',    color: C.chocolate, pct: 7  },
  ];

  return (
    <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: 24, border: `1px solid ${C.borderSoft}`, boxShadow: '0 24px 80px rgba(44,36,25,0.12), 0 2px 8px rgba(44,36,25,0.06)', overflow: 'hidden' }}>

      {/* chrome bar */}
      <div style={{ background: C.chocolate, padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#ef4444','#f59e0b','#22c55e'].map(c => <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block', opacity: 0.7 }} />)}
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 7, padding: '4px 14px', fontFamily: mono, fontSize: 11, color: 'rgba(245,241,237,0.38)', letterSpacing: '0.02em' }}>
          app.wisecrm.io / dashboard
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', background: 'rgba(16,185,129,0.18)', borderRadius: 100 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.emerald, display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ fontFamily: mono, fontSize: 9, color: C.emerald, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live</span>
        </div>
      </div>

      {/* body */}
      <div style={{ padding: '24px 24px 20px' }}>

        {/* greeting */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: fraunces, fontSize: 17, fontWeight: 500, color: C.chocolate, letterSpacing: '-0.01em', lineHeight: 1.2 }}>Good morning, Dr. Kevin.</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: C.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Here is how last week looked</div>
          </div>
          <div style={{ fontFamily: mono, fontSize: 10, color: C.textMuted, letterSpacing: '0.06em', whiteSpace: 'nowrap', marginTop: 2 }}>Apr 28 – May 4</div>
        </div>

        {/* KPI grid — 2×2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: C.paperWarm, borderRadius: 14, padding: '14px 14px 10px', border: `1px solid ${C.borderSoft}`, position: 'relative', overflow: 'hidden' }}>
              {/* accent top bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.color, borderRadius: '14px 14px 0 0' }} />
              <div style={{ fontFamily: mono, fontSize: 9, color: C.textSecond, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, marginTop: 2 }}>{k.label}</div>
              <div style={{ fontFamily: outfit, fontWeight: 800, fontSize: 26, color: C.chocolate, lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 6 }}>{k.value}</div>
              <Spark data={k.data} color={k.color} id={k.id} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
                {k.trendUp !== null && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: k.trendUp ? C.emerald : C.coral }}>
                    {k.trendUp ? '▲' : '▼'}
                  </span>
                )}
                <span style={{ fontFamily: inter, fontSize: 10, color: k.trendUp ? C.emerald : C.textMuted, fontWeight: 600 }}>{k.trend}</span>
              </div>
            </div>
          ))}
        </div>

        {/* channel attribution */}
        <div style={{ background: C.paperWarm, borderRadius: 14, padding: '14px 16px', border: `1px solid ${C.borderSoft}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: mono, fontSize: 9, color: C.textSecond, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Channel attribution</div>
            <div style={{ fontFamily: inter, fontSize: 11, color: C.textMuted }}>61 leads this month</div>
          </div>
          {/* stacked bar */}
          <div style={{ display: 'flex', height: 8, borderRadius: 100, overflow: 'hidden', marginBottom: 12, gap: 2 }}>
            {channels.map(c => (
              <div key={c.label} style={{ flex: c.pct, background: c.color, borderRadius: 100 }} />
            ))}
          </div>
          {/* legend — 2×2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 0' }}>
            {channels.map(c => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                <span style={{ fontFamily: inter, fontSize: 11, color: C.textSecond, fontWeight: 500 }}>{c.label}</span>
                <span style={{ fontFamily: outfit, fontSize: 11, color: C.chocolate, fontWeight: 700, marginLeft: 2 }}>{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const user = session.user as { role?: string; clientSlug?: string };
      if (user.role === 'admin' || user.role === 'team') router.push('/admin-dashboard');
      else if (user.role === 'client' && user.clientSlug) router.push(`/portal/${user.clientSlug}`);
    }
  }, [status, session, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.cream }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(196,112,79,0.2)', borderTopColor: C.coral, animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: inter, color: C.chocolate, overflowX: 'hidden' }}>

      <style>{`
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,0.6)}70%{box-shadow:0 0 0 8px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}
        @keyframes scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        body{background:${C.cream}}
        body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0.28;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.17 0 0 0 0 0.14 0 0 0 0 0.10 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

        /* ── responsive ── */
        @media(max-width:980px){
          .hero-grid{grid-template-columns:1fr!important;gap:48px!important}
          .two-col{grid-template-columns:1fr!important;gap:48px!important}
          .steps-grid{grid-template-columns:1fr!important}
          .trust-grid{grid-template-columns:1fr!important}
          .attr-grid{grid-template-columns:1fr!important;gap:48px!important}
          .kpi-strip{grid-template-columns:repeat(3,1fr)!important}
          .channels-strip-inner{grid-template-columns:1fr!important;gap:24px!important}
          .nav-links-desktop{display:none!important}
          .hero-founders{max-width:460px!important;margin:0 auto!important}
        }
        @media(max-width:640px){
          .hero-section-pad{padding:100px 20px 60px!important}
          .section-pad{padding:80px 20px!important}
          .section-pad-sm{padding:0 20px 80px!important}
          .dark-pad{padding:80px 20px!important}
          .kpi-strip{grid-template-columns:1fr 1fr!important}
          .trust-grid{grid-template-columns:1fr!important}
          .pull-quote-grid{grid-template-columns:1fr!important;gap:12px!important;padding:32px 24px!important}
          .compare-grid{grid-template-columns:1fr!important}
          .compare-col-after{border-top:1px dashed rgba(44,36,25,0.14)!important;border-left:none!important}
          .final-cta-pad{padding:80px 20px!important}
          nav{padding:14px 20px!important}
          .marquee-font{font-size:15px!important}
          h1.hero-h1{font-size:clamp(38px,10vw,60px)!important}
        }
      `}</style>

      {/* ══════════ NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '18px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(245,241,237,0.88)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: `1px solid ${C.borderSoft}` }}>
        <span style={{ fontFamily: outfit, fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: C.chocolate, display: 'flex', alignItems: 'center' }}>
          Wise<span style={{ color: C.coral }}>CRM</span>
          <span style={{ width: 6, height: 6, background: C.coral, borderRadius: '50%', marginLeft: 4, marginBottom: 4, alignSelf: 'flex-end', display: 'inline-block' }} />
        </span>
        <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          {[['#results','Your Results'],['#attribution','Attribution'],['#about','About Us'],['#trust','Security']].map(([href, label]) => (
            <a key={label} href={href} style={{ fontFamily: inter, fontSize: 13, fontWeight: 500, color: C.textSecond, textDecoration: 'none', transition: 'color 150ms ease' }}
              onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = C.coral}
              onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = C.textSecond}>
              {label}
            </a>
          ))}
        </div>
        <button onClick={() => router.push('/login')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', background: C.chocolate, border: 'none', borderRadius: 100, color: C.cream, fontFamily: inter, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 200ms ease' }}
          onMouseEnter={e => { const b = e.currentTarget; b.style.background = C.coral; b.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { const b = e.currentTarget; b.style.background = C.chocolate; b.style.transform = 'translateY(0)'; }}>
          <LogIn size={14} /> Sign In
        </button>
      </nav>

      {/* ══════════ HERO */}
      <section className="hero-section-pad" style={{ position: 'relative', zIndex: 2, padding: '140px 40px 80px', background: 'radial-gradient(ellipse at 75% 10%, rgba(217,168,84,0.16), transparent 50%), radial-gradient(ellipse at 10% 80%, rgba(196,112,79,0.1), transparent 55%), linear-gradient(180deg, #f9f5ee 0%, #f5f1ed 100%)', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', fontFamily: fraunces, fontWeight: 300, fontSize: 'clamp(320px,50vw,720px)', color: C.chocolate, opacity: 0.02, lineHeight: 0.8, bottom: -120, right: -80, pointerEvents: 'none', zIndex: 1 }}>W</div>

        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 72, alignItems: 'center', maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>

          {/* left: copy */}
          <Reveal>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 14px 6px 8px', background: 'rgba(255,255,255,0.72)', border: `1px solid ${C.borderSoft}`, borderRadius: 999, marginBottom: 28, backdropFilter: 'blur(8px)' }}>
              <span style={{ width: 8, height: 8, background: C.emerald, borderRadius: '50%', animation: 'pulse 2s infinite', display: 'inline-block' }} />
              <span style={{ fontFamily: inter, fontSize: 12, fontWeight: 600, color: C.textSecond }}>Updated this morning · 8:47 AM</span>
            </div>

            <h1 className="hero-h1" style={{ fontFamily: fraunces, fontWeight: 400, fontSize: 'clamp(46px,5.5vw,78px)', lineHeight: 0.98, letterSpacing: '-0.035em', color: C.chocolate, margin: '0 0 28px' }}>
              Your marketing.<br />
              <span style={{ position: 'relative', display: 'inline-block' }}>
                Fully <span style={{ fontStyle: 'italic', fontWeight: 300, color: C.coral }}>visible.</span>
                <span style={{ position: 'absolute', left: 0, right: 0, bottom: 8, height: 7, background: C.gold, opacity: 0.38, zIndex: -1, borderRadius: 2 }} />
              </span>
            </h1>

            <p style={{ fontFamily: inter, fontSize: 17, lineHeight: 1.65, color: C.textSecond, maxWidth: 520, margin: '0 0 36px' }}>
              See exactly what MyChiropractice is doing for your practice every morning. Google Ads, SEO, Google Maps, and Facebook pulled into <strong style={{ color: C.chocolate, fontWeight: 600 }}>one clear dashboard</strong> you can read in minutes.
            </p>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 40, flexWrap: 'wrap' }}>
              <button onClick={() => router.push('/login')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 28px', background: C.coral, border: 'none', borderRadius: 12, color: '#fff', fontFamily: inter, fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 20px rgba(196,112,79,0.35)', transition: 'all 200ms ease' }}
                onMouseEnter={e => { const b = e.currentTarget; b.style.background = C.coralDeep; b.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { const b = e.currentTarget; b.style.background = C.coral; b.style.transform = 'translateY(0)'; }}>
                Open My Dashboard <ArrowRight size={16} />
              </button>
              <button onClick={() => router.push('/login')}
                style={{ background: 'none', border: 'none', fontFamily: inter, fontSize: 14, fontWeight: 500, color: C.textSecond, cursor: 'pointer', padding: '16px 8px', borderBottom: '1px solid transparent', transition: 'all 200ms ease' }}
                onMouseEnter={e => { const b = e.currentTarget; b.style.color = C.coral; b.style.borderBottomColor = C.coral; }}
                onMouseLeave={e => { const b = e.currentTarget; b.style.color = C.textSecond; b.style.borderBottomColor = 'transparent'; }}>
                Already a member? Sign in
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 28, borderTop: `1px solid ${C.borderSoft}` }}>
              <div style={{ display: 'flex' }}>
                {[{i:'DR',g:'135deg,#c4704f,#d9a854'},{i:'JK',g:'135deg,#9db5a0,#10b981'},{i:'MV',g:'135deg,#d9a854,#c4704f'},{i:'+97',g:`135deg,${C.chocolate},${C.chocolate}`}].map((av, idx) => (
                  <div key={idx} style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid #f9f5ee', marginLeft: idx > 0 ? -9 : 0, background: `linear-gradient(${av.g})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: inter, fontSize: 10, fontWeight: 700, color: '#fff' }}>{av.i}</div>
                ))}
              </div>
              <div style={{ fontFamily: inter, fontSize: 12, color: C.textSecond, lineHeight: 1.4 }}>
                <strong style={{ color: C.chocolate, fontWeight: 600 }}>100+ chiropractic practices</strong> trust WiseCRM<br />
                Real data from Google and Meta every morning
              </div>
            </div>
          </Reveal>

          {/* right: founders photo */}
          <Reveal delay={0.2}>
            <div className="hero-founders" style={{ position: 'relative' }}>

              <Image
                src="/founders-nobg.png"
                alt="Kevin and Ardavan Javid, founders of MyChiropractice"
                width={1000}
                height={935}
                priority
                style={{
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                  position: 'relative',
                  zIndex: 2,
                  transition: 'filter 400ms ease',
                  filter: 'drop-shadow(0 20px 40px rgba(44,36,25,0.15))',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.filter = 'drop-shadow(0 24px 48px rgba(44,36,25,0.22)) brightness(1.07) contrast(1.04)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.filter = 'drop-shadow(0 20px 40px rgba(44,36,25,0.15))'; }}
              />

              {/* name chip */}
              <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', border: `1px solid ${C.borderSoft}`, borderRadius: 100, padding: '8px 18px', zIndex: 3, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <div style={{ display: 'flex', gap: -4 }}>
                  {[{c:'135deg,#c4704f,#d9a854',t:'K'},{c:'135deg,#9db5a0,#10b981',t:'A'}].map(av => (
                    <div key={av.t} style={{ width: 24, height: 24, borderRadius: '50%', background: `linear-gradient(${av.c})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: inter, fontSize: 10, fontWeight: 700, color: '#fff', border: '1.5px solid white', marginLeft: av.t === 'A' ? -6 : 0 }}>{av.t}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontFamily: fraunces, fontSize: 13, fontWeight: 500, color: C.chocolate, lineHeight: 1.1 }}>Kevin &amp; Ardavan Javid</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Founders · MyChiropractice</div>
                </div>
              </div>
            </div>
          </Reveal>

        </div>
      </section>

      {/* ══════════ MARQUEE */}
      <div style={{ background: C.chocolate, color: C.cream, padding: '20px 0', overflow: 'hidden', position: 'relative', zIndex: 2 }}>
        <div className="marquee-font" style={{ display: 'flex', gap: 64, whiteSpace: 'nowrap', animation: 'scroll 40s linear infinite', fontFamily: fraunces, fontSize: 18, fontWeight: 400, letterSpacing: '-0.01em' }}>
          {[...Array(2)].map((_, rep) => (
            <span key={rep} style={{ display: 'inline-flex', gap: 64, flexShrink: 0 }}>
              {[{star:true,t:'Google Ads'},{t:'Organic SEO',italic:true},{star:true,t:'Google Maps'},{t:'Facebook Ads',italic:true},{star:true,t:'Search Console'},{t:'AI Search',italic:true}].map(item => (
                <span key={item.t} style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
                  {item.star && <span style={{ color: C.gold, fontSize: 13 }}>✦</span>}
                  <span style={{ fontStyle: item.italic ? 'italic' : 'normal', color: item.italic ? C.gold : C.cream }}>{item.t}</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════ TRANSPARENCY */}
      <section id="results" className="section-pad" style={{ position: 'relative', zIndex: 2, padding: '120px 40px', background: C.cream }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Eyebrow>Full transparency, every day</Eyebrow>
          <h2 style={{ fontFamily: fraunces, fontWeight: 400, fontSize: 'clamp(32px,4.5vw,54px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: C.chocolate, maxWidth: 780, margin: '0 0 20px' }}>
            Know exactly what your marketing is doing.<br /><span style={{ fontStyle: 'italic', color: C.coral, fontWeight: 400 }}>Every single day.</span>
          </h2>
          <p style={{ fontFamily: inter, fontSize: 17, lineHeight: 1.6, color: C.textSecond, maxWidth: 600, marginBottom: 60 }}>
            You hired MyChiropractice to grow your practice. WiseCRM gives you real-time visibility into every campaign we run for you, updated automatically each morning from official APIs.
          </p>

          <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 80, alignItems: 'center' }}>
            <Reveal>
              <p style={{ fontFamily: fraunces, fontStyle: 'italic', fontSize: 24, lineHeight: 1.4, color: C.chocolate, fontWeight: 300, letterSpacing: '-0.01em', marginBottom: 24 }}>
                No more waiting for a monthly PDF. See your results before your first patient walks in.
              </p>
              <p style={{ fontFamily: inter, fontSize: 14, lineHeight: 1.65, color: C.textSecond }}>
                Same live data our team uses internally to manage your campaigns. Your numbers, your way, on your schedule.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 20px rgba(44,36,25,0.06)', border: `1px solid ${C.borderSoft}`, background: 'white' }}>
                <div className="compare-col-before" style={{ padding: '28px 24px', background: 'rgba(44,36,25,0.04)', borderRight: `1px dashed ${C.borderMed}` }}>
                  <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: C.textSecond, marginBottom: 18, fontWeight: 600 }}>Before WiseCRM</div>
                  {['Waiting on monthly PDF','No idea where leads came from','Asking your agency every week','Guessing if ad spend works','Data stuck inside agency tools','Google only keeps 1–3 years of data','No one analyzing data at night'].map(t => (
                    <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 0', fontFamily: inter, fontSize: 13, color: C.chocolate, borderBottom: `1px solid ${C.borderSoft}` }}>
                      <span style={{ width: 17, height: 17, borderRadius: '50%', background: 'rgba(196,112,79,0.15)', color: C.coral, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✕</span>
                      {t}
                    </div>
                  ))}
                </div>
                <div className="compare-col-after" style={{ padding: '28px 24px', background: 'linear-gradient(180deg, rgba(157,181,160,0.1), rgba(16,185,129,0.05))' }}>
                  <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: C.emerald, marginBottom: 18, fontWeight: 600 }}>With WiseCRM</div>
                  {[
                    { label: 'See results every morning', soon: false },
                    { label: 'Know exactly which channel drove leads', soon: false },
                    { label: 'Full visibility into campaigns', soon: false },
                    { label: 'Real numbers from Google and Meta', soon: false },
                    { label: 'Your data stored forever', soon: false },
                    { label: 'AI analysis running 24/7', soon: false },
                    { label: 'Request a task — team delivers in hours', soon: true },
                    { label: 'AI assistant built-in', soon: true },
                  ].map(({ label, soon }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 0', fontFamily: inter, fontSize: 13, color: C.chocolate, borderBottom: `1px solid ${C.borderSoft}` }}>
                      <span style={{ width: 17, height: 17, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', color: C.emerald, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                      <span style={{ flex: 1 }}>
                        {label}
                        {soon && <span style={{ marginLeft: 7, fontSize: 9, fontFamily: mono, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(217,168,84,0.2)', color: C.gold, padding: '2px 6px', borderRadius: 4 }}>upcoming</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>


      {/* ══════════ HOW IT WORKS (dark) */}
      <section id="how" className="dark-pad" style={{ background: C.chocolate, position: 'relative', zIndex: 2, padding: '120px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 70 }}>
              <Eyebrow light>Monday, 8:47 AM. Before your first patient.</Eyebrow>
              <h2 style={{ fontFamily: fraunces, fontWeight: 300, fontSize: 'clamp(30px,3.5vw,52px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: C.cream, margin: '0 0 16px' }}>
                Three steps to knowing exactly<br />how your <span style={{ fontStyle: 'italic', color: C.gold }}>marketing</span> is performing.
              </h2>
            </div>
          </Reveal>

          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, marginBottom: 56 }}>
            {[
              { n: '01', title: 'Open your dashboard',  body: 'Takes 30 seconds. No emails to your agency, no spreadsheets. Your numbers are ready every morning.' },
              { n: '02', title: 'See what happened',    body: 'Leads, spend, calls and trends in one scroll. Every channel we run for your practice, all in one view.' },
              { n: '03', title: 'Walk in with answers', body: 'Actual numbers from last week, ready before your first patient walks in.' },
            ].map(({ n, title, body }, i) => (
              <Reveal key={n} delay={i * 0.15}>
                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px 28px', transition: 'all 300ms ease' }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-4px)'; d.style.borderColor = 'rgba(196,112,79,0.3)'; }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(0)'; d.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
                  <div style={{ fontFamily: fraunces, fontStyle: 'italic', fontWeight: 300, fontSize: 60, lineHeight: 1, color: C.coral, marginBottom: 8, letterSpacing: '-0.04em' }}>{n}</div>
                  <h3 style={{ fontFamily: fraunces, fontWeight: 500, fontSize: 20, color: C.cream, margin: '0 0 10px', letterSpacing: '-0.01em' }}>{title}</h3>
                  <p style={{ fontFamily: inter, fontSize: 14, color: 'rgba(245,241,237,0.58)', lineHeight: 1.65, margin: 0 }}>{body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="pull-quote-grid" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: '52px 52px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 36, alignItems: 'center' }}>
              <div style={{ fontFamily: fraunces, fontSize: 88, fontWeight: 300, color: C.gold, lineHeight: 0.7, alignSelf: 'flex-start' }}>&ldquo;</div>
              <div>
                <p style={{ fontFamily: fraunces, fontStyle: 'italic', fontWeight: 300, fontSize: 'clamp(18px,2.4vw,26px)', lineHeight: 1.35, letterSpacing: '-0.01em', color: C.cream, marginBottom: 16 }}>
                  It replaced a 45-minute monthly call with our marketing agency.
                </p>
                <cite style={{ fontFamily: inter, fontSize: 13, color: 'rgba(245,241,237,0.6)', fontStyle: 'normal', fontWeight: 500 }}>
                  <strong style={{ color: C.gold, fontWeight: 600 }}>Dr. K.J.</strong>, MyChiropractice client
                </cite>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════ ATTRIBUTION */}
      <section id="attribution" className="section-pad" style={{ position: 'relative', zIndex: 2, padding: '120px 40px', background: C.paperWarm }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Eyebrow>Channel attribution</Eyebrow>
          <h2 style={{ fontFamily: fraunces, fontWeight: 400, fontSize: 'clamp(32px,4.5vw,54px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: C.chocolate, maxWidth: 780, margin: '0 0 20px' }}>
            See exactly where each<br />new patient <span style={{ fontStyle: 'italic', color: C.coral }}>came from.</span>
          </h2>
          <p style={{ fontFamily: inter, fontSize: 17, lineHeight: 1.6, color: C.textSecond, maxWidth: 600, marginBottom: 60 }}>
            Was it Google Ads? Your organic SEO? Your Google Business listing? WiseCRM shows you the exact breakdown every month.
          </p>

          <div className="attr-grid two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
            <Reveal>
              <div style={{ background: 'white', border: `1px solid ${C.borderSoft}`, borderRadius: 24, padding: '40px 36px', boxShadow: '0 4px 20px rgba(44,36,25,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                  <h3 style={{ fontFamily: fraunces, fontSize: 20, fontWeight: 500, color: C.chocolate, letterSpacing: '-0.01em', margin: 0 }}>Where Patients Come From</h3>
                  <span style={{ fontFamily: mono, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>This month</span>
                </div>
                <DonutChart />
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <p style={{ fontFamily: fraunces, fontStyle: 'italic', fontSize: 24, lineHeight: 1.3, color: C.chocolate, fontWeight: 300, letterSpacing: '-0.02em', marginBottom: 22 }}>
                See your growth over time, not just this month.
              </p>
              <p style={{ fontFamily: inter, fontSize: 15, lineHeight: 1.65, color: C.textSecond, marginBottom: 28 }}>
                Month-over-month comparisons and year-over-year context built in. No spreadsheets required.
              </p>
              <div style={{ background: 'white', border: `1px solid ${C.borderSoft}`, borderRadius: 16, padding: '22px', boxShadow: '0 4px 20px rgba(44,36,25,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.textSecond, fontWeight: 500, marginBottom: 4 }}>12-month trend</div>
                    <div style={{ fontFamily: fraunces, fontSize: 18, fontWeight: 500, color: C.chocolate, letterSpacing: '-0.01em' }}>New <span style={{ fontStyle: 'italic', color: C.coral, fontWeight: 300 }}>patient</span> leads</div>
                  </div>
                  <div style={{ background: 'rgba(16,185,129,0.12)', color: C.emerald, padding: '5px 11px', borderRadius: 999, fontFamily: inter, fontSize: 11, fontWeight: 700 }}>YoY +34%</div>
                </div>
                <LineChart />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════ KEY NUMBERS */}
      <section className="section-pad" style={{ position: 'relative', zIndex: 2, padding: '120px 40px', background: C.cream }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Eyebrow>Your key numbers</Eyebrow>
          <h2 style={{ fontFamily: fraunces, fontWeight: 400, fontSize: 'clamp(32px,4.5vw,54px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: C.chocolate, maxWidth: 780, margin: '0 0 20px' }}>
            Every metric that matters.<br /><span style={{ fontStyle: 'italic', color: C.coral }}>Nothing</span> that does not.
          </h2>
          <p style={{ fontFamily: inter, fontSize: 17, lineHeight: 1.6, color: C.textSecond, maxWidth: 600, marginBottom: 56 }}>
            New patient leads. Phone calls. Cost per lead. Google Maps clicks. All benchmarked against industry averages so you always know where your practice stands.
          </p>

          <div className="kpi-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginBottom: 36 }}>
            {[
              { label: 'New Leads',     bench: 'Industry avg: 31', value: '47',  meta: '8% above last month',       color: C.coral,   data: [22,28,31,35,38,42,44,47], id: 'em1' },
              { label: 'Cost per Lead', bench: 'Industry avg: $61', value: '$38', meta: '12% below average',        color: C.sage,    data: [61,55,52,58,48,44,41,38], id: 'em2' },
              { label: 'Phone Calls',   bench: '2 locations',       value: '94',  meta: '8 more than last month',   color: C.gold,    data: [72,68,80,77,85,88,89,94], id: 'em3' },
            ].map((k, i) => (
              <Reveal key={k.label} delay={i * 0.1}>
                <div style={{ background: 'white', border: `1px solid ${C.borderSoft}`, borderRadius: 18, padding: '28px 24px', position: 'relative', overflow: 'hidden', transition: 'all 300ms ease' }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-3px)'; d.style.boxShadow = '0 16px 48px rgba(44,36,25,0.1)'; }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(0)'; d.style.boxShadow = 'none'; }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.color }} />
                  <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.textSecond, marginBottom: 3, fontWeight: 500, marginTop: 6 }}>{k.label}</div>
                  <div style={{ fontFamily: inter, fontSize: 10, color: C.textMuted, marginBottom: 16 }}>{k.bench}</div>
                  <div style={{ fontFamily: outfit, fontSize: 52, fontWeight: 800, color: C.chocolate, lineHeight: 1, letterSpacing: '-0.025em', marginBottom: 8 }}>{k.value}</div>
                  <Spark data={k.data} color={k.color} id={k.id} />
                  <div style={{ fontFamily: inter, fontSize: 12, color: C.emerald, fontWeight: 600, marginTop: 6 }}>{k.meta}</div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="channels-strip-inner" style={{ padding: '28px 36px', background: 'white', border: `1px solid ${C.borderSoft}`, borderRadius: 18, display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: 36, alignItems: 'center' }}>
              <div style={{ fontFamily: fraunces, fontStyle: 'italic', fontSize: 18, color: C.chocolate, lineHeight: 1.3, fontWeight: 300 }}>
                Every channel we manage for you, in one place.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px 20px' }}>
                {[
                  { label: 'Google Ads',              color: C.coral      },
                  { label: 'Organic SEO',             color: C.sage       },
                  { label: 'Google Business Profile', color: C.gold       },
                  { label: 'Google Analytics 4',      color: C.emerald    },
                  { label: 'Facebook Ads',            color: C.chocolate  },
                  { label: 'Bing and AI Search',      color: C.textSecond },
                ].map(c => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: inter, fontSize: 13, color: C.textSecond, fontWeight: 500 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                    {c.label}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════ ABOUT (replaces dark founders split) */}
      <section id="about" className="dark-pad" style={{ background: C.chocolate, position: 'relative', zIndex: 2, padding: '120px 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <Eyebrow light>Built for practice owners, by practice owners</Eyebrow>
            <h2 style={{ fontFamily: fraunces, fontWeight: 300, fontSize: 'clamp(30px,3.5vw,48px)', lineHeight: 1.1, letterSpacing: '-0.025em', color: C.cream, marginBottom: 32 }}>
              The tool we knew<br />you <span style={{ fontStyle: 'italic', color: C.gold }}>needed.</span>
            </h2>
            <blockquote style={{ fontFamily: fraunces, fontStyle: 'italic', fontWeight: 300, fontSize: 'clamp(16px,1.8vw,20px)', lineHeight: 1.65, color: 'rgba(245,241,237,0.82)', marginBottom: 40, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto', paddingLeft: 0, border: 'none' }}>
              We built MyChiropractice into an agency running 100+ clients worldwide. Every morning we were managing campaigns across dozens of tabs with no single source of truth. WiseCRM was the tool our clients deserved. Now every practice we work with gets full visibility into what we are doing for them every day.
            </blockquote>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ display: 'flex' }}>
                {[{g:'135deg,#c4704f,#d9a854',t:'K'},{g:'135deg,#9db5a0,#10b981',t:'A'}].map((av,i) => (
                  <div key={av.t} style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(${av.g})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: inter, fontSize: 18, fontWeight: 700, color: '#fff', border: '2px solid rgba(255,255,255,0.12)', marginLeft: i > 0 ? -10 : 0, boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>{av.t}</div>
                ))}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: fraunces, fontSize: 18, fontWeight: 500, color: C.cream, letterSpacing: '-0.01em' }}>Kevin &amp; Ardavan Javid</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(245,241,237,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>Founders · MyChiropractice · 100+ clients</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════ TRUST */}
      <section id="trust" className="section-pad" style={{ position: 'relative', zIndex: 2, padding: '120px 40px', background: C.paperWarm }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <Eyebrow>Infrastructure and trust</Eyebrow>
              <h2 style={{ fontFamily: fraunces, fontWeight: 400, fontSize: 'clamp(32px,4.5vw,54px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: C.chocolate, maxWidth: 680, margin: '0 auto' }}>
                Built to the standard<br />your <span style={{ fontStyle: 'italic', color: C.coral }}>data</span> deserves.
              </h2>
            </div>
          </Reveal>

          <div className="trust-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }}>
            {[
              { icon: <ShieldCheck size={22} strokeWidth={2} />, bg: 'rgba(196,112,79,0.1)', iconColor: C.coral,   title: 'Enterprise-Grade Security',   body: 'Encrypted in transit and at rest. OAuth2 connections to Google and Meta. We never store your passwords. Role-based access so only the right people see your numbers.', badge: 'SOC-2 Ready',     live: false },
              { icon: <Zap size={22} strokeWidth={2} />,          bg: 'rgba(16,185,129,0.1)',  iconColor: C.emerald, title: '99.9% Uptime, 24/7',          body: 'Your dashboard is always on. Data syncs automatically every morning so your numbers are ready before you arrive, whether it is Monday or Sunday.',                   badge: 'Always Online',   live: true  },
              { icon: <Database size={22} strokeWidth={2} />,     bg: 'rgba(217,168,84,0.18)', iconColor: '#8a6a2e', title: 'Direct from Official APIs',    body: 'Every number comes straight from Google Analytics 4, Search Console, Google Ads, Google Business Profile, and Facebook Ads. No scraping. No estimates.',         badge: 'Verified Sources', live: false },
              { icon: <Activity size={22} strokeWidth={2} />,     bg: 'rgba(16,185,129,0.12)', iconColor: C.emerald, title: 'AI Market Intelligence',       body: 'Our AI monitors search trends, competitor activity, and algorithm shifts across Google, Bing, and AI platforms so we catch issues before they affect your practice.', badge: 'Always Watching', live: true  },
            ].map((t, i) => (
              <Reveal key={t.title} delay={i * 0.1}>
                <div style={{ background: 'white', border: `1px solid ${C.borderSoft}`, borderRadius: 20, padding: '36px 32px', transition: 'all 300ms ease', height: '100%', boxSizing: 'border-box' }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-3px)'; d.style.boxShadow = '0 8px 32px rgba(44,36,25,0.08)'; }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(0)'; d.style.boxShadow = 'none'; }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, color: t.iconColor }}>{t.icon}</div>
                  <h3 style={{ fontFamily: fraunces, fontWeight: 500, fontSize: 20, color: C.chocolate, margin: '0 0 10px', letterSpacing: '-0.01em' }}>{t.title}</h3>
                  <p style={{ fontFamily: inter, fontSize: 14, color: C.textSecond, lineHeight: 1.65, margin: '0 0 16px' }}>{t.body}</p>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(44,36,25,0.06)', borderRadius: 999, fontFamily: inter, fontSize: 10, fontWeight: 700, color: C.textSecond, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {t.live && <span style={{ width: 6, height: 6, background: C.emerald, borderRadius: '50%', animation: 'pulse 2s infinite', display: 'inline-block' }} />}
                    {t.badge}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FINAL CTA */}
      <section className="final-cta-pad" style={{ position: 'relative', zIndex: 2, padding: '140px 40px 120px', background: 'radial-gradient(ellipse at 80% 30%, rgba(217,168,84,0.18), transparent 50%), radial-gradient(ellipse at 20% 70%, rgba(196,112,79,0.14), transparent 55%), linear-gradient(180deg,#f9f5ee 0%,#f5f1ed 100%)', textAlign: 'center', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: fraunces, fontSize: 'clamp(200px,40vw,480px)', color: C.chocolate, opacity: 0.025, lineHeight: 1, pointerEvents: 'none' }}>✦</div>
        <Reveal style={{ position: 'relative', zIndex: 2 }}>
          <h2 style={{ fontFamily: fraunces, fontWeight: 300, fontSize: 'clamp(42px,6vw,80px)', lineHeight: 1, letterSpacing: '-0.035em', color: C.chocolate, margin: '0 0 22px', maxWidth: 860, marginLeft: 'auto', marginRight: 'auto' }}>
            Your dashboard is <span style={{ fontStyle: 'italic', color: C.coral }}>ready.</span>
          </h2>
          <p style={{ fontFamily: inter, fontSize: 17, lineHeight: 1.55, color: C.textSecond, maxWidth: 560, margin: '0 auto 36px' }}>
            Sign in and see how your practice performed this month. Leads, spend, rankings and calls in one place.
          </p>
          <button onClick={() => router.push('/login')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '18px 32px', background: C.coral, border: 'none', borderRadius: 12, color: '#fff', fontFamily: inter, fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 20px rgba(196,112,79,0.35)', transition: 'all 200ms ease' }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.background = C.coralDeep; b.style.transform = 'translateY(-2px)'; b.style.boxShadow = '0 10px 28px rgba(196,112,79,0.45)'; }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.background = C.coral; b.style.transform = 'translateY(0)'; b.style.boxShadow = '0 6px 20px rgba(196,112,79,0.35)'; }}>
            <LogIn size={18} /> Open My Dashboard
          </button>
          <div style={{ marginTop: 22, fontFamily: mono, fontSize: 11, color: C.textMuted, letterSpacing: '0.05em' }}>
            <CheckCircle2 size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />
            Data updated this morning · 100+ clients worldwide
          </div>
        </Reveal>
      </section>

      {/* ══════════ FOOTER */}
      <footer style={{ padding: '36px 40px', background: C.chocolate, color: 'rgba(245,241,237,0.5)', textAlign: 'center', fontFamily: inter, fontSize: 12, borderTop: '1px solid rgba(245,241,237,0.06)' }}>
        © 2026 <strong style={{ color: C.gold, fontWeight: 500 }}>WiseCRM</strong> · A product of MyChiropractice · Kevin &amp; Ardavan Javid
      </footer>
    </div>
  );
}
