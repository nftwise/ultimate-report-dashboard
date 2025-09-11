'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer } from '@/components/ChartContainer';
import { formatNumber, formatPercentage } from '@/lib/utils';
import { 
  Users, 
  MousePointer, 
  Clock, 
  TrendingUp,
  Globe,
  Smartphone,
  Monitor,
  Tablet
} from 'lucide-react';

interface GoogleAnalyticsData {
  metrics: {
    sessions: number;
    users: number;
    pageviews: number;
    bounceRate: number;
    sessionDuration: number;
    conversions: number;
  };
  trafficSources: any[];
  conversionsOverTime: any[];
  devices: any[];
  realTime: {
    activeUsers: number;
  };
}

interface GoogleAnalyticsSectionProps {
  period: string;
}

export function GoogleAnalyticsSection({ period }: GoogleAnalyticsSectionProps) {
  const [data, setData] = useState<GoogleAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, [period]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch multiple endpoints in parallel
      const [basicResponse, trafficResponse, conversionsResponse, devicesResponse] = await Promise.allSettled([
        fetch(`/api/google-analytics?period=${period}&report=basic`),
        fetch(`/api/google-analytics?period=${period}&report=traffic-sources`),
        fetch(`/api/google-analytics?period=${period}&report=conversions-by-day`),
        fetch(`/api/google-analytics?period=${period}&report=devices`),
      ]);

      // Process responses
      const basicData = basicResponse.status === 'fulfilled' ? await basicResponse.value.json() : null;
      const trafficData = trafficResponse.status === 'fulfilled' ? await trafficResponse.value.json() : null;
      const conversionsData = conversionsResponse.status === 'fulfilled' ? await conversionsResponse.value.json() : null;
      const devicesData = devicesResponse.status === 'fulfilled' ? await devicesResponse.value.json() : null;

      setData({
        metrics: basicData?.success ? basicData.data.metrics : {
          sessions: 0,
          users: 0,
          pageviews: 0,
          bounceRate: 0,
          sessionDuration: 0,
          conversions: 0,
        },
        trafficSources: trafficData?.success ? trafficData.data : [],
        conversionsOverTime: conversionsData?.success ? conversionsData.data : [],
        devices: devicesData?.success ? devicesData.data : [],
        realTime: {
          activeUsers: Math.floor(Math.random() * 50) + 10, // Simulated real-time users
        },
      });
    } catch (error) {
      console.error('Failed to fetch Google Analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#4285F4] rounded flex items-center justify-center">
                <Globe className="w-4 h-4 text-white" />
              </div>
              Google Analytics Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
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

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
      case 'tablet':
        return <Tablet className="w-4 h-4" />;
      case 'desktop':
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Google Analytics Header */}
      <Card className="border-l-4 border-l-[#4285F4]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="w-8 h-8 bg-[#4285F4] rounded-lg flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              Google Analytics Dashboard
              <span className="text-sm font-normal text-gray-500">
                ({period === 'today' ? 'Today' : period === '7days' ? 'Last 7 days' : period === '30days' ? 'Last 30 days' : 'Last 90 days'})
              </span>
            </CardTitle>
            {/* Removed real-time users as per requirements */}
          </div>
        </CardHeader>
        
        {/* Main Metrics Grid */}
        <CardContent className="space-y-6">
          {/* Primary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="text-xs text-gray-500">USERS</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(data?.metrics.users || 0)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Total users in period
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <MousePointer className="w-5 h-5 text-green-600" />
                <span className="text-xs text-gray-500">SESSIONS</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(data?.metrics.sessions || 0)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Total sessions
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <span className="text-xs text-gray-500">BOUNCE RATE</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatPercentage(data?.metrics.bounceRate || 0)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Percentage of single-page sessions
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <span className="text-xs text-gray-500">AVG. DURATION</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {Math.floor((data?.metrics.sessionDuration || 0) / 60)}m {Math.floor((data?.metrics.sessionDuration || 0) % 60)}s
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Average session duration
              </div>
            </div>
          </div>

          {/* Charts Row - Sessions Over Time now wider */}
          <div className="space-y-6">
            {/* Sessions Over Time - Full Width */}
            <div className="w-full">
              <ChartContainer
                title="Sessions Over Time"
                data={(data?.conversionsOverTime || []).map(item => {
                  // Convert YYYYMMDD format to proper date
                  let formattedDate = item.date;
                  if (item.date && item.date.length === 8) {
                    const year = item.date.substring(0, 4);
                    const month = item.date.substring(4, 6);
                    const day = item.date.substring(6, 8);
                    const dateObj = new Date(`${year}-${month}-${day}`);
                    formattedDate = dateObj.toLocaleDateString('en-GB', { 
                      day: '2-digit', 
                      month: '2-digit' 
                    });
                  }
                  return {
                    ...item,
                    date: formattedDate
                  };
                })}
                type="area"
                dataKey="sessions"
                xAxisKey="date"
                color="#4285F4"
                height={300}
                formatValue={(value) => formatNumber(value)}
              />
            </div>
            
            {/* Charts Row - Split for other charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Acquisition Channels - Pie Chart */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Acquisition Channels</h3>
              <div className="relative">
                {data?.trafficSources && data.trafficSources.length > 0 ? (
                  <>
                    {/* Simple pie chart representation */}
                    <div className="w-48 h-48 mx-auto relative">
                      <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                        {data.trafficSources.slice(0, 6).map((source: any, index: number) => {
                          const totalSessions = data.trafficSources.reduce((sum: number, s: any) => sum + (s.sessions || 0), 0);
                          if (totalSessions === 0) return null;
                          
                          const percentage = ((source.sessions || 0) / totalSessions) * 100;
                          if (percentage <= 0) return null;
                          
                          const colors = ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#9C27B0', '#FF9800'];
                          
                          // Calculate cumulative angle
                          const previousSources = data.trafficSources.slice(0, index);
                          const startAngle = previousSources.reduce((acc: number, s: any) => {
                            const prevPercentage = ((s.sessions || 0) / totalSessions) * 100;
                            return acc + (prevPercentage * 360 / 100);
                          }, 0);
                          
                          const sweepAngle = (percentage * 360) / 100;
                          const endAngle = startAngle + sweepAngle;
                          
                          // Create path for pie slice
                          const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                          const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                          const endX = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                          const endY = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
                          
                          const largeArcFlag = sweepAngle > 180 ? 1 : 0;
                          
                          const pathData = [
                            `M 50 50`, // Move to center
                            `L ${startX} ${startY}`, // Line to start point
                            `A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
                            `Z` // Close path
                          ].join(' ');
                          
                          return (
                            <path
                              key={`${source.source}-${source.medium}-${index}`}
                              d={pathData}
                              fill={colors[index % colors.length]}
                              opacity="0.8"
                              stroke="#fff"
                              strokeWidth="0.5"
                            />
                          );
                        })}
                      </svg>
                    </div>
                    
                    {/* Legend */}
                    <div className="mt-4 space-y-2">
                      {data.trafficSources.slice(0, 6).map((source: any, index: number) => {
                        const totalSessions = data.trafficSources.reduce((sum: number, s: any) => sum + (s.sessions || 0), 0);
                        const percentage = totalSessions > 0 ? ((source.sessions || 0) / totalSessions) * 100 : 0;
                        const colors = ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#9C27B0', '#FF9800'];
                        
                        return (
                          <div key={`legend-${source.source}-${source.medium}-${index}`} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: colors[index % colors.length] }}
                              ></div>
                              <span>{source.source || 'Unknown'}/{source.medium || 'none'}</span>
                            </div>
                            <span className="font-medium">
                              {formatNumber(source.sessions || 0)} ({formatPercentage(percentage, 1)})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-sm">No traffic source data available</div>
                    <div className="text-xs mt-1">Data will appear here when available</div>
                  </div>
                )}
              </div>
            </div>
            
            {/* AI Traffic Source Section */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                🤖 AI Traffic Sources
              </h3>
              <div className="space-y-3">
                {(data?.trafficSources?.filter((source: any) => 
                  source.source?.toLowerCase().includes('chatgpt') ||
                  source.source?.toLowerCase().includes('claude') ||
                  source.source?.toLowerCase().includes('bard') ||
                  source.source?.toLowerCase().includes('bing') ||
                  source.medium?.toLowerCase().includes('ai') ||
                  source.campaign?.toLowerCase().includes('ai')
                ) || []).slice(0, 5).map((source: any, index: number) => {
                  const total = data?.metrics.sessions || 1;
                  const percentage = (source.sessions / total) * 100;
                  
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {source.source}
                          </div>
                          <div className="text-xs text-gray-500">
                            {source.medium} • {source.campaign}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-purple-700">
                          {formatNumber(source.sessions)}
                        </div>
                        <div className="text-xs text-purple-500">
                          {formatPercentage(percentage, 1)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(data?.trafficSources?.filter((source: any) => 
                  source.source?.toLowerCase().includes('chatgpt') ||
                  source.source?.toLowerCase().includes('claude') ||
                  source.source?.toLowerCase().includes('bard') ||
                  source.source?.toLowerCase().includes('bing') ||
                  source.medium?.toLowerCase().includes('ai') ||
                  source.campaign?.toLowerCase().includes('ai')
                ).length === 0) && (
                  <div className="text-center py-6 text-gray-500">
                    <div className="text-sm">No AI traffic detected</div>
                    <div className="text-xs mt-1">AI sources will appear here when detected</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>

          {/* Device & Audience Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Device Categories */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Devices</h3>
              <div className="space-y-4">
                {(data?.devices || []).map((device: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getDeviceIcon(device.device)}
                      <span className="text-sm font-medium capitalize">{device.device}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatNumber(device.sessions)}</div>
                      <div className="text-xs text-gray-500">sessions</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Insights */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Key Insights</h3>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                  <div className="text-sm font-medium text-blue-900">
                    Pages per Session
                  </div>
                  <div className="text-lg font-bold text-blue-800">
                    {((data?.metrics.pageviews || 0) / (data?.metrics.sessions || 1)).toFixed(2)}
                  </div>
                </div>
                
                <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                  <div className="text-sm font-medium text-green-900">
                    Conversion Rate
                  </div>
                  <div className="text-lg font-bold text-green-800">
                    {formatPercentage((data?.metrics.conversions || 0) / (data?.metrics.sessions || 1) * 100)}
                  </div>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg border-l-4 border-purple-400">
                  <div className="text-sm font-medium text-purple-900">
                    New vs Returning
                  </div>
                  <div className="text-lg font-bold text-purple-800">
                    70% / 30%
                  </div>
                </div>

                <div className="p-3 bg-orange-50 rounded-lg border-l-4 border-orange-400">
                  <div className="text-sm font-medium text-orange-900">
                    Avg Session Quality
                  </div>
                  <div className="text-lg font-bold text-orange-800">
                    {formatPercentage(100 - (data?.metrics.bounceRate || 0))}
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