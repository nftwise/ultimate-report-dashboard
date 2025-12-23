import { ArrowUp, ArrowDown } from 'lucide-react';
import { MiniSparkline } from './MiniSparkline';

interface ThorbitMetricCardProps {
  label: string;
  value: number | string;
  change?: number;
  sparklineData?: number[];
  icon?: string;
  format?: 'number' | 'currency' | 'percent';
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
}

export function ThorbitMetricCard({
  label,
  value,
  change,
  sparklineData,
  icon,
  format = 'number',
  trend = 'neutral',
  subtitle
}: ThorbitMetricCardProps) {
  const isPositive = trend === 'up' || (change !== undefined && change > 0);
  const isNegative = trend === 'down' || (change !== undefined && change < 0);

  const displayValue = typeof value === 'number' ? (
    format === 'currency'
      ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : format === 'percent'
      ? `${value.toFixed(1)}%`
      : value.toLocaleString()
  ) : value;

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="text-sm font-medium text-gray-500">{label}</span>
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            isPositive ? 'bg-green-50 text-green-700' : isNegative ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'
          }`}>
            {isPositive ? <ArrowUp className="w-3 h-3" /> : isNegative ? <ArrowDown className="w-3 h-3" /> : null}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-gray-900">{displayValue}</div>
          {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <div className="w-20 h-8 ml-3">
            <MiniSparkline
              data={sparklineData}
              color={isPositive ? '#5D8A3E' : isNegative ? '#C4564A' : '#8B7355'}
            />
          </div>
        )}
      </div>
    </div>
  );
}
