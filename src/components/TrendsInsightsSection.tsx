'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Trophy,
  Phone,
  DollarSign,
  Target,
  Eye,
  Activity
} from 'lucide-react';

interface TrendsData {
  weekOverWeek: {
    sessions: { value: number; change: number; };
    cost: { value: number; change: number; };
    conversions: { value: number; change: number; };
    calls: { value: number; change: number; };
  };
  monthOverMonth: {
    sessions: { value: number; change: number; };
    cost: { value: number; change: number; };
    conversions: { value: number; change: number; };
    calls: { value: number; change: number; };
  };
  topPerformers: {
    campaigns: Array<{ name: string; metric: string; value: number; }>;
  };
  alerts: Array<{
    type: 'warning' | 'danger' | 'info';
    title: string;
    message: string;
    value?: number;
    impact?: string;
  }>;
}

interface TrendsInsightsSectionProps {
  period: string;
  clientId?: string;
}

export function TrendsInsightsSection({ period, clientId }: TrendsInsightsSectionProps) {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [callData, setCallData] = useState<any>(null);
  const [adsData, setAdsData] = useState<any>(null);

  useEffect(() => {
    fetchTrendsData();
  }, [period, clientId]);

  const fetchTrendsData = async () => {
    try {
      setLoading(true);
      
      // Fetch current data for context (non-blocking)
      const [callResponse, adsResponse] = await Promise.allSettled([
        fetch(`/api/callrail?period=${period}&report=overview&clientId=${clientId}`),
        fetch(`/api/google-ads?period=${period}&report=overview&clientId=${clientId}`)
      ]);

      // Process CallRail data
      if (callResponse.status === 'fulfilled') {
        const callResult = await callResponse.value.json();
        if (callResult.success) {
          setCallData(callResult.data);
        }
      }

      // Process Google Ads data (will likely fail due to token restrictions)
      if (adsResponse.status === 'fulfilled') {
        const adsResult = await adsResponse.value.json();
        if (adsResult.success) {
          setAdsData(adsResult.data);
        }
      }

      // Generate insights with real comparison data
      await generateInsights();
    } catch (error) {
      console.error('Failed to fetch trends data:', error);
      // Set error state
      setData({
        weekOverWeek: {
          sessions: { value: 0, change: 0 },
          cost: { value: 0, change: 0 },
          conversions: { value: 0, change: 0 },
          calls: { value: 0, change: 0 },
        },
        monthOverMonth: {
          sessions: { value: 0, change: 0 },
          cost: { value: 0, change: 0 },
          conversions: { value: 0, change: 0 },
          calls: { value: 0, change: 0 },
        },
        topPerformers: { campaigns: [] },
        alerts: [{
          type: 'danger',
          title: 'Failed to Load Trends Data',
          message: 'Unable to fetch comparison data',
          impact: 'please check your network connection and try again'
        }]
      });
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async () => {
    try {
      // Fetch current period and comparison period data
      const currentPeriod = period;
      let comparisonPeriod = '';
      let comparisonLabel = '';
      
      // Determine comparison period based on current selection
      if (period === '7days') {
        comparisonPeriod = '14days'; // Compare last 7 days vs previous 7 days
        comparisonLabel = 'Week-over-Week';
      } else if (period === '30days') {
        comparisonPeriod = '60days'; // Compare last 30 days vs previous 30 days  
        comparisonLabel = 'Month-over-Month';
      } else {
        comparisonPeriod = period;
        comparisonLabel = 'Period Comparison';
      }

      // Fetch comparison data in parallel
      const [currentAnalytics, comparisonAnalytics, currentCalls, comparisonCalls] = await Promise.allSettled([
        fetch(`/api/google-analytics?period=${currentPeriod}&report=basic&clientId=${clientId}`),
        fetch(`/api/google-analytics?period=${comparisonPeriod}&report=basic&clientId=${clientId}`),
        fetch(`/api/callrail?period=${currentPeriod}&report=overview&clientId=${clientId}`),
        fetch(`/api/callrail?period=${comparisonPeriod}&report=overview&clientId=${clientId}`)
      ]);

      // Process results
      let currentGA = null, comparisonGA = null;
      let currentCallData = null, comparisonCallData = null;

      if (currentAnalytics.status === 'fulfilled') {
        const response = await currentAnalytics.value.json();
        if (response.success) currentGA = response.data;
      }

      if (comparisonAnalytics.status === 'fulfilled') {
        const response = await comparisonAnalytics.value.json();
        if (response.success) comparisonGA = response.data;
      }

      if (currentCalls.status === 'fulfilled') {
        const response = await currentCalls.value.json();
        if (response.success) currentCallData = response.data;
      }

      if (comparisonCalls.status === 'fulfilled') {
        const response = await comparisonCalls.value.json();
        if (response.success) comparisonCallData = response.data;
      }

      // Calculate changes
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      // Build trends data with real API data
      const trendsData: TrendsData = {
        weekOverWeek: {
          sessions: { 
            value: currentGA?.metrics?.sessions || 0, 
            change: calculateChange(
              currentGA?.metrics?.sessions || 0, 
              comparisonGA?.metrics?.sessions || 0
            )
          },
          cost: { 
            value: adsData?.totalMetrics?.cost || 0, 
            change: 0 // Google Ads not available due to token restrictions
          },
          conversions: { 
            value: currentGA?.metrics?.conversions || 0, 
            change: calculateChange(
              currentGA?.metrics?.conversions || 0, 
              comparisonGA?.metrics?.conversions || 0
            )
          },
          calls: { 
            value: currentCallData?.metrics?.totalCalls || 0, 
            change: calculateChange(
              currentCallData?.metrics?.totalCalls || 0, 
              comparisonCallData?.metrics?.totalCalls || 0
            )
          },
        },
        monthOverMonth: {
          sessions: { 
            value: currentGA?.metrics?.sessions || 0, 
            change: calculateChange(
              currentGA?.metrics?.sessions || 0, 
              comparisonGA?.metrics?.sessions || 0
            )
          },
          cost: { 
            value: adsData?.totalMetrics?.cost || 0, 
            change: 0
          },
          conversions: { 
            value: currentGA?.metrics?.conversions || 0, 
            change: calculateChange(
              currentGA?.metrics?.conversions || 0, 
              comparisonGA?.metrics?.conversions || 0
            )
          },
          calls: { 
            value: currentCallData?.metrics?.totalCalls || 0, 
            change: calculateChange(
              currentCallData?.metrics?.totalCalls || 0, 
              comparisonCallData?.metrics?.totalCalls || 0
            )
          },
        },
        topPerformers: {
          campaigns: [] // Will be populated from real Google Ads data when available
        },
        alerts: []
      };

      // Generate real alerts based on actual data
      if (currentCallData?.metrics) {
        const missedCalls = currentCallData.metrics.missedCalls || 0;
        const potentialRevenue = missedCalls * 500;
        
        if (missedCalls > 3) {
          trendsData.alerts.push({
            type: 'danger',
            title: 'High Missed Calls',
            message: `${missedCalls} missed calls in current period`,
            value: potentialRevenue,
            impact: `potential $${formatNumber(potentialRevenue)} lost revenue`
          });
        }

        if (currentCallData.metrics.totalCalls < 5) {
          trendsData.alerts.push({
            type: 'warning',
            title: 'Low Call Volume',
            message: 'Call volume is below expected levels',
            impact: 'consider reviewing marketing campaigns or tracking setup'
          });
        }

        // Answer rate alert
        const answerRate = currentCallData.metrics.totalCalls > 0 ? 
          (currentCallData.metrics.answeredCalls / currentCallData.metrics.totalCalls) * 100 : 0;
        
        if (answerRate < 80 && currentCallData.metrics.totalCalls > 0) {
          trendsData.alerts.push({
            type: 'warning',
            title: 'Low Answer Rate',
            message: `Only ${formatPercentage(answerRate, 0)} of calls were answered`,
            impact: 'consider improving phone coverage during business hours'
          });
        }
      }

      // Google Analytics insights
      if (currentGA?.metrics) {
        const bounceRate = currentGA.metrics.bounceRate || 0;
        if (bounceRate > 70) {
          trendsData.alerts.push({
            type: 'warning',
            title: 'High Bounce Rate',
            message: `Website bounce rate is ${formatPercentage(bounceRate, 1)}`,
            impact: 'consider improving landing page quality and load times'
          });
        }

        // Session growth
        const sessionsChange = trendsData.weekOverWeek.sessions.change;
        if (sessionsChange > 10) {
          trendsData.alerts.push({
            type: 'info',
            title: 'Website Traffic Growing',
            message: `Sessions increased by ${formatPercentage(sessionsChange, 1)}`,
            impact: 'great progress on digital marketing efforts!'
          });
        }
      }

      // Add no data alerts if APIs are not working
      if (!currentGA) {
        trendsData.alerts.push({
          type: 'warning',
          title: 'Google Analytics Data Unavailable',
          message: 'Unable to fetch website analytics',
          impact: 'check Google Analytics API connection'
        });
      }

      if (!currentCallData) {
        trendsData.alerts.push({
          type: 'warning',
          title: 'CallRail Data Unavailable',
          message: 'Unable to fetch call tracking data',
          impact: 'check CallRail API connection'
        });
      }

      setData(trendsData);
    } catch (error) {
      console.error('Error generating insights:', error);
      // Set empty data on error
      setData({
        weekOverWeek: {
          sessions: { value: 0, change: 0 },
          cost: { value: 0, change: 0 },
          conversions: { value: 0, change: 0 },
          calls: { value: 0, change: 0 },
        },
        monthOverMonth: {
          sessions: { value: 0, change: 0 },
          cost: { value: 0, change: 0 },
          conversions: { value: 0, change: 0 },
          calls: { value: 0, change: 0 },
        },
        topPerformers: { campaigns: [] },
        alerts: [{
          type: 'danger',
          title: 'Data Processing Error',
          message: 'Unable to calculate trends and insights',
          impact: 'please refresh the page or contact support'
        }]
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              Trends & Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-48 bg-gray-200 rounded"></div>
                <div className="h-48 bg-gray-200 rounded"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const GrowthIndicator = ({ label, current, change, format = 'number' }: {
    label: string;
    current: number;
    change: number;
    format?: 'number' | 'currency';
  }) => {
    const isPositive = change >= 0;
    const formatValue = (val: number) => format === 'currency' ? formatCurrency(val) : formatNumber(val);
    
    return (
      <div className={`p-3 rounded-lg border-l-4 ${
        isPositive ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">{label}</div>
            <div className="text-lg font-bold text-gray-800">{formatValue(current)}</div>
          </div>
          <div className={`flex items-center gap-1 text-sm font-medium ${
            isPositive ? 'text-green-700' : 'text-red-700'
          }`}>
            {isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            {formatPercentage(Math.abs(change), 1)}
          </div>
        </div>
      </div>
    );
  };

  const AlertCard = ({ alert }: { alert: TrendsData['alerts'][0] }) => {
    const icons = {
      danger: <AlertTriangle className="w-5 h-5 text-red-600" />,
      warning: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
      info: <TrendingUp className="w-5 h-5 text-blue-600" />
    };

    const colors = {
      danger: 'border-red-200 bg-red-50',
      warning: 'border-yellow-200 bg-yellow-50',
      info: 'border-blue-200 bg-blue-50'
    };

    return (
      <div className={`p-4 rounded-lg border ${colors[alert.type]}`}>
        <div className="flex items-start gap-3">
          {icons[alert.type]}
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 mb-1">{alert.title}</h4>
            <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
            {alert.impact && (
              <p className="text-xs text-gray-600 italic">{alert.impact}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 mb-6">
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            Trends & Insights
            <span className="text-sm font-normal text-gray-500">
              Performance Analysis & Recommendations
            </span>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Growth Indicators */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Week-over-Week */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Week-over-Week Growth
              </h3>
              <div className="space-y-3">
                <GrowthIndicator 
                  label="Website Sessions" 
                  current={data?.weekOverWeek.sessions.value || 0} 
                  change={data?.weekOverWeek.sessions.change || 0} 
                />
                <GrowthIndicator 
                  label="Ad Spend" 
                  current={data?.weekOverWeek.cost.value || 0} 
                  change={data?.weekOverWeek.cost.change || 0} 
                  format="currency"
                />
                <GrowthIndicator 
                  label="Conversions" 
                  current={data?.weekOverWeek.conversions.value || 0} 
                  change={data?.weekOverWeek.conversions.change || 0} 
                />
                <GrowthIndicator 
                  label="Phone Calls" 
                  current={data?.weekOverWeek.calls.value || 0} 
                  change={data?.weekOverWeek.calls.change || 0} 
                />
              </div>
            </div>

            {/* Month-over-Month */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Month-over-Month Growth
              </h3>
              <div className="space-y-3">
                <GrowthIndicator 
                  label="Website Sessions" 
                  current={data?.monthOverMonth.sessions.value || 0} 
                  change={data?.monthOverMonth.sessions.change || 0} 
                />
                <GrowthIndicator 
                  label="Ad Spend" 
                  current={data?.monthOverMonth.cost.value || 0} 
                  change={data?.monthOverMonth.cost.change || 0} 
                  format="currency"
                />
                <GrowthIndicator 
                  label="Conversions" 
                  current={data?.monthOverMonth.conversions.value || 0} 
                  change={data?.monthOverMonth.conversions.change || 0} 
                />
                <GrowthIndicator 
                  label="Phone Calls" 
                  current={data?.monthOverMonth.calls.value || 0} 
                  change={data?.monthOverMonth.calls.change || 0} 
                />
              </div>
            </div>
          </div>

          {/* Top Performers and Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performers */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-600" />
                Top Performance Insights
              </h3>
              <div className="space-y-3">
                {data?.topPerformers?.campaigns && data.topPerformers.campaigns.length > 0 ? (
                  data.topPerformers.campaigns.map((campaign, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border-l-4 border-yellow-400">
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{campaign.name}</div>
                        <div className="text-sm text-gray-600">{campaign.metric}</div>
                      </div>
                      <div className="text-lg font-bold text-yellow-700">
                        {campaign.value}
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    {/* Show real performance insights based on available data */}
                    {callData?.metrics?.totalCalls > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-l-4 border-blue-400">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                          📞
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">Call Tracking Active</div>
                          <div className="text-sm text-gray-600">
                            {callData.metrics.totalCalls} total calls, {callData.metrics.answeredCalls} answered
                          </div>
                        </div>
                        <div className="text-lg font-bold text-blue-700">
                          {formatPercentage((callData.metrics.answeredCalls / callData.metrics.totalCalls) * 100, 0)}
                        </div>
                      </div>
                    )}
                    
                    {data?.weekOverWeek?.sessions?.value && data.weekOverWeek.sessions.value > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border-l-4 border-green-400">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">
                          📈
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">Website Analytics</div>
                          <div className="text-sm text-gray-600">
                            {formatNumber(data.weekOverWeek.sessions.value)} sessions in current period
                          </div>
                        </div>
                        <div className="text-lg font-bold text-green-700">
                          Active
                        </div>
                      </div>
                    )}
                    
                    {(!callData?.metrics?.totalCalls || callData.metrics.totalCalls === 0) && 
                     (!data?.weekOverWeek.sessions.value || data.weekOverWeek.sessions.value === 0) && (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-sm">No performance data available</div>
                        <div className="text-xs mt-1">Campaign performance will appear here when data is available</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Problem Alerts */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Alerts & Recommendations
              </h3>
              <div className="space-y-3">
                {data?.alerts.map((alert, index) => (
                  <AlertCard key={index} alert={alert} />
                ))}
              </div>
            </div>
          </div>

          {/* Key Performance Summary - Real Data Only */}
          {(data?.weekOverWeek || data?.monthOverMonth) && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-600" />
                Performance Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-700">
                    {data.weekOverWeek.sessions.change !== 0 ? 
                      formatPercentage(Math.abs(data.weekOverWeek.sessions.change)) : 
                      'No Data'
                    }
                  </div>
                  <div className="text-sm text-gray-600">Session Growth</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700">
                    {callData?.metrics?.totalCalls ? 
                      formatNumber(callData.metrics.totalCalls) : 
                      'No Data'
                    }
                  </div>
                  <div className="text-sm text-gray-600">Total Calls</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">
                    {data.weekOverWeek.conversions.value || 'No Data'}
                  </div>
                  <div className="text-sm text-gray-600">Conversions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-700">
                    {callData?.metrics?.totalCalls && callData?.metrics?.answeredCalls ? 
                      formatPercentage((callData.metrics.answeredCalls / callData.metrics.totalCalls) * 100) :
                      'No Data'
                    }
                  </div>
                  <div className="text-sm text-gray-600">Call Answer Rate</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}