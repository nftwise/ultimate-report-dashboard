'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

interface SidebarProps {
  clientSlug: string;
}

type Section = 'overview' | 'google-ads' | 'seo' | 'gbp';

export default function ClientDetailsSidebar({ clientSlug }: SidebarProps) {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const pathname = usePathname();

  const sections: Array<{ id: Section; label: string; icon: string; description: string }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: '📊',
      description: 'Marketing Overview'
    },
    {
      id: 'google-ads',
      label: 'Google Ads',
      icon: '📈',
      description: 'Google Ads Performance'
    },
    {
      id: 'seo',
      label: 'SEO',
      icon: '🔍',
      description: 'SEO Analytics'
    },
    {
      id: 'gbp',
      label: 'Google Business',
      icon: '📍',
      description: 'GBP Performance'
    }
  ];

  // Determine active section based on pathname
  let currentSection: Section = 'overview';
  if (pathname && pathname.includes('/google-ads')) currentSection = 'google-ads';
  else if (pathname && pathname.includes('/seo')) currentSection = 'seo';
  else if (pathname && pathname.includes('/gbp')) currentSection = 'gbp';

  return (
    <div style={{
      width: '240px',
      background: 'linear-gradient(180deg, #f9f7f4 0%, #f5f1ed 100%)',
      borderRight: '1px solid rgba(44, 36, 25, 0.1)',
      padding: '24px 0',
      display: 'flex',
      flexDirection: 'column',
      height: 'auto'
    }}>
      {/* Sidebar Title */}
      <div style={{ padding: '0 16px 24px 16px', borderBottom: '1px solid rgba(44, 36, 25, 0.1)' }}>
        <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 4px 0' }}>
          ANALYTICS
        </p>
        <p style={{ fontSize: '11px', color: '#5c5850', margin: 0 }}>Select Section</p>
      </div>

      {/* Navigation Buttons */}
      <div style={{ padding: '12px 8px', flex: 1 }}>
        {sections.map((section) => {
          const isActive = currentSection === section.id;
          const href = section.id === 'overview'
            ? `/admin-dashboard/${clientSlug}`
            : `/admin-dashboard/${clientSlug}/${section.id}`;

          return (
            <Link key={section.id} href={href}>
              <button
                onClick={() => setActiveSection(section.id)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  margin: '0 0 8px 0',
                  background: isActive ? 'rgba(196, 112, 79, 0.1)' : 'transparent',
                  border: isActive ? '2px solid #c4704f' : '2px solid transparent',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: isActive ? '#c4704f' : '#5c5850',
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <span style={{ fontSize: '16px' }}>{section.icon}</span>
                <span>{section.label}</span>
                <span style={{ fontSize: '10px', fontWeight: '400', color: isActive ? '#c4704f' : '#9ca3af' }}>
                  {section.description}
                </span>
              </button>
            </Link>
          );
        })}
      </div>

      {/* Footer Info */}
      <div style={{ padding: '16px', borderTop: '1px solid rgba(44, 36, 25, 0.1)', textAlign: 'center' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>
          Last Updated
        </p>
        <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: '600', margin: '4px 0 0 0' }}>
          Today
        </p>
      </div>
    </div>
  );
}
