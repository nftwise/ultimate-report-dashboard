'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Trophy, Target } from 'lucide-react';

interface RankingData {
  query: string;
  currentPosition: number;
  previousPosition: number;
  impressions: number;
  clicks: number;
  ctr: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

interface CompetitiveMetrics {
  averagePosition: number;
  previousAveragePosition: number;
  topPositions: number; // Keywords in top 3
  marketShare: number; // % of total impressions in niche
  visibilityScore: number; // 0-100
  beatCompetitors: number; // How many competitors you're ahead of
}

export function CompetitivePosition({ period, clientId }: { period: string; clientId: string }) {
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [metrics, setMetrics] = useState<CompetitiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompetitiveData();
  }, [period, clientId]);

  const fetchCompetitiveData = async () => {
    try {
      setLoading(true);

      // Fetch ranking changes from Search Console
      const response = await fetch(
        `/api/search-console?period=${period}&clientId=${clientId}&type=competitive-analysis`
      );
      const result = await response.json();

      if (result.success && result.data) {
        setRankings(result.data.rankings || []);
        setMetrics(result.data.metrics || null);
      }
    } catch (error) {
      console.error('Failed to fetch competitive data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPositionColor = (position: number) => {
    if (position <= 3) return 'text-green-600 font-bold';
    if (position <= 10) return 'text-blue-600 font-semibold';
    if (position <= 20) return 'text-orange-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Competitive Position</h3>
            <p className="text-sm text-gray-500">Your ranking vs competitors</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-green-600 font-medium">Live Rankings</span>
        </div>
      </div>

      {/* Key Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
            <div className="text-xs text-green-700 font-medium mb-1">Avg Position</div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-green-900">
                {metrics.averagePosition.toFixed(1)}
              </div>
              {metrics.previousAveragePosition > 0 && (
                <div className="flex items-center text-xs text-green-600">
                  <TrendingUp className="w-3 h-3" />
                  <span>
                    {(metrics.previousAveragePosition - metrics.averagePosition).toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-100">
            <div className="text-xs text-blue-700 font-medium mb-1">Top 3 Keywords</div>
            <div className="text-2xl font-bold text-blue-900">{metrics.topPositions}</div>
            <div className="text-xs text-blue-600">In prime position</div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-100">
            <div className="text-xs text-purple-700 font-medium mb-1">Market Share</div>
            <div className="text-2xl font-bold text-purple-900">
              {metrics.marketShare.toFixed(1)}%
            </div>
            <div className="text-xs text-purple-600">Of search impressions</div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-100">
            <div className="text-xs text-orange-700 font-medium mb-1">Visibility Score</div>
            <div className="text-2xl font-bold text-orange-900">{metrics.visibilityScore}/100</div>
            <div className="text-xs text-orange-600">Industry avg: 45</div>
          </div>
        </div>
      )}

      {/* WOW Factor Banner */}
      {metrics && metrics.beatCompetitors > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-600" />
            <div>
              <div className="text-lg font-bold text-gray-900">
                🎉 You're Beating {metrics.beatCompetitors} out of 10 Competitors!
              </div>
              <div className="text-sm text-gray-700">
                You're dominating the search results in your market
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ranking Changes Table */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Top Ranking Movements</h4>

        {rankings.length > 0 ? (
          <div className="space-y-2">
            <div className="grid grid-cols-6 gap-3 pb-2 border-b border-gray-200 text-xs font-medium text-gray-600">
              <span className="col-span-2">Keyword</span>
              <span className="text-center">Position</span>
              <span className="text-center">Change</span>
              <span className="text-center">Clicks</span>
              <span className="text-center">CTR</span>
            </div>

            {rankings.slice(0, 10).map((ranking, idx) => (
              <div
                key={idx}
                className="grid grid-cols-6 gap-3 py-3 border-b border-gray-100 items-center hover:bg-gray-50 transition-colors"
              >
                <div className="col-span-2">
                  <div className="text-sm font-medium text-gray-900 truncate" title={ranking.query}>
                    {ranking.query}
                  </div>
                  <div className="text-xs text-gray-500">
                    {ranking.impressions.toLocaleString()} impressions
                  </div>
                </div>

                <div className="text-center">
                  <span className={`text-lg font-bold ${getPositionColor(ranking.currentPosition)}`}>
                    #{ranking.currentPosition}
                  </span>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {getTrendIcon(ranking.trend)}
                    <span
                      className={`text-sm font-semibold ${
                        ranking.change > 0
                          ? 'text-green-600'
                          : ranking.change < 0
                          ? 'text-red-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {ranking.change > 0 && '+'}
                      {ranking.change}
                    </span>
                  </div>
                  {ranking.previousPosition > 0 && (
                    <div className="text-xs text-gray-400">was #{ranking.previousPosition}</div>
                  )}
                </div>

                <div className="text-center text-sm font-medium text-blue-600">
                  {ranking.clicks}
                </div>

                <div className="text-center text-sm text-gray-700">
                  {(ranking.ctr * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No ranking data available yet</p>
            <p className="text-xs text-gray-400 mt-1">Check back after Search Console syncs</p>
          </div>
        )}
      </div>

      {/* Achievement Badges */}
      {rankings.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Achievements 🏆</h4>
          <div className="flex flex-wrap gap-2">
            {rankings.filter((r) => r.currentPosition <= 3).length > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                🥇 {rankings.filter((r) => r.currentPosition <= 3).length} Top 3 Rankings
              </span>
            )}
            {rankings.filter((r) => r.change > 0).length > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                📈 {rankings.filter((r) => r.change > 0).length} Position Improvements
              </span>
            )}
            {rankings.filter((r) => r.currentPosition === 1).length > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                👑 {rankings.filter((r) => r.currentPosition === 1).length} #1 Rankings
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
