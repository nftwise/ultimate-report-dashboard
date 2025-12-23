import { ArrowUp, ArrowDown, LucideIcon } from 'lucide-react';
import { formatNumber } from '@/lib/format-utils';

interface KPICardProps {
  title: string;
  value: number;
  change?: number;
  icon: LucideIcon;
  format?: 'number' | 'currency';
  trend?: 'up' | 'down' | 'neutral';
}

export function KPICard({
  title,
  value,
  change,
  icon: Icon,
  format = 'number',
  trend = 'neutral'
}: KPICardProps) {
  const isPositive = trend === 'up';
  const TrendIcon = isPositive ? ArrowUp : ArrowDown;

  // Safety check for value
  const displayValue = value ?? 0;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-600 text-sm font-medium mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900">
            {format === 'currency' && '$'}
            {format === 'currency' ? displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : displayValue.toLocaleString()}
          </p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              <TrendIcon className="w-3 h-3" />
              <span className="font-medium">{formatNumber(Math.abs(change), 1)}%</span>
              <span className="text-gray-500">vs prev period</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${
          isPositive ? 'bg-green-50' : 'bg-amber-50'
        }`}>
          <Icon className={`w-6 h-6 ${
            isPositive ? 'text-green-600' : 'text-amber-700'
          }`} />
        </div>
      </div>
    </div>
  );
}
