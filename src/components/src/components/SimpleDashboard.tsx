'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SimpleDashboard({ user }: { user: any }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Fetch dashboard data
    fetch(`/api/dashboard?clientId=${user.id}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setData(result.data);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user.id]);

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {user.companyName} Dashboard
              </h1>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Google Analytics Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Google Analytics</h3>
              {data?.googleAnalytics?.metrics && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sessions:</span>
                    <span className="font-medium">{data.googleAnalytics.metrics.sessions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Users:</span>
                    <span className="font-medium">{data.googleAnalytics.metrics.users.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pageviews:</span>
                    <span className="font-medium">{data.googleAnalytics.metrics.pageviews.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bounce Rate:</span>
                    <span className="font-medium">{data.googleAnalytics.metrics.bounceRate.toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Google Ads Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Google Ads</h3>
              {data?.googleAds?.totalMetrics && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Clicks:</span>
                    <span className="font-medium">{data.googleAds.totalMetrics.clicks.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cost:</span>
                    <span className="font-medium">${data.googleAds.totalMetrics.cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CPC:</span>
                    <span className="font-medium">${data.googleAds.totalMetrics.cpc.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Conversions:</span>
                    <span className="font-medium">{data.googleAds.totalMetrics.conversions}</span>
                  </div>
                </div>
              )}
            </div>

            {/* CallRail Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">CallRail</h3>
              {data?.callRail?.metrics && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Calls:</span>
                    <span className="font-medium">{data.callRail.metrics.totalCalls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Answered:</span>
                    <span className="font-medium">{data.callRail.metrics.answeredCalls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Missed:</span>
                    <span className="font-medium">{data.callRail.metrics.missedCalls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Duration:</span>
                    <span className="font-medium">{Math.round(data.callRail.metrics.averageDuration)}s</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}