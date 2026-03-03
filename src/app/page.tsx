'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Search, TrendingUp, MapPin, Bot, LogIn,
  CheckCircle2, RefreshCw, ShieldCheck, BarChart3,
} from 'lucide-react';

// ─── shared styles ────────────────────────────────────────────────────────────
const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(44,36,25,0.08)',
  borderRadius: 20,
};

// ─── data ─────────────────────────────────────────────────────────────────────
const CHANNELS = [
  {
    icon: Search, color: '#9db5a0', bg: 'rgba(157,181,160,0.12)',
    title: 'SEO & Organic',
    desc: 'See how many people found your practice on Google — sessions, new visitors, and which keywords are driving traffic.',
  },
  {
    icon: TrendingUp, color: '#c4704f', bg: 'rgba(196,112,79,0.1)',
    title: 'Google Ads',
    desc: 'Track every dollar of your ad spend. See impressions, clicks, and exactly how many leads your campaigns generated.',
  },
  {
    icon: MapPin, color: '#d9a854', bg: 'rgba(217,168,84,0.12)',
    title: 'Google Business',
    desc: 'Monitor calls, direction requests, and profile views from your Google Business listing — updated daily.',
  },
  {
    icon: Bot, color: '#7c3aed', bg: 'rgba(124,58,237,0.1)',
    title: 'AI & Bing Visibility',
    desc: 'Track how your practice appears in Bing search results and AI-powered tools like ChatGPT and Perplexity.',
  },
];

const TRUST_POINTS = [
  { icon: RefreshCw, text: 'Data refreshes automatically every morning — no action needed from you.' },
  { icon: ShieldCheck, text: 'Your data is private. Only you and your team can see your practice\'s numbers.' },
  { icon: BarChart3, text: 'Month-over-month comparison built in — instantly see if you\'re growing.' },
];

// ─── metric preview cards (mock but realistic) ────────────────────────────────
const PREVIEW_METRICS = [
  { label: 'Website Sessions', value: '1,284', change: '+12%', up: true },
  { label: 'New Patients (Leads)', value: '47', change: '+8%', up: true },
  { label: 'Ad Spend', value: '$2,340', change: '-4%', up: false },
  { label: 'GBP Profile Views', value: '3,910', change: '+21%', up: true },
  { label: 'Google Ranking Keywords', value: '38', change: '+5', up: true },
  { label: 'Phone Calls', value: '93', change: '+14%', up: true },
];

