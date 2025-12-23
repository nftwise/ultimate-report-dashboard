'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Award, AlertCircle, Calendar, DollarSign, Target, BarChart3, Sparkles } from 'lucide-react';
import { formatNumber } from '@/lib/format-utils';

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
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
          <div className="animate-pulse">
            <div className="h-6 bg-white/20 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-white/10 rounded w-1/2"></div>
          </div>
        </div>
        <div className="p-6">
          <div className="animate-pulse h-64 bg-gray-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-5">
          <h3 className="font-bold text-white text-lg">6-Month Lead Trend</h3>
          <p className="text-gray-300 text-sm">Historical performance data</p>
        </div>
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium mb-2">Unable to Load Data</p>
          <p className="text-sm text-gray-500">{error || 'Please check your Google Ads connection'}</p>
        </div>
      </div>
    );
  }

  const maxLeads = Math.max(...data.months.map(m => m.leads));
  const totalLeads = data.insights.totalLeads;

  // If all months have 0 leads
  if (totalLeads === 0 || maxLeads === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-5">
          <h3 className="font-bold text-white text-lg">6-Month Lead Trend</h3>
          <p className="text-gray-300 text-sm">Historical performance data</p>
        </div>
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium mb-2">No Lead Data Available</p>
          <p className="text-sm text-gray-500">Ensure conversion tracking is configured in Google Ads</p>
        </div>
      </div>
    );
  }

  // Get bar height percentage
  const getBarHeight = (leads: number) => {
    if (maxLeads === 0) return 0;
    return Math.max((leads / maxLeads) * 100, 8);
  };

  // Determine trend colors
  const trendUp = data.insights.trend.direction === 'up';
  const trendDown = data.insights.trend.direction === 'down';
  const headerGradient = trendUp
    ? 'from-emerald-600 to-teal-600'
    : trendDown
    ? 'from-rose-600 to-red-600'
    : 'from-indigo-600 to-blue-600';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header with Trend */}
      <div className={`bg-gradient-to-r ${headerGradient} px-6 py-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">6-Month Lead Trend</h3>
              <p className="text-white/70 text-sm">
                {data.months[0].monthLabel.split(' ')[0]} - {data.months[data.months.length - 1].monthLabel.split(' ')[0]} {data.months[data.months.length - 1].monthLabel.split(' ')[1]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full">
            {trendUp && <TrendingUp className="w-5 h-5 text-white" />}
            {trendDown && <TrendingDown className="w-5 h-5 text-white" />}
            <span className="text-white font-semibold">{data.insights.trend.description}</span>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="p-6">
        {/* Bar Chart */}
        <div className="flex items-end gap-3 h-56 mb-4">
          {data.months.map((monthData, index) => {
            const barHeight = getBarHeight(monthData.leads);
            const isCurrentMonth = index === data.months.length - 1;
            const isBestMonth = monthData.monthLabel === data.insights.bestMonth.month;
            const isHovered = hoveredMonth === index;

            // Color logic
            let barBg = 'bg-gray-300';
            let barHoverBg = 'hover:bg-gray-400';
            if (isCurrentMonth) {
              barBg = 'bg-indigo-500';
              barHoverBg = 'hover:bg-indigo-600';
            } else if (isBestMonth) {
              barBg = 'bg-emerald-500';
              barHoverBg = 'hover:bg-emerald-600';
            }

            return (
              <div
                key={monthData.month}
                className="flex-1 flex flex-col items-center justify-end h-full relative"
                onMouseEnter={() => setHoveredMonth(index)}
                onMouseLeave={() => setHoveredMonth(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full mb-2 z-20 animate-in fade-in duration-150">
                    <div className="bg-gray-900 text-white text-xs rounded-xl py-3 px-4 shadow-xl min-w-[140px]">
                      <div className="font-bold text-sm mb-2 border-b border-gray-700 pb-2">
                        {monthData.monthLabel}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Leads</span>
                          <span className="font-semibold">{monthData.leads}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Spend</span>
                          <span className="font-semibold">${formatNumber(monthData.adSpend, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">CPL</span>
                          <span className="font-semibold">${formatNumber(monthData.costPerLead, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Clicks</span>
                          <span className="font-semibold">{monthData.clicks}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-3 h-3 bg-gray-900 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1.5"></div>
                  </div>
                )}

                {/* Lead count */}
                <div className={`text-sm font-bold mb-2 transition-all ${isHovered ? 'text-indigo-600 scale-110' : 'text-gray-700'}`}>
                  {monthData.leads}
                </div>

                {/* Bar */}
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 cursor-pointer ${barBg} ${barHoverBg} ${isHovered ? 'shadow-lg scale-105' : ''}`}
                  style={{ height: `${barHeight}%`, minHeight: '20px' }}
                />

                {/* Month label */}
                <div className={`mt-3 text-xs font-medium transition-colors ${isHovered ? 'text-indigo-600' : 'text-gray-500'}`}>
                  {monthData.monthLabel.split(' ')[0].slice(0, 3)}
                </div>

                {/* Badge */}
                {isCurrentMonth && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full whitespace-nowrap">
                      NOW
                    </span>
                  </div>
                )}
                {isBestMonth && !isCurrentMonth && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full whitespace-nowrap">
                      BEST
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-indigo-500 rounded"></div>
            <span className="text-xs text-gray-600">Current Month</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded"></div>
            <span className="text-xs text-gray-600">Best Month</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-300 rounded"></div>
            <span className="text-xs text-gray-600">Other Months</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 border-t border-gray-100">
        <div className="p-4 border-r border-gray-100 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Target className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs text-gray-500 font-medium">Total</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{data.insights.totalLeads}</p>
          <p className="text-xs text-gray-400">leads</p>
        </div>
        <div className="p-4 border-r border-gray-100 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs text-gray-500 font-medium">Monthly</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{data.insights.avgLeadsPerMonth}</p>
          <p className="text-xs text-gray-400">avg/mo</p>
        </div>
        <div className="p-4 border-r border-gray-100 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Award className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs text-gray-500 font-medium">Peak</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{data.insights.bestMonth.leads}</p>
          <p className="text-xs text-gray-400">{data.insights.bestMonth.month.split(' ')[0]}</p>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-gray-500 font-medium">Invested</span>
          </div>
          <p className="text-xl font-bold text-gray-900">${formatNumber(data.insights.totalSpend, 0)}</p>
          <p className="text-xs text-gray-400">total spend</p>
        </div>
      </div>

      {/* Insight Footer */}
      <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 border-t border-gray-100">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${trendUp ? 'bg-emerald-100' : trendDown ? 'bg-rose-100' : 'bg-indigo-100'}`}>
            <Sparkles className={`w-4 h-4 ${trendUp ? 'text-emerald-600' : trendDown ? 'text-rose-600' : 'text-indigo-600'}`} />
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">Performance Insight</p>
            <p className="text-sm text-gray-600 mt-0.5">
              {trendUp && (
                <>Lead generation is improving. {data.insights.bestMonth.month} was your strongest month with {data.insights.bestMonth.leads} leads.</>
              )}
              {trendDown && (
                <>Performance has declined from earlier highs. {data.insights.bestMonth.month} peaked at {data.insights.bestMonth.leads} leads - analyze what worked then.</>
              )}
              {!trendUp && !trendDown && (
                <>Stable performance at ~{data.insights.avgLeadsPerMonth} leads/month. Consider testing new campaigns to accelerate growth.</>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
