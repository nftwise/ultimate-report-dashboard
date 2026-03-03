'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Search, TrendingUp, MapPin, Bot, LogIn,
  Clock, Bell, BarChart3, ArrowUpRight, CheckCircle2,
  Zap, Users, Calendar, ChevronRight,
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(44,36,25,0.08)',
  borderRadius: 20,
};

function CoralBtn({ children, onClick, large }: { children: React.ReactNode; onClick: () => void; large?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: large ? '16px 36px' : '11px 24px',
        background: '#c4704f', border: 'none', borderRadius: 100,
        color: '#fff', fontSize: large ? 16 : 14, fontWeight: 600,
        cursor: 'pointer', boxShadow: '0 4px 20px rgba(196,112,79,0.3)',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.background = '#b05f40';
        b.style.transform = 'translateY(-2px)';
        b.style.boxShadow = '0 8px 28px rgba(196,112,79,0.4)';
      }}
      onMouseLeave={e => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.background = '#c4704f';
        b.style.transform = 'translateY(0)';
        b.style.boxShadow = '0 4px 20px rgba(196,112,79,0.3)';
      }}
    >
      {children}
    </button>
  );
}

// ─── data ────────────────────────────────────────────────────────────────────
const STATS = [
  { value: '25+', label: 'Active Practices', icon: Users },
  { value: '6', label: 'Data Sources Connected', icon: Zap },
  { value: '10:00 AM', label: 'Auto-sync Daily', icon: Clock },
  { value: '100%', label: 'Automated — Zero Manual Work', icon: CheckCircle2 },
];

const FEATURES = [
  {
    icon: Search, color: '#9db5a0', bg: 'rgba(157,181,160,0.12)',
    title: 'SEO & Organic Traffic',
    bullets: [
      'GA4 sessions, new users, bounce rate',
      'Top 10 keyword rankings from Google Search Console',
      'Month-over-month traffic comparison',
      'Landing page performance breakdown',
    ],
  },
  {
    icon: TrendingUp, color: '#c4704f', bg: 'rgba(196,112,79,0.1)',
    title: 'Google Ads Performance',
    bullets: [
      'Spend, impressions, clicks, conversions',
      'Cost per lead — calculated correctly, no double-count',
      'Campaign-level breakdown with trend charts',
      'Spend vs. leads combo chart',
    ],
  },
  {
    icon: MapPin, color: '#d9a854', bg: 'rgba(217,168,84,0.12)',
    title: 'Google Business Profile',
    bullets: [
      'Profile views, calls, direction requests',
      'Website click-throughs from GBP listing',
      'Daily trends with 30/90-day history',
      'Multi-location support',
    ],
  },
  {
    icon: Bot, color: '#7c3aed', bg: 'rgba(124,58,237,0.1)',
    title: 'GEO / AI Visibility',
    bullets: [
      'Bing organic clicks, impressions, avg. position',
      'AI citation tracking (ChatGPT, Perplexity, Gemini)',
      'News mention monitoring',
      'Page-level visibility breakdown',
    ],
  },
];

const HOW_IT_WORKS = [
  {
    step: '01', color: '#9db5a0',
    title: 'Connect Once',
    desc: 'Link your Google Analytics, Google Ads, Search Console, and GBP accounts. One-time setup per client.',
  },
  {
    step: '02', color: '#c4704f',
    title: 'Auto-sync Every Day',
    desc: 'At 10:00 AM, our pipeline pulls fresh data from all 6 sources and rolls it into a unified summary.',
  },
  {
    step: '03', color: '#d9a854',
    title: 'Instant Alerts',
    desc: 'Telegram notifications fire automatically when leads drop >20% or sessions drop >30% — before your client notices.',
  },
  {
    step: '04', color: '#7c3aed',
    title: 'Share With Clients',
    desc: 'Each practice gets their own login. They see their data only — no configuration, no confusion.',
  },
];

const TIME_SAVINGS = [
  { task: 'Pull GA4 data manually', before: '45 min/week', after: 'Automated', saving: '45 min' },
  { task: 'Check Google Ads across accounts', before: '60 min/week', after: 'Automated', saving: '60 min' },
  { task: 'Compile monthly report', before: '3–4 hrs/month', after: '< 5 min', saving: '3+ hrs' },
  { task: 'Monitor GBP performance', before: '30 min/week', after: 'Automated', saving: '30 min' },
];

