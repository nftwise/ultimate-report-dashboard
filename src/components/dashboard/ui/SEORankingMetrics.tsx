'use client';

import { Award, TrendingUp, TrendingDown, Search } from 'lucide-react';

interface SEORankingMetricsProps {
  googleRank: number | null;
  topKeywords: number;
  keywordsDeclined: number;
  nonBrandedTraffic: number;
}

export function SEORankingMetrics({
  googleRank,
  topKeywords,
  keywordsDeclined,
  nonBrandedTraffic
}: SEORankingMetricsProps) {
  const hasData = googleRank !== null || topKeywords > 0 || nonBrandedTraffic > 0;

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">SEO Rankings</h4>
        <p className="text-sm text-gray-500">No SEO ranking data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-green-600" />
        <h4 className="text-sm font-semibold text-gray-700">SEO Rankings</h4>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Google Rank */}
        {googleRank !== null && (
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 text-center">
            <div className="w-10 h-10 mx-auto bg-amber-200 rounded-full flex items-center justify-center mb-2">
              <Award className="w-5 h-5 text-amber-700" />
            </div>
            <div className="text-2xl font-bold text-amber-800">#{googleRank}</div>
            <div className="text-xs text-amber-600">Avg Position</div>
          </div>
        )}

        {/* Top Keywords */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 text-center">
          <div className="w-10 h-10 mx-auto bg-green-200 rounded-full flex items-center justify-center mb-2">
            <TrendingUp className="w-5 h-5 text-green-700" />
          </div>
          <div className="text-2xl font-bold text-green-800">{topKeywords}</div>
          <div className="text-xs text-green-600">Top Keywords</div>
        </div>

        {/* Keywords Declined */}
        {keywordsDeclined > 0 && (
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 text-center">
            <div className="w-10 h-10 mx-auto bg-red-200 rounded-full flex items-center justify-center mb-2">
              <TrendingDown className="w-5 h-5 text-red-700" />
            </div>
            <div className="text-2xl font-bold text-red-800">{keywordsDeclined}</div>
            <div className="text-xs text-red-600">Declined</div>
          </div>
        )}

        {/* Non-Branded Traffic */}
        {nonBrandedTraffic > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 text-center">
            <div className="w-10 h-10 mx-auto bg-blue-200 rounded-full flex items-center justify-center mb-2">
              <Search className="w-5 h-5 text-blue-700" />
            </div>
            <div className="text-2xl font-bold text-blue-800">{nonBrandedTraffic.toLocaleString()}</div>
            <div className="text-xs text-blue-600">Non-Brand</div>
          </div>
        )}
      </div>
    </div>
  );
}
