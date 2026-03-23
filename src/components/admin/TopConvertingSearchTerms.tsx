'use client';

import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { fmtCurrency } from '@/lib/format';

interface ConvertingSearchTerm {
  term: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number;
  conversionRate: number;
}

interface TopConvertingSearchTermsProps {
  data: ConvertingSearchTerm[];
  limit?: number;
}

export default function TopConvertingSearchTerms({
  data,
  limit = 10
}: TopConvertingSearchTermsProps) {
  const topTerms = useMemo(() => {
    return (data || [])
      .filter(term => term.conversions > 0)
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, limit);
  }, [data, limit]);

  const totalConversions = topTerms.reduce((sum, t) => sum + t.conversions, 0);
  const totalCost = topTerms.reduce((sum, t) => sum + t.cost, 0);

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
          Top Converting Search Terms
        </p>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#2c2419',
          margin: '0 0 16px 0',
          letterSpacing: '-0.02em'
        }}>
          What Customers Are Searching For
        </h3>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginTop: '12px'
        }}>
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
              Top Terms
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#10b981',
              margin: 0
            }}>
              {topTerms.length}
            </p>
          </div>

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
              Total Conversions
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#d9a854',
              margin: 0
            }}>
              {totalConversions}
            </p>
          </div>

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
              Total Cost
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#9db5a0',
              margin: 0
            }}>
              {fmtCurrency(totalCost)}
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      {topTerms.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px'
          }}>
            <thead>
              <tr style={{
                borderBottom: '2px solid rgba(44, 36, 25, 0.15)',
                background: 'rgba(44, 36, 25, 0.03)'
              }}>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  fontWeight: '700',
                  color: '#5c5850',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap'
                }}>
                  Rank
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  fontWeight: '700',
                  color: '#5c5850',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}>
                  Search Term
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontWeight: '700',
                  color: '#5c5850',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap'
                }}>
                  Impressions
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontWeight: '700',
                  color: '#5c5850',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap'
                }}>
                  Clicks
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontWeight: '700',
                  color: '#5c5850',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap'
                }}>
                  Click Rate
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontWeight: '700',
                  color: '#5c5850',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap'
                }}>
                  Conversions
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontWeight: '700',
                  color: '#5c5850',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap'
                }}>
                  Lead Rate
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontWeight: '700',
                  color: '#5c5850',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap'
                }}>
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {topTerms.map((term, index) => (
                <tr
                  key={term.term}
                  style={{
                    borderBottom: '1px solid rgba(44, 36, 25, 0.08)',
                    transition: 'background-color 150ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(245, 241, 237, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{
                    padding: '12px',
                    fontWeight: '700',
                    color: '#2c2419',
                    whiteSpace: 'nowrap'
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#c4704f',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}>
                      {index + 1}
                    </span>
                  </td>
                  <td style={{
                    padding: '12px',
                    fontWeight: '600',
                    color: '#2c2419',
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {term.term}
                  </td>
                  <td style={{
                    padding: '12px',
                    textAlign: 'center',
                    color: '#5c5850',
                    whiteSpace: 'nowrap'
                  }}>
                    {term.impressions.toLocaleString()}
                  </td>
                  <td style={{
                    padding: '12px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#9db5a0',
                    whiteSpace: 'nowrap'
                  }}>
                    {term.clicks.toLocaleString()}
                  </td>
                  <td style={{
                    padding: '12px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#d9a854',
                    whiteSpace: 'nowrap'
                  }}>
                    {term.ctr.toFixed(2)}%
                  </td>
                  <td style={{
                    padding: '12px',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: '#10b981',
                    whiteSpace: 'nowrap'
                  }}>
                    {term.conversions}
                  </td>
                  <td style={{
                    padding: '12px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#c4704f',
                    whiteSpace: 'nowrap'
                  }}>
                    {term.conversionRate.toFixed(2)}%
                  </td>
                  <td style={{
                    padding: '12px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#2c2419',
                    whiteSpace: 'nowrap'
                  }}>
                    {fmtCurrency(term.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          color: '#9ca3af'
        }}>
          <p>No search terms with conversions found for this period</p>
        </div>
      )}

      {topTerms.length > 0 && (
        <p style={{
          marginTop: '16px',
          fontSize: '11px',
          color: '#9ca3af',
          margin: '16px 0 0 0'
        }}>
          Showing top {topTerms.length} search terms that generated leads during this period.
        </p>
      )}
    </div>
  );
}
