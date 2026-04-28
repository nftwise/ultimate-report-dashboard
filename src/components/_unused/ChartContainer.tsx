'use client';

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartContainerProps {
  title: string;
  data: any[];
  type: 'line' | 'area' | 'bar' | 'pie';
  dataKey: string;
  xAxisKey?: string;
  color?: string;
  colors?: string[];
  height?: number;
  yAxisLabel?: string;
  formatValue?: (value: any) => string;
  loading?: boolean;
}

const DEFAULT_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#84cc16',
  '#f97316',
];

export function ChartContainer({
  title,
  data,
  type,
  dataKey,
  xAxisKey = 'name',
  color = '#3b82f6',
  colors = DEFAULT_COLORS,
  height = 300,
  yAxisLabel,
  formatValue,
  loading = false,
}: ChartContainerProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="flex items-center justify-center bg-gray-50 rounded-lg animate-pulse"
            style={{ height }}
          >
            <div className="text-gray-400">Loading chart...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="flex items-center justify-center bg-gray-50 rounded-lg"
            style={{ height }}
          >
            <div className="text-gray-400">No data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderChart = () => {
    const commonProps = {
      data,
      height,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip formatter={formatValue} />
            <Legend />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip formatter={formatValue} />
            <Legend />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={color}
              fillOpacity={0.3}
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip formatter={formatValue} />
            <Legend />
            <Bar dataKey={dataKey} fill={color} />
          </BarChart>
        );

      case 'pie':
        return (
          <PieChart {...commonProps}>
            <Pie
              data={data}
              dataKey={dataKey}
              nameKey={xAxisKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={formatValue} />
            <Legend />
          </PieChart>
        );

      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}