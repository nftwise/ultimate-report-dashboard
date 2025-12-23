import React from 'react';
import { ChevronRight, BarChart3, TrendingUp } from 'lucide-react';
import { MetricWithChange } from '../ui/MetricWithChange';
import { RankingBadge } from '../ui/RankingBadge';
import { PerformanceChart } from '../charts/PerformanceChart';

interface ChannelDetailCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  metrics: { label: string; value: string | number; change?: number; better?: boolean }[];
  rankingData?: { range: string; count: number; change?: number; color: string }[];
  chartData?: { clicks: number[]; impressions: number[] };
  onClick?: () => void;
}

export function ChannelDetailCard({
  icon,
  title,
  subtitle,
  metrics,
  rankingData,
  chartData,
  onClick,
}: ChannelDetailCardProps) {
  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600">
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>

      {/* Metrics Grid */}
      <div className="px-5 py-4 grid grid-cols-2 gap-4">
        {metrics.map((metric, idx) => (
          <MetricWithChange
            key={idx}
            label={metric.label}
            value={metric.value}
            change={metric.change}
            better={metric.better}
          />
        ))}
      </div>

      {/* Ranking Distribution */}
      {rankingData && rankingData.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-50">
          <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
            <BarChart3 className="w-3 h-3" />
            Query Count by Ranking
          </p>
          <div className="flex justify-between">
            {rankingData.map((rank, idx) => (
              <RankingBadge key={idx} {...rank} />
            ))}
          </div>
        </div>
      )}

      {/* Performance Chart */}
      {chartData && (
        <div className="px-5 py-4 border-t border-gray-50">
          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Performance
          </p>
          <PerformanceChart
            clicksData={chartData.clicks}
            impressionsData={chartData.impressions}
          />
        </div>
      )}
    </div>
  );
}
