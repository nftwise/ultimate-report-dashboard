'use client';

import React from 'react';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface CompetitiveAnalysisData {
  searchImpressionShare: number;
  searchImpressionShareTrend?: number;
  lostISBudget: number;
  lostISBudgetTrend?: number;
  lostISRank: number;
  lostISRankTrend?: number;
  overlappingKeywords?: number;
  topCompetitor?: string;
}

interface CompetitiveAnalysisCardsProps {
  data: CompetitiveAnalysisData;
}

export default function CompetitiveAnalysisCards({
  data
}: CompetitiveAnalysisCardsProps) {
  const getTrendColor = (value?: number) => {
    if (!value) return { color: '#5c5850', icon: null };
    return value > 0 ? { color: '#10b981', icon: TrendingUp } : { color: '#ef4444', icon: TrendingDown };
  };

  const getTrendIcon = (value?: number) => {
    if (!value) return null;
    return value > 0 ? TrendingUp : TrendingDown;
  };

  const sisTrend = getTrendColor(data.searchImpressionShareTrend);
  const sisBudgetTrend = getTrendColor(data.lostISBudgetTrend);
  const sisRankTrend = getTrendColor(data.lostISRankTrend);

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
          ⚔️ Competitive Analysis
        </p>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#2c2419',
          margin: '0 0 16px 0',
          letterSpacing: '-0.02em'
        }}>
          How You Stack Up Against Competitors
        </h3>
      </div>

      {/* Warning Alert */}
      {data.lostISBudget > 20 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          borderLeft: '3px solid #ef4444',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <AlertCircle className="w-4 h-4 mt-0.5" style={{ color: '#ef4444', flexShrink: 0 }} />
          <p style={{
            fontSize: '12px',
            color: '#ef4444',
            margin: 0,
            fontWeight: '500'
          }}>
            <strong>Warning:</strong> You're losing {data.lostISBudget}% of impression share due to budget constraints. Consider increasing budget for top-performing campaigns.
          </p>
        </div>
      )}

      {/* Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Search Impression Share */}
        <div style={{
          background: 'rgba(157, 181, 160, 0.08)',
          borderRadius: '12px',
          padding: '20px',
          borderLeft: '4px solid #9db5a0'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '12px'
          }}>
            <p style={{
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#5c5850',
              margin: 0
            }}>
              Search Impression Share
            </p>
            {data.searchImpressionShareTrend !== undefined && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: '600',
                color: sisTrend.color
              }}>
                {getTrendIcon(data.searchImpressionShareTrend) &&
                  React.createElement(getTrendIcon(data.searchImpressionShareTrend)!, { className: 'w-3 h-3' })}
                {Math.abs(data.searchImpressionShareTrend || 0)}%
              </div>
            )}
          </div>
          <p style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#9db5a0',
            margin: '0 0 8px 0'
          }}>
            {data.searchImpressionShare.toFixed(1)}%
          </p>
          <p style={{
            fontSize: '12px',
            color: '#5c5850',
            margin: 0,
            lineHeight: '1.4'
          }}>
            Share of all Google impressions for your keywords
          </p>
        </div>

        {/* Lost IS - Budget */}
        <div style={{
          background: 'rgba(196, 112, 79, 0.08)',
          borderRadius: '12px',
          padding: '20px',
          borderLeft: '4px solid #c4704f'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '12px'
          }}>
            <p style={{
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#5c5850',
              margin: 0
            }}>
              Lost IS (Budget)
            </p>
            {data.lostISBudgetTrend !== undefined && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: '600',
                color: sisBudgetTrend.color
              }}>
                {getTrendIcon(data.lostISBudgetTrend) &&
                  React.createElement(getTrendIcon(data.lostISBudgetTrend)!, { className: 'w-3 h-3' })}
                {Math.abs(data.lostISBudgetTrend || 0)}%
              </div>
            )}
          </div>
          <p style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#c4704f',
            margin: '0 0 8px 0'
          }}>
            {data.lostISBudget.toFixed(1)}%
          </p>
          <p style={{
            fontSize: '12px',
            color: '#5c5850',
            margin: 0,
            lineHeight: '1.4'
          }}>
            Impressions lost due to insufficient budget
          </p>
        </div>

        {/* Lost IS - Rank */}
        <div style={{
          background: 'rgba(217, 168, 84, 0.08)',
          borderRadius: '12px',
          padding: '20px',
          borderLeft: '4px solid #d9a854'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '12px'
          }}>
            <p style={{
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#5c5850',
              margin: 0
            }}>
              Lost IS (Rank)
            </p>
            {data.lostISRankTrend !== undefined && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: '600',
                color: sisRankTrend.color
              }}>
                {getTrendIcon(data.lostISRankTrend) &&
                  React.createElement(getTrendIcon(data.lostISRankTrend)!, { className: 'w-3 h-3' })}
                {Math.abs(data.lostISRankTrend || 0)}%
              </div>
            )}
          </div>
          <p style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#d9a854',
            margin: '0 0 8px 0'
          }}>
            {data.lostISRank.toFixed(1)}%
          </p>
          <p style={{
            fontSize: '12px',
            color: '#5c5850',
            margin: 0,
            lineHeight: '1.4'
          }}>
            Impressions lost due to low ad rank
          </p>
        </div>
      </div>

      {/* Competitor Insights */}
      {data.overlappingKeywords || data.topCompetitor ? (
        <div style={{
          background: 'rgba(44, 36, 25, 0.03)',
          borderRadius: '12px',
          padding: '16px',
          borderLeft: '3px solid #2c2419'
        }}>
          <p style={{
            fontSize: '11px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#5c5850',
            margin: '0 0 12px 0'
          }}>
            Competitor Insights
          </p>
          {data.topCompetitor && (
            <p style={{
              fontSize: '12px',
              color: '#2c2419',
              margin: '0 0 8px 0',
              lineHeight: '1.5'
            }}>
              <strong>Top Competitor:</strong> {data.topCompetitor}
            </p>
          )}
          {data.overlappingKeywords && (
            <p style={{
              fontSize: '12px',
              color: '#2c2419',
              margin: 0,
              lineHeight: '1.5'
            }}>
              <strong>Overlapping Keywords:</strong> {data.overlappingKeywords} shared with competitors
            </p>
          )}
        </div>
      ) : null}

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
          💡 <strong>Action Items:</strong> Focus on winning the keywords where you're losing to rank. Increase bids on high-performing campaigns. Improve Quality Score for underperforming ads.
        </p>
      </div>
    </div>
  );
}
