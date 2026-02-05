'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DailyMetric {
  date: string;
  seo_impressions?: number;
  seo_clicks?: number;
  traffic_organic?: number;
}

interface SEOTrendChartProps {
  data: DailyMetric[];
  height?: number;
}

export default function SEOTrendChart({ data, height = 350 }: SEOTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: `${height}px`,
        backgroundColor: 'rgba(44, 36, 25, 0.02)',
        borderRadius: '8px',
        color: '#9ca3af'
      }}>
        No data available
      </div>
    );
  }

  // Format data for chart (chronological order)
  const chartData = data
    .slice()
    .reverse()
    .map(d => ({
      date: d.date,
      impressions: d.seo_impressions || 0,
      clicks: d.seo_clicks || 0,
      organic: d.traffic_organic || 0
    }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(44, 36, 25, 0.1)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(44, 36, 25, 0.15)'
        }}>
          <p style={{
            margin: '0 0 8px 0',
            fontWeight: '600',
            color: '#2c2419',
            fontSize: '12px'
          }}>
            {data.date}
          </p>
          <p style={{
            margin: '4px 0',
            fontSize: '11px',
            color: '#c4704f'
          }}>
            📊 Impressions: {data.impressions.toLocaleString()}
          </p>
          <p style={{
            margin: '4px 0',
            fontSize: '11px',
            color: '#10b981'
          }}>
            🔗 Clicks: {data.clicks.toLocaleString()}
          </p>
          <p style={{
            margin: '4px 0',
            fontSize: '11px',
            color: '#9db5a0'
          }}>
            👥 Organic Traffic: {data.organic.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(44, 36, 25, 0.1)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          stroke="#9ca3af"
          style={{ fontSize: '12px' }}
          tick={{ fill: '#5c5850' }}
          axisLine={{ stroke: 'rgba(44, 36, 25, 0.1)' }}
        />
        <YAxis
          stroke="#9ca3af"
          style={{ fontSize: '12px' }}
          tick={{ fill: '#5c5850' }}
          axisLine={{ stroke: 'rgba(44, 36, 25, 0.1)' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: '20px' }}
          iconType="line"
        />
        <Line
          type="monotone"
          dataKey="impressions"
          stroke="#c4704f"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 6, fill: '#c4704f' }}
          name="Impressions"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="clicks"
          stroke="#10b981"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 6, fill: '#10b981' }}
          name="Clicks"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="organic"
          stroke="#9db5a0"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 6, fill: '#9db5a0' }}
          name="Organic Traffic"
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
