'use client';

import React from 'react';
import { Phone, MessageSquare, TrendingUp } from 'lucide-react';

interface PhoneCallsSummaryProps {
  phoneCalls: number;
  formFills: number;
  gbpCalls: number;
  totalLeads: number;
}

export default function PhoneCallsSummary({
  phoneCalls,
  formFills,
  gbpCalls,
  totalLeads
}: PhoneCallsSummaryProps) {
  const phoneCallsPercent = totalLeads > 0 ? (phoneCalls / totalLeads) * 100 : 0;
  const formFillsPercent = totalLeads > 0 ? (formFills / totalLeads) * 100 : 0;
  const gbpCallsPercent = totalLeads > 0 ? (gbpCalls / totalLeads) * 100 : 0;

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(44, 36, 25, 0.1)',
      borderRadius: '24px',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{
          fontSize: '11px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#5c5850',
          margin: '0 0 8px 0'
        }}>
          ☎️ Lead Channels
        </p>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#2c2419',
          margin: '0 0 16px 0',
          letterSpacing: '-0.02em'
        }}>
          How Leads Are Generated
        </h3>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginTop: '12px'
        }}>
          {/* Phone Calls from Ads */}
          <div style={{
            background: 'rgba(196, 112, 79, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #c4704f'
          }}>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '0 0 4px 0',
              fontWeight: '600'
            }}>
              Phone Calls
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#c4704f',
              margin: 0
            }}>
              {phoneCalls}
            </p>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '4px 0 0 0',
              fontWeight: '500'
            }}>
              {phoneCallsPercent.toFixed(1)}% of leads
            </p>
          </div>

          {/* Form Fills */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #10b981'
          }}>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '0 0 4px 0',
              fontWeight: '600'
            }}>
              Form Fills
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#10b981',
              margin: 0
            }}>
              {formFills}
            </p>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '4px 0 0 0',
              fontWeight: '500'
            }}>
              {formFillsPercent.toFixed(1)}% of leads
            </p>
          </div>

          {/* GBP Calls */}
          <div style={{
            background: 'rgba(217, 168, 84, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #d9a854'
          }}>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '0 0 4px 0',
              fontWeight: '600'
            }}>
              GBP Calls
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#d9a854',
              margin: 0
            }}>
              {gbpCalls}
            </p>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '4px 0 0 0',
              fontWeight: '500'
            }}>
              {gbpCallsPercent.toFixed(1)}% of leads
            </p>
          </div>
        </div>
      </div>

      {/* Lead Breakdown Bar */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: 'rgba(44, 36, 25, 0.03)',
        borderRadius: '12px'
      }}>
        <p style={{
          fontSize: '11px',
          fontWeight: '600',
          color: '#5c5850',
          margin: '0 0 12px 0',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Total Leads Distribution
        </p>

        {/* Stacked Progress Bar */}
        <div style={{
          display: 'flex',
          height: '32px',
          borderRadius: '8px',
          overflow: 'hidden',
          background: 'rgba(44, 36, 25, 0.05)',
          border: '1px solid rgba(44, 36, 25, 0.1)',
          marginBottom: '12px'
        }}>
          {phoneCalls > 0 && (
            <div style={{
              flex: phoneCalls,
              background: '#c4704f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '11px',
              fontWeight: '700',
              minWidth: '40px'
            }}>
              {phoneCallsPercent > 5 && `${phoneCallsPercent.toFixed(0)}%`}
            </div>
          )}
          {formFills > 0 && (
            <div style={{
              flex: formFills,
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '11px',
              fontWeight: '700',
              minWidth: '40px'
            }}>
              {formFillsPercent > 5 && `${formFillsPercent.toFixed(0)}%`}
            </div>
          )}
          {gbpCalls > 0 && (
            <div style={{
              flex: gbpCalls,
              background: '#d9a854',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '11px',
              fontWeight: '700',
              minWidth: '40px'
            }}>
              {gbpCallsPercent > 5 && `${gbpCallsPercent.toFixed(0)}%`}
            </div>
          )}
          {totalLeads === 0 && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: '12px'
            }}>
              No lead data
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          fontSize: '11px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#c4704f' }}></div>
            <span style={{ color: '#5c5850' }}>Phone: {phoneCalls}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#10b981' }}></div>
            <span style={{ color: '#5c5850' }}>Forms: {formFills}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#d9a854' }}></div>
            <span style={{ color: '#5c5850' }}>GBP: {gbpCalls}</span>
          </div>
        </div>
      </div>

      {/* Footer Insight */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: 'rgba(44, 36, 25, 0.03)',
        borderRadius: '8px',
        borderLeft: '3px solid #2c2419'
      }}>
        <p style={{
          fontSize: '11px',
          color: '#5c5850',
          margin: 0,
          lineHeight: '1.5'
        }}>
          💡 <strong>Insight:</strong> {totalLeads > 0
            ? `${((phoneCalls / totalLeads) * 100).toFixed(0)}% of leads come via phone calls. Focus on answering calls quickly to maximize conversions.`
            : 'No lead data available for this period.'}
        </p>
      </div>
    </div>
  );
}
