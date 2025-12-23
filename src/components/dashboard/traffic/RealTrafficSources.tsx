import { Search, DollarSign, Globe, Users, Building2, Eye, Link, Mail, Bot, BarChart3 } from 'lucide-react';
import { formatNumber } from '@/lib/format-utils';

interface RealTrafficSourcesProps {
  trafficSourcesData: any[];
}

export function RealTrafficSources({ trafficSourcesData }: RealTrafficSourcesProps) {
  const processTrafficSources = (sources: any[]) => {
    const aiSources = sources.filter(source => {
      const sourceLower = source.source?.toLowerCase() || '';
      const mediumLower = source.medium?.toLowerCase() || '';
      return sourceLower.includes('gemini') || sourceLower.includes('chatgpt') ||
             sourceLower.includes('claude') || sourceLower.includes('bard') ||
             sourceLower.includes('openai') || sourceLower.includes('copilot') ||
             sourceLower.includes('perplexity') || sourceLower.includes('you.com') ||
             (mediumLower.includes('referral') && (sourceLower.includes('ai') || sourceLower.includes('chat')));
    });

    const nonAiSources = sources.filter(source => {
      const sourceLower = source.source?.toLowerCase() || '';
      const mediumLower = source.medium?.toLowerCase() || '';
      return !(sourceLower.includes('gemini') || sourceLower.includes('chatgpt') ||
               sourceLower.includes('claude') || sourceLower.includes('bard') ||
               sourceLower.includes('openai') || sourceLower.includes('copilot') ||
               sourceLower.includes('perplexity') || sourceLower.includes('you.com') ||
               (mediumLower.includes('referral') && (sourceLower.includes('ai') || sourceLower.includes('chat'))));
    });

    const processedSources = [...nonAiSources];

    if (aiSources.length > 0) {
      const combinedAI = {
        source: 'AI Referral',
        medium: 'referral',
        sessions: aiSources.reduce((sum, source) => sum + (source.sessions || 0), 0),
        users: aiSources.reduce((sum, source) => sum + (source.users || 0), 0),
        conversions: aiSources.reduce((sum, source) => sum + (source.conversions || 0), 0),
      };
      processedSources.unshift(combinedAI);
    }

    return processedSources;
  };

  const getSourceDisplay = (source: string, medium: string) => {
    const sourceLower = source?.toLowerCase() || '';
    const mediumLower = medium?.toLowerCase() || '';

    if (sourceLower.includes('gemini') || sourceLower.includes('chatgpt') ||
        sourceLower.includes('claude') || sourceLower.includes('bard') ||
        sourceLower.includes('openai') || sourceLower.includes('copilot') ||
        sourceLower.includes('perplexity') || sourceLower.includes('you.com') ||
        (mediumLower.includes('referral') && (sourceLower.includes('ai') || sourceLower.includes('chat')))) {
      return { icon: Bot, color: 'bg-purple-600', name: 'AI Referral' };
    } else if (sourceLower.includes('google') && mediumLower.includes('organic')) {
      return { icon: Search, color: 'bg-green-500', name: 'Google Organic' };
    } else if (sourceLower.includes('google') && mediumLower.includes('cpc')) {
      return { icon: DollarSign, color: 'bg-amber-600', name: 'Google Ads' };
    } else if (sourceLower === 'direct' || sourceLower === '(direct)') {
      return { icon: Globe, color: 'bg-gray-600', name: 'Direct' };
    } else if (sourceLower.includes('facebook')) {
      return { icon: Users, color: 'bg-blue-600', name: 'Facebook' };
    } else if (sourceLower.includes('linkedin')) {
      return { icon: Building2, color: 'bg-blue-700', name: 'LinkedIn' };
    } else if (sourceLower.includes('twitter') || sourceLower.includes('x.com')) {
      return { icon: Users, color: 'bg-black', name: 'Twitter/X' };
    } else if (sourceLower.includes('youtube')) {
      return { icon: Eye, color: 'bg-red-500', name: 'YouTube' };
    } else if (sourceLower.includes('bing')) {
      return { icon: Search, color: 'bg-cyan-500', name: 'Bing' };
    } else if (mediumLower.includes('referral')) {
      return { icon: Link, color: 'bg-purple-500', name: source || 'Referral' };
    } else if (mediumLower.includes('email')) {
      return { icon: Mail, color: 'bg-orange-500', name: 'Email' };
    } else {
      return { icon: Globe, color: 'bg-gray-500', name: source || 'Unknown' };
    }
  };

  if (!trafficSourcesData || trafficSourcesData.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-amber-700" />
          </div>
          <h3 className="font-bold text-gray-900">Traffic Sources</h3>
        </div>
        <div className="text-center py-8">
          <span className="text-gray-500">No traffic sources data available</span>
        </div>
      </div>
    );
  }

  const processedSources = processTrafficSources(trafficSourcesData);
  const topSources = processedSources
    .sort((a, b) => (b.sessions || 0) - (a.sessions || 0))
    .slice(0, 6);

  const totalSessions = topSources.reduce((sum, source) => sum + (source.sessions || 0), 0);

  const pieSlices = topSources.map((source, index) => {
    const display = getSourceDisplay(source.source, source.medium);
    const sessions = source.sessions || 0;
    const percentage = totalSessions > 0 ? ((sessions / totalSessions) * 100) : 0;
    return { ...source, display, percentage, sessions };
  });

  const pieColors = [
    'rgb(59, 130, 246)',
    'rgb(16, 185, 129)',
    'rgb(249, 115, 22)',
    'rgb(139, 92, 246)',
    'rgb(236, 72, 153)',
    'rgb(14, 165, 233)',
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Traffic Sources</h3>
            <p className="text-xs text-gray-500">{totalSessions.toLocaleString()} total sessions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-xs text-green-600 font-medium">Live Data</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="flex items-center justify-center">
          <div className="relative w-48 h-48">
            <svg viewBox="0 0 200 200" className="transform -rotate-90">
              {pieSlices.map((slice, index) => {
                const previousPercentages = pieSlices.slice(0, index).reduce((sum, s) => sum + s.percentage, 0);
                const startAngle = (previousPercentages / 100) * 360;
                const endAngle = ((previousPercentages + slice.percentage) / 100) * 360;
                const largeArcFlag = slice.percentage > 50 ? 1 : 0;

                const startX = 100 + 90 * Math.cos((startAngle * Math.PI) / 180);
                const startY = 100 + 90 * Math.sin((startAngle * Math.PI) / 180);
                const endX = 100 + 90 * Math.cos((endAngle * Math.PI) / 180);
                const endY = 100 + 90 * Math.sin((endAngle * Math.PI) / 180);

                const pathData = [
                  `M 100 100`,
                  `L ${startX} ${startY}`,
                  `A 90 90 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                  `Z`
                ].join(' ');

                return (
                  <path
                    key={index}
                    d={pathData}
                    fill={pieColors[index % pieColors.length]}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                    stroke="white"
                    strokeWidth="2"
                  />
                );
              })}
              <circle cx="100" cy="100" r="50" fill="white" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <div className="text-xl font-bold text-gray-900">{totalSessions.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Sessions</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col justify-center space-y-1">
          {pieSlices.map((slice, index) => {
            const IconComponent = slice.display.icon;
            return (
              <div key={index} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: pieColors[index % pieColors.length] }}
                  ></div>
                  <IconComponent className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">{slice.display.name}</span>
                </div>
                <div className="text-sm font-bold text-gray-900">{formatNumber(slice.percentage, 1)}%</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Sources</p>
          <p className="text-xl font-bold text-gray-900">{topSources.length}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Users</p>
          <p className="text-xl font-bold text-gray-900">
            {topSources.reduce((sum, source) => sum + (source.users || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Conversions</p>
          <p className="text-xl font-bold text-gray-900">
            {Math.round(topSources.reduce((sum, source) => sum + (source.conversions || 0), 0))}
          </p>
        </div>
      </div>
    </div>
  );
}
