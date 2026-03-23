'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LogIn, ShieldCheck, Zap, Bot, Search, TrendingUp, MapPin,
  Facebook, Activity, Database, RefreshCw, CheckCircle2,
  ArrowUpRight, Coffee, BarChart2, Users,
} from 'lucide-react';

// ─── design tokens ────────────────────────────────────────────────────────────
const C = {
  coral:  '#c4704f',
  gold:   '#d9a854',
  sage:   '#9db5a0',
  dark:   '#2c2419',
  text2:  '#5c5850',
  bg:     '#f5f1ed',
  bg2:    '#ede8e3',
  card:   'rgba(255,255,255,0.9)',
  green:  '#10b981',
  fb:     '#1877f2',
  purple: '#7c3aed',
};

const glass: React.CSSProperties = {
  background: C.card,
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(44,36,25,0.08)',
  borderRadius: 20,
};

// ─── scroll-reveal hook ───────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, style: { opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(28px)', transition: 'opacity .7s ease, transform .7s ease' } as React.CSSProperties };
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

// ─── line chart (12 months) ───────────────────────────────────────────────────
function LineChart() {
  const W = 480, H = 140;
  const pts = [18, 24, 29, 22, 35, 38, 31, 42, 39, 44, 41, 47];
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * W);
  const ys = pts.map(p => H - 8 - ((p - 10) / 42) * (H - 20));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 24}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="lcg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.coral} stopOpacity="0.22" />
          <stop offset="100%" stopColor={C.coral} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path + ` L${W},${H} L0,${H} Z`} fill="url(#lcg)" />
      <path d={path} fill="none" stroke={C.coral} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {[0, 3, 6, 9, 11].map(i => (
        <circle key={i} cx={xs[i]} cy={ys[i]} r="4" fill="#fff" stroke={C.coral} strokeWidth="2" />
      ))}
      {months.filter((_, i) => i % 2 === 0).map((m, i) => (
        <text key={m} x={xs[i * 2]} y={H + 18} textAnchor="middle" fontSize="10" fill={C.text2} fontFamily="Inter,sans-serif">{m}</text>
      ))}
    </svg>
  );
}

// ─── donut chart ──────────────────────────────────────────────────────────────
function DonutChart() {
  const segs = [
    { label: 'Google Ads', pct: 48, color: C.coral },
    { label: 'Organic SEO', pct: 30, color: C.gold },
    { label: 'Google Maps', pct: 15, color: C.sage },
    { label: 'Facebook', pct: 7, color: C.fb },
  ];
  const R = 58, r = 36, cx = 80, cy = 80;
  let angle = -Math.PI / 2;
  const arcs = segs.map(s => {
    const a = (s.pct / 100) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
    angle += a;
    const x2 = cx + R * Math.cos(angle), y2 = cy + R * Math.sin(angle);
    const xi1 = cx + r * Math.cos(angle - a), yi1 = cy + r * Math.sin(angle - a);
    const xi2 = cx + r * Math.cos(angle), yi2 = cy + r * Math.sin(angle);
    const large = a > Math.PI ? 1 : 0;
    return { d: `M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} L${xi2.toFixed(1)},${yi2.toFixed(1)} A${r},${r} 0 ${large} 0 ${xi1.toFixed(1)},${yi1.toFixed(1)} Z`, ...s };
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <svg width="160" height="160" viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
        {arcs.map(a => <path key={a.label} d={a.d} fill={a.color} />)}
        <text x="80" y="76" textAnchor="middle" fontSize="18" fontWeight="800" fill={C.dark} fontFamily="Outfit,sans-serif">61</text>
        <text x="80" y="93" textAnchor="middle" fontSize="10" fill={C.text2} fontFamily="Inter,sans-serif">total leads</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {segs.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: C.text2, minWidth: 90 }}>{s.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{s.pct}%</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: C.sage, marginTop: 4 }}>Industry avg: 45% paid · 30% organic · 25% maps</div>
      </div>
    </div>
  );
}

