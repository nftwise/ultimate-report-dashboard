'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LogIn, ShieldCheck, Zap, Bot, Database, Activity,
  ArrowRight, CheckCircle2,
} from 'lucide-react';
import Image from 'next/image';

// ─── design tokens ────────────────────────────────────────────────────────────
const C = {
  chocolate:   '#2c2419',
  coral:       '#c4704f',
  coralDeep:   '#a85a3d',
  gold:        '#d9a854',
  sage:        '#9db5a0',
  emerald:     '#10b981',
  cream:       '#f5f1ed',
  creamDeep:   '#ede8e3',
  paper:       '#faf7f2',
  paperWarm:   '#f9f5ee',
  textPrimary: '#2c2419',
  textSecond:  '#5c5850',
  textMuted:   '#9ca3af',
  borderSoft:  'rgba(44,36,25,0.08)',
  borderMed:   'rgba(44,36,25,0.14)',
};

const fraunces = "'Fraunces', Georgia, serif";
const outfit   = "'Outfit', sans-serif";
const mono     = "'JetBrains Mono', 'SFMono-Regular', monospace";
const inter    = "'Inter', sans-serif";

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: `1px solid ${C.borderSoft}`,
  borderRadius: 16,
};

// ─── scroll-reveal hook ───────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return {
    ref,
    style: {
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: 'opacity .7s ease, transform .7s ease',
    } as React.CSSProperties,
  };
}

// ─── Reveal wrapper ───────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const { ref, style: revealStyle } = useReveal();
  return (
    <div ref={ref} style={{ ...revealStyle, transitionDelay: `${delay}s`, ...style }}>
      {children}
    </div>
  );
}

// ─── Eyebrow ──────────────────────────────────────────────────────────────────
function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div style={{
      fontFamily: mono,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: light ? C.gold : C.coral,
      marginBottom: 16,
    }}>
      — {children}
    </div>
  );
}

// ─── SVG sparkline ────────────────────────────────────────────────────────────
function Spark({ data, color, id }: { data: number[]; color: string; id: string }) {
  const W = 200, H = 40;
  const max = Math.max(...data), min = Math.min(...data);
  const xs = data.map((_, i) => (i / (data.length - 1)) * W);
  const ys = data.map(v => H - ((v - min) / (max - min || 1)) * (H - 4) - 2);
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 40, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path + ` L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Line chart ───────────────────────────────────────────────────────────────
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
      {[20,50,80,110].map(y => (
        <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="rgba(44,36,25,0.06)" strokeDasharray="3 4" />
      ))}
      <path d={path + ` L${W},${H} L0,${H} Z`} fill="url(#lcg)" />
      <path d={path} fill="none" stroke={C.coral} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {[0, 3, 6, 9, 11].map(i => (
        <g key={i}>
          <circle cx={xs[i]} cy={ys[i]} r="8" fill={C.coral} opacity="0.2" />
          <circle cx={xs[i]} cy={ys[i]} r="4" fill="#fff" stroke={C.coral} strokeWidth="2" />
        </g>
      ))}
      {months.filter((_, i) => i % 2 === 0).map((m, i) => (
        <text key={m} x={xs[i * 2]} y={H + 18} textAnchor="middle" fontSize="10"
          fill={C.textMuted} fontFamily={mono} letterSpacing="0.05em">{m}</text>
      ))}
    </svg>
  );
}

// ─── Donut chart ──────────────────────────────────────────────────────────────
function DonutChart() {
  const segs = [
    { label: 'Google Ads',  pct: 48, color: C.coral   },
    { label: 'Organic SEO', pct: 30, color: C.sage    },
    { label: 'Google Maps', pct: 15, color: C.gold    },
    { label: 'Facebook',    pct: 7,  color: C.chocolate },
  ];
  const C2 = 502.65, R = 80, cx = 110, cy = 110;
  let offset = 0;
  const circles = segs.map(s => {
    const dash = (s.pct / 100) * C2;
    const el = { dash, offset, ...s };
    offset += dash;
    return el;
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
      {/* donut */}
      <div style={{ position: 'relative', width: 220, height: 220, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(44,36,25,0.06)" strokeWidth="32" />
          {circles.map(s => (
            <circle key={s.label} cx={cx} cy={cy} r={R} fill="none"
              stroke={s.color} strokeWidth="32"
              strokeDasharray={`${s.dash} ${C2}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </svg>
        <div style={{ position: 'absolute', textAlign: 'center' }}>
          <div style={{ fontFamily: outfit, fontWeight: 800, fontSize: 48, color: C.chocolate, lineHeight: 1, letterSpacing: '-0.02em' }}>61</div>
          <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.textSecond, marginTop: 6 }}>Total leads</div>
        </div>
      </div>
      {/* legend */}
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

