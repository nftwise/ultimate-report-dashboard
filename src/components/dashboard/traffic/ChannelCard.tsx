import { MiniSparkline } from '../ui/MiniSparkline';

interface ChannelCardProps {
  title: string;
  icon: string;
  mainMetric: number | string;
  mainMetricLabel: string;
  secondaryMetrics?: { label: string; value: string | number }[];
  sparklineData?: number[];
  trend?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
}

export function ChannelCard({
  title,
  icon,
  mainMetric,
  mainMetricLabel,
  secondaryMetrics,
  sparklineData,
  trend,
  onClick
}: ChannelCardProps) {
  const isPositive = trend === 'up';
  const isNegative = trend === 'down';

  return (
    <div
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:border-amber-200 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-xl">
            {icon}
          </div>
          <span className="font-semibold text-gray-900">{title}</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${
          isPositive ? 'bg-green-500' : isNegative ? 'bg-red-500' : 'bg-gray-300'
        }`} />
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-3xl font-bold text-gray-900">{mainMetric}</div>
          <div className="text-xs text-gray-500 mt-1">{mainMetricLabel}</div>
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <div className="w-24 h-10">
            <MiniSparkline
              data={sparklineData}
              color={isPositive ? '#5D8A3E' : isNegative ? '#C4564A' : '#8B7355'}
              height={40}
            />
          </div>
        )}
      </div>

      {secondaryMetrics && secondaryMetrics.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
          {secondaryMetrics.map((metric, idx) => (
            <div key={idx}>
              <div className="text-xs text-gray-500">{metric.label}</div>
              <div className="text-sm font-semibold text-gray-700">{metric.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
