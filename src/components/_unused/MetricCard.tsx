'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  format?: 'currency' | 'number' | 'percentage' | 'duration' | 'none';
  icon?: LucideIcon;
  description?: string;
  loading?: boolean;
}

export function MetricCard({
  title,
  value,
  change,
  changeType = 'neutral',
  format = 'number',
  icon: Icon,
  description,
  loading = false,
}: MetricCardProps) {
  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return formatCurrency(val);
      case 'percentage':
        return formatPercentage(val);
      case 'duration':
        const minutes = Math.floor(val / 60);
        const seconds = val % 60;
        return `${minutes}m ${seconds}s`;
      case 'number':
        return formatNumber(val);
      default:
        return val.toString();
    }
  };

  const getChangeColor = () => {
    switch (changeType) {
      case 'increase':
        return 'text-green-600';
      case 'decrease':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getChangeIcon = () => {
    switch (changeType) {
      case 'increase':
        return '↗';
      case 'decrease':
        return '↘';
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-gray-400" />}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse"></div>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold text-gray-900">
              {formatValue(value)}
            </div>
            <div className="flex items-center space-x-2 text-xs">
              {change !== undefined && (
                <span className={`flex items-center ${getChangeColor()}`}>
                  <span className="mr-1">{getChangeIcon()}</span>
                  {formatPercentage(Math.abs(change))}
                </span>
              )}
              {description && (
                <span className="text-gray-500">{description}</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}