'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils';
import { 
  Target, 
  MousePointer, 
  Eye,
  DollarSign,
  TrendingUp,
  ArrowDown,
  Users
} from 'lucide-react';

interface GoogleAdsData {
  totalMetrics: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    cpc: number;
    costPerConversion: number;
    ctr: number;
    conversionRate: number;
  };
  campaigns: any[];
  adGroups: any[];
  keywords: any[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

interface GoogleAdsSectionProps {
  period: string;
  clientId?: string;
}

export function GoogleAdsSection({ period, clientId }: GoogleAdsSectionProps) {
  const [data, setData] = useState<GoogleAdsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(true);

  useEffect(() => {
    fetchGoogleAdsData();
  }, [period, clientId]);

  const fetchGoogleAdsData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/google-ads?period=${period}&report=overview&clientId=${clientId}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setData(result.data);
        // Check if there's meaningful data
        const hasMetrics = result.data.totalMetrics && (
          result.data.totalMetrics.impressions > 0 ||
          result.data.totalMetrics.clicks > 0 ||
          result.data.totalMetrics.cost > 0
        );
        setHasData(hasMetrics);
      } else {
        setHasData(false);
      }
    } catch (error) {
      console.error('Failed to fetch Google Ads data:', error);
      setHasData(false);
    } finally {
      setLoading(false);
    }
  };

  // Don't render the section if no data and not loading
  if (!loading && !hasData) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#4285F4] rounded flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              Google Ads Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const FunnelVisualization = () => {
    const impressions = data?.totalMetrics.impressions || 0;
    const clicks = data?.totalMetrics.clicks || 0;
    const conversions = data?.totalMetrics.conversions || 0;
    
    const clickRate = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

    return (
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-6 text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Conversion Funnel
        </h3>
        
        <div className="space-y-4">
          {/* Impressions */}
          <div className="relative">
            <div className="bg-gradient-to-r from-blue-400 to-blue-500 h-16 flex items-center justify-between px-6 rounded-lg text-white shadow-md">
              <div className="flex items-center gap-3">
                <Eye className="w-6 h-6" />
                <div>
                  <div className="font-semibold text-lg">{formatNumber(impressions)}</div>
                  <div className="text-blue-100 text-sm">Impressions</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-blue-100 text-sm">Ad Views</div>
                <div className="font-medium">100%</div>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-gray-400" />
          </div>

          {/* Clicks */}
          <div className="relative">
            <div className="bg-gradient-to-r from-green-400 to-green-500 h-16 flex items-center justify-between px-6 rounded-lg text-white shadow-md" 
                 style={{ width: `${Math.max(20, clickRate)}%`, minWidth: '300px' }}>
              <div className="flex items-center gap-3">
                <MousePointer className="w-6 h-6" />
                <div>
                  <div className="font-semibold text-lg">{formatNumber(clicks)}</div>
                  <div className="text-green-100 text-sm">Clicks</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-green-100 text-sm">CTR</div>
                <div className="font-medium">{formatPercentage(clickRate, 1)}</div>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-gray-400" />
          </div>

          {/* Conversions/Leads */}
          <div className="relative">
            <div className="bg-gradient-to-r from-purple-400 to-purple-500 h-16 flex items-center justify-between px-6 rounded-lg text-white shadow-md"
                 style={{ width: `${Math.max(15, conversionRate)}%`, minWidth: '250px' }}>
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6" />
                <div>
                  <div className="font-semibold text-lg">{formatNumber(conversions)}</div>
                  <div className="text-purple-100 text-sm">Leads</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-purple-100 text-sm">Conv. Rate</div>
                <div className="font-medium">{formatPercentage(conversionRate, 1)}</div>
              </div>
            </div>
          </div>

          {/* Funnel Summary */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Cost Per Click</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(data?.totalMetrics.cpc || 0)}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Cost Per Lead</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(data?.totalMetrics.costPerConversion || 0)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 mb-6">
      {/* Google Ads Header */}
      <Card className="border-l-4 border-l-[#4285F4]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="w-8 h-8 bg-[#4285F4] rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              Google Ads Dashboard
              <span className="text-sm font-normal text-gray-500">
                ({period === 'today' ? 'Today' : period === '7days' ? 'Last 7 days' : period === '30days' ? 'Last 30 days' : 'Last 90 days'})
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        
        {/* Main Metrics Grid */}
        <CardContent className="space-y-6">
          {/* Primary Metrics - 5 columns as requested */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <Eye className="w-5 h-5 text-blue-600" />
                <span className="text-xs text-gray-500">IMPRESSIONS</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(data?.totalMetrics.impressions || 0)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Ad views
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <MousePointer className="w-5 h-5 text-green-600" />
                <span className="text-xs text-gray-500">CLICKS</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(data?.totalMetrics.clicks || 0)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Total clicks
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-5 h-5 text-yellow-600" />
                <span className="text-xs text-gray-500">CPC</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(data?.totalMetrics.cpc || 0)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Cost per click
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <span className="text-xs text-gray-500">COST/CONVERSION</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(data?.totalMetrics.costPerConversion || 0)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Cost per lead
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-red-600" />
                <span className="text-xs text-gray-500">TOTAL COST</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(data?.totalMetrics.cost || 0)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Ad spend
              </div>
            </div>
          </div>

          {/* Funnel Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FunnelVisualization />
            
            {/* Additional Metrics */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Performance Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-blue-900">Click-Through Rate</div>
                    <div className="text-xs text-blue-700">Clicks ÷ Impressions</div>
                  </div>
                  <div className="text-lg font-bold text-blue-800">
                    {formatPercentage(data?.totalMetrics.ctr || 0, 2)}
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-green-900">Conversion Rate</div>
                    <div className="text-xs text-green-700">Conversions ÷ Clicks</div>
                  </div>
                  <div className="text-lg font-bold text-green-800">
                    {formatPercentage(data?.totalMetrics.conversionRate || 0, 2)}
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-purple-900">Total Conversions</div>
                    <div className="text-xs text-purple-700">Qualified leads</div>
                  </div>
                  <div className="text-lg font-bold text-purple-800">
                    {formatNumber(data?.totalMetrics.conversions || 0)}
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-orange-900">Avg. Position</div>
                    <div className="text-xs text-orange-700">Search ranking</div>
                  </div>
                  <div className="text-lg font-bold text-orange-800">
                    N/A
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}