'use client';

import React, { useMemo } from 'react';
import { Phone, Clock, MapPin, TrendingUp } from 'lucide-react';

interface CallRecord {
  id: string;
  date: string;
  phone_number?: string;
  call_duration?: number;
  call_type?: string;
  call_source?: string;
  qualified_lead?: boolean;
}

interface GoogleAdsCallMetricsProps {
  calls: CallRecord[];
  totalLeads: number;
}

export default function GoogleAdsCallMetrics({
  calls,
  totalLeads
}: GoogleAdsCallMetricsProps) {
  const stats = useMemo(() => {
    if (!calls || calls.length === 0) {
      return {
        totalCalls: 0,
        qualifiedLeads: 0,
        avgDuration: 0,
        callsPercent: 0
      };
    }

    const totalCalls = calls.length;
    const qualifiedLeads = calls.filter(c => c.qualified_lead).length;
    const totalDuration = calls.reduce((sum, c) => sum + (c.call_duration || 0), 0);
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
    const callsPercent = totalLeads > 0 ? (totalCalls / totalLeads) * 100 : 0;

    return {
      totalCalls,
      qualifiedLeads,
      avgDuration: Math.round(avgDuration),
      callsPercent
    };
  }, [calls, totalLeads]);

  // Group calls by type/source
  const callsByType = useMemo(() => {
    if (!calls || calls.length === 0) return new Map();

    const typeMap = new Map();
    calls.forEach(call => {
      const type = call.call_type || 'Unknown';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    return typeMap;
  }, [calls]);

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
          ☎️ Call Metrics
        </p>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#2c2419',
          margin: '0 0 16px 0',
          letterSpacing: '-0.02em'
        }}>
          Google Ads Phone Calls
        </h3>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginTop: '12px'
        }}>
          {/* Total Calls */}
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
              Total Calls
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#c4704f',
              margin: 0
            }}>
              {stats.totalCalls}
            </p>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '4px 0 0 0',
              fontWeight: '500'
            }}>
              {stats.callsPercent.toFixed(1)}% of total leads
            </p>
          </div>

          {/* Qualified Leads */}
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
              Qualified Leads
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#10b981',
              margin: 0
            }}>
              {stats.qualifiedLeads}
            </p>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '4px 0 0 0',
              fontWeight: '500'
            }}>
              {stats.totalCalls > 0 ? ((stats.qualifiedLeads / stats.totalCalls) * 100).toFixed(1) : 0}% conversion
            </p>
          </div>

          {/* Avg Duration */}
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
              Avg Duration
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#d9a854',
              margin: 0
            }}>
              {stats.avgDuration}s
            </p>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '4px 0 0 0',
              fontWeight: '500'
            }}>
              Per call
            </p>
          </div>

          {/* Call Quality */}
          <div style={{
            background: 'rgba(157, 181, 160, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #9db5a0'
          }}>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '0 0 4px 0',
              fontWeight: '600'
            }}>
              Quality Score
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#9db5a0',
              margin: 0
            }}>
              {stats.totalCalls > 0 ? (stats.qualifiedLeads > 0 ? '⭐⭐⭐⭐' : '⭐⭐⭐') : '—'}
            </p>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '4px 0 0 0',
              fontWeight: '500'
            }}>
              Based on conversions
            </p>
          </div>
        </div>
      </div>

      {/* Call Types Breakdown */}
      {callsByType.size > 0 && (
        <div style={{
          marginBottom: '20px',
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
            Calls by Type
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px'
          }}>
            {Array.from(callsByType.entries()).map(([type, count]) => (
              <div key={type} style={{
                padding: '10px',
                background: 'rgba(255, 255, 255, 0.5)',
                borderRadius: '8px',
                border: '1px solid rgba(44, 36, 25, 0.1)'
              }}>
                <p style={{
                  fontSize: '10px',
                  color: '#5c5850',
                  margin: '0 0 4px 0',
                  fontWeight: '600'
                }}>
                  {type}
                </p>
                <p style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#c4704f',
                  margin: 0
                }}>
                  {count}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Calls Table */}
      {calls && calls.length > 0 ? (
        <div style={{ marginTop: '20px' }}>
          <p style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#5c5850',
            margin: '0 0 12px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Recent Calls ({calls.length})
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '11px'
            }}>
              <thead>
                <tr style={{
                  borderBottom: '1px solid rgba(44, 36, 25, 0.1)',
                  background: 'rgba(44, 36, 25, 0.03)'
                }}>
                  <th style={{
                    padding: '8px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#5c5850',
                    fontSize: '10px',
                    textTransform: 'uppercase'
                  }}>
                    Date
                  </th>
                  <th style={{
                    padding: '8px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#5c5850',
                    fontSize: '10px',
                    textTransform: 'uppercase'
                  }}>
                    Phone
                  </th>
                  <th style={{
                    padding: '8px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#5c5850',
                    fontSize: '10px',
                    textTransform: 'uppercase'
                  }}>
                    Type
                  </th>
                  <th style={{
                    padding: '8px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#5c5850',
                    fontSize: '10px',
                    textTransform: 'uppercase'
                  }}>
                    Duration
                  </th>
                  <th style={{
                    padding: '8px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#5c5850',
                    fontSize: '10px',
                    textTransform: 'uppercase'
                  }}>
                    Qualified
                  </th>
                </tr>
              </thead>
              <tbody>
                {calls.slice(0, 10).map((call, idx) => (
                  <tr
                    key={call.id || idx}
                    style={{
                      borderBottom: '1px solid rgba(44, 36, 25, 0.05)'
                    }}
                  >
                    <td style={{
                      padding: '8px',
                      color: '#5c5850'
                    }}>
                      {call.date}
                    </td>
                    <td style={{
                      padding: '8px',
                      fontWeight: '500',
                      color: '#2c2419'
                    }}>
                      {call.phone_number ? call.phone_number.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : '—'}
                    </td>
                    <td style={{
                      padding: '8px',
                      textAlign: 'center',
                      color: '#5c5850'
                    }}>
                      {call.call_type || '—'}
                    </td>
                    <td style={{
                      padding: '8px',
                      textAlign: 'center',
                      color: '#d9a854',
                      fontWeight: '500'
                    }}>
                      {call.call_duration ? `${call.call_duration}s` : '—'}
                    </td>
                    <td style={{
                      padding: '8px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: call.qualified_lead ? '#10b981' : '#ef4444'
                    }}>
                      {call.qualified_lead ? '✅ Yes' : '❌ No'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          color: '#9ca3af'
        }}>
          <Phone style={{ width: '32px', height: '32px', opacity: 0.3, margin: '0 auto 12px' }} />
          <p>No call data available for this period</p>
        </div>
      )}

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
          💡 <strong>Insight:</strong> {stats.totalCalls > 0
            ? `${stats.callsPercent.toFixed(1)}% of leads are from phone calls. Focus on call quality and follow-up speed to improve conversion rates.`
            : 'Track incoming calls to measure phone lead quality and improve response times.'}
        </p>
      </div>
    </div>
  );
}
