'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { cachedFetch, clearCachePattern } from '@/lib/browser-cache';
import {
  TrendingUp,
  Users,
  DollarSign,
  Target,
  Phone,
  LogOut,
  ArrowUp,
  ArrowDown,
  Building2,
  AlertCircle,
  AlertTriangle,
  Search,
  Eye,
  MousePointer,
  Calendar,
  BarChart3,
  MapPin,
  Globe,
  CheckCircle,
  XCircle,
  Clock,
  Wrench,
  Bot,
  Link,
  Mail,
  LayoutDashboard,
  ChevronRight,
  Smartphone,
  RefreshCw
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { WeeklyReport } from '@/components/WeeklyReport';
import SixMonthLeadsChart from '@/components/SixMonthLeadsChart';
import { LeadSourcesBreakdown } from '@/components/LeadSourcesBreakdown';
import { MonthInProgressCard } from '@/components/MonthInProgressCard';
import { AITrafficOnly } from '@/components/AITrafficOnly';
import { ServiceUnavailableCard } from '@/components/ServiceUnavailableCard';
import { TrafficSourcesPieChart } from '@/components/TrafficSourcesPieChart';
import { formatNumber } from '@/lib/format-utils';
import {
  SummaryCard,
  MetricWithChange,
  RankingBadge,
  MiniSparkline,
  ThorbitMetricCard,
  KPICard,
  PerformanceChart,
  ModernTrafficChart,
  FilterTabs,
  PositionFilter,
  ChannelCard,
  ChannelDetailCard,
  ConversionJourneySimple,
  RealTrafficSources,
  DeviceBreakdown,
  UserTypeBreakdown,
  AdsPerformanceMetrics,
  SEORankingMetrics,
  GBPReviewsCard,
  GBPPostsCard,
  calendarStyles,
} from '@/components/dashboard';

// Main Dashboard Component
export default function ProfessionalDashboard({ user }: { user: any }) {
  const [period, setPeriod] = useState('30days');
  const [startDate, setStartDate] = useState<Date | null>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Add refresh trigger for custom date range
  const [activeView, setActiveView] = useState<'team' | 'overview' | 'ads' | 'seo' | 'calls' | 'trends' | 'gbp'>('overview'); // Sidebar view - default to overview for clients
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Client config and services (from /api/clients/config)
  const [clientServices, setClientServices] = useState<any>({
    googleAnalytics: true,
    googleAds: true,
    searchConsole: true,
    callRail: true,
  });
  const [clientInfo, setClientInfo] = useState<any>({
    companyName: '',
    owner: '',
    city: '',
  });
  const [clientUUID, setClientUUID] = useState<string | null>(null);
  const router = useRouter();

  // Calculate dates based on selected range - memoized with useCallback
  const getDateRange = useCallback(() => {
    if (period === 'custom' && startDate && endDate) {
      const range = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };
      return range;
    }

    const today = new Date();
    const end = today.toISOString().split('T')[0];
    let start = '';

    switch (period) {
      case '7days': {
        const startDateObj = new Date(today);
        startDateObj.setDate(today.getDate() - 7);
        start = startDateObj.toISOString().split('T')[0];
        break;
      }
      case '30days': {
        const startDateObj = new Date(today);
        startDateObj.setDate(today.getDate() - 30);
        start = startDateObj.toISOString().split('T')[0];
        break;
      }
      case '90days': {
        const startDateObj = new Date(today);
        startDateObj.setDate(today.getDate() - 90);
        start = startDateObj.toISOString().split('T')[0];
        break;
      }
      case '180days': {
        const startDateObj = new Date(today);
        startDateObj.setDate(today.getDate() - 180);
        start = startDateObj.toISOString().split('T')[0];
        break;
      }
      case '365days': {
        const startDateObj = new Date(today);
        startDateObj.setDate(today.getDate() - 365);
        start = startDateObj.toISOString().split('T')[0];
        break;
      }
      case 'this-month':
        start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        break;
      case 'last-month': {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        start = lastMonth.toISOString().split('T')[0];
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        const range = { startDate: start, endDate: lastMonthEnd.toISOString().split('T')[0] };
        return range;
      }
      default: {
        const startDateObj = new Date(today);
        startDateObj.setDate(today.getDate() - 7);
        start = startDateObj.toISOString().split('T')[0];
      }
    }

    const range = { startDate: start, endDate: end };
    return range;
  }, [period, startDate, endDate]);

  const handlePresetChange = useCallback((preset: string) => {
    setPeriod(preset);
    setShowDatePicker(false);

    // Update dates based on preset
    const today = new Date();
    let start = new Date();

    switch (preset) {
      case '7days':
        start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '180days':
        start = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '365days':
        start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'this-month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'last-month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        setStartDate(start);
        setEndDate(end);
        return;
    }

    setStartDate(start);
    setEndDate(today);
  }, []);

  // Fetch client config only when user changes
  useEffect(() => {
    if (user.id) {
      fetchClientConfig();
    }
  }, [user.id]);

  // Fetch dashboard data from pre-computed database (FAST: ~50-100ms)
  useEffect(() => {
    const fetchCoreData = async () => {
      console.log('⚡ Fetching from pre-computed database', { userId: user.id, period });
      setLoading(true);
      clearCachePattern('dashboard-fast');

      try {
        await fetchDashboardData();
        console.log('⚡ Dashboard loaded from DB');
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user.id && startDate && endDate) {
      fetchCoreData();
    }
  }, [user.id, period, startDate?.getTime(), endDate?.getTime(), refreshTrigger]);

  const fetchClientConfig = async () => {
    try {
      const response = await fetch(`/api/clients/config?clientId=${user.id}`);
      const result = await response.json();
      if (result.success && result.config) {
        setClientServices(result.config.services);
        setClientInfo({
          companyName: result.config.companyName,
          owner: result.config.owner,
          city: result.config.city,
        });
        // Store the client UUID for OAuth flows
        if (result.config.id) {
          setClientUUID(result.config.id);
        }
      }
    } catch (error) {
      console.error('❌ [fetchClientConfig] Failed:', error);
    }
  };

  const fetchDashboardData = async () => {
    const { startDate: start, endDate: end } = getDateRange();

    try {
      const cacheKey = `dashboard-fast-${user.id}-${start}-${end}`;

      // FAST: Read from pre-computed database (~50-100ms)
      const result = await cachedFetch(cacheKey, async () => {
        const response = await fetch(`/api/client-dashboard?startDate=${start}&endDate=${end}&clientId=${user.id}`);
        return response.json();
      });

      if (result.success) {
        // Map API response to data structure used by UI components
        const mappedData = {
          googleAnalytics: {
            metrics: {
              sessions: result.metrics?.sessions || 0,
              users: result.metrics?.users || 0,
              pageviews: 0,
              bounceRate: 0,
              sessionDuration: 0,
              conversions: result.metrics?.formFills || 0,
              engagementRate: result.metrics?.engagementRate || 0,
            },
            dateRange: result.dateRange,
          },
          googleAds: {
            totalMetrics: {
              impressions: result.metrics?.adsImpressions || 0,
              clicks: result.metrics?.adsClicks || 0,
              ctr: result.metrics?.adsCtr || 0,
              cpc: result.metrics?.adsCpc || 0,
              cost: result.metrics?.adSpend || 0,
              conversions: result.metrics?.googleAdsConversions || 0,
              conversionRate: 0,
              costPerConversion: result.metrics?.cpl || 0,
              phoneCallConversions: result.metrics?.adsPhoneCalls || 0,
              costPerLead: result.metrics?.cpl || 0,
            },
            campaigns: [],
            dateRange: result.dateRange,
          },
          searchConsole: {
            clicks: result.metrics?.gscClicks || 0,
            impressions: result.metrics?.gscImpressions || 0,
            ctr: result.metrics?.gscCtr || 0,
            position: result.metrics?.gscPosition || 0,
          },
          googleBusiness: {
            calls: result.metrics?.gbpCalls || 0,
            clicks: result.metrics?.gbpClicks || 0,
            directions: result.metrics?.gbpDirections || 0,
            views: result.metrics?.gbpViews || 0,
            // Reviews
            reviewsCount: result.metrics?.gbpReviewsCount || 0,
            ratingAvg: result.metrics?.gbpRatingAvg || 0,
            newReviews: result.metrics?.gbpNewReviews || 0,
            daysSinceReview: result.metrics?.gbpDaysSinceReview || 0,
            // Posts
            postsCount: result.metrics?.gbpPostsCount || 0,
            postsViews: result.metrics?.gbpPostsViews || 0,
            postsClicks: result.metrics?.gbpPostsClicks || 0,
            daysSincePost: result.metrics?.gbpDaysSincePost || 0,
          },
          // GA4 Events (form submissions, phone calls from website, chat clicks)
          gaEvents: {
            formSubmissions: result.metrics?.formFills || 0,
            phoneCalls: 0, // TODO: Add web_calls column to DB and rollup
            clickToChat: 0, // TODO: Add chat_clicks column to DB and rollup
          },
          combined: {
            totalTrafficSessions: result.metrics?.sessions || 0,
            totalAdSpend: result.metrics?.adSpend || 0,
            totalPhoneCalls: result.metrics?.gbpCalls || 0,
            totalConversions: result.metrics?.googleAdsConversions || 0,
            overallCostPerLead: result.metrics?.cpl || 0,
          },
          comparison: {
            trafficChange: result.changes?.sessions || 0,
            leadsChange: result.changes?.googleAdsConversions || 0,
            phoneCallsChange: result.changes?.gbpCalls || 0,
            spendChange: result.changes?.adSpend || 0,
            cplChange: result.changes?.cpl || 0,
          },
          _fastData: result,
        };

        setData(mappedData);

        if (result.services) {
          setClientServices(result.services);
        }

        console.log(`⚡ Loaded in ${result.duration}ms`);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  // Helper function for date formatting
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  };

  // Calculate KPIs with fallback for missing data
  // IMPORTANT: Leads should ONLY come from Google Ads conversions (not GA, not CallRail)
  // Memoize KPIs calculation for performance
  const kpis = useMemo(() => {
    if (!data) return null;
    return {
      traffic: data.googleAnalytics?.metrics?.sessions || 0,
      leads: data.googleAds?.totalMetrics?.conversions || 0, // Only Google Ads conversions
      phoneCalls: (data.googleAds?.totalMetrics?.phoneCallConversions || 0) + (data.callRail?.metrics?.totalCalls || 0), // Google Ads phone calls + CallRail
      adSpend: data.googleAds?.totalMetrics?.cost || 0,
      cpl: (data.googleAds?.totalMetrics?.conversions || 0) > 0
        ? (data.googleAds?.totalMetrics?.cost || 0) / (data.googleAds?.totalMetrics?.conversions || 1)
        : 0,
      // Use comparison data from API (calculated from previous period)
      trafficChange: data.comparison?.trafficChange || 0,
      leadsChange: data.comparison?.leadsChange || 0,
      phoneCallsChange: data.comparison?.phoneCallsChange || 0,
      spendChange: data.comparison?.spendChange || 0,
      cplChange: data.comparison?.cplChange || 0,
    };
  }, [data]);

  // Memoize API connection checks for performance
  const hasGoogleAnalytics = useMemo(() => (data?.googleAnalytics?.metrics?.sessions || 0) > 0, [data]);
  const hasGoogleAds = useMemo(() =>
    (data?.googleAds?.totalMetrics?.impressions > 0) ||
    (data?.googleAds?.totalMetrics?.cost > 0) ||
    (data?._fastData?.metrics?.adSpend > 0),
    [data?.googleAds?.totalMetrics?.impressions, data?.googleAds?.totalMetrics?.cost, data?._fastData?.metrics?.adSpend]
  );
  const hasCallRail = useMemo(() => data?.callRail?.metrics?.totalCalls > 0, [data?.callRail?.metrics?.totalCalls]);

  // Sidebar navigation items with Lucide icons
  const navItems = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard, description: 'All channels summary' },
    { id: 'ads' as const, label: 'Google Ads', icon: DollarSign, description: 'Paid advertising' },
    { id: 'seo' as const, label: 'SEO', icon: Search, description: 'Organic search' },
    { id: 'gbp' as const, label: 'Google Business', icon: MapPin, description: 'Local profile' },
    { id: 'calls' as const, label: 'Calls', icon: Phone, description: 'Phone tracking' },
  ];

  // Sidebar hover state
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex">
      {/* Inject custom calendar styles */}
      <style dangerouslySetInnerHTML={{ __html: calendarStyles }} />

      {/* Thorbit-Style Compact Sidebar */}
      <aside
        className={`bg-white border-r border-gray-100 flex flex-col fixed h-full z-20 transition-all duration-300 ease-in-out ${
          sidebarExpanded ? 'w-56' : 'w-16'
        }`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        {/* Logo */}
        <div className="p-3 border-b border-gray-100 flex items-center justify-center h-16">
          <div className={`flex items-center gap-3 transition-all duration-300 ${sidebarExpanded ? 'w-full px-1' : 'w-10'}`}>
            <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-amber-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            {sidebarExpanded && (
              <div className="overflow-hidden whitespace-nowrap">
                <h1 className="text-sm font-bold text-gray-900 truncate">{user.companyName}</h1>
                <p className="text-xs text-gray-400">Dashboard</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-2">
          <div className="space-y-1">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                    ${activeView === item.id
                      ? 'bg-amber-50 text-amber-800 shadow-sm border border-amber-100'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                  title={!sidebarExpanded ? item.label : undefined}
                >
                  <IconComponent className="w-5 h-5 flex-shrink-0" />
                  {sidebarExpanded && (
                    <span className="text-sm font-medium whitespace-nowrap overflow-hidden">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Bottom - Logout */}
        <div className="p-2 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all"
            title={!sidebarExpanded ? 'Logout' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 transition-all duration-300 ${sidebarExpanded ? 'ml-56' : 'ml-16'}`}>
        {/* Thorbit-Style Clean Header */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              {/* Left - View Title */}
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 capitalize">{activeView}</h2>
                  <p className="text-xs text-gray-500">
                    {clientInfo.companyName && `${clientInfo.companyName}`}
                    {clientInfo.city && ` • ${clientInfo.city}`}
                  </p>
                </div>
              </div>

              {/* Right - Controls */}
              <div className="flex items-center gap-2">
                {/* Compact OAuth indicators - only show icons */}
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={async () => {
                      try {
                        if (!clientUUID) return;
                        const response = await fetch(`/api/auth/google-analytics?clientId=${clientUUID}`);
                        const result = await response.json();
                        if (result.success && result.authUrl) {
                          window.location.href = result.authUrl;
                        }
                      } catch (error) {
                        console.error('Error connecting GA:', error);
                      }
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-green-50 text-gray-600 hover:text-green-600 transition-colors"
                    disabled={!clientUUID}
                    title="Connect Google Analytics"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        if (!clientUUID) return;
                        const response = await fetch(`/api/auth/search-console?clientId=${clientUUID}`);
                        const result = await response.json();
                        if (result.success && result.authUrl) {
                          window.location.href = result.authUrl;
                        }
                      } catch (error) {
                        console.error('Error connecting GSC:', error);
                      }
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-gray-600 hover:text-orange-600 transition-colors"
                    disabled={!clientUUID}
                    title="Connect Search Console"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        if (!clientUUID) return;
                        const response = await fetch(`/api/auth/google-business?clientId=${clientUUID}`);
                        const result = await response.json();
                        if (result.success && result.authUrl) {
                          window.location.href = result.authUrl;
                        }
                      } catch (error) {
                        console.error('Error connecting GBP:', error);
                      }
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-teal-50 text-gray-600 hover:text-teal-600 transition-colors"
                    disabled={!clientUUID}
                    title="Connect Google Business Profile"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                </div>

                {/* Date Picker Button - Thorbit style */}
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium transition-colors border border-gray-200"
                >
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span>
                    {startDate && endDate
                      ? `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : 'Select dates'
                    }
                  </span>
                </button>

                {/* Date Range Picker Dropdown */}
                {showDatePicker && (
                  <div className="fixed inset-0 z-40 flex items-start justify-center pt-16 px-4">
                    {/* Backdrop */}
                    <div
                      className="absolute inset-0 bg-black/10 backdrop-blur-sm"
                      onClick={() => setShowDatePicker(false)}
                    />

                    {/* Calendar Modal - Thorbit style */}
                    <div className="relative z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-5 w-full max-w-3xl">
                      <div className="flex flex-col lg:flex-row gap-5">
                        {/* Preset Options */}
                        <div className="flex flex-row lg:flex-col gap-2 border-b lg:border-b-0 lg:border-r border-gray-100 pb-4 lg:pb-0 lg:pr-5 flex-wrap lg:flex-nowrap">
                          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 w-full">Quick Select</h3>
                          {[
                            { value: '7days', label: 'Last 7 Days' },
                            { value: '30days', label: 'Last 30 Days' },
                            { value: '90days', label: 'Last 90 Days' },
                            { value: '180days', label: 'Last 6 Months' },
                            { value: '365days', label: 'Last Year' },
                          ].map((preset) => (
                            <button
                              key={preset.value}
                              onClick={() => handlePresetChange(preset.value)}
                              className={`px-4 py-2 rounded-lg text-left text-sm transition-all whitespace-nowrap ${
                                period === preset.value
                                  ? 'bg-amber-600 text-white shadow-sm'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        {/* Calendar */}
                        <div className="flex-1">
                          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Custom Range</h3>
                          <div className="flex justify-center">
                            <DatePicker
                              selected={startDate}
                              onChange={(dates) => {
                                const [start, end] = dates as [Date | null, Date | null]
                                setStartDate(start)
                                setEndDate(end)
                              }}
                              startDate={startDate}
                              endDate={endDate}
                              selectsRange
                              inline
                              monthsShown={window.innerWidth >= 1024 ? 2 : 1}
                              maxDate={new Date()}
                              openToDate={new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)}
                              calendarClassName="border-0"
                            />
                          </div>

                          {/* Apply Button */}
                          <div className="mt-4 flex justify-end gap-2 pt-4 border-t border-gray-100">
                            <button
                              onClick={() => setShowDatePicker(false)}
                              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                if (startDate && endDate) {
                                  setPeriod('custom')
                                  setRefreshTrigger(prev => prev + 1)
                                  setShowDatePicker(false)
                                }
                              }}
                              className="px-5 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                              disabled={!startDate || !endDate}
                            >
                              Apply Range
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>


      {/* Main Content */}
      <main className="px-6 py-8 relative">
        {/* Lightweight Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent pointer-events-none">
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-6 py-4 rounded-lg shadow-lg border border-gray-200 pointer-events-auto">
              <div className="w-3 h-3 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-3 h-3 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-3 h-3 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              <span className="text-sm text-gray-600 ml-2 font-medium">Loading data...</span>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto space-y-6">

          {/* OVERVIEW VIEW */}
          {activeView === 'overview' && (
            <>
          {/* TOP SUMMARY ROW - Thorbit Style with colored icons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              icon={<Target className="w-6 h-6 text-teal-700" />}
              iconBg="bg-teal-100"
              label="Total Leads"
              value={Math.round((data?.googleAds?.totalMetrics?.conversions || 0) + (data?.gaEvents?.formSubmissions || 0) + (data?.googleBusiness?.calls || 0))}
            />
            <SummaryCard
              icon={<MousePointer className="w-6 h-6 text-amber-700" />}
              iconBg="bg-amber-100"
              label="Total Clicks"
              value={formatNumber((data?.searchConsole?.clicks || 0) + (data?.googleAds?.totalMetrics?.clicks || 0), 0)}
            />
            <SummaryCard
              icon={<Eye className="w-6 h-6 text-orange-600" />}
              iconBg="bg-orange-100"
              label="Total Impressions"
              value={formatNumber((data?.searchConsole?.impressions || 0) + (data?.googleAds?.totalMetrics?.impressions || 0), 0)}
            />
            <SummaryCard
              icon={<Calendar className="w-6 h-6 text-amber-700" />}
              iconBg="bg-amber-50"
              label="Date Range"
              value={`${startDate && endDate ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 30} Days`}
            />
          </div>

          {/* CHANNEL CARDS - Simple metric display without charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Google Ads Card */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setActiveView('ads')}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Google Ads</h3>
                  <p className="text-xs text-gray-500">Paid advertising</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Clicks</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(data?.googleAds?.totalMetrics?.clicks || 0, 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Impressions</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(data?.googleAds?.totalMetrics?.impressions || 0, 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">CTR</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber((data?.googleAds?.totalMetrics?.clicks || 0) / Math.max(data?.googleAds?.totalMetrics?.impressions || 1, 1) * 100, 1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cost/Lead</p>
                  <p className="text-xl font-bold text-gray-900">${formatNumber(kpis?.cpl || 0, 0)}</p>
                </div>
              </div>
            </div>

            {/* SEO / Search Console Card */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setActiveView('seo')}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                  <Search className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Search Console</h3>
                  <p className="text-xs text-gray-500">Organic search</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Clicks</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(data?.searchConsole?.clicks || 0, 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Impressions</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(data?.searchConsole?.impressions || 0, 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">CTR</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(data?.searchConsole?.ctr || 0, 2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Avg Position</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(data?.searchConsole?.position || 0, 1)}</p>
                </div>
              </div>
            </div>

            {/* Google Business Profile Card */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setActiveView('gbp')}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Google Business</h3>
                  <p className="text-xs text-gray-500">Local profile</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Phone Calls</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(data?.googleBusiness?.calls || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Website Clicks</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(data?.googleBusiness?.clicks || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Directions</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(data?.googleBusiness?.directions || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Profile Views</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(data?.googleBusiness?.views || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Smart Performance Insights - Thorbit style */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h3>
            <div className="space-y-3">
              {/* Generate insights based on data */}
              {(() => {
                const insights: { type: 'success' | 'warning' | 'working'; message: string; detail?: string; priority: number }[] = [];

                // Check Google Ads performance
                const leads = data?.googleAds?.totalMetrics?.conversions || 0;
                const cpl = kpis?.cpl || 0;
                const adSpend = kpis?.adSpend || 0;
                const clicks = data?.googleAds?.totalMetrics?.clicks || 0;
                const impressions = data?.googleAds?.totalMetrics?.impressions || 0;
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                const conversionRate = clicks > 0 ? (leads / clicks) * 100 : 0;

                // === GOOGLE ADS INSIGHTS ===
                if (leads >= 20) {
                  insights.push({
                    type: 'success',
                    message: `Outstanding month with ${Math.round(leads)} conversions`,
                    detail: 'Your campaigns are performing exceptionally well',
                    priority: 1
                  });
                } else if (leads >= 10) {
                  insights.push({
                    type: 'success',
                    message: `Solid performance with ${Math.round(leads)} leads generated`,
                    detail: 'Consistent lead flow from your advertising investment',
                    priority: 2
                  });
                } else if (leads >= 5) {
                  insights.push({
                    type: 'success',
                    message: `${Math.round(leads)} qualified leads captured this period`,
                    detail: 'Your ads are reaching the right audience',
                    priority: 3
                  });
                } else if (leads > 0 && leads < 3 && adSpend > 500) {
                  insights.push({
                    type: 'working',
                    message: 'Scaling up lead volume through bid optimization',
                    detail: 'Adjusting bids and expanding high-performing keywords',
                    priority: 2
                  });
                }

                // CPL Analysis
                if (cpl > 0 && cpl <= 30) {
                  insights.push({
                    type: 'success',
                    message: `Exceptional efficiency at $${formatNumber(cpl, 2)} per lead`,
                    detail: 'Significantly below industry benchmarks - great ROI',
                    priority: 1
                  });
                } else if (cpl > 30 && cpl <= 60) {
                  insights.push({
                    type: 'success',
                    message: `Strong cost control at $${formatNumber(cpl, 2)} per lead`,
                    detail: 'Within optimal range for healthcare marketing',
                    priority: 3
                  });
                } else if (cpl > 60 && cpl <= 100) {
                  insights.push({
                    type: 'working',
                    message: `Fine-tuning campaigns to reduce $${formatNumber(cpl, 2)} CPL`,
                    detail: 'Testing new ad copy and landing page optimizations',
                    priority: 2
                  });
                } else if (cpl > 100) {
                  insights.push({
                    type: 'working',
                    message: `Restructuring campaigns to improve $${formatNumber(cpl, 2)} CPL`,
                    detail: 'Analyzing search terms and pausing underperforming keywords',
                    priority: 1
                  });
                }

                // CTR Analysis
                if (ctr >= 8) {
                  insights.push({
                    type: 'success',
                    message: `Exceptional ${formatNumber(ctr, 1)}% click-through rate`,
                    detail: 'Your ads are highly compelling to searchers',
                    priority: 2
                  });
                } else if (ctr >= 5) {
                  insights.push({
                    type: 'success',
                    message: `Strong ad engagement at ${formatNumber(ctr, 1)}% CTR`,
                    detail: 'Above industry average of 3-4% for healthcare',
                    priority: 3
                  });
                } else if (ctr >= 2 && ctr < 4) {
                  insights.push({
                    type: 'working',
                    message: `Enhancing ad copy to boost ${formatNumber(ctr, 1)}% click rate`,
                    detail: 'Testing headlines with stronger calls-to-action',
                    priority: 3
                  });
                } else if (ctr > 0 && ctr < 2) {
                  insights.push({
                    type: 'working',
                    message: 'Refreshing ad creatives to improve engagement',
                    detail: 'Rewriting ads with benefit-focused messaging',
                    priority: 2
                  });
                }

                // Conversion Rate
                if (conversionRate >= 10) {
                  insights.push({
                    type: 'success',
                    message: `Excellent ${formatNumber(conversionRate, 1)}% conversion rate`,
                    detail: 'Landing pages are highly effective at converting',
                    priority: 2
                  });
                } else if (conversionRate > 0 && conversionRate < 3) {
                  insights.push({
                    type: 'working',
                    message: 'Optimizing landing pages for better conversions',
                    detail: 'Testing layouts, form placements, and trust signals',
                    priority: 3
                  });
                }

                // === WEBSITE & FORMS ===
                const formFills = data?.gaEvents?.formSubmissions || 0;
                const phoneCalls = data?.gaEvents?.phoneCalls || 0;
                const chatClicks = data?.gaEvents?.clickToChat || 0;
                const traffic = kpis?.traffic || 0;

                if (formFills >= 10) {
                  insights.push({
                    type: 'success',
                    message: `${formFills} form submissions - strong online engagement`,
                    detail: 'Visitors actively requesting appointments',
                    priority: 2
                  });
                } else if (formFills >= 5) {
                  insights.push({
                    type: 'success',
                    message: `${formFills} appointment requests via website`,
                    detail: 'Contact forms generating quality leads',
                    priority: 3
                  });
                } else if (formFills === 0 && traffic > 200) {
                  insights.push({
                    type: 'working',
                    message: 'Implementing form improvements to capture leads',
                    detail: 'Adding prominent CTAs and simplifying fields',
                    priority: 2
                  });
                } else if (formFills > 0 && formFills < 3 && traffic > 100) {
                  insights.push({
                    type: 'working',
                    message: 'Boosting form conversion with A/B testing',
                    detail: 'Testing different styles and placements',
                    priority: 3
                  });
                }

                if (phoneCalls >= 5 || chatClicks >= 5) {
                  insights.push({
                    type: 'success',
                    message: `Active engagement: ${phoneCalls} calls, ${chatClicks} chats`,
                    detail: 'Multiple contact channels driving inquiries',
                    priority: 3
                  });
                }

                // === GBP INSIGHTS ===
                const gbpCalls = data?.googleBusiness?.calls || 0;
                const gbpWebsite = data?.googleBusiness?.clicks || 0;
                const gbpDirections = data?.googleBusiness?.directions || 0;
                const gbpImpressions = data?.googleBusiness?.views || 0;
                const gbpActions = gbpCalls + gbpWebsite + gbpDirections;
                const gbpEngagementRate = gbpImpressions > 0 ? (gbpActions / gbpImpressions) * 100 : 0;

                if (gbpCalls >= 10) {
                  insights.push({
                    type: 'success',
                    message: `${gbpCalls} direct calls from Google listing`,
                    detail: 'Patients finding and calling directly from search',
                    priority: 1
                  });
                } else if (gbpCalls >= 5) {
                  insights.push({
                    type: 'success',
                    message: `${gbpCalls} calls from Google Business Profile`,
                    detail: 'Local presence driving direct patient contact',
                    priority: 2
                  });
                }

                if (gbpDirections >= 10) {
                  insights.push({
                    type: 'success',
                    message: `${gbpDirections} direction requests to your office`,
                    detail: 'Strong local intent - people planning visits',
                    priority: 2
                  });
                }

                if (gbpEngagementRate >= 5) {
                  insights.push({
                    type: 'success',
                    message: `${formatNumber(gbpEngagementRate, 1)}% GBP engagement rate`,
                    detail: 'Excellent interaction from profile viewers',
                    priority: 3
                  });
                } else if (gbpEngagementRate > 0 && gbpEngagementRate < 2) {
                  insights.push({
                    type: 'working',
                    message: 'Enhancing GBP profile to increase engagement',
                    detail: 'Adding photos, posts, and responding to reviews',
                    priority: 3
                  });
                }

                if (gbpImpressions >= 5000) {
                  insights.push({
                    type: 'success',
                    message: `${formatNumber(gbpImpressions)} profile views - excellent visibility`,
                    detail: 'Appearing frequently in local search results',
                    priority: 2
                  });
                } else if (gbpImpressions >= 1000) {
                  insights.push({
                    type: 'success',
                    message: `${formatNumber(gbpImpressions)} Google profile views`,
                    detail: 'Solid local visibility in your service area',
                    priority: 3
                  });
                } else if (gbpImpressions > 0 && gbpImpressions < 500) {
                  insights.push({
                    type: 'working',
                    message: 'Growing your local search visibility',
                    detail: 'Publishing posts and optimizing categories',
                    priority: 3
                  });
                }

                // === SEO INSIGHTS ===
                const topKeywords = 0; // Query-level data not available from DB
                const top3Keywords = 0; // Query-level data not available from DB
                const totalClicks = data?.searchConsole?.clicks || 0;

                if (top3Keywords >= 5) {
                  insights.push({
                    type: 'success',
                    message: `${top3Keywords} keywords in top 3 positions`,
                    detail: 'Dominating search results for key terms',
                    priority: 1
                  });
                } else if (topKeywords >= 15) {
                  insights.push({
                    type: 'success',
                    message: `${topKeywords} keywords on page 1 of Google`,
                    detail: 'Strong organic presence driving free traffic',
                    priority: 2
                  });
                } else if (topKeywords >= 5) {
                  insights.push({
                    type: 'success',
                    message: `${topKeywords} keywords in Google top 10`,
                    detail: 'SEO efforts are gaining traction',
                    priority: 3
                  });
                } else if (totalClicks > 0 && totalClicks < 50) {
                  insights.push({
                    type: 'working',
                    message: `Building organic presence with ${totalClicks} clicks`,
                    detail: 'Creating content and earning backlinks',
                    priority: 3
                  });
                }

                if (totalClicks >= 500) {
                  insights.push({
                    type: 'success',
                    message: `${formatNumber(totalClicks)} organic clicks from Google`,
                    detail: 'Free traffic from SEO investment',
                    priority: 2
                  });
                } else if (totalClicks >= 100) {
                  insights.push({
                    type: 'success',
                    message: `${formatNumber(totalClicks)} organic search visitors`,
                    detail: 'Growing organic traffic to your site',
                    priority: 3
                  });
                }

                // === CALL TRACKING ===
                const totalCalls = data?.callRail?.metrics?.totalCalls || 0;
                const answeredCalls = data?.callRail?.metrics?.answeredCalls || 0;
                const missedCalls = data?.callRail?.metrics?.missedCalls || 0;
                const answerRate = totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0;

                if (totalCalls >= 20 && answerRate >= 90) {
                  insights.push({
                    type: 'success',
                    message: `${totalCalls} calls with ${formatNumber(answerRate, 0)}% answer rate`,
                    detail: 'Excellent phone performance - capturing leads',
                    priority: 1
                  });
                } else if (totalCalls >= 10) {
                  insights.push({
                    type: 'success',
                    message: `${totalCalls} phone inquiries tracked`,
                    detail: 'Healthy call volume from marketing',
                    priority: 3
                  });
                }

                if (missedCalls >= 5 && answerRate < 80) {
                  insights.push({
                    type: 'warning',
                    message: `${missedCalls} missed calls (${formatNumber(100 - answerRate, 0)}% miss rate)`,
                    detail: 'Consider extending hours or adding answering service',
                    priority: 1
                  });
                } else if (missedCalls >= 3) {
                  insights.push({
                    type: 'working',
                    message: `Reducing ${missedCalls} missed calls`,
                    detail: 'Review call patterns to optimize staffing',
                    priority: 2
                  });
                }

                // === WARNINGS ===
                if (!clientServices.googleAds && !leads) {
                  insights.push({
                    type: 'warning',
                    message: 'No paid advertising active',
                    detail: 'Add Google Ads for immediate lead generation',
                    priority: 4
                  });
                }

                if (!data?.googleBusiness) {
                  insights.push({
                    type: 'warning',
                    message: 'Google Business Profile not connected',
                    detail: 'Connect GBP to track local performance',
                    priority: 3
                  });
                }

                // Sort by priority and limit to top 4
                const displayInsights = insights
                  .sort((a, b) => a.priority - b.priority)
                  .slice(0, 4);

                if (displayInsights.length === 0) {
                  return null;
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {displayInsights.map((insight, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg p-4 border ${
                          insight.type === 'success'
                            ? 'bg-green-50 border-green-200'
                            : insight.type === 'warning'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-amber-50 border-amber-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            insight.type === 'success'
                              ? 'bg-green-100'
                              : insight.type === 'warning'
                              ? 'bg-amber-100'
                              : 'bg-amber-100'
                          }`}>
                            {insight.type === 'success' ? (
                              <CheckCircle className="w-4 h-4 text-green-700" />
                            ) : insight.type === 'warning' ? (
                              <AlertTriangle className="w-4 h-4 text-amber-700" />
                            ) : (
                              <Wrench className="w-4 h-4 text-amber-700" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${
                              insight.type === 'success'
                                ? 'text-green-900'
                                : insight.type === 'warning'
                                ? 'text-amber-900'
                                : 'text-amber-900'
                            }`}>
                              {insight.message}
                            </p>
                            {insight.detail && (
                              <p className={`text-xs mt-1 ${
                                insight.type === 'success'
                                  ? 'text-green-700'
                                  : insight.type === 'warning'
                                  ? 'text-amber-700'
                                  : 'text-amber-700'
                              }`}>
                                {insight.detail}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* SECTION 2: CHANNEL PERFORMANCE COMPARISON */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Channel Performance</h2>
              <p className="text-sm text-gray-500 mt-1">Compare how each marketing channel is performing</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* Google Ads Card */}
              {clientServices.googleAds ? (
                <div className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-amber-700" />
                    </div>
                    <h3 className="font-bold text-gray-900">Google Ads</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Leads</span>
                      <span className="font-bold text-gray-900">{formatNumber(kpis?.leads || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Clicks</span>
                      <span className="font-bold text-gray-900">{formatNumber(data?.googleAds?.totalMetrics?.clicks || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Impressions</span>
                      <span className="font-bold text-gray-900">{formatNumber(data?.googleAds?.totalMetrics?.impressions || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-sm text-gray-500">CPL</span>
                      <span className="font-bold text-amber-600">${formatNumber(kpis?.cpl || 0, 2)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <DollarSign className="w-5 h-5 text-gray-400" />
                  </div>
                  <h3 className="font-bold text-gray-700 mb-1">Google Ads</h3>
                  <p className="text-xs text-gray-500">Not configured</p>
                </div>
              )}

              {/* SEO/Organic Card */}
              {clientServices.googleAnalytics ? (
                <div className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-green-700" />
                    </div>
                    <h3 className="font-bold text-gray-900">SEO/Organic</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Organic Sessions</span>
                      <span className="font-bold text-gray-900">{formatNumber(kpis?.traffic || 0, 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Organic Clicks</span>
                      <span className="font-bold text-gray-900">{formatNumber(data?.searchConsole?.clicks || 0, 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Impressions</span>
                      <span className="font-bold text-gray-900">{formatNumber(data?.searchConsole?.impressions || 0, 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Avg Position</span>
                      <span className="font-bold text-gray-900">{formatNumber(data?.searchConsole?.position || 0, 1)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-bold text-gray-700 mb-1">Google Analytics</h3>
                  <p className="text-xs text-gray-500 mb-3">Connect to see traffic</p>
                  <button
                    onClick={async () => {
                      try {
                        if (!clientUUID) return;
                        const response = await fetch(`/api/auth/google-analytics?clientId=${clientUUID}`);
                        const result = await response.json();
                        if (result.success && result.authUrl) {
                          window.location.href = result.authUrl;
                        }
                      } catch (error) {
                        console.error('Error connecting GA:', error);
                      }
                    }}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    disabled={!clientUUID}
                  >
                    Connect
                  </button>
                </div>
              )}

              {/* CallRail Card */}
              {clientServices.callRail ? (
                <div className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Phone className="w-5 h-5 text-purple-700" />
                    </div>
                    <h3 className="font-bold text-gray-900">CallRail</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Total Calls</span>
                      <span className="font-bold text-gray-900">{formatNumber(data?.callRail?.metrics?.totalCalls || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Answered</span>
                      <span className="font-bold text-green-600">{formatNumber(data?.callRail?.metrics?.answeredCalls || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Missed</span>
                      <span className="font-bold text-red-500">{formatNumber(data?.callRail?.metrics?.missedCalls || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-sm text-gray-500">Avg Duration</span>
                      <span className="font-bold text-gray-900">{formatNumber(data?.callRail?.metrics?.averageDuration || 0)}s</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Phone className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="font-bold text-gray-700 mb-1">CallRail</h3>
                  <p className="text-xs text-gray-500">Not configured</p>
                </div>
              )}

              {/* Search Console Card */}
              {clientServices.searchConsole ? (
                <div className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Search className="w-5 h-5 text-orange-700" />
                    </div>
                    <h3 className="font-bold text-gray-900">Search Console</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Impressions</span>
                      <span className="font-bold text-gray-900">{formatNumber(data?.searchConsole?.impressions || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Clicks</span>
                      <span className="font-bold text-gray-900">{formatNumber(data?.searchConsole?.clicks || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Avg Position</span>
                      <span className="font-bold text-gray-900">{formatNumber(data?.searchConsole?.position || 0, 1)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-sm text-gray-500">Avg CTR</span>
                      <span className="font-bold text-orange-600">{formatNumber(data?.searchConsole?.ctr || 0, 2)}%</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Search className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="font-bold text-gray-700 mb-1">Search Console</h3>
                  <p className="text-xs text-gray-500 mb-3">Connect to see rankings</p>
                  <button
                    onClick={async () => {
                      try {
                        if (!clientUUID) return;
                        const response = await fetch(`/api/auth/search-console?clientId=${clientUUID}`);
                        const result = await response.json();
                        if (result.success && result.authUrl) {
                          window.location.href = result.authUrl;
                        }
                      } catch (error) {
                        console.error('Error connecting GSC:', error);
                      }
                    }}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    disabled={!clientUUID}
                  >
                    Connect
                  </button>
                </div>
              )}

              {/* Google Business Profile Card */}
              {data?.googleBusiness ? (
                <div className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-teal-700" />
                    </div>
                    <h3 className="font-bold text-gray-900">Google Business</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Phone Calls</span>
                      <span className="font-bold text-gray-900">{formatNumber(data?.googleBusiness?.calls || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Website Clicks</span>
                      <span className="font-bold text-gray-900">{formatNumber(data?.googleBusiness?.clicks || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Directions</span>
                      <span className="font-bold text-gray-900">{formatNumber(data?.googleBusiness?.directions || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-sm text-gray-500">Profile Views</span>
                      <span className="font-bold text-teal-600">
                        {formatNumber(data?.googleBusiness?.views || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center">
                  <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-5 h-5 text-teal-600" />
                  </div>
                  <h3 className="font-bold text-gray-700 mb-1">Google Business</h3>
                  <p className="text-xs text-gray-500 mb-3">Connect to see local data</p>
                  <button
                    onClick={async () => {
                      try {
                        if (!clientUUID) return;
                        const response = await fetch(`/api/auth/google-business?clientId=${clientUUID}`);
                        const result = await response.json();
                        if (result.success && result.authUrl) {
                          window.location.href = result.authUrl;
                        }
                      } catch (error) {
                        console.error('Error connecting GBP:', error);
                      }
                    }}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    disabled={!clientUUID}
                  >
                    Connect
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: TRAFFIC ANALYSIS */}
          {/* Traffic Sources - Data from pre-computed database */}
          <RealTrafficSources trafficSourcesData={data?._fastData?.trafficSources || []} />

          {/* AI Referral Traffic */}
          <AITrafficOnly trafficSourcesData={data?._fastData?.aiTrafficSources || []} />

          {/* Device & User Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <DeviceBreakdown
              mobile={data?._fastData?.metrics?.sessionsMobile || 0}
              desktop={data?._fastData?.metrics?.sessionsDesktop || 0}
            />
            <UserTypeBreakdown
              newUsers={data?._fastData?.metrics?.newUsers || 0}
              returningUsers={data?._fastData?.metrics?.returningUsers || 0}
            />
          </div>

          {/* Historical Trends Section */}
          <div className="mt-8 space-y-6">
            <div className="border-t border-gray-100 pt-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-indigo-700" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Historical Trends</h3>
              </div>

              {/* 6-Month Leads Chart */}
              <SixMonthLeadsChart clientId={user.id} />

              {/* Traffic Trend */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4">Traffic Trend ({period})</h4>
                <ModernTrafficChart data={data?._fastData?.daily || []} />
              </div>
            </div>
          </div>

          {/* End of Overview */}
            </>
          )}
          {/* END OVERVIEW VIEW */}

          {/* GOOGLE ADS VIEW */}
          {activeView === 'ads' && (
            <div className="space-y-6">
              {/* Top Summary Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard
                  icon={<Target className="w-6 h-6 text-teal-700" />}
                  iconBg="bg-teal-100"
                  label="Conversions"
                  value={Math.round(kpis?.leads || 0)}
                />
                <SummaryCard
                  icon={<MousePointer className="w-6 h-6 text-amber-700" />}
                  iconBg="bg-amber-100"
                  label="Clicks"
                  value={formatNumber(data?.googleAds?.totalMetrics?.clicks || 0, 0)}
                />
                <SummaryCard
                  icon={<Eye className="w-6 h-6 text-orange-600" />}
                  iconBg="bg-orange-100"
                  label="Impressions"
                  value={formatNumber(data?.googleAds?.totalMetrics?.impressions || 0, 0)}
                />
                <SummaryCard
                  icon={<DollarSign className="w-6 h-6 text-green-700" />}
                  iconBg="bg-green-100"
                  label="Ad Spend"
                  value={`$${formatNumber(kpis?.adSpend || 0, 0)}`}
                />
              </div>

              {/* Ads Performance Metrics - Visual Card */}
              <AdsPerformanceMetrics
                ctr={data?._fastData?.metrics?.adsCtr || 0}
                avgCpc={data?._fastData?.metrics?.adsCpc || 0}
                conversionRate={data?._fastData?.metrics?.adsConversionRate || 0}
                impressions={data?._fastData?.metrics?.adsImpressions || 0}
                clicks={data?._fastData?.metrics?.adsClicks || 0}
              />

              {/* Detailed Metrics */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <MetricWithChange label="CTR" value={`${formatNumber((data?.googleAds?.totalMetrics?.clicks || 0) / Math.max(data?.googleAds?.totalMetrics?.impressions || 1, 1) * 100, 2)}%`} />
                  <MetricWithChange label="Cost Per Click" value={`$${formatNumber((kpis?.adSpend || 0) / Math.max(data?.googleAds?.totalMetrics?.clicks || 1, 1), 2)}`} />
                  <MetricWithChange label="Cost Per Lead" value={`$${formatNumber(kpis?.cpl || 0, 2)}`} change={kpis?.cplChange} better={false} />
                  <MetricWithChange label="Phone Calls" value={data?.googleAds?.totalMetrics?.phoneCallConversions || 0} />
                </div>
              </div>

              {/* Campaign Performance Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Campaign Performance</h3>
                  <p className="text-sm text-gray-500 mt-1">Active campaigns and their metrics</p>
                </div>
                <div className="p-6">
                  {data?._fastData?.campaigns && data._fastData.campaigns.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-2 font-semibold text-gray-600">Campaign</th>
                            <th className="text-center py-3 px-2 font-semibold text-gray-600">Status</th>
                            <th className="text-right py-3 px-2 font-semibold text-gray-600">Spend</th>
                            <th className="text-right py-3 px-2 font-semibold text-gray-600">Clicks</th>
                            <th className="text-right py-3 px-2 font-semibold text-gray-600">Impr.</th>
                            <th className="text-right py-3 px-2 font-semibold text-gray-600">Conv.</th>
                            <th className="text-right py-3 px-2 font-semibold text-gray-600">CTR</th>
                            <th className="text-right py-3 px-2 font-semibold text-gray-600">CPC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data._fastData.campaigns.map((campaign: any, idx: number) => (
                            <tr key={campaign.id || idx} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-2">
                                <div className="font-medium text-gray-900 truncate max-w-[200px]" title={campaign.name}>
                                  {campaign.name}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  campaign.status === 'ENABLED' ? 'bg-green-100 text-green-800' :
                                  campaign.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {campaign.status === 'ENABLED' ? 'Active' : campaign.status}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right font-medium">${formatNumber(campaign.cost || 0, 0)}</td>
                              <td className="py-3 px-2 text-right">{formatNumber(campaign.clicks || 0, 0)}</td>
                              <td className="py-3 px-2 text-right">{formatNumber(campaign.impressions || 0, 0)}</td>
                              <td className="py-3 px-2 text-right font-medium text-purple-600">{Math.round(campaign.conversions || 0)}</td>
                              <td className="py-3 px-2 text-right">{formatNumber(campaign.ctr || 0, 2)}%</td>
                              <td className="py-3 px-2 text-right">${formatNumber(campaign.cpc || 0, 2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 font-semibold">
                            <td className="py-3 px-2">Total ({data._fastData.campaigns.length} campaigns)</td>
                            <td></td>
                            <td className="py-3 px-2 text-right">${formatNumber(kpis?.adSpend || 0, 0)}</td>
                            <td className="py-3 px-2 text-right">{formatNumber(data?._fastData?.metrics?.adsClicks || 0, 0)}</td>
                            <td className="py-3 px-2 text-right">{formatNumber(data?._fastData?.metrics?.adsImpressions || 0, 0)}</td>
                            <td className="py-3 px-2 text-right text-purple-600">{Math.round(kpis?.leads || 0)}</td>
                            <td className="py-3 px-2 text-right">{formatNumber(data?._fastData?.metrics?.adsCtr || 0, 2)}%</td>
                            <td className="py-3 px-2 text-right">${formatNumber(data?._fastData?.metrics?.adsCpc || 0, 2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-sm">No campaign data available for this period</div>
                      <div className="text-xs mt-1 text-gray-400">Campaign data is collected during daily rollup</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Conversion Journey - Ads Focus */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Conversion Journey</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                        <Eye className="w-5 h-5 text-amber-700" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">Impressions</div>
                        <div className="text-sm text-gray-500">People saw your ads</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{formatNumber(data?.googleAds?.totalMetrics?.impressions || 0)}</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                        <MousePointer className="w-5 h-5 text-teal-700" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">Clicks</div>
                        <div className="text-sm text-gray-500">Clicked to visit</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{formatNumber(data?.googleAds?.totalMetrics?.clicks || 0)}</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                        <Phone className="w-5 h-5 text-purple-700" />
                      </div>
                      <div>
                        <div className="font-semibold text-purple-900">Phone Calls</div>
                        <div className="text-sm text-purple-600">Phone call conversions</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-purple-900">{formatNumber(data?.googleAds?.totalMetrics?.phoneCallConversions || 0)}</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                        <Target className="w-5 h-5 text-green-700" />
                      </div>
                      <div>
                        <div className="font-semibold text-green-900">Conversions</div>
                        <div className="text-sm text-green-600">Became leads</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-green-900">{Math.round(kpis?.leads || 0)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* END GOOGLE ADS VIEW */}

          {/* SEO VIEW */}
          {activeView === 'seo' && (
            <div className="space-y-6">
              {/* Top Summary Row - Using pre-computed DB data */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard
                  icon={<MousePointer className="w-6 h-6 text-teal-700" />}
                  iconBg="bg-teal-100"
                  label="Organic Clicks"
                  value={formatNumber(data?.searchConsole?.clicks || 0, 0)}
                />
                <SummaryCard
                  icon={<Eye className="w-6 h-6 text-amber-700" />}
                  iconBg="bg-amber-100"
                  label="Impressions"
                  value={formatNumber(data?.searchConsole?.impressions || 0, 0)}
                />
                <SummaryCard
                  icon={<TrendingUp className="w-6 h-6 text-orange-600" />}
                  iconBg="bg-orange-100"
                  label="Avg CTR"
                  value={`${formatNumber(data?.searchConsole?.ctr || 0, 2)}%`}
                />
                <SummaryCard
                  icon={<Target className="w-6 h-6 text-green-700" />}
                  iconBg="bg-green-100"
                  label="Avg Position"
                  value={formatNumber(data?.searchConsole?.position || 0, 1)}
                />
              </div>

              {/* SEO Performance Summary */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">SEO Performance</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <MetricWithChange label="Organic Clicks" value={formatNumber(data?.searchConsole?.clicks || 0, 0)} />
                  <MetricWithChange label="Impressions" value={formatNumber(data?.searchConsole?.impressions || 0, 0)} />
                  <MetricWithChange label="CTR" value={`${formatNumber(data?.searchConsole?.ctr || 0, 2)}%`} />
                  <MetricWithChange label="Avg Position" value={formatNumber(data?.searchConsole?.position || 0, 1)} />
                </div>
              </div>

              {/* SEO Ranking Metrics */}
              <SEORankingMetrics
                googleRank={data?._fastData?.metrics?.googleRank || null}
                topKeywords={data?._fastData?.metrics?.topKeywords || 0}
                keywordsDeclined={data?._fastData?.metrics?.keywordsDeclined || 0}
                nonBrandedTraffic={data?._fastData?.metrics?.nonBrandedTraffic || 0}
              />

              {/* Traffic Metrics from GA */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Traffic Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <MetricWithChange label="Sessions" value={formatNumber(data?.googleAnalytics?.metrics?.sessions || 0, 0)} />
                  <MetricWithChange label="Users" value={formatNumber(data?.googleAnalytics?.metrics?.users || 0, 0)} />
                  <MetricWithChange label="Engagement Rate" value={`${formatNumber(data?.googleAnalytics?.metrics?.engagementRate || 0, 1)}%`} />
                  <MetricWithChange label="Conversions" value={formatNumber(data?.googleAnalytics?.metrics?.conversions || 0, 0)} />
                </div>
              </div>

              {/* Traffic Chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Traffic Trend</h3>
                <ModernTrafficChart data={data?._fastData?.daily || []} />
              </div>

              {/* Traffic Sources - Real data from database */}
              <RealTrafficSources trafficSourcesData={data?._fastData?.trafficSources || []} />

              {/* SEO Keyword Performance */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Keyword Rankings</h3>
                  <p className="text-sm text-gray-500 mt-1">Search visibility metrics from Google Search Console</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-teal-50 rounded-xl p-4">
                      <div className="text-xs text-gray-500 mb-1">Avg Position</div>
                      <div className="text-2xl font-bold text-teal-600">
                        {(() => {
                          const googleRank = data?._fastData?.metrics?.googleRank;
                          const gscPosition = data?.searchConsole?.position;
                          if (googleRank) return `#${formatNumber(googleRank, 1)}`;
                          if (gscPosition && gscPosition > 0) return `#${formatNumber(gscPosition, 1)}`;
                          return 'N/A';
                        })()}
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4">
                      <div className="text-xs text-gray-500 mb-1">Top 10 Keywords</div>
                      <div className="text-2xl font-bold text-green-600">
                        {data?._fastData?.metrics?.topKeywords || 0}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4">
                      <div className="text-xs text-gray-500 mb-1">Non-Branded Traffic</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatNumber(data?._fastData?.metrics?.nonBrandedTraffic || 0, 0)}
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4">
                      <div className="text-xs text-gray-500 mb-1">Keywords Declined</div>
                      <div className="text-2xl font-bold text-amber-600">
                        {data?._fastData?.metrics?.keywordsDeclined || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SEO Performance Summary - From Database */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Organic Search Performance</h3>
                      <p className="text-sm text-gray-500 mt-1">Summary metrics from Google Search Console</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-teal-50 rounded-xl p-4">
                      <div className="text-xs text-gray-500 mb-1">Organic Clicks</div>
                      <div className="text-2xl font-bold text-teal-600">
                        {formatNumber(data?.searchConsole?.clicks || 0, 0)}
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4">
                      <div className="text-xs text-gray-500 mb-1">Impressions</div>
                      <div className="text-2xl font-bold text-amber-600">
                        {formatNumber(data?.searchConsole?.impressions || 0, 0)}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4">
                      <div className="text-xs text-gray-500 mb-1">Click-Through Rate</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatNumber(data?.searchConsole?.ctr || 0, 1)}%
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-4">
                      <div className="text-xs text-gray-500 mb-1">Avg Position</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {formatNumber(data?.searchConsole?.position || 0, 1)}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-4 text-center">
                    Detailed keyword rankings available in full SEO reports
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* END SEO VIEW */}

          {/* CALLS VIEW */}
          {activeView === 'calls' && (
            <div className="space-y-6">
              {!clientServices.callRail ? (
                // Service Not Available Message
                <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                  <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-10 h-10 text-amber-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Call Tracking Not Configured
                  </h3>
                  <p className="text-gray-600 max-w-md mx-auto mb-4">
                    This client is not currently using CallRail call tracking service.
                  </p>
                  <p className="text-sm text-gray-500">
                    To enable call tracking and analytics, please contact support to set up CallRail integration.
                  </p>
                </div>
              ) : (
                <>
                  {/* Top Summary Row - Thorbit Style */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <SummaryCard
                      icon={<Phone className="w-6 h-6 text-teal-700" />}
                      iconBg="bg-teal-100"
                      label="Total Calls"
                      value={data?.callRail?.metrics?.totalCalls || 0}
                    />
                    <SummaryCard
                      icon={<CheckCircle className="w-6 h-6 text-green-700" />}
                      iconBg="bg-green-100"
                      label="Answered"
                      value={data?.callRail?.metrics?.answeredCalls || 0}
                    />
                    <SummaryCard
                      icon={<XCircle className="w-6 h-6 text-red-600" />}
                      iconBg="bg-red-100"
                      label="Missed"
                      value={data?.callRail?.metrics?.missedCalls || 0}
                    />
                    <SummaryCard
                      icon={<Clock className="w-6 h-6 text-amber-700" />}
                      iconBg="bg-amber-100"
                      label="Avg Duration"
                      value={`${Math.round((data?.callRail?.metrics?.averageDuration || 0) / 60)}m`}
                    />
                  </div>

                  {/* Call Performance Metrics */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Call Performance</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <MetricWithChange
                        label="Answer Rate"
                        value={`${data?.callRail?.metrics?.totalCalls > 0 ? Math.round((data?.callRail?.metrics?.answeredCalls || 0) / data?.callRail?.metrics?.totalCalls * 100) : 0}%`}
                        better={true}
                      />
                      <MetricWithChange
                        label="Avg Talk Time"
                        value={`${Math.round((data?.callRail?.metrics?.averageDuration || 0) / 60)}:${String(Math.round((data?.callRail?.metrics?.averageDuration || 0) % 60)).padStart(2, '0')}`}
                        better={true}
                      />
                      <MetricWithChange
                        label="First-time Callers"
                        value={data?.callRail?.metrics?.firstTimeCalls || '--'}
                        better={true}
                      />
                      <MetricWithChange
                        label="Repeat Callers"
                        value={data?.callRail?.metrics?.repeatCalls || '--'}
                        better={true}
                      />
                    </div>
                  </div>

                  {/* Recent Calls - Data from pre-computed database */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                    <div className="px-6 py-4 border-b border-gray-50">
                      <h3 className="text-lg font-bold text-gray-900">Recent Calls</h3>
                    </div>
                    <div className="p-8 text-center text-gray-500">
                      <p>Call details available in CallRail dashboard</p>
                    </div>
                  </div>

                  {/* Calls by Source */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                    <div className="px-6 py-4 border-b border-gray-50">
                      <h3 className="text-lg font-bold text-gray-900">Calls by Source</h3>
                    </div>
                    <div className="p-8 text-center text-gray-500">
                      <p>Source breakdown available in CallRail dashboard</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {/* END CALLS VIEW */}

          {/* GOOGLE BUSINESS PROFILE VIEW */}
          {activeView === 'gbp' && (
            <div className="space-y-6">
              {(() => {
                // Check if GBP has actual data (not just zeros)
                const gbpHasData = (data?.googleBusiness?.calls || 0) +
                  (data?.googleBusiness?.clicks || 0) +
                  (data?.googleBusiness?.directions || 0) +
                  (data?.googleBusiness?.views || 0) > 0;
                const gbpConfigured = clientServices?.googleBusiness;

                // Case 1: Has data - show normal GBP section
                if (gbpHasData) {
                  return (
                    <>
                      {/* Top Summary Row - Thorbit Style */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <SummaryCard
                          icon={<Phone className="w-6 h-6 text-teal-700" />}
                          iconBg="bg-teal-100"
                          label="Phone Calls"
                          value={data?.googleBusiness?.calls || 0}
                        />
                        <SummaryCard
                      icon={<Globe className="w-6 h-6 text-amber-700" />}
                      iconBg="bg-amber-100"
                      label="Website Visits"
                      value={data?.googleBusiness?.clicks || 0}
                    />
                    <SummaryCard
                      icon={<MapPin className="w-6 h-6 text-purple-700" />}
                      iconBg="bg-purple-100"
                      label="Directions"
                      value={data?.googleBusiness?.directions || 0}
                    />
                    <SummaryCard
                      icon={<Eye className="w-6 h-6 text-orange-600" />}
                      iconBg="bg-orange-100"
                      label="Profile Views"
                      value={formatNumber(data?.googleBusiness?.views || 0)}
                    />
                  </div>

                  {/* Summary Card */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Visibility Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-teal-50 rounded-xl">
                        <p className="text-3xl font-bold text-teal-600">{formatNumber(data?.googleBusiness?.views || 0)}</p>
                        <p className="text-sm text-gray-600 mt-1">Total Profile Views</p>
                      </div>
                      <div className="text-center p-4 bg-amber-50 rounded-xl">
                        <p className="text-3xl font-bold text-amber-600">
                          {formatNumber((data?.googleBusiness?.calls || 0) + (data?.googleBusiness?.clicks || 0) + (data?.googleBusiness?.directions || 0))}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">Total Actions</p>
                      </div>
                    </div>
                  </div>

                  {/* Engagement Metrics - Thorbit Style */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Customer Engagement</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <MetricWithChange
                        label="Total Actions"
                        value={formatNumber(
                          (data?.googleBusiness?.calls || 0) +
                          (data?.googleBusiness?.clicks || 0) +
                          (data?.googleBusiness?.directions || 0)
                        )}
                        better={true}
                      />
                      <MetricWithChange
                        label="Engagement Rate"
                        value={(() => {
                          const totalActions = (data?.googleBusiness?.calls || 0) + (data?.googleBusiness?.clicks || 0) + (data?.googleBusiness?.directions || 0);
                          const totalViews = data?.googleBusiness?.views || 0;
                          return totalViews > 0 ? (formatNumber(totalActions / totalViews * 100, 1) + '%') : '0%';
                        })()}
                        better={true}
                      />
                      <MetricWithChange
                        label="Call Conversion"
                        value={(() => {
                          const calls = data?.googleBusiness?.calls || 0;
                          const totalActions = (data?.googleBusiness?.calls || 0) + (data?.googleBusiness?.clicks || 0) + (data?.googleBusiness?.directions || 0);
                          return totalActions > 0 ? (Math.round(calls / totalActions * 100) + '%') : '0%';
                        })()}
                        better={true}
                      />
                    </div>
                  </div>

                  {/* Action Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                          <Target className="w-4 h-4 text-amber-700" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Top Action</h3>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-2">
                        {(() => {
                          const actions = [
                            { label: 'Phone Calls', value: data?.googleBusiness?.calls || 0 },
                            { label: 'Website Visits', value: data?.googleBusiness?.clicks || 0 },
                            { label: 'Directions', value: data?.googleBusiness?.directions || 0 }
                          ].sort((a, b) => b.value - a.value);
                          return actions[0].label;
                        })()}
                      </div>
                      <div className="text-sm text-gray-500">
                        Most common customer action
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-teal-700" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Action Breakdown</h3>
                      </div>
                      <div className="space-y-3">
                        {[
                          { label: 'Phone Calls', value: data?.googleBusiness?.calls || 0, gradient: 'from-teal-400 to-teal-500' },
                          { label: 'Website Clicks', value: data?.googleBusiness?.clicks || 0, gradient: 'from-amber-400 to-amber-500' },
                          { label: 'Directions', value: data?.googleBusiness?.directions || 0, gradient: 'from-purple-400 to-purple-500' }
                        ].map((action, idx) => (
                          <div key={idx}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">{action.label}</span>
                              <span className="font-bold text-gray-900">{action.value}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className={`bg-gradient-to-r ${action.gradient} h-2 rounded-full transition-all duration-500`}
                                style={{
                                  width: `${(() => {
                                    const total = (data?.googleBusiness?.calls || 0) + (data?.googleBusiness?.clicks || 0) + (data?.googleBusiness?.directions || 0);
                                    return total > 0 ? Math.round((action.value / total) * 100) : 0;
                                  })()}%`
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* GBP Reviews & Posts Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <GBPReviewsCard
                      totalReviews={data?.googleBusiness?.reviewsCount || 0}
                      averageRating={data?.googleBusiness?.ratingAvg || 0}
                      newReviews={data?.googleBusiness?.newReviews || 0}
                      daysSinceReview={data?.googleBusiness?.daysSinceReview ?? 0}
                    />
                    <GBPPostsCard
                      postsCount={data?.googleBusiness?.postsCount || 0}
                      postsViews={data?.googleBusiness?.postsViews || 0}
                      postsClicks={data?.googleBusiness?.postsClicks || 0}
                      daysSincePost={data?.googleBusiness?.daysSincePost ?? 0}
                    />
                  </div>

                    </>
                  );
                }

                // Case 2: Configured but no data - needs re-authentication
                if (gbpConfigured) {
                  return (
                    <div className="bg-amber-50 rounded-xl p-12 text-center border border-amber-200">
                      <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-10 h-10 text-amber-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Google Business Profile Needs Re-Authentication
                      </h3>
                      <p className="text-gray-600 max-w-md mx-auto mb-4">
                        Your GBP is configured but we couldn't fetch any data. This usually means the authentication has expired or the connected account no longer has access.
                      </p>
                      <div className="bg-white rounded-lg p-4 mb-6 max-w-md mx-auto border border-amber-200">
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><strong>Possible causes:</strong></p>
                          <ul className="list-disc list-inside text-left ml-2">
                            <li>OAuth token has expired</li>
                            <li>Google account access was revoked</li>
                            <li>Business Profile location changed</li>
                          </ul>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            if (!clientUUID) return;
                            const response = await fetch(`/api/auth/google-business?clientId=${clientUUID}`);
                            const result = await response.json();
                            if (result.success && result.authUrl) {
                              window.location.href = result.authUrl;
                            }
                          } catch (error) {
                            console.error('Auth error:', error);
                          }
                        }}
                        className="inline-flex items-center px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors"
                        disabled={!clientUUID}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Re-Authenticate Google Business Profile
                      </button>
                      <p className="text-xs text-gray-500 mt-4">
                        You'll be redirected to Google to re-authorize access
                      </p>
                    </div>
                  );
                }

                // Case 3: Not connected at all
                return (
                  <div className="bg-gray-50 rounded-xl p-12 text-center border border-gray-200">
                    <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MapPin className="w-10 h-10 text-teal-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Google Business Profile Not Connected
                    </h3>
                    <p className="text-gray-600 max-w-md mx-auto mb-6">
                      Connect your Google Business Profile to see customer engagement metrics like calls, website visits, and direction requests.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          if (!clientUUID) return;
                          const response = await fetch(`/api/auth/google-business?clientId=${clientUUID}`);
                          const result = await response.json();
                          if (result.success && result.authUrl) {
                            window.location.href = result.authUrl;
                          }
                        } catch (error) {
                          console.error('Auth error:', error);
                        }
                      }}
                      className="inline-flex items-center px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors"
                      disabled={!clientUUID}
                    >
                      <Link className="w-4 h-4 mr-2" />
                      Connect Google Business Profile
                    </button>
                    <div className="mt-6 max-w-lg mx-auto">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
                        <div className="flex items-start">
                          <AlertCircle className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-amber-900">
                            <p className="font-semibold mb-1">Important: Use the correct Google account</p>
                            <p className="text-amber-800">You can connect using <strong>any Google email</strong> that has Manager or Owner access to your Google Business Profile. It doesn't need to match your dashboard login email.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">
                      You'll be redirected to Google to authorize access
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
          {/* END GOOGLE BUSINESS PROFILE VIEW */}

        </div>
      </main>
      </div>
    </div>
  );
}