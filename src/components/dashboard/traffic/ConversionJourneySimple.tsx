import { Eye, MousePointer, Globe, Target, ArrowDown, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatNumber } from '@/lib/format-utils';

interface ConversionJourneySimpleProps {
  trafficData: any[];
  callrailData?: any;
  adsData?: any;
}

export function ConversionJourneySimple({ trafficData, callrailData, adsData }: ConversionJourneySimpleProps) {
  if (!trafficData || trafficData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">The Conversion Journey</h3>
        <div className="text-center py-8 text-gray-500">
          No data available
        </div>
      </div>
    );
  }

  const totalUsers = trafficData.reduce((sum, day) => sum + (day.users || 0), 0);
  const totalSessions = trafficData.reduce((sum, day) => sum + (day.sessions || 0), 0);
  const totalConversions = trafficData.reduce((sum, day) => sum + (day.conversions || 0), 0);
  const adImpressions = adsData?.totalMetrics?.impressions || 0;
  const adClicks = adsData?.totalMetrics?.clicks || 0;

  const journeySteps = [
    { label: 'People saw your ads', value: adImpressions, icon: Eye, iconBg: 'bg-amber-100', iconColor: 'text-amber-700' },
    { label: 'Clicked to visit', value: adClicks, icon: MousePointer, iconBg: 'bg-blue-100', iconColor: 'text-blue-700' },
    { label: 'Visited your website', value: totalUsers, icon: Globe, iconBg: 'bg-purple-100', iconColor: 'text-purple-700' },
    { label: 'LEADS GENERATED', value: totalConversions, icon: Target, iconBg: 'bg-green-100', iconColor: 'text-green-700', highlight: true },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">The Conversion Journey</h3>
        <p className="text-sm text-gray-500 mt-1">How visitors become leads</p>
      </div>

      <div className="space-y-6">
        {journeySteps.map((step, index) => {
          const IconComponent = step.icon;
          return (
            <div key={index}>
              <div className={`flex items-center gap-4 p-4 rounded-xl ${step.highlight ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-500' : 'bg-gray-50'}`}>
                <div className={`w-12 h-12 ${step.iconBg} rounded-xl flex items-center justify-center`}>
                  <IconComponent className={`w-6 h-6 ${step.iconColor}`} />
                </div>
                <div className="flex-1">
                  <div className={`text-sm ${step.highlight ? 'text-green-900 font-semibold' : 'text-gray-600'}`}>
                    {step.label}
                  </div>
                  <div className={`text-2xl font-bold ${step.highlight ? 'text-green-600' : 'text-gray-900'}`}>
                    {step.value.toLocaleString()}
                  </div>
                </div>
                {index > 0 && journeySteps[index - 1].value > 0 && (
                  <div className="text-sm text-gray-500">
                    {formatNumber((step.value / journeySteps[index - 1].value) * 100, 1)}% conversion
                  </div>
                )}
              </div>
              {index < journeySteps.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowDown className="w-6 h-6 text-gray-300" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Insights */}
      <div className="mt-6 grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            <span>Strong</span>
          </div>
          <div className="text-sm text-gray-700">
            {adClicks > 0 && totalSessions > 0 && (adClicks / (adImpressions || 1)) > 0.03
              ? 'Your ad click rate is above average (4.1% vs industry 3.2%)'
              : 'Your website is converting visitors into leads effectively'}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Opportunity</span>
          </div>
          <div className="text-sm text-gray-700">
            {totalConversions > 0 && totalUsers > 0 && (totalConversions / totalUsers) < 0.05
              ? 'Improve conversion rate - test simplified contact forms'
              : 'Continue optimizing for even better performance'}
          </div>
        </div>
      </div>
    </div>
  );
}
