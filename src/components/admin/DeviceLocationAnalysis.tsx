'use client';

import React from 'react';
import { Smartphone, Monitor, Tablet, MapPin } from 'lucide-react';

interface DeviceMetrics {
  type: 'mobile' | 'desktop' | 'tablet';
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  cpc: number;
}

interface LocationMetrics {
  location: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  roi: number;
}

interface DeviceLocationAnalysisProps {
  deviceData?: DeviceMetrics[];
  locationData?: LocationMetrics[];
}

export default function DeviceLocationAnalysis({
  deviceData = [],
  locationData = []
}: DeviceLocationAnalysisProps) {
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return Smartphone;
      case 'desktop':
        return Monitor;
      case 'tablet':
        return Tablet;
      default:
        return Monitor;
    }
  };

  const getDeviceLabel = (type: string) => {
    switch (type) {
      case 'mobile':
        return 'Mobile';
      case 'desktop':
        return 'Desktop';
      case 'tablet':
        return 'Tablet';
      default:
        return type;
    }
  };

  const totalImpressions = deviceData.reduce((sum, d) => sum + d.impressions, 0);
  const totalClicks = deviceData.reduce((sum, d) => sum + d.clicks, 0);

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
          📱 Device & Location Analysis
        </p>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#2c2419',
          margin: '0 0 24px 0',
          letterSpacing: '-0.02em'
        }}>
          Understand Your Audience
        </h3>
      </div>

      {/* Device Performance Section */}
      {deviceData.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <p style={{
            fontSize: '13px',
            fontWeight: '700',
            color: '#2c2419',
            margin: '0 0 16px 0',
            paddingBottom: '12px',
            borderBottom: '2px solid rgba(44, 36, 25, 0.1)'
          }}>
            📲 Device Performance
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px'
          }}>
            {deviceData.map((device, index) => {
              const DeviceIcon = getDeviceIcon(device.type);
              const share = totalImpressions > 0 ? (device.impressions / totalImpressions * 100) : 0;

              return (
                <div
                  key={index}
                  style={{
                    background: 'rgba(245, 241, 237, 0.5)',
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid rgba(44, 36, 25, 0.08)'
                  }}
                >
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
                      background: 'rgba(196, 112, 79, 0.1)',
                      color: '#c4704f'
                    }}>
                      <DeviceIcon className="w-5 h-5" />
                    </div>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: '#2c2419'
                    }}>
                      {getDeviceLabel(device.type)}
                    </span>
                  </div>

                  <div style={{
                    background: 'rgba(44, 36, 25, 0.05)',
                    borderRadius: '8px',
                    height: '4px',
                    marginBottom: '12px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${share}%`,
                      background: '#c4704f',
                      transition: 'width 300ms ease'
                    }} />
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontSize: '11px',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <p style={{ color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>
                        Impressions
                      </p>
                      <p style={{ color: '#2c2419', margin: 0, fontWeight: '700' }}>
                        {(device.impressions / 1000).toFixed(1)}K
                      </p>
                    </div>
                    <div>
                      <p style={{ color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>
                        Share
                      </p>
                      <p style={{ color: '#2c2419', margin: 0, fontWeight: '700' }}>
                        {share.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p style={{ color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>
                        CTR
                      </p>
                      <p style={{ color: '#2c2419', margin: 0, fontWeight: '700' }}>
                        {device.ctr.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p style={{ color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>
                        CPC
                      </p>
                      <p style={{ color: '#2c2419', margin: 0, fontWeight: '700' }}>
                        ${device.cpc.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(157, 181, 160, 0.1)',
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '11px'
                  }}>
                    <p style={{ color: '#5c5850', margin: '0 0 2px 0', fontWeight: '600' }}>
                      Conversions
                    </p>
                    <p style={{ color: '#9db5a0', margin: 0, fontWeight: '700' }}>
                      {device.conversions}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Location Performance Section */}
      {locationData.length > 0 && (
        <div>
          <p style={{
            fontSize: '13px',
            fontWeight: '700',
            color: '#2c2419',
            margin: '0 0 16px 0',
            paddingBottom: '12px',
            borderBottom: '2px solid rgba(44, 36, 25, 0.1)'
          }}>
            📍 Location Performance
          </p>

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
                    Location
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
                    Impressions
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
                    Clicks
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
                    ROI
                  </th>
                </tr>
              </thead>
              <tbody>
                {locationData.map((location, index) => (
                  <tr
                    key={index}
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
                      whiteSpace: 'nowrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin className="w-3 h-3" style={{ color: '#c4704f' }} />
                        {location.location}
                      </div>
                    </td>
                    <td style={{
                      padding: '10px',
                      textAlign: 'center',
                      color: '#5c5850',
                      whiteSpace: 'nowrap'
                    }}>
                      {(location.impressions / 1000).toFixed(1)}K
                    </td>
                    <td style={{
                      padding: '10px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#2c2419',
                      whiteSpace: 'nowrap'
                    }}>
                      {location.clicks}
                    </td>
                    <td style={{
                      padding: '10px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#9db5a0',
                      whiteSpace: 'nowrap'
                    }}>
                      {location.conversions}
                    </td>
                    <td style={{
                      padding: '10px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#c4704f',
                      whiteSpace: 'nowrap'
                    }}>
                      ${location.spend.toFixed(2)}
                    </td>
                    <td style={{
                      padding: '10px',
                      textAlign: 'center',
                      fontWeight: '700',
                      color: location.roi > 0 ? '#10b981' : '#ef4444',
                      whiteSpace: 'nowrap'
                    }}>
                      {location.roi.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {deviceData.length === 0 && locationData.length === 0 && (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          color: '#9ca3af'
        }}>
          <p>No device or location data available</p>
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
          💡 <strong>Tips:</strong> Adjust bids by device if mobile/desktop performance differs. Target high-ROI locations with increased budget. Consider geo-targeting for location-specific campaigns.
        </p>
      </div>
    </div>
  );
}
