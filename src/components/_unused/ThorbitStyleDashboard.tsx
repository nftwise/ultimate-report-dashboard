'use client';

import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Globe, MousePointer, Eye, Calendar, TrendingUp, Phone, DollarSign, Target } from 'lucide-react';

// Thorbit Color Palette
const colors = {
  primary: '#8B7355', // Warm brown
  primaryLight: '#A68B5B',
  primaryDark: '#6B5344',
  accent: '#5D8A3E', // Green for positive
  accentLight: '#7BA85C',
  danger: '#C4564A', // Red for negative
  dangerLight: '#E07B6F',
  background: '#FAF8F5', // Cream background
  cardBg: '#FFFFFF',
  cardBorder: '#E8E4DE',
  textPrimary: '#3D3D3D',
  textSecondary: '#6B6B6B',
  textMuted: '#9B9B9B',
};

interface ThorbitKPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  iconBg: string;
}

function ThorbitKPICard({ title, value, change, icon, iconBg }: ThorbitKPICardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#E8E4DE] shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-[#6B6B6B] font-medium">{title}</p>
          <p className="text-2xl font-bold text-[#3D3D3D]">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-semibold ${
            isPositive ? 'bg-[#E8F5E0] text-[#5D8A3E]' : 'bg-[#FCEAE8] text-[#C4564A]'
          }`}>
            {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

interface ChannelCardProps {
  name: string;
  icon: string;
  metrics: {
    label: string;
    value: number | string;
    change?: number;
  }[];
  chartData?: number[];
  accentColor: string;
}

function ChannelCard({ name, icon, metrics, chartData, accentColor }: ChannelCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E4DE] overflow-hidden hover:shadow-lg transition-all">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E8E4DE] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <h3 className="font-bold text-[#3D3D3D] text-lg">{name}</h3>
        </div>
        <button className="text-[#8B7355] hover:text-[#6B5344] transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="p-5 grid grid-cols-2 gap-4">
        {metrics.map((metric, idx) => (
          <div key={idx}>
            <p className="text-xs text-[#9B9B9B] font-medium uppercase tracking-wide">{metric.label}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-[#3D3D3D]">
                {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
              </span>
              {metric.change !== undefined && (
                <span className={`text-xs font-semibold ${
                  metric.change >= 0 ? 'text-[#5D8A3E]' : 'text-[#C4564A]'
                }`}>
                  {metric.change >= 0 ? '↗' : '↘'} {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mini Chart */}
      {chartData && chartData.length > 0 && (
        <div className="px-5 pb-5">
          <div className="h-16 flex items-end gap-1">
            {chartData.map((value, idx) => {
              const maxValue = Math.max(...chartData);
              const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
              return (
                <div
                  key={idx}
                  className="flex-1 rounded-t transition-all hover:opacity-80"
                  style={{
                    height: `${height}%`,
                    backgroundColor: accentColor,
                    minHeight: '4px'
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface RankingBadgeProps {
  range: string;
  count: number;
  change?: number;
  color: string;
}

function RankingBadge({ range, count, change, color }: RankingBadgeProps) {
  return (
    <div className="text-center">
      <div
        className="px-3 py-1 rounded-full text-white text-xs font-bold mb-1"
        style={{ backgroundColor: color }}
      >
        {range}
      </div>
      <div className="text-lg font-bold text-[#3D3D3D]">{count.toLocaleString()}</div>
      {change !== undefined && (
        <div className={`text-xs font-medium ${change >= 0 ? 'text-[#5D8A3E]' : 'text-[#C4564A]'}`}>
          {change >= 0 ? '+' : ''}{change}
        </div>
      )}
    </div>
  );
}

interface ThorbitStyleDashboardProps {
  data: any;
  gbpData?: any;
  searchConsoleData?: any;
  gaEvents?: any;
  period: string;
  comparison?: {
    trafficChange?: number;
    leadsChange?: number;
    phoneCallsChange?: number;
    spendChange?: number;
    cplChange?: number;
  };
}

export default function ThorbitStyleDashboard({
  data,
  gbpData,
  searchConsoleData,
  gaEvents,
  period,
  comparison
}: ThorbitStyleDashboardProps) {
  // Extract metrics from data
  const sessions = data?.googleAnalytics?.metrics?.sessions || 0;
  const leads = (data?.googleAds?.totalMetrics?.conversions || 0) + (gaEvents?.formSubmissions || 0);
  const phoneCalls = data?.googleAds?.totalMetrics?.phoneCallConversions || 0;
  const adSpend = data?.googleAds?.totalMetrics?.cost || 0;
  const impressions = data?.googleAds?.totalMetrics?.impressions || 0;
  const clicks = data?.googleAds?.totalMetrics?.clicks || 0;
  const ctr = data?.googleAds?.totalMetrics?.ctr || 0;
  const cpl = leads > 0 ? adSpend / leads : 0;

  // GBP metrics
  const gbpCalls = gbpData?.CALL_CLICKS || 0;
  const gbpWebsite = gbpData?.WEBSITE_CLICKS || 0;
  const gbpDirections = gbpData?.BUSINESS_DIRECTION_REQUESTS || 0;
  const gbpViews = (gbpData?.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) +
                   (gbpData?.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0) +
                   (gbpData?.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) +
                   (gbpData?.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0);

  // Mock chart data (would be real data in production)
  const generateChartData = () => Array.from({ length: 14 }, () => Math.floor(Math.random() * 100) + 20);

  return (
    <div className="space-y-6" style={{ backgroundColor: colors.background }}>
      {/* Top Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThorbitKPICard
          title="Total Traffic"
          value={sessions}
          change={comparison?.trafficChange}
          icon={<Globe className="w-6 h-6 text-[#8B7355]" />}
          iconBg="bg-[#F5F0E8]"
        />
        <ThorbitKPICard
          title="Total Leads"
          value={leads}
          change={comparison?.leadsChange}
          icon={<Target className="w-6 h-6 text-[#5D8A3E]" />}
          iconBg="bg-[#E8F5E0]"
        />
        <ThorbitKPICard
          title="Phone Calls"
          value={phoneCalls + gbpCalls}
          change={comparison?.phoneCallsChange}
          icon={<Phone className="w-6 h-6 text-[#E09B3D]" />}
          iconBg="bg-[#FFF4E5]"
        />
        <ThorbitKPICard
          title="Date Range"
          value={period === '7days' ? '7 Days' : period === '30days' ? '30 Days' : period === '90days' ? '90 Days' : period}
          icon={<Calendar className="w-6 h-6 text-[#6B8E9F]" />}
          iconBg="bg-[#E8F0F5]"
        />
      </div>

      {/* Channel Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Google Ads Card */}
        <ChannelCard
          name="Google Ads"
          icon="📢"
          accentColor="#4285F4"
          metrics={[
            { label: 'Clicks', value: clicks, change: comparison?.trafficChange },
            { label: 'Impressions', value: impressions > 1000 ? `${(impressions/1000).toFixed(1)}K` : impressions },
            { label: 'CTR', value: `${ctr.toFixed(1)}%` },
            { label: 'Cost', value: `$${adSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          ]}
          chartData={generateChartData()}
        />

        {/* Google Analytics Card */}
        <ChannelCard
          name="Organic Traffic"
          icon="🔍"
          accentColor="#34A853"
          metrics={[
            { label: 'Sessions', value: sessions, change: comparison?.trafficChange },
            { label: 'Users', value: data?.googleAnalytics?.metrics?.users || 0 },
            { label: 'Bounce Rate', value: `${(data?.googleAnalytics?.metrics?.bounceRate || 0).toFixed(1)}%` },
            { label: 'Avg Duration', value: `${Math.floor((data?.googleAnalytics?.metrics?.sessionDuration || 0) / 60)}m` },
          ]}
          chartData={generateChartData()}
        />

        {/* Google Business Profile Card */}
        <ChannelCard
          name="Google Business"
          icon="📍"
          accentColor="#EA4335"
          metrics={[
            { label: 'Phone Calls', value: gbpCalls },
            { label: 'Website Clicks', value: gbpWebsite },
            { label: 'Directions', value: gbpDirections },
            { label: 'Profile Views', value: gbpViews > 1000 ? `${(gbpViews/1000).toFixed(1)}K` : gbpViews },
          ]}
          chartData={generateChartData()}
        />
      </div>

      {/* Performance Summary */}
      <div className="bg-white rounded-2xl border border-[#E8E4DE] p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[#3D3D3D]">Performance Summary</h2>
            <p className="text-sm text-[#9B9B9B] mt-1">Key metrics for the selected period</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          <div className="text-center p-4 bg-[#FAF8F5] rounded-xl">
            <p className="text-xs text-[#9B9B9B] font-medium uppercase tracking-wide mb-2">Ad Spend</p>
            <p className="text-2xl font-bold text-[#3D3D3D]">${adSpend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            {comparison?.spendChange !== undefined && (
              <p className={`text-xs font-semibold mt-1 ${comparison.spendChange >= 0 ? 'text-[#5D8A3E]' : 'text-[#C4564A]'}`}>
                {comparison.spendChange >= 0 ? '↗' : '↘'} {comparison.spendChange.toFixed(1)}%
              </p>
            )}
          </div>

          <div className="text-center p-4 bg-[#FAF8F5] rounded-xl">
            <p className="text-xs text-[#9B9B9B] font-medium uppercase tracking-wide mb-2">Cost/Lead</p>
            <p className="text-2xl font-bold text-[#3D3D3D]">${cpl.toFixed(2)}</p>
            {comparison?.cplChange !== undefined && (
              <p className={`text-xs font-semibold mt-1 ${comparison.cplChange <= 0 ? 'text-[#5D8A3E]' : 'text-[#C4564A]'}`}>
                {comparison.cplChange <= 0 ? '↗' : '↘'} {Math.abs(comparison.cplChange).toFixed(1)}%
              </p>
            )}
          </div>

          <div className="text-center p-4 bg-[#FAF8F5] rounded-xl">
            <p className="text-xs text-[#9B9B9B] font-medium uppercase tracking-wide mb-2">Conversions</p>
            <p className="text-2xl font-bold text-[#3D3D3D]">{leads}</p>
            {comparison?.leadsChange !== undefined && (
              <p className={`text-xs font-semibold mt-1 ${comparison.leadsChange >= 0 ? 'text-[#5D8A3E]' : 'text-[#C4564A]'}`}>
                {comparison.leadsChange >= 0 ? '↗' : '↘'} {comparison.leadsChange.toFixed(1)}%
              </p>
            )}
          </div>

          <div className="text-center p-4 bg-[#FAF8F5] rounded-xl">
            <p className="text-xs text-[#9B9B9B] font-medium uppercase tracking-wide mb-2">Form Fills</p>
            <p className="text-2xl font-bold text-[#3D3D3D]">{gaEvents?.formSubmissions || 0}</p>
          </div>

          <div className="text-center p-4 bg-[#FAF8F5] rounded-xl">
            <p className="text-xs text-[#9B9B9B] font-medium uppercase tracking-wide mb-2">Phone Calls</p>
            <p className="text-2xl font-bold text-[#3D3D3D]">{phoneCalls + gbpCalls}</p>
            {comparison?.phoneCallsChange !== undefined && (
              <p className={`text-xs font-semibold mt-1 ${comparison.phoneCallsChange >= 0 ? 'text-[#5D8A3E]' : 'text-[#C4564A]'}`}>
                {comparison.phoneCallsChange >= 0 ? '↗' : '↘'} {comparison.phoneCallsChange.toFixed(1)}%
              </p>
            )}
          </div>

          <div className="text-center p-4 bg-[#FAF8F5] rounded-xl">
            <p className="text-xs text-[#9B9B9B] font-medium uppercase tracking-wide mb-2">GBP Actions</p>
            <p className="text-2xl font-bold text-[#3D3D3D]">{gbpCalls + gbpWebsite + gbpDirections}</p>
          </div>
        </div>
      </div>

      {/* Ranking Distribution (if search console data available) */}
      {searchConsoleData && (
        <div className="bg-white rounded-2xl border border-[#E8E4DE] p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#3D3D3D]">Query Count by Ranking</h2>
              <p className="text-sm text-[#9B9B9B] mt-1">Distribution of keywords by search position</p>
            </div>
          </div>

          <div className="flex justify-center gap-8">
            <RankingBadge range="1-3" count={searchConsoleData.ranking?.top3 || 0} change={5} color="#5D8A3E" />
            <RankingBadge range="4-10" count={searchConsoleData.ranking?.top10 || 0} change={-2} color="#7BA85C" />
            <RankingBadge range="11-20" count={searchConsoleData.ranking?.page2 || 0} change={-8} color="#E09B3D" />
            <RankingBadge range="21+" count={searchConsoleData.ranking?.beyond || 0} change={12} color="#9B9B9B" />
          </div>
        </div>
      )}
    </div>
  );
}
