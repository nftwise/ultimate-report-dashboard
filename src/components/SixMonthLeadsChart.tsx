'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Award, AlertCircle } from 'lucide-react';

interface MonthData {
  month: string;
  monthLabel: string;
  leads: number;
  adSpend: number;
  costPerLead: number;
  sessions: number;
  clicks: number;
}

interface HistoricalData {
  months: MonthData[];
  insights: {
    totalLeads: number;
    totalSpend: number;
    avgLeadsPerMonth: number;
    bestMonth: { month: string; leads: number };
    worstMonth: { month: string; leads: number };
    trend: {
      direction: string;
      percentage: number;
      description: string;
    };
  };
}

interface SixMonthLeadsChartProps {
  clientId: string;
}

export default function SixMonthLeadsChart({ clientId }: SixMonthLeadsChartProps) {
  const [data, setData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/reports/historical?clientId=${clientId}&months=6`);
        const result = await response.json();

        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to load data');
        }
      } catch (err) {
        setError('Failed to fetch historical data');
        console.error('Error fetching historical data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [clientId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-red-600 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error || 'No data available'}</span>
        </div>
      </div>
    );
  }

  const maxLeads = Math.max(...data.months.map(m => m.leads));
  const minLeads = Math.min(...data.months.map(m => m.leads));

  // Calculate bar height percentage
  const getBarHeight = (leads: number) => {
    if (maxLeads === 0) return 0;
    return Math.max((leads / maxLeads) * 100, 5); // Minimum 5% for visibility
  };

  // Get color based on performance
  const getBarColor = (monthData: MonthData, index: number) => {
    const isCurrentMonth = index === data.months.length - 1;
    const isPreviousMonth = index === data.months.length - 2;
    const isBestMonth = monthData.monthLabel === data.insights.bestMonth.month;
    const isWorstMonth = monthData.monthLabel === data.insights.worstMonth.month;

    if (isCurrentMonth) return 'bg-blue-500 border-blue-600'; // Current month (October)
    if (isPreviousMonth) return 'bg-green-500 border-green-600'; // Previous month (September)
    if (isBestMonth) return 'bg-purple-500 border-purple-600'; // Best performing
    if (isWorstMonth) return 'bg-red-400 border-red-500'; // Worst performing
    return 'bg-gray-400 border-gray-500'; // Other months
  };

  const getBarLabel = (monthData: MonthData, index: number) => {
    const isCurrentMonth = index === data.months.length - 1;
    const isPreviousMonth = index === data.months.length - 2;
    const isBestMonth = monthData.monthLabel === data.insights.bestMonth.month;

    if (isCurrentMonth) return '📍 Current';
    if (isPreviousMonth) return '⭐ Peak';
    if (isBestMonth) return '🏆 Best';
    return '';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-900">6-Month Lead Generation Trend</h2>
          {data.insights.trend.direction === 'up' && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
              <TrendingUp className="w-5 h-5" />
              <span className="font-semibold">{data.insights.trend.description}</span>
            </div>
          )}
          {data.insights.trend.direction === 'down' && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full">
              <TrendingDown className="w-5 h-5" />
              <span className="font-semibold">{data.insights.trend.description}</span>
            </div>
          )}
        </div>
        <p className="text-gray-600">
          Showing monthly lead volume from {data.months[0].monthLabel} to {data.months[data.months.length - 1].monthLabel}
        </p>
      </div>

      {/* Chart */}
      <div className="p-6">
        <div className="flex items-end justify-between gap-4 h-80 mb-6">
          {data.months.map((monthData, index) => {
            const barHeight = getBarHeight(monthData.leads);
            const barColor = getBarColor(monthData, index);
            const barLabel = getBarLabel(monthData, index);

            return (
              <div key={monthData.month} className="flex-1 flex flex-col items-center justify-end h-full">
                {/* Lead count label above bar */}
                <div className="mb-2 text-center">
                  <div className="text-2xl font-bold text-gray-900">{monthData.leads}</div>
                  {barLabel && (
                    <div className="text-xs font-medium text-gray-600 mt-1">{barLabel}</div>
                  )}
                </div>

                {/* Bar */}
                <div
                  className={`w-full rounded-t-lg border-2 transition-all duration-300 hover:opacity-80 cursor-pointer relative group ${barColor}`}
                  style={{ height: `${barHeight}%` }}
                  title={`${monthData.monthLabel}: ${monthData.leads} leads`}
                >
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                    <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap">
                      <div className="font-bold">{monthData.monthLabel}</div>
                      <div>Leads: {monthData.leads}</div>
                      <div>Spend: ${monthData.adSpend.toFixed(2)}</div>
                      <div>Cost/Lead: ${monthData.costPerLead.toFixed(2)}</div>
                      <div>Clicks: {monthData.clicks}</div>
                    </div>
                  </div>
                </div>

                {/* Month label */}
                <div className="mt-3 text-sm font-medium text-gray-700 text-center">
                  {monthData.monthLabel.split(' ')[0]}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 border-2 border-blue-600 rounded"></div>
            <span className="text-sm text-gray-700">Current Month (Oct)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 border-2 border-green-600 rounded"></div>
            <span className="text-sm text-gray-700">Previous Month (Sep)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 border-2 border-purple-600 rounded"></div>
            <span className="text-sm text-gray-700">Best Performance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 border-2 border-gray-500 rounded"></div>
            <span className="text-sm text-gray-700">Historical Average</span>
          </div>
        </div>
      </div>

      {/* Insights Summary */}
      <div className="p-6 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total Leads (6 months)</div>
            <div className="text-2xl font-bold text-gray-900">{data.insights.totalLeads}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Average per Month</div>
            <div className="text-2xl font-bold text-gray-900">{data.insights.avgLeadsPerMonth}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-green-100">
            <div className="text-sm text-green-700 mb-1 flex items-center gap-1">
              <Award className="w-4 h-4" />
              Best Month
            </div>
            <div className="text-xl font-bold text-green-700">
              {data.insights.bestMonth.month}: {data.insights.bestMonth.leads} leads
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total Investment</div>
            <div className="text-2xl font-bold text-gray-900">${data.insights.totalSpend.toLocaleString()}</div>
          </div>
        </div>

        {/* Key Message */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 mt-1">💡</div>
            <div>
              <div className="font-semibold text-blue-900 mb-1">Key Insight:</div>
              <p className="text-sm text-blue-800">
                While October shows a dip from September's peak, the overall trend remains{' '}
                <strong>positive compared to earlier months</strong>. June and August also performed well with 6 leads each.
                The data shows consistent performance with September being an exceptional outlier, not the new normal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