// ─── page ────────────────────────────────────────────────────────────────────
export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const role = (session.user as any).role;
      router.push(role === 'admin' || role === 'team' ? '/admin-dashboard' : '/dashboard');
    }
  }, [status, session, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f1ed' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(196,112,79,0.2)', borderTopColor: '#c4704f', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f5f1ed 0%, #ede8e3 100%)', fontFamily: 'Inter, sans-serif', color: '#2c2419' }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(245,241,237,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44,36,25,0.07)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: '100%',
      }}>
        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>
          Wise<span style={{ color: '#c4704f' }}>CRM</span>
        </span>
        <button
          onClick={() => router.push('/login')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 20px', background: 'transparent', border: '1.5px solid #c4704f', borderRadius: 100, color: '#c4704f', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#c4704f'; b.style.color = '#fff'; }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'transparent'; b.style.color = '#c4704f'; }}
        >
          <LogIn size={14} />
          Sign In
        </button>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '100px 24px 72px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(196,112,79,0.1)', borderRadius: 100, marginBottom: 24 }}>
          <Zap size={13} color="#c4704f" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#c4704f', letterSpacing: '0.04em', textTransform: 'uppercase' }}>All data sources. One dashboard.</span>
        </div>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 'clamp(34px, 5.5vw, 58px)', lineHeight: 1.1, letterSpacing: '-0.025em', margin: '0 0 20px' }}>
          Stop Chasing Reports.<br />
          <span style={{ color: '#c4704f' }}>Start Making Decisions.</span>
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.65, color: '#5c5850', maxWidth: 560, margin: '0 auto 16px' }}>
          WiseCRM connects Google Analytics, Search Console, Google Ads, GBP, and Bing — syncing automatically every morning so your team always has fresh data.
        </p>
        <p style={{ fontSize: 15, color: '#9db5a0', fontWeight: 600, margin: '0 0 40px' }}>
          Save <span style={{ color: '#2c2419' }}>5+ hours per week</span> per client. Zero manual data pulling.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <CoralBtn onClick={() => router.push('/login')} large>
            <LogIn size={17} />
            Access Your Dashboard
          </CoralBtn>
          <button
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '16px 28px', background: 'transparent', border: '1.5px solid rgba(44,36,25,0.15)', borderRadius: 100, color: '#5c5850', fontSize: 15, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2c2419'; (e.currentTarget as HTMLButtonElement).style.color = '#2c2419'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(44,36,25,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = '#5c5850'; }}
          >
            See what's included <ChevronRight size={15} />
          </button>
        </div>
      </section>

      {/* ── Stats Strip ── */}
      <section style={{ maxWidth: 1080, margin: '0 auto 80px', padding: '0 24px' }}>
        <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 0 }}>
          {STATS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.label} style={{
                padding: '28px 24px', textAlign: 'center',
                borderRight: i < STATS.length - 1 ? '1px solid rgba(44,36,25,0.07)' : 'none',
              }}>
                <Icon size={18} color="#c4704f" style={{ marginBottom: 8 }} />
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em', color: '#2c2419', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#5c5850', marginTop: 6, lineHeight: 1.4 }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ maxWidth: 1080, margin: '0 auto 100px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 'clamp(26px, 4vw, 38px)', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
            Every channel. Every metric.
          </h2>
          <p style={{ fontSize: 16, color: '#5c5850', maxWidth: 480, margin: '0 auto' }}>
            Built specifically for chiropractic and healthcare practices — tracking what actually drives patient growth.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div key={f.title}
                style={{ ...card, padding: '28px 24px', transition: 'all 0.2s ease' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-4px)'; d.style.boxShadow = '0 16px 40px rgba(44,36,25,0.1)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(0)'; d.style.boxShadow = 'none'; }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Icon size={20} color={f.color} strokeWidth={2} />
                </div>
                <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 16, margin: '0 0 14px', letterSpacing: '-0.01em' }}>{f.title}</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {f.bullets.map(b => (
                    <li key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#5c5850', lineHeight: 1.5 }}>
                      <CheckCircle2 size={13} color={f.color} style={{ flexShrink: 0, marginTop: 2 }} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Time Savings ── */}
      <section style={{ maxWidth: 1080, margin: '0 auto 100px', padding: '0 24px' }}>
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '36px 36px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
            <div>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 'clamp(22px, 3vw, 32px)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>
                Hours back every week.
              </h2>
              <p style={{ fontSize: 15, color: '#5c5850', margin: 0 }}>What your team stops doing manually the moment WiseCRM goes live.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(157,181,160,0.15)', borderRadius: 12, padding: '12px 20px' }}>
              <Clock size={18} color="#9db5a0" />
              <div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 24, color: '#2c2419', lineHeight: 1 }}>5+ hrs</div>
                <div style={{ fontSize: 11, color: '#5c5850', marginTop: 2 }}>saved per client/week</div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(44,36,25,0.07)' }}>
            {TIME_SAVINGS.map((row, i) => (
              <div key={row.task} style={{
                display: 'grid', gridTemplateColumns: '1fr 160px 160px 120px',
                gap: 16, padding: '16px 36px', alignItems: 'center',
                background: i % 2 === 0 ? 'transparent' : 'rgba(44,36,25,0.02)',
                borderBottom: i < TIME_SAVINGS.length - 1 ? '1px solid rgba(44,36,25,0.05)' : 'none',
              }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#2c2419' }}>{row.task}</div>
                <div style={{ fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  {row.before}
                </div>
                <div style={{ fontSize: 13, color: '#10b981', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                  {row.after}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9db5a0', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowUpRight size={13} />
                  -{row.saving}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ maxWidth: 1080, margin: '0 auto 100px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 'clamp(26px, 4vw, 38px)', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
            Live in minutes. Runs itself.
          </h2>
          <p style={{ fontSize: 16, color: '#5c5850' }}>No engineering required. No spreadsheets. No reminders.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {HOW_IT_WORKS.map(h => (
            <div key={h.step} style={{ ...card, padding: '28px 24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 52, color: 'rgba(44,36,25,0.05)', position: 'absolute', top: 12, right: 20, lineHeight: 1, userSelect: 'none' }}>{h.step}</div>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: h.color, marginBottom: 16 }} />
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 16, margin: '0 0 10px', letterSpacing: '-0.01em' }}>{h.title}</h3>
              <p style={{ fontSize: 13.5, color: '#5c5850', lineHeight: 1.6, margin: 0 }}>{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Alerts callout ── */}
      <section style={{ maxWidth: 1080, margin: '0 auto 100px', padding: '0 24px' }}>
        <div style={{ ...card, background: 'rgba(44,36,25,0.97)', border: 'none', padding: '48px 40px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 32, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Bell size={18} color="#d9a854" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#d9a854', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Proactive Alerts</span>
            </div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 'clamp(22px, 3vw, 32px)', color: '#f5f1ed', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
              Know before your client asks.
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(245,241,237,0.6)', lineHeight: 1.6, margin: '0 0 8px', maxWidth: 520 }}>
              Automatic Telegram alerts fire when a client's leads drop by more than 20% or sessions fall 30% week-over-week.
            </p>
            <p style={{ fontSize: 14, color: '#9db5a0', margin: 0 }}>
              <BarChart3 size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Powered by a 7-day rolling comparison — no thresholds to configure.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 220 }}>
            {[
              { icon: '⚠️', client: 'Southport Chiro', msg: 'Leads ↓ 34% this week', color: '#ef4444' },
              { icon: '✅', client: 'Tails Animal Chiro', msg: 'Sessions +18% vs last week', color: '#10b981' },
              { icon: '⚠️', client: 'Hood Chiropractic', msg: 'Ad spend up, conv. flat', color: '#d9a854' },
            ].map(a => (
              <div key={a.client} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14 }}>{a.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#f5f1ed', marginBottom: 2 }}>{a.client}</div>
                  <div style={{ fontSize: 11, color: a.color }}>{a.msg}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA bottom ── */}
      <section style={{ maxWidth: 680, margin: '0 auto 100px', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ ...card, padding: '56px 40px' }}>
          <Calendar size={28} color="#c4704f" style={{ marginBottom: 20 }} />
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: '-0.02em', margin: '0 0 14px' }}>
            Your data is already waiting.
          </h2>
          <p style={{ fontSize: 16, color: '#5c5850', lineHeight: 1.6, margin: '0 0 32px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
            Sign in to see this week's sessions, ad spend, conversions, and local visibility — updated this morning.
          </p>
          <CoralBtn onClick={() => router.push('/login')} large>
            <LogIn size={17} />
            Access Your Dashboard
          </CoralBtn>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ textAlign: 'center', padding: '24px', borderTop: '1px solid rgba(44,36,25,0.07)', color: '#5c5850', fontSize: 13 }}>
        © 2026 WiseCRM · Contact your administrator
      </footer>

    </div>
  );
}
