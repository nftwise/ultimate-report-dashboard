'use client';

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface SearchTerm {
  term: string;
  searches: number;
  clicks: number;
  impressions: number;
  ctr: number;
  trend?: 'up' | 'down' | 'stable';
  trendPercent?: number;
}

interface TopSearchTermsTableProps {
  data: SearchTerm[];
  limit?: number;
}

export default function TopSearchTermsTable({
  data,
  limit = 5
}: TopSearchTermsTableProps) {
  const topTerms = useMemo(() => {
    return (data || [])
      .sort((a, b) => b.searches - a.searches)
      .slice(0, limit);
  }, [data, limit]);

  const getTrendColor = (trend?: string) => {
    switch (trend) {
      case 'up':
        return { color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' };
      case 'down':
        return { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' };
      default:
        return { color: '#5c5850', bgColor: 'rgba(92, 88, 80, 0.05)' };
    }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4" />;
      case 'down':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return null;
    }
  };

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
          🔍 Top Search Terms
        </p>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#2c2419',
          margin: '0 0 16px 0',
          letterSpacing: '-0.02em'
        }}>
          What Are Customers Searching For?
        </h3>
      </div>

      {/* Table */}
      {topTerms.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px'
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
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap'
                }}>
                  Search Term
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontWeight: '700',
                  color: '#5c5850',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap'
                }}>
                  Searches
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontWeight: '700',
                  color: '#5c5850',
                  fontSize: '11px',
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
                  fontSize: '11px',
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
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap'
                }}>
                  CTR
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontWeight: '700',
                  color: '#5c5850',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap'
                }}>
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {topTerms.map((term, index) => {
                const trendInfo = getTrendColor(term.trend);
                return (
                  <tr
                    key={index}
                    style={{
                      borderBottom: '1px solid rgba(44, 36, 25, 0.08)',
                      transition: 'background-color 150ms ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(245, 241, 237, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{
                      padding: '14px 12px',
                      fontWeight: '600',
                      color: '#2c2419',
                      whiteSpace: 'nowrap'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{
                          display: 'flex',
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
                        {term.term}
                      </div>
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#2c2419',
                      whiteSpace: 'nowrap'
                    }}>
                      {term.searches.toLocaleString()}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      color: '#5c5850',
                      whiteSpace: 'nowrap'
                    }}>
                      {term.impressions.toLocaleString()}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#9db5a0',
                      whiteSpace: 'nowrap'
                    }}>
                      {term.clicks.toLocaleString()}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#d9a854',
                      whiteSpace: 'nowrap'
                    }}>
                      {term.ctr.toFixed(2)}%
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: trendInfo.bgColor,
                        color: trendInfo.color,
                        fontWeight: '600'
                      }}>
                        {getTrendIcon(term.trend)}
                        {term.trendPercent !== undefined && (
                          <span>{term.trendPercent > 0 ? '+' : ''}{term.trendPercent}%</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          color: '#9ca3af'
        }}>
          <p>No search term data available</p>
        </div>
      )}

      {/* Footer Info */}
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
          💡 <strong>Tip:</strong> Focus on high-volume terms with good CTR. Optimize bid strategy for position 1-3 terms. Consider long-tail variations of top performers.
        </p>
      </div>
    </div>
  );
}
