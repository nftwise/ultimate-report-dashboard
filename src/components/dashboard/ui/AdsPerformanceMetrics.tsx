'use client';

import { MousePointer, DollarSign, Target, TrendingUp } from 'lucide-react';

interface AdsPerformanceMetricsProps {
  ctr: number;           // Click-through rate %
  avgCpc: number;        // Average cost per click $
  conversionRate: number; // Conversion rate %
  impressions: number;
  clicks: number;
}

export function AdsPerformanceMetrics({
  ctr,
  avgCpc,
  conversionRate,
  impressions,
  clicks
}: AdsPerformanceMetricsProps) {
  const hasData = impressions > 0 || clicks > 0;

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Ads Performance</h4>
        <p className="text-sm text-gray-500">No ads performance data available</p>
      </div>
    );
  }

  const metrics = [
    {
      label: 'CTR',
      value: `${ctr.toFixed(2)}%`,
      sublabel: 'Click-through Rate',
      icon: MousePointer,
      color: 'blue',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600'
    },
    {
      label: 'Avg CPC',
      value: `$${avgCpc.toFixed(2)}`,
      sublabel: 'Cost per Click',
      icon: DollarSign,
      color: 'green',
      bgColor: 'bg-green-100',
      textColor: 'text-green-600'
    },
    {
      label: 'Conv. Rate',
      value: `${conversionRate.toFixed(2)}%`,
      sublabel: 'Conversion Rate',
      icon: Target,
      color: 'purple',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-600'
    }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-amber-600" />
        <h4 className="text-sm font-semibold text-gray-700">Ads Performance</h4>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="text-center">
              <div className={`w-10 h-10 mx-auto ${metric.bgColor} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className={`w-5 h-5 ${metric.textColor}`} />
              </div>
              <div className="text-lg font-bold text-gray-900">{metric.value}</div>
              <div className="text-xs text-gray-500">{metric.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-900">{impressions.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Impressions</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-900">{clicks.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Clicks</div>
        </div>
      </div>
    </div>
  );
}
