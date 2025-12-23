'use client';

import { formatNumber } from '@/lib/format-utils';
import { Bot, Brain, Sparkles, Briefcase, Search, Globe, TrendingUp, Users, MousePointerClick, Zap } from 'lucide-react';

interface AITrafficOnlyProps {
  trafficSourcesData: any[];
}

export function AITrafficOnly({ trafficSourcesData }: AITrafficOnlyProps) {

  // Filter to show ONLY AI traffic sources
  const filterAITraffic = (sources: any[]) => {
    if (!sources || sources.length === 0) return [];

    return sources.filter(source => {
      const sourceLower = source.source?.toLowerCase() || '';
      const mediumLower = source.medium?.toLowerCase() || '';

      return (
        sourceLower.includes('gemini') ||
        sourceLower.includes('chatgpt') ||
        sourceLower.includes('claude') ||
        sourceLower.includes('bard') ||
        sourceLower.includes('openai') ||
        sourceLower.includes('copilot') ||
        sourceLower.includes('perplexity') ||
        sourceLower.includes('you.com') ||
        sourceLower.includes('bing chat') ||
        sourceLower.includes('character.ai') ||
        (mediumLower.includes('referral') && (
          sourceLower.includes('ai') ||
          sourceLower.includes('chat') ||
          sourceLower.includes('gpt')
        ))
      );
    });
  };

  // Get AI brand colors and icons
  const getAIBrandInfo = (source: string) => {
    const sourceLower = source.toLowerCase();
    if (sourceLower.includes('chatgpt') || sourceLower.includes('openai')) {
      return { icon: Bot, color: 'emerald', bgColor: 'bg-emerald-500', textColor: 'text-emerald-600', name: 'ChatGPT' };
    }
    if (sourceLower.includes('claude')) {
      return { icon: Brain, color: 'orange', bgColor: 'bg-orange-500', textColor: 'text-orange-600', name: 'Claude' };
    }
    if (sourceLower.includes('gemini') || sourceLower.includes('bard')) {
      return { icon: Sparkles, color: 'blue', bgColor: 'bg-blue-500', textColor: 'text-blue-600', name: 'Gemini' };
    }
    if (sourceLower.includes('copilot')) {
      return { icon: Briefcase, color: 'sky', bgColor: 'bg-sky-500', textColor: 'text-sky-600', name: 'Copilot' };
    }
    if (sourceLower.includes('perplexity')) {
      return { icon: Search, color: 'teal', bgColor: 'bg-teal-500', textColor: 'text-teal-600', name: 'Perplexity' };
    }
    if (sourceLower.includes('you.com')) {
      return { icon: Globe, color: 'indigo', bgColor: 'bg-indigo-500', textColor: 'text-indigo-600', name: 'You.com' };
    }
    return { icon: Bot, color: 'violet', bgColor: 'bg-violet-500', textColor: 'text-violet-600', name: source };
  };

  const aiTrafficSources = filterAITraffic(trafficSourcesData);

  // Calculate totals
  const totalAISessions = aiTrafficSources.reduce((sum, source) => sum + (source.sessions || 0), 0);
  const totalAIUsers = aiTrafficSources.reduce((sum, source) => sum + (source.users || 0), 0);
  const totalAIConversions = aiTrafficSources.reduce((sum, source) => sum + (source.conversions || 0), 0);

  // Sort by sessions descending
  const sortedSources = [...aiTrafficSources].sort((a, b) => (b.sessions || 0) - (a.sessions || 0));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">AI Referral Traffic</h3>
              <p className="text-violet-200 text-sm">Visitors from AI assistants</p>
            </div>
          </div>
          {totalAISessions > 0 && (
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-white font-medium">{totalAISessions} sessions</span>
            </div>
          )}
        </div>
      </div>

      {aiTrafficSources.length > 0 ? (
        <div className="p-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
              <div className="flex items-center gap-2 mb-2">
                <MousePointerClick className="w-4 h-4 text-violet-600" />
                <span className="text-xs font-medium text-violet-600 uppercase tracking-wide">Sessions</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalAISessions}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Users</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalAIUsers}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Conversions</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalAIConversions}</p>
            </div>
          </div>

          {/* AI Sources - Modern Cards */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Traffic by Platform</h4>
            {sortedSources.map((source, index) => {
              const sessions = source.sessions || 0;
              const users = source.users || 0;
              const conversions = source.conversions || 0;
              const percentage = totalAISessions > 0 ? (sessions / totalAISessions) * 100 : 0;
              const brandInfo = getAIBrandInfo(source.source);
              const IconComponent = brandInfo.icon;

              return (
                <div
                  key={index}
                  className="group relative bg-gray-50 hover:bg-white rounded-xl p-4 transition-all duration-200 hover:shadow-md border border-transparent hover:border-gray-200"
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 ${brandInfo.bgColor} rounded-xl flex items-center justify-center shadow-lg shadow-${brandInfo.color}-500/25`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{brandInfo.name}</span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Top Source</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-gray-500">{users} users</span>
                        {conversions > 0 && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-sm text-emerald-600 font-medium">{conversions} conversions</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-900">{sessions}</div>
                      <div className="text-sm text-gray-500">{formatNumber(percentage, 0)}% share</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${brandInfo.bgColor} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Insight */}
          <div className="mt-6 p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-100">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">AI Traffic Insight</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {totalAISessions > 50
                    ? `AI referrals are growing! ${sortedSources[0] ? getAIBrandInfo(sortedSources[0].source).name : 'ChatGPT'} leads with ${formatNumber((sortedSources[0]?.sessions || 0) / totalAISessions * 100, 0)}% of AI traffic.`
                    : `Early AI traffic detected. As AI assistants become more popular, expect this channel to grow.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-violet-600" />
          </div>
          <h4 className="font-semibold text-gray-900 mb-2">No AI Traffic Yet</h4>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            AI assistants like ChatGPT, Claude, and Gemini haven't referred visitors to your site yet. This emerging channel is worth watching.
          </p>
        </div>
      )}
    </div>
  );
}
