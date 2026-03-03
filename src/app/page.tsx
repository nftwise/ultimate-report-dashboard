'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Search, TrendingUp, MapPin, Bot, LogIn, Facebook,
  CheckCircle2, RefreshCw, ShieldCheck, Bell,
  Database, Zap, Activity, Lock, ArrowUpRight,
} from 'lucide-react';

// ─── shared ──────────────────────────────────────────────────────────────────
const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(44,36,25,0.08)',
  borderRadius: 20,
};

// ─── mock line chart (SVG) ────────────────────────────────────────────────────
function LineChartMock() {
  const W = 340, H = 120;
  const pts = [28,52,44,68,60,84,72,96,82,110,92,104];
  const xs = pts.map((_,i) => (i / (pts.length-1)) * W);
  const ys = pts.map(p => H - p);
  const path = xs.map((x,i) => `${i===0?'M':'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const area = path + ` L${W},${H} L0,${H} Z`;
  const months = ['Sep','Oct','Nov','Dec','Jan','Feb'];

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H+28}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c4704f" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#c4704f" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lg1)" />
        <path d={path} fill="none" stroke="#c4704f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* dots at 6 even points */}
        {[0,2,4,6,8,10].map(i => (
          <circle key={i} cx={xs[i]} cy={ys[i]} r="4" fill="#fff" stroke="#c4704f" strokeWidth="2" />
        ))}
        {/* month labels */}
        {months.map((m,i) => (
          <text key={m} x={(i/(months.length-1))*W} y={H+20} textAnchor="middle" fontSize="11" fill="#5c5850" fontFamily="Inter,sans-serif">{m}</text>
        ))}
      </svg>
    </div>
  );
}

// ─── mock donut chart (SVG) ───────────────────────────────────────────────────
function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const R = 54, r = 34, cx = 70, cy = 70;
  let angle = -Math.PI / 2;
  const total = segments.reduce((s,x) => s + x.value, 0);
  const arcs = segments.map(seg => {
    const a = (seg.value / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
    angle += a;
    const x2 = cx + R * Math.cos(angle), y2 = cy + R * Math.sin(angle);
    const xi1 = cx + r * Math.cos(angle - a), yi1 = cy + r * Math.sin(angle - a);
    const xi2 = cx + r * Math.cos(angle), yi2 = cy + r * Math.sin(angle);
    const large = a > Math.PI ? 1 : 0;
    const d = `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${xi2.toFixed(2)},${yi2.toFixed(2)} A${r},${r} 0 ${large} 0 ${xi1.toFixed(2)},${yi1.toFixed(2)} Z`;
    return { d, color: seg.color, label: seg.label, value: seg.value };
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
        {arcs.map(a => <path key={a.label} d={a.d} fill={a.color} />)}
        <text x="70" y="66" textAnchor="middle" fontSize="18" fontWeight="700" fill="#2c2419" fontFamily="Outfit,sans-serif">
          {segments[0].value}%
        </text>
        <text x="70" y="82" textAnchor="middle" fontSize="10" fill="#5c5850" fontFamily="Inter,sans-serif">Organic</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#5c5850' }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#2c2419', marginLeft: 'auto' }}>{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── mini bar spark ───────────────────────────────────────────────────────────
function BarSpark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
      {data.map((v,i) => (
        <div key={i} style={{ flex: 1, background: i === data.length-1 ? color : `${color}55`, borderRadius: 3, height: `${(v/max)*100}%`, transition: 'height 0.3s' }} />
      ))}
    </div>
  );
}

// ─── data ─────────────────────────────────────────────────────────────────────
const METRICS = [
  { label: 'Website Sessions', value: '1,284', change: '+12%', up: true },
  { label: 'New Patient Leads', value: '47', change: '+8%', up: true },
  { label: 'Ad Spend', value: '$2,340', change: '-4%', up: false },
  { label: 'GBP Profile Views', value: '3,910', change: '+21%', up: true },
  { label: 'Top 10 Keywords', value: '38', change: '+5', up: true },
  { label: 'Phone Calls', value: '93', change: '+14%', up: true },
];

const CHANNELS = [
  { icon: Search, color: '#9db5a0', bg: 'rgba(157,181,160,0.12)', title: 'SEO & Organic', desc: 'Sessions, rankings, and which keywords are driving real patients to your website.' },
  { icon: TrendingUp, color: '#c4704f', bg: 'rgba(196,112,79,0.1)', title: 'Google Ads', desc: 'Spend, impressions, clicks, and cost per lead — campaign-level detail with monthly comparison.' },
  { icon: Facebook, color: '#1877f2', bg: 'rgba(24,119,242,0.1)', title: 'Facebook Ads', desc: 'Ad reach, clicks, cost per result, and lead performance from your Meta campaigns.' },
  { icon: MapPin, color: '#d9a854', bg: 'rgba(217,168,84,0.12)', title: 'Google Business Profile', desc: 'Calls, direction requests, and profile views from your Google listing — daily.' },
  { icon: Bot, color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', title: 'AI & Bing Visibility', desc: 'Bing organic rankings plus how often your practice appears in ChatGPT, Perplexity, and Gemini.' },
  { icon: Activity, color: '#10b981', bg: 'rgba(16,185,129,0.1)', title: 'Site Health & Uptime', desc: '24/7 monitoring to make sure your website is live, fast, and fully indexed by Google.' },
];

const ADVANTAGES = [
  {
    icon: Database, color: '#c4704f', bg: 'rgba(196,112,79,0.1)',
    title: 'We Keep Your Data Forever',
    body: 'Google Analytics only stores data for 14 months by default. We pull and store your historical data permanently — so you can always compare this month to 2 years ago.',
    highlight: 'Google: 14 months · WiseCRM: unlimited',
  },
  {
    icon: Zap, color: '#d9a854', bg: 'rgba(217,168,84,0.12)',
    title: "Straight from Google's API",
    body: 'Your data comes directly from Google Analytics, Google Ads, Search Console, and GBP APIs — no third-party filters, no estimates. The exact same numbers Google shows internally.',
    highlight: '100% accurate · No sampling',
  },
  {
    icon: Bell, color: '#9db5a0', bg: 'rgba(157,181,160,0.12)',
    title: 'Auto-Alerts to Your Account Team',
    body: 'When your leads drop or sessions fall unexpectedly, your account manager gets an instant alert — before you even notice. They act, you relax.',
    highlight: 'Proactive, not reactive',
  },
  {
    icon: Activity, color: '#10b981', bg: 'rgba(16,185,129,0.1)',
    title: '24/7 Site Audit & Monitoring',
    body: 'We continuously check your website\'s performance, uptime, and indexing status. If something breaks, we know — and fix it — before it costs you patients.',
    highlight: 'Always-on protection',
  },
];

// ─── page ─────────────────────────────────────────────────────────────────────
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
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#f5f1ed 0%,#ede8e3 100%)', fontFamily: 'Inter,sans-serif', color: '#2c2419' }}>

      {/* ── Nav ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(245,241,237,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(44,36,25,0.07)', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>
          Wise<span style={{ color: '#c4704f' }}>CRM</span>
        </span>
        <button onClick={() => router.push('/login')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 20px', background: '#c4704f', border: 'none', borderRadius: 100, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 3px 12px rgba(196,112,79,0.3)', transition: 'background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#b05f40'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#c4704f'; }}>
          <LogIn size={14} /> Sign In
        </button>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '96px 24px 64px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(196,112,79,0.1)', borderRadius: 100, marginBottom: 24 }}>
          <Lock size={12} color="#c4704f" />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#c4704f', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Direct from Google API · Stored forever</span>
        </div>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(32px,5.5vw,54px)', lineHeight: 1.1, letterSpacing: '-0.025em', margin: '0 0 20px' }}>
          Your Practice's Marketing<br />
          <span style={{ color: '#c4704f' }}>Performance, at a Glance.</span>
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.65, color: '#5c5850', maxWidth: 560, margin: '0 auto 14px' }}>
          Google Analytics, Search Console, Google Ads, Facebook Ads, GBP, and AI visibility — all synced every morning into one clear dashboard.
        </p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#9db5a0', margin: '0 auto 40px' }}>
          Trusted data. Updated daily. Stored <span style={{ color: '#2c2419' }}>forever</span>.
        </p>
        <button onClick={() => router.push('/login')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '16px 36px', background: '#c4704f', border: 'none', borderRadius: 100, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 24px rgba(196,112,79,0.35)', transition: 'all 0.15s' }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#b05f40'; b.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#c4704f'; b.style.transform = 'translateY(0)'; }}>
          <LogIn size={18} /> View My Dashboard
        </button>
      </section>

      {/* ── Metrics strip ── */}
      <section style={{ maxWidth: 1000, margin: '0 auto 72px', padding: '0 24px' }}>
        <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#9db5a0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
          Example snapshot — what you'll see inside
        </p>
        <div style={{ ...glass, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 0 }}>
          {METRICS.map((m,i) => (
            <div key={m.label} style={{ padding: '22px 16px', textAlign: 'center', borderRight: i < METRICS.length-1 ? '1px solid rgba(44,36,25,0.06)' : 'none' }}>
              <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4 }}>{m.value}</div>
              <div style={{ fontSize: 10, color: '#5c5850', marginBottom: 8, lineHeight: 1.3 }}>{m.label}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 100, background: m.up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)', color: m.up ? '#10b981' : '#ef4444' }}>
                {m.up ? '↑' : '↓'} {m.change}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Charts Section ── */}
      <section style={{ maxWidth: 1000, margin: '0 auto 88px', padding: '0 24px' }}>
        <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(24px,3.5vw,36px)', letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 40px' }}>
          Visual reports. No spreadsheets.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>

          {/* Line Chart Card */}
          <div style={{ ...glass, padding: '28px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Website Sessions</div>
                <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em' }}>1,284</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.1)', borderRadius: 100, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: '#10b981' }}>
                <ArrowUpRight size={12} /> +12%
              </div>
            </div>
            <LineChartMock />
            <div style={{ fontSize: 11, color: '#9db5a0', textAlign: 'center', marginTop: 4 }}>Last 6 months vs. previous period</div>
          </div>

          {/* Donut Chart Card */}
          <div style={{ ...glass, padding: '28px 24px' }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Traffic Sources</div>
              <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em' }}>3,910 visits</div>
            </div>
            <DonutChart segments={[
              { label: 'Organic Search', value: 45, color: '#9db5a0' },
              { label: 'Google Ads', value: 28, color: '#c4704f' },
              { label: 'Facebook Ads', value: 15, color: '#1877f2' },
              { label: 'Direct & Other', value: 12, color: '#ede8e3' },
            ]} />
            <div style={{ fontSize: 11, color: '#9db5a0', textAlign: 'center', marginTop: 14 }}>This month · All channels combined</div>
          </div>

          {/* Bar Spark Card */}
          <div style={{ ...glass, padding: '28px 24px' }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>New Patient Leads</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em' }}>47</span>
                <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>↑ 8% vs last month</span>
              </div>
            </div>
            <BarSpark data={[22,31,28,39,35,41,38,47]} color="#c4704f" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
              {[
                { label: 'From Google Ads', value: '24', color: '#c4704f' },
                { label: 'From Facebook', value: '11', color: '#1877f2' },
                { label: 'From Organic SEO', value: '8', color: '#9db5a0' },
                { label: 'From GBP Calls', value: '4', color: '#d9a854' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#5c5850', lineHeight: 1.2 }}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2419' }}>{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#9db5a0', textAlign: 'center', marginTop: 14 }}>Last 8 months</div>
          </div>

        </div>
      </section>

      {/* ── Channels ── */}
      <section style={{ maxWidth: 1000, margin: '0 auto 88px', padding: '0 24px' }}>
        <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(24px,3.5vw,36px)', letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 12px' }}>Every channel. One screen.</h2>
        <p style={{ textAlign: 'center', fontSize: 15, color: '#5c5850', margin: '0 0 36px' }}>No more logging into 6 different platforms. Everything is here, updated automatically every morning.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
          {CHANNELS.map(c => {
            const Icon = c.icon;
            return (
              <div key={c.title} style={{ ...glass, padding: '24px 22px', transition: 'all 0.2s', display: 'flex', gap: 16, alignItems: 'flex-start' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-3px)'; d.style.boxShadow = '0 12px 32px rgba(44,36,25,0.09)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(0)'; d.style.boxShadow = 'none'; }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Icon size={18} color={c.color} strokeWidth={2} />
                </div>
                <div>
                  <h3 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 15, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{c.title}</h3>
                  <p style={{ fontSize: 13, color: '#5c5850', lineHeight: 1.55, margin: 0 }}>{c.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Why WiseCRM ── */}
      <section style={{ maxWidth: 1000, margin: '0 auto 88px', padding: '0 24px' }}>
        <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(24px,3.5vw,36px)', letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 12px' }}>Built to protect your practice's data.</h2>
        <p style={{ textAlign: 'center', fontSize: 15, color: '#5c5850', margin: '0 0 36px' }}>Not just a dashboard — a system that watches your marketing 24/7 so your team can focus on patients.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
          {ADVANTAGES.map(a => {
            const Icon = a.icon;
            return (
              <div key={a.title} style={{ ...glass, padding: '28px 24px' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Icon size={20} color={a.color} strokeWidth={2} />
                </div>
                <h3 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 15, margin: '0 0 10px', letterSpacing: '-0.01em' }}>{a.title}</h3>
                <p style={{ fontSize: 13, color: '#5c5850', lineHeight: 1.6, margin: '0 0 14px' }}>{a.body}</p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: a.color, background: a.bg, padding: '4px 10px', borderRadius: 100 }}>
                  <CheckCircle2 size={11} /> {a.highlight}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Dark trust banner ── */}
      <section style={{ maxWidth: 1000, margin: '0 auto 88px', padding: '0 24px' }}>
        <div style={{ background: 'rgba(44,36,25,0.96)', borderRadius: 24, padding: '48px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 32, alignItems: 'center' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#d9a854', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>Our Commitment to You</div>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(22px,3vw,32px)', color: '#f5f1ed', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
              Your data. Your history. Always here.
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(245,241,237,0.6)', lineHeight: 1.65, margin: 0, maxWidth: 480 }}>
              Unlike Google Analytics which limits history to 14 months, we archive every data point permanently. Compare this year to 2020 if you want. It's all here.
            </p>
          </div>
          {[
            { icon: Database, label: 'Data retained', value: 'Forever', sub: 'Google keeps 14 months', color: '#d9a854' },
            { icon: Zap, label: 'Data source', value: 'Google API', sub: '100% accurate, no estimates', color: '#9db5a0' },
            { icon: RefreshCw, label: 'Sync frequency', value: 'Daily', sub: 'Every morning at 10 AM', color: '#c4704f' },
            { icon: ShieldCheck, label: 'Uptime monitoring', value: '24/7', sub: 'Site health & indexing', color: '#10b981' },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Icon size={16} color={s.color} />
                <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 22, color: '#f5f1ed', letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(245,241,237,0.4)', lineHeight: 1.4 }}>{s.sub}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ maxWidth: 560, margin: '0 auto 96px', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ ...glass, padding: '52px 36px' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(196,112,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={24} color="#c4704f" />
          </div>
          <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 'clamp(22px,3.5vw,32px)', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
            Your report is ready.
          </h2>
          <p style={{ fontSize: 15, color: '#5c5850', lineHeight: 1.65, margin: '0 0 32px', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
            Sign in to see this week's sessions, leads, ad spend, and local visibility — updated this morning.
          </p>
          <button onClick={() => router.push('/login')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 32px', background: '#c4704f', border: 'none', borderRadius: 100, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 20px rgba(196,112,79,0.35)', transition: 'background 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#b05f40'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#c4704f'; }}>
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
