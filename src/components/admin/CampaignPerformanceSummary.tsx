'use client';

import React, { useMemo } from 'react';
import { BarChart3, Smartphone, Monitor } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  spend: number;
  conversions: number;
  cpl: number;
  adGroupCount: number;
}

interface DeviceData {
  mobileSessions: number;
  desktopSessions: number;
}

interface CampaignPerformanceSummaryProps {
  campaigns: Campaign[];
  deviceData?: DeviceData;
}

export default function CampaignPerformanceSummary({
  campaigns,
  deviceData
}: CampaignPerformanceSummaryProps) {
  const topCampaigns = useMemo(() => {
    return (campaigns || [])
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);
  }, [campaigns]);

  const totalMobileSessions = deviceData?.mobileSessions || 0;
  const totalDesktopSessions = deviceData?.desktopSessions || 0;
  const totalSessions = totalMobileSessions + totalDesktopSessions;
  const mobilePercent = totalSessions > 0 ? (totalMobileSessions / totalSessions) * 100 : 0;
  const desktopPercent = totalSessions > 0 ? (totalDesktopSessions / totalSessions) * 100 : 0;

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(44, 36, 25, 0.1)',
      borderRadius: '24px',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
    }}>
      {/* Section 1: Top Campaigns */}
      <div style={{ marginBottom: '32px' }}>
        <h4 style={{
          fontSize: '13px',
          fontWeight: '700',
          color: '#2c2419',
          margin: '0 0 16px 0',
          paddingBottom: '12px',
          borderBottom: '2px solid rgba(44, 36, 25, 0.1)'
        }}>
          📊 Top Campaigns
        </h4>

        {topCampaigns.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px'
            }}>
              <thead>
                <tr style={{
                  borderBottom: '1px solid rgba(44, 36, 25, 0.1)',
                  background: 'rgba(44, 36, 25, 0.03)'
                }}>
                  <th style={{
                    padding: '10px',
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
                    padding: '10px',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: '#5c5850',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}>
                    Ad Groups
                  </th>
                  <th style={{
                    padding: '10px',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: '#5c5850',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}>
                    Spend
                  </th>
                  <th style={{
                    padding: '10px',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: '#5c5850',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}>
                    Conversions
                  </th>
                  <th style={{
                    padding: '10px',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: '#5c5850',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}>
                    CPL
                  </th>
                </tr>
              </thead>
              <tbody>
                {topCampaigns.map((camp) => (
                  <tr
                    key={camp.id}
                    style={{
                      borderBottom: '1px solid rgba(44, 36, 25, 0.08)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(245, 241, 237, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{
                      padding: '10px',
                      fontWeight: '600',
                      color: '#2c2419',
                      maxWidth: '150px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {camp.name}
                    </td>
                    <td style={{
                      padding: '10px',
                      textAlign: 'center',
                      color: '#5c5850',
                      whiteSpace: 'nowrap'
                    }}>
                      {camp.adGroupCount}
                    </td>
                    <td style={{
                      padding: '10px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#c4704f',
                      whiteSpace: 'nowrap'
                    }}>
                      ${camp.spend.toFixed(2)}
                    </td>
                    <td style={{
                      padding: '10px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#10b981',
                      whiteSpace: 'nowrap'
                    }}>
                      {camp.conversions}
                    </td>
                    <td style={{
                      padding: '10px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: camp.cpl > 0 && camp.cpl <= 50 ? '#10b981' : camp.cpl > 0 && camp.cpl <= 100 ? '#d9a854' : '#ef4444',
                      whiteSpace: 'nowrap'
                    }}>
                      ${camp.cpl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#9ca3af', margin: 0 }}>No campaign data available</p>
        )}
      </div>

      {/* Section 2: Device Performance */}
      <div>
        <h4 style={{
          fontSize: '13px',
          fontWeight: '700',
          color: '#2c2419',
          margin: '0 0 16px 0',
          paddingBottom: '12px',
          borderBottom: '2px solid rgba(44, 36, 25, 0.1)'
        }}>
          📱 Device Performance
        </h4>

        {totalSessions > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px'
          }}>
            {/* Mobile */}
            <div style={{
              background: 'rgba(245, 241, 237, 0.5)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(44, 36, 25, 0.08)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981'
                }}>
                  <Smartphone className="w-5 h-5" />
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#2c2419'
                }}>
                  Mobile
                </span>
              </div>

              <div style={{
                background: 'rgba(44, 36, 25, 0.05)',
                borderRadius: '8px',
                height: '6px',
                marginBottom: '12px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${mobilePercent}%`,
                  background: '#10b981',
                  transition: 'width 300ms ease'
                }} />
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                fontSize: '11px'
              }}>
                <div>
                  <p style={{ color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>
                    Sessions
                  </p>
                  <p style={{ color: '#2c2419', margin: 0, fontWeight: '700' }}>
                    {totalMobileSessions.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p style={{ color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>
                    Share
                  </p>
                  <p style={{ color: '#2c2419', margin: 0, fontWeight: '700' }}>
                    {mobilePercent.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Desktop */}
            <div style={{
              background: 'rgba(245, 241, 237, 0.5)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(44, 36, 25, 0.08)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(157, 181, 160, 0.1)',
                  color: '#9db5a0'
                }}>
                  <Monitor className="w-5 h-5" />
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#2c2419'
                }}>
                  Desktop
                </span>
              </div>

              <div style={{
                background: 'rgba(44, 36, 25, 0.05)',
                borderRadius: '8px',
                height: '6px',
                marginBottom: '12px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${desktopPercent}%`,
                  background: '#9db5a0',
                  transition: 'width 300ms ease'
                }} />
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                fontSize: '11px'
              }}>
                <div>
                  <p style={{ color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>
                    Sessions
                  </p>
                  <p style={{ color: '#2c2419', margin: 0, fontWeight: '700' }}>
                    {totalDesktopSessions.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p style={{ color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>
                    Share
                  </p>
                  <p style={{ color: '#2c2419', margin: 0, fontWeight: '700' }}>
                    {desktopPercent.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p style={{ color: '#9ca3af', margin: 0 }}>No device data available</p>
        )}
      </div>
    </div>
  );
}
