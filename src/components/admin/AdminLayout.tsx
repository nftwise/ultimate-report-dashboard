'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';

const ChatWidget = dynamic(() => import('@/components/portal/ChatWidget'), { ssr: false });
import {
  LayoutDashboard,
  Users,
  Activity,
  ChevronRight,
  LogOut,
  Briefcase,
  Search,
  TrendingUp,
  MapPin,
  Bot,
  Menu,
  X,
  BarChart2,
  Settings,
  Facebook,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin-dashboard', icon: LayoutDashboard },
  { label: 'Clients', href: '/admin-dashboard/clients', icon: Briefcase },
  { label: 'Users', href: '/admin-dashboard/users', icon: Users },
];

const SETTINGS_ITEMS = [
  { label: 'FB Onboarding', href: '/admin-dashboard/settings/onboard-fb', icon: Facebook },
];

const CLIENT_TABS = [
  { id: 'overview',   label: 'Overview',    icon: LayoutDashboard, href: '',            badge: null },
  { id: 'seo',        label: 'SEO',         icon: Search,          href: '/seo',        badge: null },
  { id: 'google-ads', label: 'Google Ads',  icon: TrendingUp,      href: '/google-ads', badge: null },
  { id: 'gbp',        label: 'GBP',         icon: MapPin,          href: '/gbp',        badge: null },
  { id: 'geo',        label: 'GEO / AI',    icon: Bot,             href: '/geo',        badge: 'NEW' },
] as const;

