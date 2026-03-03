'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Search, TrendingUp, MapPin, Bot, LogIn } from 'lucide-react';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const role = (session.user as any).role;
      if (role === 'admin' || role === 'team') {
        router.push('/admin-dashboard');
      } else {
        router.push('/dashboard');
      }
    }
  }, [status, session, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f1ed' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid rgba(196,112,79,0.2)',
          borderTopColor: '#c4704f',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const features = [
    {
      icon: Search,
      color: '#9db5a0',
      bgColor: 'rgba(157,181,160,0.12)',
      title: 'SEO & Organic',
      description: 'GA4 sessions, keyword rankings, and traffic trends — all tracked automatically every day.',
    },
    {
      icon: TrendingUp,
      color: '#c4704f',
      bgColor: 'rgba(196,112,79,0.1)',
      title: 'Google Ads',
      description: 'Campaign spend, conversions, and cost per lead with month-over-month comparison.',
    },
    {
      icon: MapPin,
      color: '#d9a854',
      bgColor: 'rgba(217,168,84,0.12)',
      title: 'Google Business',
      description: 'Calls, direction requests, and profile views from your Google Business listing.',
    },
    {
      icon: Bot,
      color: '#7c3aed',
      bgColor: 'rgba(124,58,237,0.1)',
      title: 'GEO / AI Visibility',
      description: 'Bing organic rankings, AI citation tracking, and search visibility trends.',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f5f1ed 0%, #ede8e3 100%)', fontFamily: 'Inter, sans-serif' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(245,241,237,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44,36,25,0.07)',
        padding: '0 24px',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'Outfit, Inter, sans-serif',
            fontWeight: 800, fontSize: 20,
            color: '#2c2419', letterSpacing: '-0.02em',
          }}>
            Wise<span style={{ color: '#c4704f' }}>CRM</span>
          </span>
        </div>
        <button
          onClick={() => router.push('/login')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 20px',
            background: 'transparent',
            border: '1.5px solid #c4704f',
            borderRadius: 100,
            color: '#c4704f',
            fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#c4704f';
            (e.currentTarget as HTMLButtonElement).style.color = '#fff';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = '#c4704f';
          }}
        >
          <LogIn size={14} />
          Sign In
        </button>
      </nav>

      {/* Hero */}
      <section style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '96px 24px 80px',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: 'Outfit, Inter, sans-serif',
          fontWeight: 700,
          fontSize: 'clamp(32px, 5vw, 52px)',
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: '#2c2419',
          margin: '0 0 20px',
        }}>
          Marketing Intelligence<br />
          <span style={{ color: '#c4704f' }}>Built for Your Practice</span>
        </h1>
        <p style={{
          fontSize: 18, lineHeight: 1.6,
          color: '#5c5850', margin: '0 0 40px',
          maxWidth: 520, marginLeft: 'auto', marginRight: 'auto',
        }}>
          Real-time SEO, Google Ads, GBP, and AI visibility — all in one dashboard.
        </p>
        <button
          onClick={() => router.push('/login')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 32px',
            background: '#c4704f',
            border: 'none',
            borderRadius: 100,
            color: '#fff',
            fontSize: 15, fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(196,112,79,0.35)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#b05f40';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 28px rgba(196,112,79,0.45)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#c4704f';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(196,112,79,0.35)';
          }}
        >
          <LogIn size={16} />
          Access Your Dashboard
        </button>
      </section>

      {/* Features Grid */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 100px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
        }}>
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                style={{
                  background: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44,36,25,0.08)',
                  borderRadius: 16,
                  padding: '28px 24px',
                  transition: 'all 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 30px rgba(44,36,25,0.12)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: 44, height: 44,
                  borderRadius: 12,
                  background: f.bgColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <Icon size={20} color={f.color} strokeWidth={2} />
                </div>
                <h3 style={{
                  fontFamily: 'Outfit, Inter, sans-serif',
                  fontWeight: 700, fontSize: 16,
                  color: '#2c2419', margin: '0 0 8px',
                  letterSpacing: '-0.01em',
                }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#5c5850', margin: 0 }}>
                  {f.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '24px',
        borderTop: '1px solid rgba(44,36,25,0.07)',
        color: '#5c5850',
        fontSize: 13,
      }}>
        © 2026 WiseCRM · Contact your administrator
      </footer>
    </div>
  );
}