// ─── browser mockup ───────────────────────────────────────────────────────────
function BrowserMockup() {
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(44,36,25,0.18)', border: '1px solid rgba(44,36,25,0.12)' }}>
      {/* chrome bar */}
      <div style={{ background: '#2c2419', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#ef4444','#f59e0b','#22c55e'].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />)}
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 12px', fontSize: 11, color: 'rgba(245,241,237,0.5)', fontFamily: 'Inter,sans-serif' }}>
          app.wisecrm.io/dashboard
        </div>
      </div>
      {/* content */}
      <div style={{ background: '#f5f1ed', padding: '18px 20px' }}>
        <div style={{ fontSize: 12, color: C.text2, marginBottom: 14, fontFamily: 'Inter,sans-serif' }}>
          Good morning, Dr. Kevin. Here&apos;s how last week looked.
        </div>
        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'New Leads', value: '47', sub: '+52% vs avg 31', color: C.coral, data: [22,28,31,27,35,38,42,47] },
            { label: 'Ad Spend', value: '$3,840', sub: 'This month', color: C.gold, data: [3200,3100,3600,3400,3800,3750,3900,3840] },
            { label: 'Cost / Lead', value: '$38', sub: '↓12% vs last mo', color: C.green, data: [61,55,52,58,48,44,41,38] },
            { label: 'Phone Calls', value: '94', sub: '+8 vs last mo', color: C.sage, data: [72,68,80,77,85,88,89,94] },
          ].map(k => (
            <div key={k.label} style={{ background: 'rgba(255,255,255,0.85)', borderRadius: 10, padding: '10px 10px 8px', border: '1px solid rgba(44,36,25,0.06)' }}>
              <div style={{ fontSize: 9, color: C.text2, marginBottom: 3, fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
              <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 16, color: C.dark, lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
              <Spark data={k.data} color={k.color} id={`ms-${k.label}`} />
              <div style={{ fontSize: 9, color: k.color, marginTop: 3, fontWeight: 600 }}>{k.sub}</div>
            </div>
          ))}
        </div>
        {/* channel pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[{ label: 'Google Ads', color: C.coral }, { label: 'Google Maps', color: C.gold }, { label: 'Organic SEO', color: C.sage }, { label: 'Facebook', color: C.fb }].map(p => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.9)', borderRadius: 100, padding: '4px 10px', fontSize: 10, color: C.dark, fontWeight: 500, border: '1px solid rgba(44,36,25,0.07)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color }} />
              {p.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── section wrapper with reveal ─────────────────────────────────────────────
function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const { ref, style: revealStyle } = useReveal();
  return (
    <div ref={ref} style={{ ...revealStyle, ...style }}>
      {children}
    </div>
  );
}

// ─── eyebrow label ────────────────────────────────────────────────────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.coral, marginBottom: 12 }}>
      {children}
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(196,112,79,0.2)', borderTopColor: C.coral, animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(160deg,${C.bg} 0%,${C.bg2} 100%)`, fontFamily: 'Inter,sans-serif', color: C.dark, overflowX: 'hidden' }}>

      {/* ── background blobs ── */}
      <style>{`
        @keyframes drift1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.08)}}
        @keyframes drift2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-30px,40px) scale(1.06)}}
        @keyframes drift3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(20px,30px) scale(1.05)}}
        .blob{position:fixed;border-radius:50%;filter:blur(80px);pointer-events:none;z-index:0}
        .blob1{width:480px;height:480px;background:rgba(196,112,79,.07);top:-100px;right:-80px;animation:drift1 14s ease-in-out infinite}
        .blob2{width:360px;height:360px;background:rgba(217,168,84,.06);bottom:10%;left:-60px;animation:drift2 18s ease-in-out infinite}
        .blob3{width:280px;height:280px;background:rgba(157,181,160,.06);top:40%;right:10%;animation:drift3 16s ease-in-out infinite}
        @media(max-width:768px){
          .hero-grid{grid-template-columns:1fr!important}
          .two-col{grid-template-columns:1fr!important}
          .feat-rev{order:0!important}
          .steps-grid{grid-template-columns:1fr!important}
          .trust-grid{grid-template-columns:repeat(2,1fr)!important}
          .trust-grid-mobile{grid-template-columns:1fr!important}
        }
      `}</style>
      <div className="blob blob1" />
      <div className="blob blob2" />
      <div className="blob blob3" />

      {/* ══════════════════════════════════════════════════════ NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(245,241,237,0.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(44,36,25,0.07)', padding: '0 40px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>
          Wise<span style={{ color: C.coral }}>CRM</span>
        </span>
        <button
          onClick={() => router.push('/login')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 22px', background: C.coral, border: 'none', borderRadius: 100, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(196,112,79,0.3)', transition: 'background .15s, transform .15s' }}
          onMouseEnter={e => { const b = e.currentTarget; b.style.background = '#b05f40'; b.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { const b = e.currentTarget; b.style.background = C.coral; b.style.transform = 'translateY(0)'; }}
        >
          <LogIn size={14} /> Sign In
        </button>
      </nav>

      {/* ══════════════════════════════════════════════════════ HERO */}
      <section style={{ position: 'relative', zIndex: 1, padding: '100px 40px 80px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>

          {/* text */}
          <Section>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', background: 'rgba(196,112,79,0.1)', borderRadius: 100, marginBottom: 24 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.coral, animation: 'spin 2s linear infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.coral, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Kevin &amp; Ardavan Javid · MyChiropractice</span>
            </div>
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 'clamp(34px,4.5vw,54px)', lineHeight: 1.1, letterSpacing: '-0.025em', margin: '0 0 20px', color: C.dark }}>
              Every marketing channel.{' '}
              <span style={{ color: C.coral }}>One dashboard.</span>
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.7, color: C.text2, margin: '0 0 36px', maxWidth: 500 }}>
              Google Ads, SEO, Google Maps, Facebook, Search Console, and AI Search — pulled from official APIs every morning into one clean dashboard your whole team can read in minutes.
            </p>
            <button
              onClick={() => router.push('/login')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '16px 36px', background: C.coral, border: 'none', borderRadius: 100, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 28px rgba(196,112,79,0.35)', transition: 'all .15s', marginBottom: 20 }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = '#b05f40'; b.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = C.coral; b.style.transform = 'translateY(0)'; }}
            >
              <LogIn size={18} /> Open My Dashboard
            </button>
            <div style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>Already a member? Your data is waiting.</div>
            <div style={{ fontSize: 12, color: C.text2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
              Trusted by 100+ clients around the world · Updated daily from official Google &amp; Meta APIs
            </div>
          </Section>

          {/* browser mockup */}
          <Section style={{ transitionDelay: '0.2s' } as React.CSSProperties}>
            <BrowserMockup />
          </Section>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ AGENCY */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>

          <Section>
            <Eyebrow>Built by an Agency, for Practices</Eyebrow>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(26px,3.5vw,38px)', letterSpacing: '-0.02em', lineHeight: 1.2, margin: '0 0 20px' }}>
              We manage 100+ clients.<br />This is how we do it.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: C.text2, margin: '0 0 16px' }}>
              WiseCRM was built by MyChiropractice — a full-service marketing agency running campaigns for over 100 chiropractic and medical practices worldwide.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: C.text2 }}>
              We built this dashboard because we needed it ourselves: one place to see every client&apos;s Google Ads, SEO, Maps, and Facebook performance at a glance. Now your practice gets the same visibility our team uses every day.
            </p>
          </Section>

          {/* comparison card */}
          <Section style={{ transitionDelay: '0.2s' } as React.CSSProperties}>
            <div style={{ ...glass, padding: '28px 24px', maxWidth: 420 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 0 10px 0', borderBottom: '2px solid rgba(239,68,68,0.15)', textAlign: 'center' }}>Without WiseCRM</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 0 10px 0', borderBottom: `2px solid rgba(16,185,129,0.2)`, textAlign: 'center' }}>With WiseCRM</div>
              </div>
              {[
                ['6 platforms, 6 tabs', 'One dashboard'],
                ['Monthly agency PDF', 'Updated every morning'],
                ['No historical data', 'Data stored forever'],
                ['Guessing what\'s working', 'Channel attribution, live'],
                ['Reactive to problems', 'AI alerts before you notice'],
              ].map(([before, after]) => (
                <div key={before} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, padding: '10px 0', borderBottom: '1px solid rgba(44,36,25,0.05)' }}>
                  <div style={{ fontSize: 13, color: C.text2, paddingRight: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#ef4444', fontWeight: 700, flexShrink: 0 }}>✕</span> {before}
                  </div>
                  <div style={{ fontSize: 13, color: C.dark, fontWeight: 500, paddingLeft: 12, borderLeft: '1px solid rgba(44,36,25,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: C.green, fontWeight: 700, flexShrink: 0 }}>✓</span> {after}
                  </div>
                </div>
              ))}
              <div style={{ textAlign: 'center', fontSize: 12, color: C.text2, marginTop: 14, fontStyle: 'italic' }}>
                Same practice. Completely different clarity.
              </div>
            </div>
          </Section>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ MONDAY MORNING */}
      <section style={{ background: C.dark, position: 'relative', zIndex: 1, padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Section>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(26px,3.5vw,40px)', letterSpacing: '-0.02em', color: '#f5f1ed', margin: '0 0 12px' }}>
                Monday, 8:47 AM. Before your first patient.
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(245,241,237,0.55)', maxWidth: 460, margin: '0 auto' }}>
                Three steps to knowing exactly how your marketing is performing.
              </p>
            </div>
          </Section>

          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, marginBottom: 48 }}>
            {[
              { Icon: Coffee,   n: '01', title: 'Open WiseCRM',              body: 'Takes 30 seconds. No login maze. No waiting on an agency email or digging through spreadsheets.' },
              { Icon: BarChart2, n: '02', title: 'See last week at a glance', body: 'Leads, spend, calls, and trends — in one scroll. Every channel, every clinic, one view.' },
              { Icon: Users,    n: '03', title: 'Walk in with answers',       body: 'Not "I\'ll check with our agency." Actual numbers, ready before your first patient walks in.' },
            ].map(({ Icon, n, title, body }, i) => (
              <Section key={n} style={{ transitionDelay: `${i * 0.15}s` } as React.CSSProperties}>
                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '36px 28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(196,112,79,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} color={C.coral} strokeWidth={2} />
                    </div>
                    <span style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 28, color: 'rgba(196,112,79,0.25)', letterSpacing: '-0.03em' }}>{n}</span>
                  </div>
                  <h3 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 17, color: '#f5f1ed', margin: '0 0 10px' }}>{title}</h3>
                  <p style={{ fontSize: 14, color: 'rgba(245,241,237,0.55)', lineHeight: 1.7, margin: 0 }}>{body}</p>
                </div>
              </Section>
            ))}
          </div>

          <Section>
            <div style={{ textAlign: 'center', padding: '28px 32px', background: 'rgba(196,112,79,0.08)', borderRadius: 16, border: '1px solid rgba(196,112,79,0.15)', maxWidth: 640, margin: '0 auto' }}>
              <p style={{ fontStyle: 'italic', fontSize: 16, color: 'rgba(245,241,237,0.75)', margin: '0 0 8px', lineHeight: 1.7 }}>
                &ldquo;It replaced a 45-minute monthly call with our marketing agency.&rdquo;
              </p>
              <cite style={{ fontSize: 13, color: C.coral, fontStyle: 'normal', fontWeight: 600 }}>— Dr. K.J., MyChiropractice</cite>
            </div>
          </Section>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ WHERE PATIENTS COME FROM */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>

          <Section>
            <Eyebrow>Channel Attribution</Eyebrow>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(26px,3.5vw,38px)', letterSpacing: '-0.02em', lineHeight: 1.2, margin: '0 0 20px' }}>
              Where are your new patients actually coming from?
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: C.text2, margin: '0 0 16px' }}>
              Most practices have no idea which channel is driving their best patients. Is it the $3,000/month you&apos;re spending on Google Ads? Your organic SEO? Your Google Business listing?
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: C.text2 }}>
              WiseCRM shows you the exact split — so you can double down on what&apos;s working and stop wasting money on what isn&apos;t.
            </p>
          </Section>

          <Section style={{ transitionDelay: '0.2s' } as React.CSSProperties}>
            <div style={{ ...glass, padding: '32px 28px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Where Patients Come From</div>
              <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 28, color: C.dark, marginBottom: 24 }}>This Month</div>
              <DonutChart />
            </div>
          </Section>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ TREND OVER TIME */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 40px 96px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>

          {/* chart left */}
          <Section>
            <div style={{ ...glass, padding: '28px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>New Patient Leads</div>
                  <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 28, color: C.dark }}>12-Month Trend</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(16,185,129,0.1)', borderRadius: 100, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: C.green }}>
                  <ArrowUpRight size={13} /> YoY +34%
                </div>
              </div>
              <LineChart />
            </div>
          </Section>

          {/* text right */}
          <Section style={{ transitionDelay: '0.2s' } as React.CSSProperties}>
            <Eyebrow>Growth Over Time — Not Just This Month</Eyebrow>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(26px,3.5vw,38px)', letterSpacing: '-0.02em', lineHeight: 1.2, margin: '0 0 20px' }}>
              See if your marketing is actually growing.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: C.text2, margin: '0 0 16px' }}>
              A 30-day dip in leads looks scary in isolation. But when you see the last 12 months side by side, you see the growth. WiseCRM shows you the full trend — so you can stop reacting and start planning.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: C.text2 }}>
              Monthly comparisons built in. Year-over-year context always visible. No spreadsheets required.
            </p>
          </Section>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ EVERY METRIC */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 40px 96px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>

          <Section>
            <Eyebrow>Your Numbers, Your Way</Eyebrow>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(26px,3.5vw,38px)', letterSpacing: '-0.02em', lineHeight: 1.2, margin: '0 0 20px' }}>
              Every metric that matters. Nothing that doesn&apos;t.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: C.text2, margin: '0 0 16px' }}>
              New patient leads. Phone calls. Cost per lead. Organic sessions. Google Maps clicks. All in one place.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: C.text2 }}>
              No marketing degree required — if a number matters for your practice, it&apos;s on the dashboard. Benchmarked against industry averages so you always know if you&apos;re ahead or behind.
            </p>
          </Section>

          {/* stat cards */}
          <Section style={{ transitionDelay: '0.2s' } as React.CSSProperties}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'New Leads', value: '47', badge: 'avg: 31', badgeColor: C.coral, sub: '↑ 8% vs last month', subColor: C.green, data: [22,28,31,35,38,42,44,47], color: C.coral, id: 'em1' },
                { label: 'Cost Per Lead', value: '$38', badge: 'avg: $61', badgeColor: C.green, sub: '↓ 12% — you\'re beating average', subColor: C.green, data: [61,55,52,58,48,44,41,38], color: C.gold, id: 'em2' },
                { label: 'Phone Calls', value: '94', badge: '2 locations', badgeColor: C.sage, sub: '+8 vs last month', subColor: C.green, data: [72,68,80,77,85,88,89,94], color: C.sage, id: 'em3' },
              ].map(k => (
                <div key={k.label} style={{ ...glass, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: C.text2 }}>{k.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: k.badgeColor, background: `${k.badgeColor}18`, padding: '2px 7px', borderRadius: 100 }}>{k.badge}</span>
                    </div>
                    <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 28, color: C.dark, lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
                    <div style={{ fontSize: 12, color: k.subColor, fontWeight: 600 }}>{k.sub}</div>
                  </div>
                  <div style={{ width: 100, flexShrink: 0 }}>
                    <Spark data={k.data} color={k.color} id={k.id} />
                  </div>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ CHANNELS STRIP */}
      <section style={{ background: C.dark, position: 'relative', zIndex: 1, padding: '80px 40px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Section>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(24px,3vw,36px)', letterSpacing: '-0.02em', color: '#f5f1ed', textAlign: 'center', margin: '0 0 12px' }}>
              One source of truth for every channel you pay for.
            </h2>
            <p style={{ textAlign: 'center', fontSize: 15, color: 'rgba(245,241,237,0.5)', maxWidth: 480, margin: '0 auto 40px' }}>
              No more logging into 6 different platforms. Everything is here, updated automatically every morning.
            </p>
          </Section>
          <Section>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 28 }}>
              {[
                { Icon: TrendingUp, label: 'Google Ads',               color: C.coral },
                { Icon: Search,     label: 'Organic SEO',              color: C.gold },
                { Icon: MapPin,     label: 'Google Business Profile',  color: C.sage },
                { Icon: Activity,   label: 'Google Analytics 4',       color: '#7eb3d4' },
                { Icon: Facebook,   label: 'Facebook Ads',             color: C.fb },
                { Icon: Bot,        label: 'Bing / AI Search',         color: C.purple },
              ].map(({ Icon, label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 100, padding: '10px 18px' }}>
                  <Icon size={14} color={color} />
                  <span style={{ fontSize: 13, color: 'rgba(245,241,237,0.8)', fontWeight: 500 }}>{label}</span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
                </div>
              ))}
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(245,241,237,0.35)' }}>
              Works for single-location practices and multi-location groups. Each clinic gets its own view.
            </p>
          </Section>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ TRUST PILLARS */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <Section>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <Eyebrow>Infrastructure &amp; Trust</Eyebrow>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(26px,3.5vw,38px)', letterSpacing: '-0.02em', maxWidth: 560, margin: '8px auto 0' }}>
              Built to the standard your data deserves.
            </h2>
          </div>
        </Section>
        <div className="trust-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
          {[
            {
              icon: <ShieldCheck size={22} color={C.coral} />, bg: 'rgba(196,112,79,0.1)',
              title: 'Enterprise-Grade Security',
              body: 'Encrypted in transit and at rest. OAuth2 connections to Google & Meta — we never store your passwords. Role-based access so only the right people see the right numbers.',
              badge: 'SOC-2 Ready', badgeColor: C.coral, badgeBg: 'rgba(196,112,79,0.1)',
            },
            {
              icon: <Zap size={22} color={C.green} />, bg: 'rgba(16,185,129,0.1)',
              title: '99.9% Uptime, 24/7',
              body: 'Our infrastructure runs around the clock on globally distributed servers. Data syncs automatically every morning — whether it\'s 8 AM Monday or 2 AM Sunday.',
              badge: 'Always Online', badgeColor: C.green, badgeBg: 'rgba(16,185,129,0.1)',
            },
            {
              icon: <Database size={22} color={C.gold} />, bg: 'rgba(217,168,84,0.12)',
              title: 'Direct from Official APIs',
              body: 'Every number comes straight from Google Analytics 4, Search Console, Google Ads, GBP, Facebook Ads, and Bing. No scraping. No estimates. Real data, every time.',
              badge: 'Verified Sources', badgeColor: '#a07820', badgeBg: 'rgba(217,168,84,0.12)',
            },
            {
              icon: <Bot size={22} color={C.purple} />, bg: 'rgba(124,58,237,0.1)',
              title: 'AI Market Intelligence',
              body: 'Our AI bot monitors search trends, competitor activity, and algorithm shifts across Google, Bing, and AI platforms — proactive alerts before problems affect your practice.',
              badge: 'Always Watching', badgeColor: C.purple, badgeBg: 'rgba(124,58,237,0.1)',
            },
          ].map((t, i) => (
            <Section key={t.title} style={{ transitionDelay: `${i * 0.1}s` } as React.CSSProperties}>
              <div
                style={{ ...glass, padding: '28px 22px', height: '100%', transition: 'transform .25s, box-shadow .25s' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-4px)'; d.style.boxShadow = '0 16px 40px rgba(44,36,25,0.1)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(0)'; d.style.boxShadow = 'none'; }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 13, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  {t.icon}
                </div>
                <h3 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 16, margin: '0 0 10px', letterSpacing: '-0.01em' }}>{t.title}</h3>
                <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.65, margin: '0 0 16px' }}>{t.body}</p>
                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100, background: t.badgeBg, color: t.badgeColor }}>
                  {t.badge}
                </span>
              </div>
            </Section>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ FOUNDER */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 40px 96px', maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <Section>
          <div style={{ ...glass, padding: '56px 48px', background: 'linear-gradient(135deg, rgba(196,112,79,0.06) 0%, rgba(217,168,84,0.06) 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
              {[{ initial: 'K', color: C.coral }, { initial: 'A', color: C.gold }].map(av => (
                <div key={av.initial} style={{ width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(135deg, ${av.color}, ${av.color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 22, color: '#fff', boxShadow: `0 4px 14px ${av.color}44` }}>
                  {av.initial}
                </div>
              ))}
            </div>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(22px,3vw,30px)', letterSpacing: '-0.02em', margin: '0 0 20px' }}>
              Built by practice owners, for practice owners.
            </h2>
            <p style={{ fontSize: 16, color: C.text2, lineHeight: 1.8, margin: '0 0 20px', maxWidth: 580, marginLeft: 'auto', marginRight: 'auto' }}>
              &ldquo;We built MyChiropractice into a marketing agency running 100+ clients around the world — and we were doing it all manually, across dozens of tabs, every single morning. WiseCRM was the tool we needed and couldn&apos;t find. So we built it. Now every practice we work with gets the same real-time visibility we use to run their campaigns.&rdquo;
            </p>
            <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 15, color: C.dark, marginBottom: 4 }}>Kevin &amp; Ardavan Javid</div>
            <div style={{ fontSize: 13, color: C.text2 }}>Founders · MyChiropractice · Marketing Agency · 100+ clients worldwide</div>
          </div>
        </Section>
      </section>

      {/* ══════════════════════════════════════════════════════ FINAL CTA */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 40px 96px', maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
        <Section>
          <div style={{ background: C.coral, borderRadius: 24, padding: '64px 40px', boxShadow: '0 20px 60px rgba(196,112,79,0.3)' }}>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 'clamp(26px,4vw,40px)', color: '#fff', letterSpacing: '-0.02em', margin: '0 0 14px' }}>
              Your dashboard is ready.
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.8)', margin: '0 0 36px', lineHeight: 1.65 }}>
              Sign in to see how your practice performed this month — leads, spend, rankings, and calls, all in one place.
            </p>
            <button
              onClick={() => router.push('/login')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '16px 36px', background: '#fff', border: 'none', borderRadius: 100, color: C.coral, fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', transition: 'all .15s' }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.transform = 'translateY(-2px)'; b.style.boxShadow = '0 8px 28px rgba(0,0,0,0.2)'; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.transform = 'translateY(0)'; b.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'; }}
            >
              <LogIn size={18} /> Open My Dashboard
            </button>
            <div style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
              <CheckCircle2 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />
              Data updated this morning · 100+ clients worldwide
            </div>
          </div>
        </Section>
      </section>

      {/* ══════════════════════════════════════════════════════ FOOTER */}
      <footer style={{ textAlign: 'center', padding: '28px 24px', borderTop: '1px solid rgba(44,36,25,0.07)', color: 'rgba(44,36,25,0.35)', fontSize: 13 }}>
        © 2026 WiseCRM · A product of MyChiropractice · Kevin &amp; Ardavan Javid
      </footer>

    </div>
  );
}
