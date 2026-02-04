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
}

interface AdGroupPerformanceTableProps {
  data: AdGroup[];
}

interface CampaignGroup {
  campaignName: string;
  adGroups: AdGroup[];
  totalImpressions: number;
  totalClicks: number;
  totalCost: number;
  totalConversions: number;
  avgCtr: number;
}

export default function AdGroupPerformanceTable({
  data
}: AdGroupPerformanceTableProps) {
  // Filter only active groups and group by campaign
  const groupedByCampaign = useMemo(() => {
    const active = (data || []).filter(g => g.status === 'active');

    const campaigns = new Map<string, AdGroup[]>();
    active.forEach(group => {
      const campaignName = group.campaignName;
      if (!campaigns.has(campaignName)) {
        campaigns.set(campaignName, []);
      }
      campaigns.get(campaignName)!.push(group);
    });

    // Convert to array and sort by total cost
    return Array.from(campaigns.entries()).map(([campaignName, adGroups]) => {
      const totalImpressions = adGroups.reduce((sum, g) => sum + g.impressions, 0);
      const totalClicks = adGroups.reduce((sum, g) => sum + g.clicks, 0);
      const totalCost = adGroups.reduce((sum, g) => sum + g.cost, 0);
      const totalConversions = adGroups.reduce((sum, g) => sum + g.conversions, 0);
      const avgCtr = adGroups.length > 0 ? adGroups.reduce((sum, g) => sum + g.ctr, 0) / adGroups.length : 0;

      return {
        campaignName,
        adGroups: adGroups.sort((a, b) => b.cost - a.cost),
        totalImpressions,
        totalClicks,
        totalCost,
        totalConversions,
        avgCtr
      };
    }).sort((a, b) => b.totalCost - a.totalCost);
  }, [data]);

  const totalStats = useMemo(() => {
    return {
      campaigns: groupedByCampaign.length,
      adGroups: groupedByCampaign.reduce((sum, c) => sum + c.adGroups.length, 0),
      impressions: groupedByCampaign.reduce((sum, c) => sum + c.totalImpressions, 0),
      clicks: groupedByCampaign.reduce((sum, c) => sum + c.totalClicks, 0),
      cost: groupedByCampaign.reduce((sum, c) => sum + c.totalCost, 0),
      conversions: groupedByCampaign.reduce((sum, c) => sum + c.totalConversions, 0)
    };
  }, [groupedByCampaign]);

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
          Active Ad Groups by Campaign
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
            <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Campaigns</p>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#c4704f', margin: 0 }}>
              {totalStats.campaigns}
            </p>
          </div>

          <div style={{
            background: 'rgba(157, 181, 160, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #9db5a0'
          }}>
            <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Ad Groups</p>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#9db5a0', margin: 0 }}>
              {totalStats.adGroups}
            </p>
          </div>

          <div style={{
            background: 'rgba(217, 168, 84, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #d9a854'
          }}>
            <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Total Spend</p>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#d9a854', margin: 0 }}>
              ${totalStats.cost.toFixed(2)}
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
              {totalStats.conversions}
            </p>
          </div>
        </div>
      </div>

      {/* Grouped Campaigns */}
      {groupedByCampaign.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groupedByCampaign.map((campaign, campaignIndex) => (
            <div
              key={campaign.campaignName}
              style={{
                background: 'rgba(44, 36, 25, 0.02)',
                border: '1px solid rgba(44, 36, 25, 0.08)',
                borderRadius: '12px',
                padding: '16px',
                overflow: 'hidden'
              }}
            >
              {/* Campaign Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: '1px solid rgba(44, 36, 25, 0.1)'
              }}>
                <div>
                  <h4 style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#2c2419',
                    margin: 0,
                    marginBottom: '4px'
                  }}>
                    {campaign.campaignName}
                  </h4>
                  <p style={{
                    fontSize: '11px',
                    color: '#5c5850',
                    margin: 0
                  }}>
                    {campaign.adGroups.length} ad group{campaign.adGroups.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '20px',
                  fontSize: '12px'
                }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 2px 0' }}>Spend</p>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#c4704f', margin: 0 }}>
                      ${campaign.totalCost.toFixed(2)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 2px 0' }}>CTR</p>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#9db5a0', margin: 0 }}>
                      {campaign.avgCtr.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Ad Groups Table */}
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
                        Ad Group
                      </th>
                      <th style={{
                        padding: '8px',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#5c5850',
                        fontSize: '10px',
                        textTransform: 'uppercase'
                      }}>
                        Impr
                      </th>
                      <th style={{
                        padding: '8px',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#5c5850',
                        fontSize: '10px',
                        textTransform: 'uppercase'
                      }}>
                        Clicks
                      </th>
                      <th style={{
                        padding: '8px',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#5c5850',
                        fontSize: '10px',
                        textTransform: 'uppercase'
                      }}>
                        CTR%
                      </th>
                      <th style={{
                        padding: '8px',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#5c5850',
                        fontSize: '10px',
                        textTransform: 'uppercase'
                      }}>
                        Cost
                      </th>
                      <th style={{
                        padding: '8px',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#5c5850',
                        fontSize: '10px',
                        textTransform: 'uppercase'
                      }}>
                        Conv
                      </th>
                      <th style={{
                        padding: '8px',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#5c5850',
                        fontSize: '10px',
                        textTransform: 'uppercase'
                      }}>
                        CPL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.adGroups.map((group) => (
                      <tr
                        key={group.adGroupId}
                        style={{
                          borderBottom: '1px solid rgba(44, 36, 25, 0.05)',
                          transition: 'background-color 150ms ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(245, 241, 237, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <td style={{
                          padding: '8px',
                          fontWeight: '500',
                          color: '#2c2419',
                          maxWidth: '150px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {group.adGroupName}
                        </td>
                        <td style={{
                          padding: '8px',
                          textAlign: 'center',
                          color: '#5c5850'
                        }}>
                          {group.impressions.toLocaleString()}
                        </td>
                        <td style={{
                          padding: '8px',
                          textAlign: 'center',
                          fontWeight: '500',
                          color: '#9db5a0'
                        }}>
                          {group.clicks.toLocaleString()}
                        </td>
                        <td style={{
                          padding: '8px',
                          textAlign: 'center',
                          fontWeight: '500',
                          color: '#d9a854'
                        }}>
                          {group.ctr.toFixed(2)}%
                        </td>
                        <td style={{
                          padding: '8px',
                          textAlign: 'center',
                          fontWeight: '500',
                          color: '#c4704f'
                        }}>
                          ${group.cost.toFixed(2)}
                        </td>
                        <td style={{
                          padding: '8px',
                          textAlign: 'center',
                          fontWeight: '600',
                          color: '#10b981'
                        }}>
                          {group.conversions}
                        </td>
                        <td style={{
                          padding: '8px',
                          textAlign: 'center',
                          fontWeight: '500',
                          color: group.cpl > 0 && group.cpl <= 50 ? '#10b981' : group.cpl > 0 && group.cpl <= 100 ? '#d9a854' : '#ef4444'
                        }}>
                          ${group.cpl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          color: '#9ca3af'
        }}>
          <p>No active ad groups found for this period</p>
        </div>
      )}

      {/* Footer Note */}
      <div style={{
        marginTop: '20px',
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
          💡 <strong>Showing only active campaigns and ad groups.</strong> Paused groups are hidden. Focus on optimizing high-spend, high-converting groups.
        </p>
      </div>
    </div>
  );
}