function formatSlug(slug: string) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const sidebarStyles = {
  base: {
    width: '220px',
    minWidth: '220px',
    background: 'linear-gradient(180deg, #f9f7f4 0%, #f5f1ed 100%)',
    borderRight: '1px solid rgba(44,36,25,0.1)',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    height: '100vh',
    overflowY: 'auto' as const,
  },
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const userEmail = (session?.user as any)?.email || '';
  const userRole = (session?.user as any)?.role || '';
  const isClient = userRole === 'client';

  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/admin-dashboard') return pathname === '/admin-dashboard';
    return pathname?.startsWith(href) ?? false;
  };

  const navButtonStyle = (active: boolean) => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center' as const,
    gap: '10px',
    padding: '11px 14px',
    marginBottom: '2px',
    borderRadius: '8px',
    border: active ? '1.5px solid rgba(196,112,79,0.35)' : '1.5px solid transparent',
    background: active ? 'rgba(196,112,79,0.08)' : 'transparent',
    color: active ? '#c4704f' : '#5c5850',
    fontSize: '13px',
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    transition: 'all 150ms ease',
    textAlign: 'left' as const,
  });

  // Client login: left sidebar with page tabs
  if (isClient) {
    const parts = pathname?.split('/') || [];
    const clientSlug = parts[2] || '';
    const activeTabId = parts[3] || 'overview';
    const clientDisplayName = clientSlug ? formatSlug(clientSlug) : 'Portal';

    return (
      <div className="flex min-h-screen" style={{ background: 'linear-gradient(135deg, #f5f1ed 0%, #ede8e3 100%)' }}>

        {/* Mobile top bar */}
        <div
          className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center h-14 px-4 gap-3"
          style={{ background: '#f9f7f4', borderBottom: '1px solid rgba(44,36,25,0.1)' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#2c2419' }}
          >
            <Menu size={20} />
          </button>
          <span style={{ fontSize: '17px', fontWeight: 800, color: '#2c2419', letterSpacing: '-0.01em' }}>
            {clientDisplayName}
          </span>
        </div>

        {/* Mobile backdrop */}
        {mobileOpen && (
          <div
            className="md:hidden fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed md:sticky top-0 z-50 md:z-auto transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
          style={sidebarStyles.base}
        >
          {/* Mobile close button */}
          <button
            className="md:hidden absolute top-4 right-4"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            style={{ padding: '4px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#5c5850' }}
          >
            <X size={18} />
          </button>

          {/* Client name */}
          <div style={{ padding: '24px 20px 18px 20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#2c2419', letterSpacing: '-0.01em', marginBottom: '2px' }}>
              {clientDisplayName}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Client Portal</div>
          </div>

          {/* Tab nav */}
          <nav style={{ flex: 1, padding: '0 8px' }}>
            {CLIENT_TABS.map(({ id, label, icon: Icon, href, badge }) => {
              const active = activeTabId === id;
              const dest = `/admin-dashboard/${clientSlug}${href}`;
              return (
                <button
                  key={id}
                  onClick={() => { router.push(dest); setMobileOpen(false); }}
                  style={navButtonStyle(active)}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(44,36,25,0.04)';
                      (e.currentTarget as HTMLElement).style.color = '#2c2419';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = '#5c5850';
                    }
                  }}
                >
                  <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {badge && (
                    <span style={{
                      fontSize: '9px', fontWeight: 700, padding: '1px 5px',
                      borderRadius: '4px', background: 'rgba(107,70,193,0.12)',
                      color: '#6b46c1', letterSpacing: '0.04em',
                    }}>
                      {badge}
                    </span>
                  )}
                  {active && !badge && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
                </button>
              );
            })}
          </nav>

          {/* Bottom: email + account + logout */}
          <div style={{ padding: '12px 8px 20px 8px', borderTop: '1px solid rgba(44,36,25,0.08)', marginTop: 'auto' }}>
            <div style={{ padding: '6px 14px 10px', fontSize: '11px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail}
            </div>
            {(() => {
              const settingsHref = `/portal/${clientSlug}/settings`;
              const settingsActive = pathname === settingsHref;
              return (
                <button
                  onClick={() => { router.push(settingsHref); setMobileOpen(false); }}
                  style={navButtonStyle(settingsActive)}
                  onMouseEnter={e => {
                    if (!settingsActive) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(44,36,25,0.04)';
                      (e.currentTarget as HTMLElement).style.color = '#2c2419';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!settingsActive) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = '#5c5850';
                    }
                  }}
                >
                  <Settings size={15} strokeWidth={settingsActive ? 2.2 : 1.8} />
                  <span>My Account</span>
                </button>
              );
            })()}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              aria-label="Logout"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '9px 14px', borderRadius: '8px',
                border: '1px solid rgba(196,112,79,0.2)',
                background: 'transparent', color: '#c4704f',
                fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(196,112,79,0.06)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <LogOut size={13} />
              Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
          {/* Spacer for mobile fixed top bar */}
          <div className="md:hidden h-14" />
          {children}
        </main>
      </div>
    );
  }

  // Admin / Team: full sidebar layout
  return (
    <div className="flex min-h-screen" style={{ background: 'linear-gradient(135deg, #f5f1ed 0%, #ede8e3 100%)' }}>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center h-14 px-4 gap-3"
        style={{ background: '#f9f7f4', borderBottom: '1px solid rgba(44,36,25,0.1)' }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#2c2419' }}
        >
          <Menu size={20} />
        </button>
        <span style={{ fontSize: '18px', fontWeight: 800, color: '#2c2419', fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.02em' }}>
          Wise<span style={{ color: '#c4704f' }}>CRM</span>
        </span>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-50 md:z-auto transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={sidebarStyles.base}
      >
        {/* Mobile close button */}
        <button
          className="md:hidden absolute top-4 right-4"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
          style={{ padding: '4px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#5c5850' }}
        >
          <X size={18} />
        </button>

        {/* Logo */}
        <div style={{ padding: '24px 20px 20px 20px' }}>
          <span style={{
            fontSize: '20px',
            fontWeight: 800,
            color: '#2c2419',
            fontFamily: '"Outfit", sans-serif',
            letterSpacing: '-0.02em',
          }}>
            Wise<span style={{ color: '#c4704f' }}>CRM</span>
          </span>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '0 8px' }}>
          {NAV_ITEMS.filter(({ label }) => {
            if (isClient && (label === 'Clients' || label === 'Users')) return false;
            return true;
          }).map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <button
                key={href}
                onClick={() => { router.push(href); setMobileOpen(false); }}
                style={navButtonStyle(active)}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(44,36,25,0.04)';
                    (e.currentTarget as HTMLElement).style.color = '#2c2419';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = '#5c5850';
                  }
                }}
              >
                <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                <span>{label}</span>
                {active && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
              </button>
            );
          })}

          {/* Settings section */}
          <div style={{ margin: '14px 0 6px', padding: '0 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af' }}>
              <Settings size={11} />
              Settings
            </div>
          </div>
          {SETTINGS_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <button
                key={href}
                onClick={() => { router.push(href); setMobileOpen(false); }}
                style={navButtonStyle(active)}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(44,36,25,0.04)';
                    (e.currentTarget as HTMLElement).style.color = '#2c2419';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = '#5c5850';
                  }
                }}
              >
                <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                <span>{label}</span>
                {active && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
              </button>
            );
          })}
        </nav>

        {/* Bottom: user info + logout */}
        <div style={{
          padding: '12px 8px 20px 8px',
          borderTop: '1px solid rgba(44,36,25,0.08)',
          marginTop: 'auto',
        }}>
          <div style={{ padding: '8px 14px', marginBottom: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#2c2419', marginBottom: '2px', textTransform: 'capitalize' }}>
              {userRole}
            </div>
            <div style={{
              fontSize: '11px',
              color: '#9ca3af',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '170px',
            }}>
              {userEmail}
            </div>
          </div>
          <button
            onClick={() => { router.push('/admin-dashboard/settings'); setMobileOpen(false); }}
            style={navButtonStyle(pathname === '/admin-dashboard/settings')}
            onMouseEnter={e => {
              if (pathname !== '/admin-dashboard/settings') {
                (e.currentTarget as HTMLElement).style.background = 'rgba(44,36,25,0.04)';
                (e.currentTarget as HTMLElement).style.color = '#2c2419';
              }
            }}
            onMouseLeave={e => {
              if (pathname !== '/admin-dashboard/settings') {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = '#5c5850';
              }
            }}
          >
            <Settings size={15} strokeWidth={pathname === '/admin-dashboard/settings' ? 2.2 : 1.8} />
            <span>My Account</span>
            {pathname === '/admin-dashboard/settings' && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            aria-label="Logout"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(196,112,79,0.2)',
              background: 'transparent',
              color: '#c4704f',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(196,112,79,0.06)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <LogOut size={13} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
        {/* Spacer for mobile fixed top bar */}
        <div className="md:hidden h-14" />
        {children}
      </main>

      {/* AI Chat — admin/team only */}
      <ChatWidget role={userRole} />
    </div>
  );
}
