'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Phone, 
  Users, 
  TrendingUp, 
  MousePointer,
  Clock,
  Target,
  PhoneCall,
} from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';
import { ChartContainer } from '@/components/ChartContainer';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { DataTable } from '@/components/DataTable';
import { GoogleAnalyticsSection } from '@/components/GoogleAnalyticsSection';
import { DashboardMetrics } from '@/types';
import { formatCurrency, formatNumber } from '@/lib/utils';

export default function Dashboard() {
  const [period, setPeriod] = useState('7days');
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 300000); // Refresh every 5 minutes

    return () => clearInterval(interval);
  }, [period]);

  const fetchDashboardData = async () => {
    try {
      // Don't block the UI - start loading immediately with optimistic UI
      const startTime = Date.now();
      
      // Only set loading to true if we don't have any cached data
      if (!data) {
        setLoading(true);
      }
      
      const response = await fetch(`/api/dashboard?period=${period}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setLastUpdated(new Date());
        
        // Log performance for debugging
        const loadTime = Date.now() - startTime;
        console.log(`Dashboard data loaded in ${loadTime}ms`);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ultimate Marketing Analytics</h1>
            <p className="text-gray-600 mt-1">
              Comprehensive insights from Google Analytics, Google Ads, and CallRail
            </p>
            {lastUpdated && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <TimeRangeSelector
            selectedPeriod={period}
            onPeriodChange={setPeriod}
          />
        </div>

        {/* Google Analytics Section - Top Priority */}
        <GoogleAnalyticsSection period={period} />

        {/* Cross-Platform Summary Metrics */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-green-500 rounded"></div>
            Cross-Platform Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Sessions"
            value={data?.googleAnalytics.metrics.sessions || 0}
            format="number"
            icon={Users}
            description="from Google Analytics"
            loading={loading && !data}
          />
          <MetricCard
            title="Ad Spend"
            value={data?.googleAds.totalMetrics.cost || 0}
            format="currency"
            icon={DollarSign}
            description="Google Ads"
            loading={loading && !data}
          />
          <MetricCard
            title="Phone Calls"
            value={data?.callRail.metrics.totalCalls || 0}
            format="number"
            icon={Phone}
            loading={loading && !data}
            description="from CallRail"
          />
          <MetricCard
            title="Total Conversions"
            value={data?.combined.totalConversions || 0}
            format="number"
            icon={Target}
            description="all sources"
            loading={loading && !data}
          />
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-red-500 rounded"></div>
            Performance & Cost Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Cost Per Click"
            value={data?.googleAds.totalMetrics.cpc || 0}
            format="currency"
            icon={MousePointer}
            description="Google Ads CPC"
            loading={loading && !data}
          />
          <MetricCard
            title="Cost Per Lead"
            value={data?.combined.overallCostPerLead || 0}
            format="currency"
            icon={TrendingUp}
            description="across all channels"
            loading={loading && !data}
          />
          <MetricCard
            title="Call Duration"
            value={data?.callRail.metrics.averageDuration || 0}
            format="duration"
            icon={Clock}
            description="average call time"
            loading={loading && !data}
          />
          <MetricCard
            title="Call Conversion Rate"
            value={data?.callRail.metrics.conversionRate || 0}
            format="percentage"
            icon={PhoneCall}
            description="calls to leads"
            loading={loading && !data}
          />
          </div>
        </div>

        {/* Analytics Charts */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded"></div>
            Trends & Performance Charts
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <GoogleAdsChart period={period} loading={loading} />
          <CallRailChart period={period} loading={loading} />
          </div>
        </div>

        {/* Detailed Reports */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-blue-500 rounded"></div>
            Detailed Campaign & Call Reports
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <GoogleAdsCampaignTable period={period} loading={loading} />
          <CallsBySourceTable period={period} loading={loading} />
          </div>
        </div>

        {/* Traffic Source Analysis */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-teal-500 rounded"></div>
            Traffic Source Analysis
          </h2>
          <TrafficSourcesTable period={period} loading={loading} />
        </div>
      </div>
    </div>
  );
}

function GoogleAdsChart({ period, loading }: { period: string; loading: boolean }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchGoogleAdsChart();
  }, [period]);

  const fetchGoogleAdsChart = async () => {
    try {
      const response = await fetch(`/api/google-ads?period=${period}&report=cost-per-lead`);
      const result = await response.json();
      
      if (result.success) {
        const chartData = result.data.map((item: any) => ({
          date: item.date,
          cost: item.cost,
          conversions: item.conversions,
          costPerLead: item.costPerLead,
        }));
        setData(chartData);
      }
    } catch (error) {
      console.error('Failed to fetch Google Ads chart data:', error);
    }
  };

  return (
    <ChartContainer
      title="Google Ads: Cost vs Conversions"
      data={data}
      type="area"
      dataKey="cost"
      xAxisKey="date"
      color="#3b82f6"
      loading={loading}
      yAxisLabel="Cost ($)"
      formatValue={(value) => formatCurrency(value)}
    />
  );
}

function CallRailChart({ period, loading }: { period: string; loading: boolean }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchCallRailChart();
  }, [period]);

  const fetchCallRailChart = async () => {
    try {
      const response = await fetch(`/api/callrail?period=${period}&report=by-day`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch CallRail chart data:', error);
    }
  };

  return (
    <ChartContainer
      title="Daily Phone Calls"
      data={data}
      type="bar"
      dataKey="totalCalls"
      xAxisKey="date"
      color="#10b981"
      loading={loading}
      yAxisLabel="Calls"
      formatValue={(value) => formatNumber(value)}
    />
  );
}

function GoogleAdsCampaignTable({ period, loading }: { period: string; loading: boolean }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchCampaigns();
  }, [period]);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch(`/api/google-ads?period=${period}&report=campaigns`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data.campaigns || []);
      }
    } catch (error) {
      console.error('Failed to fetch campaigns data:', error);
    }
  };

  const columns = [
    { key: 'name', label: 'Campaign', format: 'none' as const },
    { key: 'cost', label: 'Cost', format: 'currency' as const, align: 'right' as const },
    { key: 'clicks', label: 'Clicks', format: 'number' as const, align: 'right' as const },
    { key: 'conversions', label: 'Conversions', format: 'number' as const, align: 'right' as const },
    { key: 'cpc', label: 'CPC', format: 'currency' as const, align: 'right' as const },
    { key: 'costPerConversion', label: 'Cost/Lead', format: 'currency' as const, align: 'right' as const },
  ];

  return (
    <DataTable
      title="Top Google Ads Campaigns"
      data={data.map((campaign: any) => ({
        name: campaign.name,
        cost: campaign.metrics.cost,
        clicks: campaign.metrics.clicks,
        conversions: campaign.metrics.conversions,
        cpc: campaign.metrics.cpc,
        costPerConversion: campaign.metrics.costPerConversion,
      }))}
      columns={columns}
      loading={loading}
    />
  );
}

function CallsBySourceTable({ period, loading }: { period: string; loading: boolean }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchCallsBySource();
  }, [period]);

  const fetchCallsBySource = async () => {
    try {
      const response = await fetch(`/api/callrail?period=${period}&report=by-source`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch calls by source data:', error);
    }
  };

  const columns = [
    { key: 'source', label: 'Source', format: 'none' as const },
    { key: 'totalCalls', label: 'Total Calls', format: 'number' as const, align: 'right' as const },
    { key: 'answeredCalls', label: 'Answered', format: 'number' as const, align: 'right' as const },
    { key: 'conversions', label: 'Conversions', format: 'number' as const, align: 'right' as const },
  ];

  return (
    <DataTable
      title="Calls by Source"
      data={data}
      columns={columns}
      loading={loading}
    />
  );
}

function TrafficSourcesTable({ period, loading }: { period: string; loading: boolean }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchTrafficSources();
  }, [period]);

  const fetchTrafficSources = async () => {
    try {
      const response = await fetch(`/api/google-analytics?period=${period}&report=traffic-sources`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch traffic sources data:', error);
    }
  };

  const columns = [
    { key: 'source', label: 'Source', format: 'none' as const },
    { key: 'medium', label: 'Medium', format: 'none' as const },
    { key: 'sessions', label: 'Sessions', format: 'number' as const, align: 'right' as const },
    { key: 'users', label: 'Users', format: 'number' as const, align: 'right' as const },
    { key: 'conversions', label: 'Conversions', format: 'number' as const, align: 'right' as const },
  ];

  return (
    <DataTable
      title="Top Traffic Sources (Google Analytics)"
      data={data}
      columns={columns}
      loading={loading}
      maxRows={15}
    />
  );
}