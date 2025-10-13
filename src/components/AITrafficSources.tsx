'use client';

import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, Brain, Mic, Smartphone, AlertCircle } from 'lucide-react';

interface AITrafficSource {
  name: string;
  source: string;
  sessions: number;
  users: number;
  conversions: number;
  growthRate: number;
  icon: string;
  color: string;
}

interface EmergingTrafficMetrics {
  totalAITraffic: number;
  aiGrowthRate: number;
  voiceSearchTraffic: number;
  smartSpeakerTraffic: number;
  aiConversions: number;
  aiConversionRate: number;
}

export function AITrafficSources({ period, clientId }: { period: string; clientId: string }) {
  const [aiSources, setAiSources] = useState<AITrafficSource[]>([]);
  const [metrics, setMetrics] = useState<EmergingTrafficMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAITrafficData();
  }, [period, clientId]);

  const fetchAITrafficData = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `/api/google-analytics?period=${period}&clientId=${clientId}&report=ai-traffic`
      );
      const result = await response.json();

      if (result.success && result.data) {
        setAiSources(result.data.sources || []);
        setMetrics(result.data.metrics || null);
      }
    } catch (error) {
      console.error('Failed to fetch AI traffic data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'brain':
        return <Brain className="w-5 h-5" />;
      case 'mic':
        return <Mic className="w-5 h-5" />;
      case 'smartphone':
        return <Smartphone className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-lg flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">AI & Emerging Traffic</h3>
            <p className="text-sm text-gray-500">Next-generation traffic sources</p>
          </div>
        </div>
        <div className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
          CUTTING EDGE
        </div>
      </div>

      {/* Key Metrics */}
      {metrics && metrics.totalAITraffic > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-100">
              <div className="text-xs text-purple-700 font-medium mb-1">Total AI Traffic</div>
              <div className="text-2xl font-bold text-purple-900">
                {metrics.totalAITraffic.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-xs text-purple-600 mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>{metrics.aiGrowthRate > 0 ? '+' : ''}{metrics.aiGrowthRate}%</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-100">
              <div className="text-xs text-blue-700 font-medium mb-1">Voice Search</div>
              <div className="text-2xl font-bold text-blue-900">
                {metrics.voiceSearchTraffic || 0}
              </div>
              <div className="text-xs text-blue-600">Alexa, Siri, Google</div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
              <div className="text-xs text-green-700 font-medium mb-1">AI Conversions</div>
              <div className="text-2xl font-bold text-green-900">{metrics.aiConversions}</div>
              <div className="text-xs text-green-600">
                {metrics.aiConversionRate.toFixed(1)}% conversion rate
              </div>
            </div>
          </div>

          {/* WOW Factor Alert */}
          {metrics.aiGrowthRate > 100 && (
            <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50 border-2 border-purple-300 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Sparkles className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    🚀 AI Traffic Exploding: +{metrics.aiGrowthRate}%!
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    You're getting discovered through ChatGPT, Gemini, and other AI assistants. This is
                    the future of search - and you're already there!
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* AI Traffic Sources Breakdown */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">AI Assistant Referrals</h4>

        {aiSources.length > 0 ? (
          <div className="space-y-3">
            {aiSources.map((source, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-100 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${source.color} text-white shadow-lg`}
                  >
                    <span className="text-xl">{source.icon}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{source.name}</div>
                    <div className="text-xs text-gray-500">{source.source}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Sessions</div>
                    <div className="text-lg font-bold text-gray-900">
                      {source.sessions.toLocaleString()}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-gray-500">Users</div>
                    <div className="text-lg font-bold text-blue-600">
                      {source.users.toLocaleString()}
                    </div>
                  </div>

                  {source.conversions > 0 && (
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Conversions</div>
                      <div className="text-lg font-bold text-green-600">{source.conversions}</div>
                    </div>
                  )}

                  {source.growthRate !== 0 && (
                    <div className="flex items-center gap-1">
                      <TrendingUp
                        className={`w-4 h-4 ${
                          source.growthRate > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      />
                      <span
                        className={`text-sm font-bold ${
                          source.growthRate > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {source.growthRate > 0 ? '+' : ''}
                        {source.growthRate}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-100">
            <Brain className="w-12 h-12 mx-auto mb-3 text-purple-400" />
            <p className="text-gray-700 font-medium">No AI traffic detected yet</p>
            <p className="text-xs text-gray-500 mt-1">
              AI assistants may start referring traffic as your content gets indexed
            </p>
          </div>
        )}
      </div>

      {/* Educational Info */}
      {aiSources.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-blue-900 mb-1">
                  Why This Matters 💡
                </div>
                <div className="text-xs text-blue-800 space-y-1">
                  <p>
                    • <strong>Future-Proof:</strong> AI search is growing 10x faster than traditional
                    search
                  </p>
                  <p>
                    • <strong>High Intent:</strong> Users asking AI assistants are ready to take
                    action
                  </p>
                  <p>
                    • <strong>First Mover Advantage:</strong> Early adopters dominate AI search
                    results
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emerging Trends */}
      {metrics && (metrics.voiceSearchTraffic > 0 || metrics.smartSpeakerTraffic > 0) && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Other Emerging Sources</h4>
          <div className="grid grid-cols-2 gap-3">
            {metrics.voiceSearchTraffic > 0 && (
              <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-100">
                <Mic className="w-8 h-8 text-orange-600" />
                <div>
                  <div className="text-xs text-orange-700 font-medium">Voice Search</div>
                  <div className="text-lg font-bold text-orange-900">
                    {metrics.voiceSearchTraffic}
                  </div>
                </div>
              </div>
            )}

            {metrics.smartSpeakerTraffic > 0 && (
              <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100">
                <Smartphone className="w-8 h-8 text-green-600" />
                <div>
                  <div className="text-xs text-green-700 font-medium">Smart Speakers</div>
                  <div className="text-lg font-bold text-green-900">
                    {metrics.smartSpeakerTraffic}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
