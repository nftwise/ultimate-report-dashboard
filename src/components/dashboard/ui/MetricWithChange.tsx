import { formatNumber } from '@/lib/format-utils';

interface MetricWithChangeProps {
  label: string;
  value: string | number;
  change?: number;
  better?: boolean;
}

export function MetricWithChange({ label, value, change, better = true }: MetricWithChangeProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  // Format number if value is a number
  const displayValue = typeof value === 'number' ? formatNumber(value) : value;

  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-gray-900">{displayValue}</span>
        {change !== undefined && (
          <span className={`text-xs font-medium ${
            (isPositive && better) || (isNegative && !better)
              ? 'text-green-600'
              : (isNegative && better) || (isPositive && !better)
              ? 'text-red-500'
              : 'text-gray-500'
          }`}>
            {isPositive ? '+' : ''}{formatNumber(change, 1)}%
            {label === 'Avg Position' && change < 0 ? ' better' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