// ─── page ──────────────────────────────────────────────────────────────────────
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
      }}>
        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>
          Wise<span style={{ color: '#c4704f' }}>CRM</span>
        </span>
        <button
          onClick={() => router.push('/login')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 20px', background: '#c4704f', border: 'none', borderRadius: 100, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 3px 12px rgba(196,112,79,0.3)', transition: 'all 0.15s ease' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#b05f40'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#c4704f'; }}
        >
          <LogIn size={14} /> Sign In
        </button>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 780, margin: '0 auto', padding: '88px 24px 64px', textAlign: 'center' }}>
        <h1 style={{
          fontFamily: 'Outfit, sans-serif', fontWeight: 700,
          fontSize: 'clamp(32px, 5.5vw, 54px)',
          lineHeight: 1.1, letterSpacing: '-0.025em', margin: '0 0 20px',
        }}>
          Your Practice's Marketing<br />
          <span style={{ color: '#c4704f' }}>Performance, at a Glance.</span>
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.65, color: '#5c5850', maxWidth: 540, margin: '0 auto 36px' }}>
          See exactly how your website, ads, and Google listing are performing — all in one place, updated every morning automatically.
        </p>
        <button
          onClick={() => router.push('/login')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 9,
            padding: '16px 36px', background: '#c4704f', border: 'none',
            borderRadius: 100, color: '#fff', fontSize: 16, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 6px 24px rgba(196,112,79,0.35)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background = '#b05f40'; b.style.transform = 'translateY(-2px)';
            b.style.boxShadow = '0 10px 30px rgba(196,112,79,0.45)';
          }}
          onMouseLeave={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background = '#c4704f'; b.style.transform = 'translateY(0)';
            b.style.boxShadow = '0 6px 24px rgba(196,112,79,0.35)';
          }}
        >
          <LogIn size={18} />
          View My Dashboard
        </button>
      </section>

      {/* ── Metrics Preview ── */}
      <section style={{ maxWidth: 960, margin: '0 auto 88px', padding: '0 24px' }}>
        <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#9db5a0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
          Example — what you'll see inside your dashboard
        </p>
        <div style={{ ...glass, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 0 }}>
          {PREVIEW_METRICS.map((m, i) => (
            <div key={m.label} style={{
              padding: '24px 20px', textAlign: 'center',
              borderRight: i < PREVIEW_METRICS.length - 1 ? '1px solid rgba(44,36,25,0.06)' : 'none',
            }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4 }}>{m.value}</div>
              <div style={{ fontSize: 11, color: '#5c5850', marginBottom: 8, lineHeight: 1.3 }}>{m.label}</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 100,
                background: m.up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                color: m.up ? '#10b981' : '#ef4444',
              }}>
                {m.up ? '↑' : '↓'} {m.change}
              </div>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(44,36,25,0.35)', marginTop: 12 }}>
          Compared to previous month · Updated daily
        </p>
      </section>

      {/* ── What's included ── */}
      <section style={{ maxWidth: 960, margin: '0 auto 88px', padding: '0 24px' }}>
        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 3.5vw, 36px)', letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 12px' }}>
          Everything tracked, automatically.
        </h2>
        <p style={{ textAlign: 'center', fontSize: 15, color: '#5c5850', margin: '0 0 40px' }}>
          No logins to multiple platforms. No spreadsheets. Everything in one screen.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {CHANNELS.map(c => {
            const Icon = c.icon;
            return (
              <div key={c.title}
                style={{ ...glass, padding: '26px 22px', transition: 'all 0.2s ease' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-4px)'; d.style.boxShadow = '0 16px 40px rgba(44,36,25,0.1)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(0)'; d.style.boxShadow = 'none'; }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 12, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Icon size={19} color={c.color} strokeWidth={2} />
                </div>
                <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 15, margin: '0 0 8px', letterSpacing: '-0.01em' }}>{c.title}</h3>
                <p style={{ fontSize: 13, color: '#5c5850', lineHeight: 1.6, margin: 0 }}>{c.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Trust points ── */}
      <section style={{ maxWidth: 680, margin: '0 auto 88px', padding: '0 24px' }}>
        <div style={{ ...glass, padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {TRUST_POINTS.map(t => {
            const Icon = t.icon;
            return (
              <div key={t.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(196,112,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color="#c4704f" strokeWidth={2} />
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: '#5c5850', margin: 0 }}>{t.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{ maxWidth: 580, margin: '0 auto 96px', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ ...glass, padding: '52px 36px' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(196,112,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={24} color="#c4704f" />
          </div>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 'clamp(22px, 3.5vw, 32px)', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
            Your report is ready.
          </h2>
          <p style={{ fontSize: 15, color: '#5c5850', lineHeight: 1.65, margin: '0 0 32px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
            Sign in to view your latest numbers — sessions, calls, ad performance, and more. Updated as of this morning.
          </p>
          <button
            onClick={() => router.push('/login')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '15px 32px', background: '#c4704f', border: 'none',
              borderRadius: 100, color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 4px 20px rgba(196,112,79,0.35)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#b05f40'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#c4704f'; }}
          >
            <LogIn size={16} /> View My Dashboard
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ textAlign: 'center', padding: '24px', borderTop: '1px solid rgba(44,36,25,0.07)', color: 'rgba(44,36,25,0.35)', fontSize: 13 }}>
        © 2026 WiseCRM · Questions? Contact your account manager.
      </footer>

    </div>
  );
}
