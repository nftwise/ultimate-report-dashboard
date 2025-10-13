'use client';

import { useState, useEffect } from 'react';
import { Trophy, DollarSign, TrendingUp, Phone, Target, Sparkles, Download, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WeeklyReportData {
  weekWin: {
    title: string;
    description: string;
    icon: string;
  };
  moneyMetrics: {
    revenue: number;
    roas: number;
    costPerLead: number;
    costPerLeadImprovement: number;
    adSpend: number;
  };
  competitiveEdge: {
    rankingImprovements: Array<{
      keyword: string;
      oldPosition: number;
      newPosition: number;
    }>;
    newTopKeywords: number;
  };
  growthTrend: {
    trafficGrowth: number;
    leadsGrowth: number;
    insight: string;
  };
  weekPeriod: {
    start: string;
    end: string;
  };
}

export function WeeklyReport({ clientId }: { clientId: string }) {
  const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchWeeklyReport();
  }, [clientId]);

  const fetchWeeklyReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports/weekly?clientId=${clientId}`);
      const result = await response.json();

      if (result.success && result.data) {
        setReportData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch weekly report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/reports/weekly/pdf?clientId=${clientId}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weekly-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

  const handleEmailReport = async () => {
    try {
      setSending(true);
      await fetch(`/api/reports/weekly/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      alert('Weekly report sent successfully!');
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to send report. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
        <p className="text-gray-500">No weekly report data available</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-xl shadow-lg border border-blue-200 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">📊 Your Weekly Win Report</h2>
          <p className="text-sm text-gray-600">
            {reportData.weekPeriod.start} - {reportData.weekPeriod.end}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
          <Button
            onClick={handleEmailReport}
            disabled={sending}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Mail className="w-4 h-4" />
            {sending ? 'Sending...' : 'Email Report'}
          </Button>
        </div>
      </div>

      {/* Section 1: This Week's Win */}
      <div className="bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 border-2 border-yellow-300 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
            {reportData.weekWin.icon}
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              🎯 {reportData.weekWin.title}
            </h3>
            <p className="text-lg text-gray-700">{reportData.weekWin.description}</p>
          </div>
        </div>
      </div>

      {/* Section 2: Money Metrics */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-600" />
          💰 Money Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportData.moneyMetrics.revenue > 0 && (
            <div className="bg-white rounded-lg p-5 border-2 border-green-200 shadow-sm">
              <div className="text-sm text-green-700 font-medium mb-1">Revenue Generated</div>
              <div className="text-3xl font-bold text-green-900">
                ${reportData.moneyMetrics.revenue.toLocaleString()}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg p-5 border-2 border-blue-200 shadow-sm">
            <div className="text-sm text-blue-700 font-medium mb-1">Return on Ad Spend</div>
            <div className="text-3xl font-bold text-blue-900">
              {reportData.moneyMetrics.roas}%
            </div>
            <div className="text-xs text-blue-600 mt-1">
              ${(reportData.moneyMetrics.roas / 100).toFixed(2)} for every $1 spent
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 border-2 border-purple-200 shadow-sm">
            <div className="text-sm text-purple-700 font-medium mb-1">Cost Per Lead</div>
            <div className="text-3xl font-bold text-purple-900">
              ${reportData.moneyMetrics.costPerLead.toFixed(2)}
            </div>
            {reportData.moneyMetrics.costPerLeadImprovement !== 0 && (
              <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>
                  {reportData.moneyMetrics.costPerLeadImprovement > 0 ? '↓' : '↑'}{' '}
                  {Math.abs(reportData.moneyMetrics.costPerLeadImprovement)}% vs last week
                </span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-5 border-2 border-orange-200 shadow-sm">
            <div className="text-sm text-orange-700 font-medium mb-1">Ad Spend</div>
            <div className="text-3xl font-bold text-orange-900">
              ${reportData.moneyMetrics.adSpend.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Competitive Edge */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-600" />
          🏆 Competitive Edge
        </h3>
        <div className="bg-white rounded-lg p-6 border-2 border-yellow-200 shadow-sm">
          {reportData.competitiveEdge.rankingImprovements.length > 0 ? (
            <div className="space-y-3">
              <div className="font-semibold text-gray-900 mb-3">
                📈 Rankings That Improved This Week:
              </div>
              {reportData.competitiveEdge.rankingImprovements.map((ranking, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🎯</span>
                    <span className="font-medium text-gray-900">"{ranking.keyword}"</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">#{ranking.oldPosition}</span>
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-xl font-bold text-green-600">
                      #{ranking.newPosition}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">Maintaining strong positions across all keywords</p>
          )}

          {reportData.competitiveEdge.newTopKeywords > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <span className="font-bold text-yellow-900">
                🌟 {reportData.competitiveEdge.newTopKeywords} new keywords reached Top 3!
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Growth Trend */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          📈 Growth Trend
        </h3>
        <div className="bg-white rounded-lg p-6 border-2 border-blue-200 shadow-sm">
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <div className="text-sm text-gray-600 mb-1">Traffic Growth</div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-blue-900">
                  {reportData.growthTrend.trafficGrowth > 0 ? '+' : ''}
                  {reportData.growthTrend.trafficGrowth}%
                </span>
                <span className="text-sm text-gray-500">vs last week</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Leads Growth</div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-green-900">
                  {reportData.growthTrend.leadsGrowth > 0 ? '+' : ''}
                  {reportData.growthTrend.leadsGrowth}%
                </span>
                <span className="text-sm text-gray-500">vs last week</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
              <div>
                <div className="text-sm font-semibold text-purple-900 mb-1">Key Insight:</div>
                <p className="text-gray-700">{reportData.growthTrend.insight}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Next Steps */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <h3 className="text-xl font-bold mb-2">🚀 Keep The Momentum Going!</h3>
        <p className="text-blue-100">
          Your marketing is working! These results show real progress. We'll keep optimizing to
          maintain this upward trajectory.
        </p>
      </div>
    </div>
  );
}
