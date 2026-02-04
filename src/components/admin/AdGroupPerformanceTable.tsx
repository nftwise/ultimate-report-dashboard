'use client';

import React, { useMemo } from 'react';

interface AdGroup {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  status: 'active' | 'paused';
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  cpl: number;
  efficiency: number;
}

interface AdGroupPerformanceTableProps {
  data: AdGroup[];
}

export default function AdGroupPerformanceTable({
  data
}: AdGroupPerformanceTableProps) {
  const sortedGroups = useMemo(() => {
    return (data || []).sort((a, b) => b.cost - a.cost);
  }, [data]);

  const getStatusColor = (status: string) => {
    return status === 'active' ? { color: '#10b981', label: '🟢 Active' } : { color: '#ef4444', label: '🔴 Paused' };
  };

  const getTotalStats = () => {
    return {
      impressions: sortedGroups.reduce((sum, g) => sum + g.impressions, 0),
      clicks: sortedGroups.reduce((sum, g) => sum + g.clicks, 0),
      cost: sortedGroups.reduce((sum, g) => sum + g.cost, 0),
      conversions: sortedGroups.reduce((sum, g) => sum + g.conversions, 0),
      avgCtr: sortedGroups.length > 0 ? sortedGroups.reduce((sum, g) => sum + g.ctr, 0) / sortedGroups.length : 0
    };
  };

  const totals = getTotalStats();

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
          📋 Campaign Breakdown
        </p>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#2c2419',
          margin: '0 0 16px 0',
          letterSpacing: '-0.02em'
        }}>
          Ad Group Performance
        </h3>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '12px',
          marginTop: '16px'
        }}>
          <div style={{
            background: 'rgba(196, 112, 79, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #c4704f'
          }}>
            <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Total Spend</p>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#c4704f', margin: 0 }}>
              ${totals.cost.toFixed(2)}
            </p>
          </div>

          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #10b981'
          }}>
            <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Conversions</p>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', margin: 0 }}>
              {totals.conversions}
            </p>
          </div>

          <div style={{
            background: 'rgba(217, 168, 84, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #d9a854'
          }}>
            <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Impressions</p>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#d9a854', margin: 0 }}>
              {(totals.impressions / 1000).toFixed(1)}K
            </p>
          </div>

          <div style={{
            background: 'rgba(157, 181, 160, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #9db5a0'
          }}>
            <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Avg CTR</p>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#9db5a0', margin: 0 }}>
              {totals.avgCtr.toFixed(2)}%
            </p>
          </div>

          <div style={{
            background: 'rgba(44, 36, 25, 0.05)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #2c2419'
          }}>
            <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Ad Groups</p>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#2c2419', margin: 0 }}>
              {sortedGroups.length}
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      {sortedGroups.length > 0 ? (
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
                  letterSpacing: '0.1em'
                }}>
                  Campaign
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
                  Ad Group
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
                  Status
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
                  Impr
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
                  CTR%
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
                  Conv
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
                  CPL
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
                  Eff%
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map((group, index) => {
                const statusInfo = getStatusColor(group.status);
                return (
                  <tr
                    key={group.adGroupId || index}
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
                      fontWeight: '600',
                      color: '#2c2419',
                      maxWidth: '120px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {group.campaignName}
                    </td>
                    <td style={{
                      padding: '12px',
                      fontWeight: '600',
                      color: '#2c2419',
                      maxWidth: '150px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {group.adGroupName}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: statusInfo.color,
                      whiteSpace: 'nowrap'
                    }}>
                      {statusInfo.label}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#5c5850',
                      whiteSpace: 'nowrap'
                    }}>
                      {group.impressions.toLocaleString()}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#9db5a0',
                      whiteSpace: 'nowrap'
                    }}>
                      {group.clicks.toLocaleString()}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#d9a854',
                      whiteSpace: 'nowrap'
                    }}>
                      {group.ctr.toFixed(2)}%
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#c4704f',
                      whiteSpace: 'nowrap'
                    }}>
                      ${group.cost.toFixed(2)}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontWeight: '700',
                      color: '#10b981',
                      whiteSpace: 'nowrap'
                    }}>
                      {group.conversions}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: group.cpl > 0 && group.cpl <= 50 ? '#10b981' : group.cpl > 0 && group.cpl <= 100 ? '#d9a854' : '#ef4444',
                      whiteSpace: 'nowrap'
                    }}>
                      ${group.cpl.toFixed(2)}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: group.efficiency > 0 ? '#10b981' : '#5c5850',
                      whiteSpace: 'nowrap'
                    }}>
                      {group.efficiency.toFixed(2)}%
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
          <p>No ad group data available</p>
        </div>
      )}

      {/* Footer Note */}
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
          💡 <strong>Action Items:</strong> Focus budget on high-efficiency ad groups. Pause underperforming groups. Test new keywords in top-converting groups.
        </p>
      </div>
    </div>
  );
}
