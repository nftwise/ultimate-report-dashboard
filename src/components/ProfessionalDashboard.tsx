'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Target,
  Phone,
  LogOut,
  Calendar,
  ArrowUp,
  ArrowDown,
  Building2
} from 'lucide-react';

// KPI Card Component
function KPICard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  format = 'number',
  trend = 'neutral' 
}: any) {
  const isPositive = trend === 'up';
  const TrendIcon = isPositive ? ArrowUp : ArrowDown;
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-600 text-sm font-medium mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900">
            {format === 'currency' && '$'}
            {format === 'currency' ? value.toLocaleString('en-US', { minimumFractionDigits: 2 }) : value.toLocaleString()}
          </p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              <TrendIcon className="w-3 h-3" />
              <span className="font-medium">{Math.abs(change)}%</span>
              <span className="text-gray-500">vs prev period</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${
          isPositive ? 'bg-green-50' : 'bg-blue-50'
        }`}>
          <Icon className={`w-6 h-6 ${
            isPositive ? 'text-green-600' : 'text-blue-600'
          }`} />
        </div>
      </div>
    </div>
  );
}

// Main Dashboard Component
export default function ProfessionalDashboard({ user }: { user: any }) {
  const [period, setPeriod] = useState('7days');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchDashboardData();
  }, [period, user.id]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard?period=${period}&clientId=${user.id}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  };

  // Calculate KPIs
  const kpis = data ? {
    traffic: data.googleAnalytics?.metrics?.sessions || 0,
    leads: (data.googleAnalytics?.metrics?.conversions || 0) + (data.callRail?.metrics?.totalCalls || 0),
    adSpend: data.googleAds?.totalMetrics?.cost || 0,
    cpl: data.combined?.overallCostPerLead || 0,
    trafficChange: 18, // Calculate from historical data
    leadsChange: 12,
    spendChange: -5,
    cplChange: -8,
  } : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Company Name */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {user.companyName}
                </h1>
                <p className="text-xs text-gray-500">Marketing Dashboard</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              {/* Date Range Selector */}
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
              </select>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Row 1: KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard
              title="Traffic (Sessions)"
              value={kpis?.traffic || 0}
              change={kpis?.trafficChange}
              icon={Users}
              trend="up"
            />
            <KPICard
              title="Leads (Forms + Calls)"
              value={kpis?.leads || 0}
              change={kpis?.leadsChange}
              icon={Target}
              trend="up"
            />
            <KPICard
              title="Ad Spend"
              value={kpis?.adSpend || 0}
              change={kpis?.spendChange}
              icon={DollarSign}
              format="currency"
              trend="down"
            />
            <KPICard
              title="Cost per Lead"
              value={kpis?.cpl || 0}
              change={kpis?.cplChange}
              icon={TrendingUp}
              format="currency"
              trend="down"
            />
          </div>

          {/* Row 2: Traffic Trend Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Traffic & Leads Trend
            </h2>
            <div className="h-64 flex items-center justify-center text-gray-500">
              {/* Replace with actual chart component */}
              <div className="text-center">
                <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Chart will display traffic and leads over time</p>
              </div>
            </div>
          </div>

          {/* Row 3: Google Analytics & Google Ads */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Google Analytics Summary */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Google Analytics Summary
              </h2>
              <div className="space-y-4">
                {/* Traffic Sources */}
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Traffic Sources</h3>
                  <div className="space-y-2">
                    {['Organic', 'Paid', 'Direct', 'Referral', 'Social'].map((source, idx) => (
                      <div key={source} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{source}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${[45, 25, 15, 10, 5][idx]}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {[45, 25, 15, 10, 5][idx]}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Pages */}
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Top Pages</h3>
                  <div className="text-sm text-gray-600">
                    <div className="grid grid-cols-3 gap-2 pb-2 border-b font-medium">
                      <span>Page</span>
                      <span className="text-right">Views</span>
                      <span className="text-right">Time</span>
                    </div>
                    {[1, 2, 3].map(i => (
                      <div key={i} className="grid grid-cols-3 gap-2 py-2 border-b">
                        <span className="truncate">/page-{i}</span>
                        <span className="text-right">{1000 - i * 200}</span>
                        <span className="text-right">{2 + i}:30</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Google Ads Summary */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Google Ads Summary
              </h2>
              <div className="space-y-4">
                {/* Campaign Performance */}
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Top Campaigns</h3>
                  <div className="text-sm text-gray-600">
                    <div className="grid grid-cols-4 gap-2 pb-2 border-b font-medium">
                      <span>Campaign</span>
                      <span className="text-right">Spend</span>
                      <span className="text-right">Clicks</span>
                      <span className="text-right">CPL</span>
                    </div>
                    {[1, 2, 3].map(i => (
                      <div key={i} className="grid grid-cols-4 gap-2 py-2 border-b">
                        <span className="truncate">Campaign {i}</span>
                        <span className="text-right">${500 * i}</span>
                        <span className="text-right">{100 * i}</span>
                        <span className="text-right">${15 + i}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metrics Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Total Clicks</p>
                    <p className="text-xl font-bold text-gray-900">
                      {data?.googleAds?.totalMetrics?.clicks || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Avg. CPC</p>
                    <p className="text-xl font-bold text-gray-900">
                      ${data?.googleAds?.totalMetrics?.cpc?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: CallRail Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              CallRail Summary
            </h2>
            
            {/* Call Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <p className="text-sm text-gray-600">Total Calls</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {data?.callRail?.metrics?.totalCalls || 0}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Answered</p>
                <p className="text-2xl font-bold text-green-600">
                  {data?.callRail?.metrics?.answeredCalls || 0}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Missed</p>
                <p className="text-2xl font-bold text-red-600">
                  {data?.callRail?.metrics?.missedCalls || 0}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Avg Duration</p>
                <p className="text-2xl font-bold text-blue-600">
                  {Math.round(data?.callRail?.metrics?.averageDuration || 0)}s
                </p>
              </div>
            </div>

            {/* Call Sources */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Call Sources</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['Google Ads', 'Organic', 'Direct', 'Referral'].map((source, idx) => (
                  <div key={source} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">{source}</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {[35, 25, 20, 20][idx]}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}