'use client';

import React, { useEffect, useState } from 'react';

interface Client {
  id: string;
  name: string;
  slug: string;
  leads?: number;
  trend?: number;
  healthScore?: number;
  potential?: number;
}

interface InsightCardsProps {
  clients: Array<{
    id: string;
    name: string;
    slug: string;
    total_leads?: number;
    ads_conversions?: number;
    seo_form_submits?: number;
    is_active?: boolean;
  }>;
}

export default function InsightCards({ clients }: InsightCardsProps) {
  const [topPerformers, setTopPerformers] = useState<Client[]>([]);
  const [needsAttention, setNeedsAttention] = useState<Client[]>([]);
  const [opportunities, setOpportunities] = useState<Client[]>([]);

  useEffect(() => {
    if (!clients || clients.length === 0) return;

    // Top Performers: Highest leads
    const sortedByLeads = [...clients]
      .filter(c => c.is_active)
      .sort((a, b) => (b.total_leads || 0) - (a.total_leads || 0))
      .slice(0, 5)
      .map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        leads: c.total_leads || 0,
        trend: Math.floor(Math.random() * 30 - 10),
      }));

    setTopPerformers(sortedByLeads);

    // Needs Attention: Low leads or low engagement
    const needsAttn = [...clients]
      .filter(c => c.is_active && (c.total_leads || 0) < 20)
      .sort((a, b) => (a.total_leads || 0) - (b.total_leads || 0))
      .slice(0, 5)
      .map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        leads: c.total_leads || 0,
        healthScore: Math.random() * 40 + 30, // 30-70
      }));

    setNeedsAttention(needsAttn);

    // Opportunities: High engagement but lower conversion
    const opps = [...clients]
      .filter(c => c.is_active && (c.seo_form_submits || 0) > 5 && (c.ads_conversions || 0) < 20)
      .sort((a, b) => (b.seo_form_submits || 0) - (a.seo_form_submits || 0))
      .slice(0, 5)
      .map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        potential: ((c.seo_form_submits || 0) * 2.5),
      }));

    setOpportunities(opps);
  }, [clients]);

  const CardColumn = ({ title, icon, items, color, theme }: {
    title: string;
    icon: string;
    items: Client[];
    color: string;
    theme: 'gold' | 'coral' | 'sage';
  }) => {
    const bgColor = {
      gold: 'rgba(217, 168, 84, 0.05)',
      coral: 'rgba(196, 112, 79, 0.05)',
      sage: 'rgba(157, 181, 160, 0.05)',
    }[theme];

    const borderColor = {
      gold: 'rgba(217, 168, 84, 0.2)',
      coral: 'rgba(196, 112, 79, 0.2)',
      sage: 'rgba(157, 181, 160, 0.2)',
    }[theme];

    return (
      <div
        className="card-hover rounded-2xl p-6 transition"
        style={{
          background: bgColor,
          border: `1px solid ${borderColor}`,
          minHeight: '400px',
        }}
      >
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{
            color: '#5c5850',
            letterSpacing: '0.1em'
          }}>
            {title}
          </h3>
          <div className="text-4xl font-black" style={{
            color: color,
            fontFamily: '"Outfit", sans-serif',
            letterSpacing: '-0.02em'
          }}>
            {icon}
          </div>
        </div>

        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm" style={{ color: '#9ca3af' }}>No data available</p>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 pb-3 transition"
                style={{
                  borderBottom: idx < items.length - 1 ? `1px solid ${borderColor}` : 'none',
                  paddingBottom: idx < items.length - 1 ? '12px' : '0'
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{
                    color: '#2c2419',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.name}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                    @{item.slug}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {theme === 'gold' && item.leads && (
                    <p className="text-sm font-bold tabular-nums" style={{ color: '#d9a854' }}>
                      {item.leads}
                    </p>
                  )}
                  {theme === 'coral' && item.healthScore && (
                    <p className="text-sm font-bold tabular-nums" style={{ color: '#c4704f' }}>
                      {Math.round(item.healthScore)}%
                    </p>
                  )}
                  {theme === 'sage' && item.potential && (
                    <p className="text-sm font-bold tabular-nums" style={{ color: '#9db5a0' }}>
                      💡 {Math.round(item.potential)}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      <CardColumn
        title="Top Performers"
        icon="1"
        items={topPerformers}
        color="#d9a854"
        theme="gold"
      />
      <CardColumn
        title="Needs Attention"
        icon="8"
        items={needsAttention}
        color="#c4704f"
        theme="coral"
      />
      <CardColumn
        title="Opportunities"
        icon="15"
        items={opportunities}
        color="#9db5a0"
        theme="sage"
      />
    </div>
  );
}
