'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LayoutDashboard, Search, TrendingUp, MapPin, ArrowLeft, Bot } from 'lucide-react';

interface ClientTabBarProps {
  clientSlug: string;
  clientName?: string;
  clientCity?: string;
  activeTab: 'overview' | 'seo' | 'google-ads' | 'gbp' | 'geo';
}

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: LayoutDashboard, href: '',          badge: null },
  { id: 'seo',         label: 'SEO',         icon: Search,          href: '/seo',       badge: null },
  { id: 'google-ads',  label: 'Google Ads',  icon: TrendingUp,      href: '/google-ads',badge: null },
  { id: 'gbp',         label: 'GBP',         icon: MapPin,          href: '/gbp',       badge: null },
  { id: 'geo',         label: 'GEO / AI',    icon: Bot,             href: '/geo',       badge: 'NEW' },
] as const;

export default function ClientTabBar({ clientSlug, clientName, clientCity, activeTab }: ClientTabBarProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const isClient = (session?.user as any)?.role === 'client';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.98)',
      borderBottom: '1px solid rgba(44,36,25,0.08)',
      backdropFilter: 'blur(12px)',
      padding: '0 24px',
    }}>
      {/* Top row: back (admin/team only) + client name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '14px', paddingBottom: '10px' }}>
        {!isClient && (
          <>
            <button
              onClick={() => router.push('/admin-dashboard')}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#9ca3af', fontSize: '12px', fontWeight: 500, padding: '4px 0',
                transition: 'color 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#c4704f')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
            >
              <ArrowLeft size={13} />
              All Clients
            </button>
            <span style={{ color: '#d1d5db', fontSize: '12px' }}>/</span>
          </>
        )}
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#2c2419' }}>{clientName || clientSlug}</span>
        {clientCity && <span style={{ fontSize: '12px', color: '#9ca3af' }}>{clientCity}</span>}
      </div>

      {/* Tab row */}
      <div style={{ display: 'flex', gap: '0', borderTop: '1px solid rgba(44,36,25,0.06)' }}>
        {TABS.map(({ id, label, icon: Icon, href, badge }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => router.push(`/admin-dashboard/${clientSlug}${href}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 18px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: active ? 600 : 500,
                color: active ? '#c4704f' : '#6b7280',
                borderBottom: active ? '2px solid #c4704f' : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget.style.color = '#2c2419'); }}
              onMouseLeave={e => { if (!active) (e.currentTarget.style.color = '#6b7280'); }}
            >
              <Icon size={13} strokeWidth={active ? 2.2 : 1.8} />
              {label}
              {badge && (
                <span style={{
                  fontSize: '9px', fontWeight: 700, padding: '1px 5px',
                  borderRadius: '4px', background: 'rgba(107,70,193,0.12)',
                  color: '#6b46c1', letterSpacing: '0.04em',
                }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