// ─── Browser mockup ───────────────────────────────────────────────────────────
function BrowserMockup() {
  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 100px rgba(44,36,25,0.22)', border: `1px solid ${C.borderMed}`, transform: 'rotate(-1deg)', transition: 'transform 400ms ease' }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'rotate(0deg)'}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = 'rotate(-1deg)'}
    >
      <div style={{ background: C.chocolate, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#ef4444','#f59e0b','#22c55e'].map(c => <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block', opacity: 0.7 }} />)}
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '4px 12px', fontFamily: mono, fontSize: 11, color: 'rgba(245,241,237,0.4)' }}>
          app.wisecrm.io / dashboard
        </div>
      </div>
      <div style={{ background: C.paperWarm, padding: '20px 22px' }}>
        <div style={{ fontFamily: fraunces, fontSize: 16, fontWeight: 500, color: C.chocolate, marginBottom: 4, letterSpacing: '-0.01em' }}>Good morning, Dr. Kevin.</div>
        <div style={{ fontFamily: mono, fontSize: 10, color: C.textMuted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Here&apos;s how last week looked</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'New Leads',   value: '47',    sub: '+52% vs avg 31', color: C.coral,   data: [22,28,31,27,35,38,42,47], accent: C.coral   },
            { label: 'Ad Spend',    value: '$3,840', sub: 'This month',    color: C.gold,    data: [3200,3100,3600,3400,3800,3750,3900,3840], accent: C.gold },
            { label: 'Cost / Lead', value: '$38',   sub: '↓12% vs last',  color: C.emerald, data: [61,55,52,58,48,44,41,38], accent: C.sage  },
            { label: 'Phone Calls', value: '94',    sub: '+8 vs last mo', color: C.sage,    data: [72,68,80,77,85,88,89,94], accent: C.sage   },
          ].map(k => (
            <div key={k.label} style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 10, padding: '10px 10px 8px', border: `1px solid ${C.borderSoft}`, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.accent }} />
              <div style={{ fontFamily: mono, fontSize: 8, color: C.textSecond, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{k.label}</div>
              <div style={{ fontFamily: outfit, fontWeight: 800, fontSize: 15, color: C.chocolate, lineHeight: 1, marginBottom: 4, letterSpacing: '-0.02em' }}>{k.value}</div>
              <Spark data={k.data} color={k.color} id={`ms-${k.label}`} />
              <div style={{ fontFamily: inter, fontSize: 9, color: k.color, marginTop: 3, fontWeight: 700 }}>{k.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { label: 'Google Ads', color: C.coral },
            { label: 'Google Maps', color: C.gold },
            { label: 'Organic SEO', color: C.sage },
            { label: 'Facebook', color: C.chocolate },
          ].map(p => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.9)', borderRadius: 100, padding: '4px 10px', fontFamily: inter, fontSize: 10, color: C.chocolate, fontWeight: 500, border: `1px solid ${C.borderSoft}` }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color }} />
              {p.label}
            </div>
          ))}
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
      if (user.role === 'admin' || user.role === 'team') {
        router.push('/admin-dashboard');
      } else if (user.role === 'client' && user.clientSlug) {
        router.push(`/portal/${user.clientSlug}`);
      }
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
        @keyframes floaty1{0%,100%{transform:rotate(-4deg) translateY(0)}50%{transform:rotate(-4deg) translateY(-8px)}}
        @keyframes floaty2{0%,100%{transform:rotate(3deg) translateY(0)}50%{transform:rotate(3deg) translateY(-8px)}}
        body{background:${C.cream}}
        body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0.3;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.17 0 0 0 0 0.14 0 0 0 0 0.10 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
        @media(max-width:980px){.hero-grid{grid-template-columns:1fr!important}.two-col{grid-template-columns:1fr!important}.steps-grid{grid-template-columns:1fr!important}.trust-grid{grid-template-columns:repeat(2,1fr)!important}.founders-grid{grid-template-columns:1fr!important}}
        @media(max-width:640px){.trust-grid{grid-template-columns:1fr!important}}
      `}</style>

      {/* ══════════ NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '18px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(245,241,237,0.88)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${C.borderSoft}`,
      }}>
        <span style={{ fontFamily: outfit, fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: C.chocolate, display: 'flex', alignItems: 'center', gap: 2 }}>
          Wise<span style={{ color: C.coral }}>CRM</span>
          <span style={{ width: 6, height: 6, background: C.coral, borderRadius: '50%', marginLeft: 4, marginBottom: 4, alignSelf: 'flex-end', display: 'inline-block' }} />
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          {[['#how','How it works'],['#attribution','Attribution'],['#founders','Founders'],['#trust','Security']].map(([href, label]) => (
            <a key={label} href={href} style={{ fontFamily: inter, fontSize: 13, fontWeight: 500, color: C.textSecond, textDecoration: 'none', transition: 'color 150ms ease' }}
              onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = C.coral}
              onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = C.textSecond}>
              {label}
            </a>
          ))}
        </div>
        <button
          onClick={() => router.push('/login')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', background: C.chocolate, border: 'none', borderRadius: 100, color: C.cream, fontFamily: inter, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 200ms ease' }}
          onMouseEnter={e => { const b = e.currentTarget; b.style.background = C.coral; b.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { const b = e.currentTarget; b.style.background = C.chocolate; b.style.transform = 'translateY(0)'; }}
        >
          <LogIn size={14} /> Sign In →
        </button>
      </nav>

      {/* ══════════ HERO */}
      <section style={{
        position: 'relative', zIndex: 2, padding: '140px 40px 80px',
        background: 'radial-gradient(ellipse at 80% 20%, rgba(217,168,84,0.18), transparent 50%), radial-gradient(ellipse at 10% 70%, rgba(196,112,79,0.12), transparent 55%), linear-gradient(180deg, #f9f5ee 0%, #f5f1ed 100%)',
        overflow: 'hidden',
      }}>
        {/* decorative W */}
        <div aria-hidden style={{ position: 'absolute', fontFamily: fraunces, fontWeight: 300, fontSize: 720, color: C.chocolate, opacity: 0.02, lineHeight: 0.8, bottom: -120, right: -80, pointerEvents: 'none', zIndex: 1 }}>W</div>

        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 64, alignItems: 'center', maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>

          {/* copy */}
          <Reveal>
            {/* eyebrow pill */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 14px 6px 8px', background: 'rgba(255,255,255,0.7)', border: `1px solid ${C.borderSoft}`, borderRadius: 999, marginBottom: 28, backdropFilter: 'blur(8px)' }}>
              <span style={{ width: 8, height: 8, background: C.emerald, borderRadius: '50%', animation: 'pulse 2s infinite', boxShadow: '0 0 0 0 rgba(16,185,129,0.5)' }} />
              <span style={{ fontFamily: inter, fontSize: 12, fontWeight: 600, color: C.textSecond }}>Updated this morning · 8:47 AM</span>
            </div>

            <h1 style={{ fontFamily: fraunces, fontWeight: 400, fontSize: 'clamp(48px,6vw,80px)', lineHeight: 0.98, letterSpacing: '-0.035em', color: C.chocolate, margin: '0 0 28px' }}>
              Every marketing channel.<br />
              <span style={{ position: 'relative', display: 'inline-block' }}>
                One{' '}
                <span style={{ fontStyle: 'italic', fontWeight: 300, color: C.coral }}>dashboard.</span>
                <span style={{ position: 'absolute', left: 0, right: 0, bottom: 8, height: 8, background: C.gold, opacity: 0.4, zIndex: -1, borderRadius: 2 }} />
              </span>
            </h1>

            <p style={{ fontFamily: inter, fontSize: 17, lineHeight: 1.65, color: C.textSecond, maxWidth: 520, margin: '0 0 36px' }}>
              Google Ads, SEO, Google Maps, Facebook, Search Console, and AI Search — pulled from official APIs every morning into <strong style={{ color: C.chocolate, fontWeight: 600 }}>one clean dashboard</strong> your whole team can read in minutes.
            </p>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 40 }}>
              <button
                onClick={() => router.push('/login')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 28px', background: C.coral, border: 'none', borderRadius: 12, color: '#fff', fontFamily: inter, fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 20px rgba(196,112,79,0.35)', transition: 'all 200ms ease' }}
                onMouseEnter={e => { const b = e.currentTarget; b.style.background = C.coralDeep; b.style.transform = 'translateY(-2px)'; b.style.boxShadow = '0 10px 28px rgba(196,112,79,0.45)'; }}
                onMouseLeave={e => { const b = e.currentTarget; b.style.background = C.coral; b.style.transform = 'translateY(0)'; b.style.boxShadow = '0 6px 20px rgba(196,112,79,0.35)'; }}
              >
                Open My Dashboard <span style={{ transition: 'transform 200ms ease' }}>→</span>
              </button>
              <button
                onClick={() => router.push('/login')}
                style={{ background: 'none', border: 'none', fontFamily: inter, fontSize: 14, fontWeight: 500, color: C.textSecond, cursor: 'pointer', padding: '16px 8px', borderBottom: '1px solid transparent', transition: 'all 200ms ease' }}
                onMouseEnter={e => { const b = e.currentTarget; b.style.color = C.coral; b.style.borderBottomColor = C.coral; }}
                onMouseLeave={e => { const b = e.currentTarget; b.style.color = C.textSecond; b.style.borderBottomColor = 'transparent'; }}
              >
                Already a member? Sign in
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 32, borderTop: `1px solid ${C.borderSoft}` }}>
              <div style={{ display: 'flex' }}>
                {[{i:'DR',g:'135deg, #c4704f, #d9a854'},{i:'JK',g:'135deg, #9db5a0, #10b981'},{i:'MV',g:'135deg, #d9a854, #c4704f'},{i:'+97',g:`135deg, ${C.chocolate}, ${C.chocolate}`}].map((av, idx) => (
                  <div key={idx} style={{ width: 36, height: 36, borderRadius: '50%', border: `2.5px solid ${C.paperWarm}`, marginLeft: idx > 0 ? -10 : 0, background: `linear-gradient(${av.g})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: inter, fontSize: 11, fontWeight: 700, color: '#fff' }}>{av.i}</div>
                ))}
              </div>
              <div style={{ fontFamily: inter, fontSize: 12, color: C.textSecond, lineHeight: 1.4 }}>
                <strong style={{ color: C.chocolate, fontWeight: 600 }}>Trusted by 100+ practices</strong> worldwide<br />
                Updated daily from official Google &amp; Meta APIs
              </div>
            </div>
          </Reveal>

          {/* browser mockup */}
          <Reveal delay={0.2} style={{ position: 'relative' }}>
            {/* floating cards */}
            <div style={{ position: 'absolute', top: -28, left: -32, background: 'white', border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: '12px 14px', boxShadow: '0 20px 60px rgba(44,36,25,0.18)', zIndex: 3, animation: 'floaty1 6s ease-in-out infinite' }}>
              <div style={{ fontFamily: mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted, fontWeight: 700, marginBottom: 4 }}>New Leads</div>
              <div style={{ fontFamily: outfit, fontSize: 22, fontWeight: 800, color: C.chocolate, lineHeight: 1, letterSpacing: '-0.02em' }}>47</div>
              <div style={{ fontFamily: inter, fontSize: 10, color: C.emerald, fontWeight: 600, marginTop: 4 }}>↑ 52% vs avg 31</div>
            </div>
            <div style={{ position: 'absolute', bottom: -24, right: -28, background: 'white', border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: '12px 14px', boxShadow: '0 20px 60px rgba(44,36,25,0.18)', zIndex: 3, animation: 'floaty2 7s ease-in-out infinite' }}>
              <div style={{ fontFamily: mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted, fontWeight: 700, marginBottom: 4 }}>Cost / Lead</div>
              <div style={{ fontFamily: outfit, fontSize: 22, fontWeight: 800, color: C.chocolate, lineHeight: 1, letterSpacing: '-0.02em' }}>$38</div>
              <div style={{ fontFamily: inter, fontSize: 10, color: C.emerald, fontWeight: 600, marginTop: 4 }}>↓ 12% beating avg</div>
            </div>
            <BrowserMockup />
          </Reveal>

        </div>
      </section>

      {/* ══════════ MARQUEE */}
      <div style={{ background: C.chocolate, color: C.cream, padding: '22px 0', overflow: 'hidden', borderTop: `1px solid ${C.chocolate}`, borderBottom: `1px solid ${C.chocolate}`, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', gap: 64, whiteSpace: 'nowrap', animation: 'scroll 40s linear infinite', fontFamily: fraunces, fontSize: 18, fontWeight: 400, letterSpacing: '-0.01em' }}>
          {[...Array(2)].map((_, rep) => (
            <span key={rep} style={{ display: 'inline-flex', gap: 64, flexShrink: 0 }}>
              {[
                { star: true, t: 'Google Ads' },
                { t: 'Organic SEO', italic: true },
                { star: true, t: 'Google Maps' },
                { t: 'Facebook Ads', italic: true },
                { star: true, t: 'Search Console' },
                { t: 'AI Search', italic: true },
              ].map(item => (
                <span key={item.t} style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
                  {item.star && <span style={{ color: C.gold, fontSize: 14 }}>✦</span>}
                  <span style={{ fontStyle: item.italic ? 'italic' : 'normal', color: item.italic ? C.gold : C.cream }}>{item.t}</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════ AGENCY / SPLIT */}
      <section style={{ position: 'relative', zIndex: 2, padding: '120px 40px', background: C.cream }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Eyebrow>Built by an agency, for practices</Eyebrow>
          <h2 style={{ fontFamily: fraunces, fontWeight: 400, fontSize: 'clamp(36px,4.5vw,56px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: C.chocolate, maxWidth: 800, margin: '0 0 20px' }}>
            We manage 100+ clients.<br /><span style={{ fontStyle: 'italic', color: C.coral, fontWeight: 400 }}>This is how we do it.</span>
          </h2>
          <p style={{ fontFamily: inter, fontSize: 17, lineHeight: 1.6, color: C.textSecond, maxWidth: 620, marginBottom: 60 }}>
            WiseCRM was built by MyChiropractice — a marketing agency running campaigns for over 100 practices worldwide. We built this dashboard because we needed it ourselves. Now your practice gets the same visibility our team uses every day.
          </p>

          <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 80, alignItems: 'center' }}>
            <Reveal>
              <p style={{ fontFamily: fraunces, fontStyle: 'italic', fontSize: 24, lineHeight: 1.4, color: C.chocolate, fontWeight: 300, letterSpacing: '-0.01em', marginBottom: 24 }}>
                One place to see every client&apos;s Google Ads, SEO, Maps, and Facebook performance — at a glance.
              </p>
              <p style={{ fontFamily: inter, fontSize: 14, lineHeight: 1.65, color: C.textSecond }}>
                Same numbers, same APIs, same morning sync we use for our agency clients. No PDFs. No 45-minute calls. No more guessing.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 20px rgba(44,36,25,0.06)', border: `1px solid ${C.borderSoft}`, background: 'white' }}>
                {/* before */}
                <div style={{ padding: '32px 28px', background: 'rgba(44,36,25,0.04)', borderRight: `1px dashed ${C.borderMed}` }}>
                  <div style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: C.textSecond, marginBottom: 20, fontWeight: 500 }}>Without WiseCRM</div>
                  {['6 platforms, 6 tabs','Monthly agency PDF','No historical data','Guessing what\'s working','Reactive to problems'].map(t => (
                    <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', fontFamily: inter, fontSize: 14, color: C.chocolate, borderBottom: `1px solid ${C.borderSoft}` }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(196,112,79,0.15)', color: C.coral, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✕</span>
                      {t}
                    </div>
                  ))}
                </div>
                {/* after */}
                <div style={{ padding: '32px 28px', background: 'linear-gradient(180deg, rgba(157,181,160,0.1), rgba(16,185,129,0.05))' }}>
                  <div style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: C.emerald, marginBottom: 20, fontWeight: 500 }}>With WiseCRM</div>
                  {['One dashboard','Updated every morning','Data stored forever','Channel attribution, live','AI alerts before you notice'].map(t => (
                    <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', fontFamily: inter, fontSize: 14, color: C.chocolate, borderBottom: `1px solid ${C.borderSoft}` }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', color: C.emerald, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS (dark) */}
      <section id="how" style={{ background: C.chocolate, position: 'relative', zIndex: 2, padding: '120px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 70 }}>
              <Eyebrow light>Monday, 8:47 AM. Before your first patient.</Eyebrow>
              <h2 style={{ fontFamily: fraunces, fontWeight: 300, fontSize: 'clamp(32px,3.5vw,52px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: C.cream, margin: '0 0 16px' }}>
                Three steps to knowing exactly<br />how your <span style={{ fontStyle: 'italic', color: C.gold }}>marketing</span> is performing.
              </h2>
            </div>
          </Reveal>

          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28, marginBottom: 60 }}>
            {[
              { n: '01', title: 'Open WiseCRM',              body: 'Takes 30 seconds. No login maze. No waiting on an agency email or digging through spreadsheets.' },
              { n: '02', title: 'See last week at a glance', body: 'Leads, spend, calls, and trends — in one scroll. Every channel, every clinic, one view.' },
              { n: '03', title: 'Walk in with answers',       body: 'Not "I\'ll check with our agency." Actual numbers, ready before your first patient walks in.' },
            ].map(({ n, title, body }, i) => (
              <Reveal key={n} delay={i * 0.15}>
                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '36px 30px 32px', transition: 'all 300ms ease' }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-4px)'; d.style.borderColor = 'rgba(196,112,79,0.3)'; }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(0)'; d.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                >
                  <div style={{ fontFamily: fraunces, fontStyle: 'italic', fontWeight: 300, fontSize: 64, lineHeight: 1, color: C.coral, marginBottom: 8, letterSpacing: '-0.04em' }}>{n}</div>
                  <h3 style={{ fontFamily: fraunces, fontWeight: 500, fontSize: 22, color: C.cream, margin: '0 0 12px', letterSpacing: '-0.01em' }}>{title}</h3>
                  <p style={{ fontFamily: inter, fontSize: 14, color: 'rgba(245,241,237,0.6)', lineHeight: 1.65, margin: 0 }}>{body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: '60px 56px', position: 'relative', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 40, alignItems: 'center' }}>
              <div style={{ fontFamily: fraunces, fontSize: 100, fontWeight: 300, color: C.gold, lineHeight: 0.7, alignSelf: 'flex-start' }}>&ldquo;</div>
              <div>
                <p style={{ fontFamily: fraunces, fontStyle: 'italic', fontWeight: 300, fontSize: 'clamp(20px,2.4vw,28px)', lineHeight: 1.35, letterSpacing: '-0.01em', color: C.cream, marginBottom: 18 }}>
                  It replaced a 45-minute monthly call with our marketing agency.
                </p>
                <cite style={{ fontFamily: inter, fontSize: 13, color: 'rgba(245,241,237,0.6)', fontStyle: 'normal', fontWeight: 500 }}>
                  — <strong style={{ color: C.gold, fontWeight: 600 }}>Dr. K.J.</strong>, MyChiropractice
                </cite>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════ ATTRIBUTION */}
      <section id="attribution" style={{ position: 'relative', zIndex: 2, padding: '120px 40px', background: C.paperWarm }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Eyebrow>Channel attribution</Eyebrow>
          <h2 style={{ fontFamily: fraunces, fontWeight: 400, fontSize: 'clamp(36px,4.5vw,56px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: C.chocolate, maxWidth: 800, margin: '0 0 20px' }}>
            Where are your new patients<br /><span style={{ fontStyle: 'italic', color: C.coral }}>actually</span> coming from?
          </h2>
          <p style={{ fontFamily: inter, fontSize: 17, lineHeight: 1.6, color: C.textSecond, maxWidth: 620, marginBottom: 60 }}>
            Most practices have no idea which channel is driving their best patients. WiseCRM shows you the exact split — so you can double down on what&apos;s working and stop wasting money on what isn&apos;t.
          </p>

          <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
            <Reveal>
              <div style={{ background: 'white', border: `1px solid ${C.borderSoft}`, borderRadius: 24, padding: '48px 40px', boxShadow: '0 4px 20px rgba(44,36,25,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                  <h3 style={{ fontFamily: fraunces, fontSize: 22, fontWeight: 500, color: C.chocolate, letterSpacing: '-0.01em', margin: 0 }}>Where Patients Come From</h3>
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>This month</span>
                </div>
                <DonutChart />
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <p style={{ fontFamily: fraunces, fontStyle: 'italic', fontSize: 28, lineHeight: 1.3, color: C.chocolate, fontWeight: 300, letterSpacing: '-0.02em', marginBottom: 24 }}>
                See growth over time — not just this month.
              </p>
              <p style={{ fontFamily: inter, fontSize: 15, lineHeight: 1.65, color: C.textSecond, marginBottom: 20 }}>
                A 30-day dip in leads looks scary in isolation. But when you see the last 12 months side by side, you see the growth.
              </p>
              <p style={{ fontFamily: inter, fontSize: 15, lineHeight: 1.65, color: C.textSecond, marginBottom: 32 }}>
                Monthly comparisons built in. Year-over-year context always visible. No spreadsheets required.
              </p>

              <div style={{ background: 'white', border: `1px solid ${C.borderSoft}`, borderRadius: 16, padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.textSecond, fontWeight: 500, marginBottom: 4 }}>12-month trend</div>
                    <div style={{ fontFamily: fraunces, fontSize: 20, fontWeight: 500, color: C.chocolate, letterSpacing: '-0.01em' }}>New <span style={{ fontStyle: 'italic', color: C.coral, fontWeight: 300 }}>patient</span> leads</div>
                  </div>
                  <div style={{ background: 'rgba(16,185,129,0.12)', color: C.emerald, padding: '6px 12px', borderRadius: 999, fontFamily: inter, fontSize: 12, fontWeight: 700 }}>YoY +34%</div>
                </div>
                <LineChart />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════ EVERY METRIC */}
      <section style={{ position: 'relative', zIndex: 2, padding: '120px 40px', background: C.cream }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Eyebrow>Your numbers, your way</Eyebrow>
          <h2 style={{ fontFamily: fraunces, fontWeight: 400, fontSize: 'clamp(36px,4.5vw,56px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: C.chocolate, maxWidth: 800, margin: '0 0 20px' }}>
            Every metric that matters.<br /><span style={{ fontStyle: 'italic', color: C.coral }}>Nothing</span> that doesn&apos;t.
          </h2>
          <p style={{ fontFamily: inter, fontSize: 17, lineHeight: 1.6, color: C.textSecond, maxWidth: 620, marginBottom: 60 }}>
            New patient leads. Phone calls. Cost per lead. Organic sessions. Google Maps clicks. All in one place — benchmarked against industry averages so you always know if you&apos;re ahead.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, marginBottom: 40 }}>
            {[
              { label: 'New Leads',    bench: 'Industry avg: 31', value: '47',  meta: '↑ 8% vs last month',           color: C.coral,   data: [22,28,31,35,38,42,44,47], id: 'em1' },
              { label: 'Cost per lead', bench: 'Industry avg: $61', value: '$38', meta: '↓ 12% — you\'re beating average', color: C.sage, data: [61,55,52,58,48,44,41,38], id: 'em2', accent: C.sage },
              { label: 'Phone Calls',   bench: '2 locations',       value: '94',  meta: '+8 vs last month',             color: C.gold,    data: [72,68,80,77,85,88,89,94], id: 'em3', accent: C.gold },
            ].map((k, i) => (
              <Reveal key={k.label} delay={i * 0.1}>
                <div style={{ background: 'white', border: `1px solid ${C.borderSoft}`, borderRadius: 20, padding: '32px 28px', position: 'relative', overflow: 'hidden', transition: 'all 300ms ease' }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-3px)'; d.style.boxShadow = '0 20px 60px rgba(44,36,25,0.12)'; }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(0)'; d.style.boxShadow = 'none'; }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.accent || k.color }} />
                  <div style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.textSecond, marginBottom: 4, fontWeight: 500, marginTop: 8 }}>{k.label}</div>
                  <div style={{ fontFamily: inter, fontSize: 11, color: C.textMuted, marginBottom: 18 }}>{k.bench}</div>
                  <div style={{ fontFamily: outfit, fontSize: 56, fontWeight: 800, color: C.chocolate, lineHeight: 1, letterSpacing: '-0.025em', marginBottom: 10 }}>{k.value}</div>
                  <Spark data={k.data} color={k.color} id={k.id} />
                  <div style={{ fontFamily: inter, fontSize: 13, color: C.emerald, fontWeight: 600, marginTop: 8 }}>{k.meta}</div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* channels strip */}
          <Reveal>
            <div style={{ padding: '36px 40px', background: 'white', border: `1px solid ${C.borderSoft}`, borderRadius: 20, display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: 40, alignItems: 'center' }}>
              <div style={{ fontFamily: fraunces, fontStyle: 'italic', fontSize: 20, color: C.chocolate, lineHeight: 1.3, fontWeight: 300 }}>
                One source of truth for every channel you pay for.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px 24px' }}>
                {[
                  { label: 'Google Ads',               color: C.coral     },
                  { label: 'Organic SEO',              color: C.sage      },
                  { label: 'Google Business Profile',  color: C.gold      },
                  { label: 'Google Analytics 4',       color: C.emerald   },
                  { label: 'Facebook Ads',             color: C.chocolate },
                  { label: 'Bing / AI Search',         color: C.textSecond },
                ].map(c => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: inter, fontSize: 13, color: C.textSecond, fontWeight: 500 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                    {c.label}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════ FOUNDERS (dark) */}
      <section id="founders" style={{ background: C.chocolate, position: 'relative', zIndex: 2, overflow: 'hidden' }}>
        <div className="founders-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', minHeight: 640, alignItems: 'stretch' }}>
          {/* image side */}
          <div style={{ position: 'relative', background: 'radial-gradient(ellipse at center, #1a1410 0%, #0d0a07 100%)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 60%, rgba(196,112,79,0.15), transparent 60%), radial-gradient(circle at 30% 40%, rgba(217,168,84,0.08), transparent 50%)' }} />
            {/* floating credential cards */}
            <div style={{ position: 'absolute', top: 60, left: 40, background: 'rgba(245,241,237,0.97)', color: C.chocolate, borderRadius: 14, padding: '14px 18px', boxShadow: '0 20px 60px rgba(44,36,25,0.18)', zIndex: 3, transform: 'rotate(-3deg)' }}>
              <div style={{ fontFamily: mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.textMuted, fontWeight: 500, marginBottom: 4 }}>Active clients</div>
              <div style={{ fontFamily: outfit, fontSize: 22, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: C.chocolate }}>100+</div>
              <div style={{ fontFamily: inter, fontSize: 11, color: C.textSecond, marginTop: 2 }}>Worldwide · daily syncs</div>
            </div>
            <div style={{ position: 'absolute', bottom: 60, right: 30, background: 'rgba(245,241,237,0.97)', color: C.chocolate, borderRadius: 14, padding: '14px 18px', boxShadow: '0 20px 60px rgba(44,36,25,0.18)', zIndex: 3, transform: 'rotate(2deg)' }}>
              <div style={{ fontFamily: mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.textMuted, fontWeight: 500, marginBottom: 4 }}>Replacing</div>
              <div style={{ fontFamily: outfit, fontSize: 22, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: C.chocolate }}>45-min</div>
              <div style={{ fontFamily: inter, fontSize: 11, color: C.textSecond, marginTop: 2 }}>Monthly agency calls</div>
            </div>
            <Image
              src="/founders.png"
              alt="Kevin and Ardavan Javid, founders of MyChiropractice and WiseCRM"
              width={720}
              height={640}
              style={{ width: '100%', maxWidth: 720, height: 'auto', objectFit: 'contain', display: 'block', position: 'relative', zIndex: 2, filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.5))' }}
              priority
            />
          </div>
          {/* text side */}
          <div style={{ padding: '80px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'radial-gradient(ellipse at top right, rgba(196,112,79,0.12), transparent 50%), #2c2419' }}>
            <Eyebrow light>Built by practice owners, for practice owners</Eyebrow>
            <h2 style={{ fontFamily: fraunces, fontWeight: 300, fontSize: 'clamp(32px,3.5vw,44px)', lineHeight: 1.1, letterSpacing: '-0.025em', color: C.cream, marginBottom: 28 }}>
              The tool we couldn&apos;t find.<br /><span style={{ fontStyle: 'italic', color: C.gold }}>So we built it.</span>
            </h2>
            <blockquote style={{ fontFamily: fraunces, fontStyle: 'italic', fontWeight: 300, fontSize: 18, lineHeight: 1.6, color: 'rgba(245,241,237,0.85)', marginBottom: 32, paddingLeft: 20, borderLeft: `2px solid ${C.coral}`, margin: '0 0 32px' }}>
              We built MyChiropractice into a marketing agency running 100+ clients around the world — and we were doing it all manually, across dozens of tabs, every single morning. WiseCRM was the tool we needed and couldn&apos;t find. Now every practice we work with gets the same real-time visibility we use to run their campaigns.
            </blockquote>
            <div>
              <div style={{ fontFamily: fraunces, fontSize: 22, fontWeight: 500, color: C.cream, letterSpacing: '-0.01em', marginBottom: 6 }}>Kevin &amp; Ardavan Javid</div>
              <div style={{ fontFamily: mono, fontSize: 12, color: 'rgba(245,241,237,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Founders · MyChiropractice · 100+ clients worldwide</div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ TRUST */}
      <section id="trust" style={{ position: 'relative', zIndex: 2, padding: '120px 40px', background: C.paperWarm }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <Eyebrow>Infrastructure &amp; trust</Eyebrow>
              <h2 style={{ fontFamily: fraunces, fontWeight: 400, fontSize: 'clamp(36px,4.5vw,56px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: C.chocolate, maxWidth: 700, margin: '0 auto' }}>
                Built to the standard<br />your <span style={{ fontStyle: 'italic', color: C.coral }}>data</span> deserves.
              </h2>
            </div>
          </Reveal>

          <div className="trust-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 24 }}>
            {[
              {
                icon: <ShieldCheck size={22} strokeWidth={2} />, bg: 'rgba(196,112,79,0.1)', iconColor: C.coral,
                title: 'Enterprise-Grade Security',
                body: 'Encrypted in transit and at rest. OAuth2 connections to Google & Meta — we never store your passwords. Role-based access so only the right people see the right numbers.',
                badge: 'SOC-2 Ready', live: false,
              },
              {
                icon: <Zap size={22} strokeWidth={2} />, bg: 'rgba(16,185,129,0.1)', iconColor: C.emerald,
                title: '99.9% Uptime, 24/7',
                body: 'Our infrastructure runs around the clock on globally distributed servers. Data syncs automatically every morning — whether it\'s 8 AM Monday or 2 AM Sunday.',
                badge: 'Always Online', live: true,
              },
              {
                icon: <Database size={22} strokeWidth={2} />, bg: 'rgba(217,168,84,0.18)', iconColor: '#8a6a2e',
                title: 'Direct from Official APIs',
                body: 'Every number comes straight from Google Analytics 4, Search Console, Google Ads, GBP, Facebook Ads, and Bing. No scraping. No estimates. Real data, every time.',
                badge: 'Verified Sources', live: false,
              },
              {
                icon: <Activity size={22} strokeWidth={2} />, bg: 'rgba(16,185,129,0.12)', iconColor: C.emerald,
                title: 'AI Market Intelligence',
                body: 'Our AI bot monitors search trends, competitor activity, and algorithm shifts across Google, Bing, and AI platforms — proactive alerts before problems affect your practice.',
                badge: 'Always Watching', live: true,
              },
            ].map((t, i) => (
              <Reveal key={t.title} delay={i * 0.1}>
                <div
                  style={{ background: 'white', border: `1px solid ${C.borderSoft}`, borderRadius: 20, padding: '40px 36px', transition: 'all 300ms ease', height: '100%', boxSizing: 'border-box' }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-3px)'; d.style.boxShadow = '0 4px 20px rgba(44,36,25,0.06)'; }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(0)'; d.style.boxShadow = 'none'; }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, color: t.iconColor }}>
                    {t.icon}
                  </div>
                  <h3 style={{ fontFamily: fraunces, fontWeight: 500, fontSize: 22, color: C.chocolate, margin: '0 0 12px', letterSpacing: '-0.01em' }}>{t.title}</h3>
                  <p style={{ fontFamily: inter, fontSize: 14, color: C.textSecond, lineHeight: 1.65, margin: '0 0 18px' }}>{t.body}</p>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(44,36,25,0.06)', borderRadius: 999, fontFamily: inter, fontSize: 11, fontWeight: 700, color: C.textSecond, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t.live && <span style={{ width: 6, height: 6, background: C.emerald, borderRadius: '50%', animation: 'pulse 2s infinite' }} />}
                    {t.badge}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FINAL CTA */}
      <section style={{ position: 'relative', zIndex: 2, padding: '140px 40px 120px', background: 'radial-gradient(ellipse at 80% 30%, rgba(217,168,84,0.18), transparent 50%), radial-gradient(ellipse at 20% 70%, rgba(196,112,79,0.14), transparent 55%), linear-gradient(180deg, #f9f5ee 0%, #f5f1ed 100%)', textAlign: 'center', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontFamily: fraunces, fontSize: 480, color: C.chocolate, opacity: 0.025, lineHeight: 1, pointerEvents: 'none' }}>✦</div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <Reveal>
            <h2 style={{ fontFamily: fraunces, fontWeight: 300, fontSize: 'clamp(48px,6vw,84px)', lineHeight: 1, letterSpacing: '-0.035em', color: C.chocolate, margin: '0 0 24px', maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>
              Your dashboard is <span style={{ fontStyle: 'italic', color: C.coral }}>ready.</span>
            </h2>
            <p style={{ fontFamily: inter, fontSize: 18, lineHeight: 1.5, color: C.textSecond, maxWidth: 580, margin: '0 auto 40px' }}>
              Sign in to see how your practice performed this month — leads, spend, rankings, and calls, all in one place.
            </p>
            <button
              onClick={() => router.push('/login')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '18px 32px', background: C.coral, border: 'none', borderRadius: 12, color: '#fff', fontFamily: inter, fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 20px rgba(196,112,79,0.35)', transition: 'all 200ms ease' }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = C.coralDeep; b.style.transform = 'translateY(-2px)'; b.style.boxShadow = '0 10px 28px rgba(196,112,79,0.45)'; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = C.coral; b.style.transform = 'translateY(0)'; b.style.boxShadow = '0 6px 20px rgba(196,112,79,0.35)'; }}
            >
              <ArrowRight size={18} /> Open My Dashboard
            </button>
            <div style={{ marginTop: 24, fontFamily: mono, fontSize: 12, color: C.textMuted, letterSpacing: '0.05em' }}>
              <CheckCircle2 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />
              Data updated this morning · 100+ clients worldwide
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════ FOOTER */}
      <footer style={{ padding: '40px', background: C.chocolate, color: 'rgba(245,241,237,0.55)', textAlign: 'center', fontFamily: inter, fontSize: 12, borderTop: '1px solid rgba(245,241,237,0.06)' }}>
        © 2026 <strong style={{ color: C.gold, fontWeight: 500 }}>WiseCRM</strong> · A product of MyChiropractice · Kevin &amp; Ardavan Javid
      </footer>

    </div>
  );
}
