'use client';

import React, { useMemo } from 'react';
import { Activity, Square, MoreVertical } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  adGroups: number;
  ads: number;
  status: 'active' | 'paused' | 'ended';
  spend: number;
  conversions: number;
  cpc: number;
  ctr: number;
  impressions: number;
  clicks: number;
}

interface ActiveCampaignsTableProps {
  data: Campaign[];
  limit?: number;
}

export default function ActiveCampaignsTable({
  data,
  limit = 10
}: ActiveCampaignsTableProps) {
  const campaigns = useMemo(() => {
    return (data || [])
      .sort((a, b) => b.spend - a.spend)
      .slice(0, limit);
  }, [data, limit]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return {
          color: '#10b981',
          bgColor: 'rgba(16, 185, 129, 0.1)',
          label: 'Active',
          icon: Activity
        };
      case 'paused':
        return {
          color: '#f59e0b',
          bgColor: 'rgba(245, 158, 11, 0.1)',
          label: 'Paused',
          icon: Square
        };
      case 'ended':
        return {
          color: '#ef4444',
          bgColor: 'rgba(239, 68, 68, 0.1)',
          label: 'Ended',
          icon: Square
        };
      default:
        return {
          color: '#5c5850',
          bgColor: 'rgba(92, 88, 80, 0.05)',
          label: 'Unknown',
          icon: Activity
        };
    }
  };

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);

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
          🎬 Active Campaigns
        </p>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#2c2419',
          margin: '0 0 16px 0',
          letterSpacing: '-0.02em'
        }}>
          Campaign Performance Overview
        </h3>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginTop: '16px'
        }}>
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
              Total Campaigns
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#c4704f',
              margin: 0
            }}>
              {campaigns.length}
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
              Total Spend
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#9db5a0',
              margin: 0
            }}>
              ${totalSpend.toFixed(2)}
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
              Conversions
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
            background: 'rgba(44, 36, 25, 0.05)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #2c2419'
          }}>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '0 0 4px 0',
              fontWeight: '600'
            }}>
              Impressions
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#2c2419',
              margin: 0
            }}>
              {(totalImpressions / 1000).toFixed(1)}K
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      {campaigns.length > 0 ? (
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
                  Campaign Name
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
                  Status
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
                  Ad Groups
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
                  Spend
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
                  Conversions
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
                  CPC
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign, index) => {
                const statusInfo = getStatusBadge(campaign.status);
                const StatusIcon = statusInfo.icon;

                return (
                  <tr
                    key={campaign.id || index}
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
                      padding: '14px 12px',
                      fontWeight: '600',
                      color: '#2c2419',
                      maxWidth: '250px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {campaign.name}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap'
                    }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: statusInfo.bgColor,
                        color: statusInfo.color,
                        fontWeight: '600'
                      }}>
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}
                      </div>
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#2c2419',
                      whiteSpace: 'nowrap'
                    }}>
                      {campaign.adGroups}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#c4704f',
                      whiteSpace: 'nowrap'
                    }}>
                      ${campaign.spend.toFixed(2)}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#9db5a0',
                      whiteSpace: 'nowrap'
                    }}>
                      {campaign.conversions}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#d9a854',
                      whiteSpace: 'nowrap'
                    }}>
                      ${campaign.cpc.toFixed(2)}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#2c2419',
                      whiteSpace: 'nowrap'
                    }}>
                      {campaign.ctr.toFixed(2)}%
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap'
                    }}>
                      <button style={{
                        background: 'rgba(44, 36, 25, 0.05)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        color: '#5c5850',
                        transition: 'background-color 150ms ease'
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(44, 36, 25, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(44, 36, 25, 0.05)';
                      }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
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
          <p>No active campaigns found</p>
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
          💡 <strong>Pro Tips:</strong> Monitor campaigns with high spend and low conversions. Pause underperforming ad groups. Test new keywords in top-performing campaigns.
        </p>
      </div>
    </div>
  );
}
