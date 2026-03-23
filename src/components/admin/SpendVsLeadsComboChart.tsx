'use client';

import React, { useMemo } from 'react';
import { fmtCurrency, fmtNum } from '@/lib/format';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface ChartDataPoint {
  date: string;
  ad_spend: number;
  total_leads: number;
  // For formatting
  displayDate: string;
}

interface SpendVsLeadsComboChartProps {
  data: Array<{
    date: string;
    ad_spend?: number;
    total_leads?: number;
  }>;
  height?: number;
}

export default function SpendVsLeadsComboChart({
  data,
  height = 400
}: SpendVsLeadsComboChartProps) {
  const chartData = useMemo(() => {
    return (data || []).map((item) => {
      const date = new Date(item.date);
      const displayDate = `${date.getDate()}/${date.getMonth() + 1}`;

      return {
        date: item.date,
        displayDate,
        ad_spend: item.ad_spend || 0,
        total_leads: item.total_leads || 0
      };
    });
  }, [data]);

  // Calculate max values for dual axis scaling
  const maxSpend = Math.max(...chartData.map(d => d.ad_spend), 1);
  const maxLeads = Math.max(...chartData.map(d => d.total_leads), 1);

  // Calculate summary statistics
  const totalSpend = chartData.reduce((sum, d) => sum + d.ad_spend, 0);
  const totalLeads = chartData.reduce((sum, d) => sum + d.total_leads, 0);
  const avgSpendPerLead = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '0.00';

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(44, 36, 25, 0.2)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(44, 36, 25, 0.15)'
        }}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#2c2419', margin: '0 0 8px 0' }}>
            {payload[0]?.payload?.displayDate}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{
              fontSize: '12px',
              color: entry.color,
              margin: '4px 0',
              fontWeight: '500'
            }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(44, 36, 25, 0.1)',
      borderRadius: '24px',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{
          fontSize: '11px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#5c5850',
          margin: '0 0 8px 0'
        }}>
          💰 Spend vs Leads Trend
        </p>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#2c2419',
          margin: '0 0 16px 0',
          letterSpacing: '-0.02em'
        }}>
          Spend &amp; Leads Trend
        </h3>

        {/* Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginTop: '16px'
        }}>
          <div style={{
            background: 'rgba(196, 112, 79, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #c4704f'
          }}>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '0 0 4px 0',
              fontWeight: '600'
            }}>
              Total Spend
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#c4704f',
              margin: 0
            }}>
              {fmtCurrency(totalSpend)}
            </p>
          </div>

          <div style={{
            background: 'rgba(157, 181, 160, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #9db5a0'
          }}>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '0 0 4px 0',
              fontWeight: '600'
            }}>
              Total Leads
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#9db5a0',
              margin: 0
            }}>
              {totalLeads}
            </p>
          </div>

          <div style={{
            background: 'rgba(217, 168, 84, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #d9a854'
          }}>
            <p style={{
              fontSize: '10px',
              color: '#5c5850',
              margin: '0 0 4px 0',
              fontWeight: '600'
            }}>
              Cost Per Lead
            </p>
            <p style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#d9a854',
              margin: 0
            }}>
              {fmtCurrency(parseFloat(avgSpendPerLead))}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 80, bottom: 20, left: 20 }}
        >
          <defs>
            <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#c4704f" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#c4704f" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#9db5a0" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#9db5a0" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(44, 36, 25, 0.1)"
            vertical={false}
          />

          <XAxis
            dataKey="displayDate"
            stroke="#5c5850"
            style={{ fontSize: '12px' }}
          />

          <YAxis
            yAxisId="left"
            stroke="#9db5a0"
            style={{ fontSize: '12px' }}
            label={{
              value: 'Leads',
              angle: -90,
              position: 'insideLeft',
              style: { color: '#9db5a0', fontSize: '12px', fontWeight: '600' }
            }}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#c4704f"
            style={{ fontSize: '12px' }}
            label={{
              value: 'Ad Spend ($)',
              angle: 90,
              position: 'insideRight',
              style: { color: '#c4704f', fontSize: '12px', fontWeight: '600' }
            }}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{
              paddingTop: '20px',
              fontSize: '12px',
              fontWeight: '600'
            }}
          />

          {/* Bar for Leads */}
          <Bar
            yAxisId="left"
            dataKey="total_leads"
            fill="#9db5a0"
            name="Leads"
            opacity={0.8}
            radius={[8, 8, 0, 0]}
          />

          {/* Line for Spend */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="ad_spend"
            stroke="#c4704f"
            name="Ad Spend ($)"
            strokeWidth={3}
            dot={{
              fill: '#fff',
              stroke: '#c4704f',
              strokeWidth: 2,
              r: 4
            }}
            activeDot={{
              r: 6,
              fill: '#c4704f'
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Footer Note */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: 'rgba(44, 36, 25, 0.03)',
        borderRadius: '8px',
        borderLeft: '3px solid #2c2419'
      }}>
        <p style={{
          fontSize: '11px',
          color: '#5c5850',
          margin: 0,
          lineHeight: '1.5'
        }}>
          💡 <strong>Insight:</strong> Track how your ad spend correlates with lead generation. A rising spend line with a declining leads line may indicate declining efficiency.
        </p>
      </div>
    </div>
  );
}
