'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { fmtNum, fmtCurrency, fmtPct } from '@/lib/format';

interface MoMData {
  pct: string;
  type: 'up' | 'down' | 'neutral';
}

interface ExecutiveSummaryCardsProps {
  totalSpend: number;
  totalConversions: number;
  costPerLead: number;
  conversionRate: number;
  spendTrend?: number;
  conversionsTrend?: number;
  momSpend?: MoMData;
  momConversions?: MoMData;
  momCpa?: MoMData;
  momCtr?: MoMData;
  periodLabel?: string;
}

export default function ExecutiveSummaryCards({
  totalSpend,
  totalConversions,
  costPerLead,
  conversionRate,
  spendTrend,
  conversionsTrend,
  momSpend,
  momConversions,
  momCpa,
  momCtr,
  periodLabel
}: ExecutiveSummaryCardsProps) {
  // CPL color based on MoM direction (improved = green, worsened = red, neutral = gold)
  const getCPLColor = () => {
    if (costPerLead === 0) return { text: '#5c5850', bg: 'rgba(92, 88, 80, 0.08)' };
    if (momCpa?.type === 'up') return { text: '#10b981', bg: 'rgba(16, 185, 129, 0.08)' }; // Improved (lower CPL = up MoM)
    if (momCpa?.type === 'down') return { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)' }; // Worsened
    return { text: '#d9a854', bg: 'rgba(217, 168, 84, 0.08)' }; // Neutral
  };

  const cplColor = getCPLColor();

  const renderMoMBadge = (mom?: MoMData) => {
    if (!mom || !periodLabel) return null;
    const color = mom.type === 'up' ? '#10b981' : mom.type === 'down' ? '#ef4444' : '#9ca3af';
    return (
      <p style={{
        fontSize: '11px',
        fontWeight: '600',
        color,
        margin: '4px 0 0 0'
      }}>
        {mom.pct} <span style={{ fontWeight: '400', color: '#9ca3af' }}>{periodLabel}</span>
      </p>
    );
  };

  return (
    <div style={{ marginBottom: '32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{
          fontSize: '11px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#5c5850',
          margin: 0
        }}>
          Campaign Results
        </p>
      </div>

      {/* 4-Grid Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '16px'
      }}>
        {/* Card 1: Total Ad Spend */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(44, 36, 25, 0.1)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 30px rgba(44, 36, 25, 0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(44, 36, 25, 0.08)';
        }}>
          <p style={{
            fontSize: '10px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#5c5850',
            margin: '0 0 12px 0'
          }}>
            Total Ad Spend
          </p>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#2c2419',
            marginBottom: '8px',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {fmtCurrency(totalSpend)}
          </div>
          <p style={{
            fontSize: '11px',
            color: '#9ca3af',
            margin: 0
          }}>
            Campaign budget spent
          </p>
          {renderMoMBadge(momSpend)}
        </div>

        {/* Card 2: Total Conversions (Bold) */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(44, 36, 25, 0.1)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 30px rgba(44, 36, 25, 0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(44, 36, 25, 0.08)';
        }}>
          <p style={{
            fontSize: '10px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#5c5850',
            margin: '0 0 12px 0'
          }}>
            Total Conversions
          </p>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: totalConversions > 0 ? '#10b981' : '#ef4444',
            marginBottom: '8px',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {fmtNum(Math.round(totalConversions))}
          </div>
          <p style={{
            fontSize: '11px',
            color: '#9ca3af',
            margin: 0
          }}>
            Customer leads generated
          </p>
          {renderMoMBadge(momConversions)}
        </div>

        {/* Card 3: Cost Per Lead (Color coded) */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(44, 36, 25, 0.1)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 30px rgba(44, 36, 25, 0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(44, 36, 25, 0.08)';
        }}>
          <p style={{
            fontSize: '10px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#5c5850',
            margin: '0 0 12px 0'
          }}>
            Cost Per Lead
          </p>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: cplColor.text,
            marginBottom: '8px',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {fmtCurrency(costPerLead)}
          </div>
          <p style={{
            fontSize: '11px',
            color: '#9ca3af',
            margin: 0
          }}>
            Spend per conversion
          </p>
          {renderMoMBadge(momCpa)}
        </div>

        {/* Card 4: Conversion Rate */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(44, 36, 25, 0.1)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 30px rgba(44, 36, 25, 0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(44, 36, 25, 0.08)';
        }}>
          <p style={{
            fontSize: '10px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#5c5850',
            margin: '0 0 12px 0'
          }}>
            Conversion Rate
          </p>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#d9a854',
            marginBottom: '8px',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {fmtPct(conversionRate, 2)}
          </div>
          <p style={{
            fontSize: '11px',
            color: '#9ca3af',
            margin: 0
          }}>
            Of ad clicks that became leads
          </p>
          {renderMoMBadge(momCtr)}
        </div>
      </div>
    </div>
  );
}
