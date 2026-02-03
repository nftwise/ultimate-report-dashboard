'use client';

import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartData {
  month: string;
  value: number;
}

interface MonthlyLeadsTrendChartProps {
  months?: number;
}

export default function MonthlyLeadsTrendChart({ months = 6 }: MonthlyLeadsTrendChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ highest: 0, lowest: 0, average: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/monthly-leads-trend?months=${months}`);
        const result = await response.json();

        if (result.data && Array.isArray(result.data)) {
          setData(result.data);
          if (result.stats) {
            setStats(result.stats);
          } else {
            // Calculate stats locally
            const values = result.data.map((d: ChartData) => d.value);
            setStats({
              highest: Math.max(...values),
              lowest: Math.min(...values),
              average: Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length),
            });
          }
        }
      } catch (err) {
        setError('Failed to load trend data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#5c5850' }}>Loading chart...</div>;
  }

  if (error) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>{error}</div>;
  }

  if (!data || data.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#5c5850' }}>No data available</div>;
  }

  return (
    <div className="rounded-3xl p-8 mb-12" style={{
      background: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(44, 36, 25, 0.1)',
      boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
    }}>
      <h3 className="text-2xl font-bold mb-8" style={{
        color: '#2c2419',
        fontFamily: '"Outfit", sans-serif',
        letterSpacing: '-0.02em'
      }}>
        Monthly Leads Trend
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 50 }}>
          <defs>
            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#9db5a0" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#9db5a0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2c24191a" />
          <XAxis
            dataKey="month"
            stroke="#5c5850"
            style={{ fontSize: '11px', fontFamily: '"Inter", sans-serif' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="#5c5850"
            style={{ fontSize: '12px', fontFamily: '"Inter", sans-serif' }}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              borderRadius: '8px',
              fontFamily: '"Inter", sans-serif',
              color: '#2c2419',
            }}
            formatter={(value) => [`${value} leads`, 'Leads']}
            labelStyle={{ color: '#2c2419' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#9db5a0"
            strokeWidth={3}
            fill="url(#colorLeads)"
            dot={{
              fill: '#ffffff',
              stroke: '#9db5a0',
              strokeWidth: 2,
              r: 4,
            }}
            activeDot={{
              fill: '#ffffff',
              stroke: '#9db5a0',
              strokeWidth: 2,
              r: 6,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Bottom Stats Section */}
      <div className="grid grid-cols-3 gap-4 mt-8 pt-8" style={{
        borderTop: '1px solid rgba(44, 36, 25, 0.1)'
      }}>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{
            color: '#5c5850',
            letterSpacing: '0.1em'
          }}>
            Highest
          </p>
          <p className="text-2xl font-bold tabular-nums" style={{
            color: '#c4704f',
            fontFamily: '"Outfit", sans-serif'
          }}>
            {stats.highest}
          </p>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>leads</p>
        </div>

        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{
            color: '#5c5850',
            letterSpacing: '0.1em'
          }}>
            Lowest
          </p>
          <p className="text-2xl font-bold tabular-nums" style={{
            color: '#9db5a0',
            fontFamily: '"Outfit", sans-serif'
          }}>
            {stats.lowest}
          </p>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>leads</p>
        </div>

        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{
            color: '#5c5850',
            letterSpacing: '0.1em'
          }}>
            Average
          </p>
          <p className="text-2xl font-bold tabular-nums" style={{
            color: '#d9a854',
            fontFamily: '"Outfit", sans-serif'
          }}>
            {stats.average}
          </p>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>leads/month</p>
        </div>
      </div>
    </div>
  );
}
