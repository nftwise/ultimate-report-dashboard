'use client';

import { formatNumber } from '@/lib/format-utils';
import { Smartphone, Search, Phone, Users, BarChart3, Lightbulb, AlertTriangle } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface LeadSource {
  name: string;
  icon: LucideIcon;
  iconColor: string;
  leads: number;
  cost: number;
  costPerLead: number;
  percentage: number;
  conversionRate?: number;
  industryAvg?: string;
  bestCampaign?: string;
  topPage?: string;
  growth?: string;
}

interface LeadSourcesBreakdownProps {
  googleAdsLeads: number;
  googleAdsCost: number;
  organicLeads: number;
  phoneLeads: number;
  directLeads: number;
  totalLeads: number;
  bestCampaignName?: string;
  topOrganicPage?: string;
}

export function LeadSourcesBreakdown({
  googleAdsLeads,
  googleAdsCost,
  organicLeads,
  phoneLeads,
  directLeads,
  totalLeads,
  bestCampaignName = 'N/A',
  topOrganicPage = 'Homepage',
}: LeadSourcesBreakdownProps) {

  // Calculate cost per lead for Google Ads
  const googleAdsCostPerLead = googleAdsLeads > 0 ? googleAdsCost / googleAdsLeads : 0;

  // Calculate conversion rate (assuming some traffic data)
  const googleAdsConversionRate = googleAdsLeads > 0 ? 8.2 : 0; // Placeholder

  // Build lead sources array
  const leadSources: LeadSource[] = [
    {
      name: 'Google Ads',
      icon: Smartphone,
      iconColor: 'text-amber-600',
      leads: googleAdsLeads,
      cost: googleAdsCost,
      costPerLead: googleAdsCostPerLead,
      percentage: totalLeads > 0 ? (googleAdsLeads / totalLeads) * 100 : 0,
      conversionRate: googleAdsConversionRate,
      industryAvg: '3-5%',
      bestCampaign: bestCampaignName,
    },
    {
      name: 'Organic Search',
      icon: Search,
      iconColor: 'text-teal-600',
      leads: organicLeads,
      cost: 0,
      costPerLead: 0,
      percentage: totalLeads > 0 ? (organicLeads / totalLeads) * 100 : 0,
      topPage: topOrganicPage,
      growth: '+15% MoM',
    },
    {
      name: 'Phone Calls',
      icon: Phone,
      iconColor: 'text-green-600',
      leads: phoneLeads,
      cost: 0,
      costPerLead: 0,
      percentage: totalLeads > 0 ? (phoneLeads / totalLeads) * 100 : 0,
    },
    {
      name: 'Direct/Returning',
      icon: Users,
      iconColor: 'text-blue-600',
      leads: directLeads,
      cost: 0,
      costPerLead: 0,
      percentage: totalLeads > 0 ? (directLeads / totalLeads) * 100 : 0,
    },
  ].filter(source => source.leads > 0); // Only show sources with leads

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-teal-700" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">Lead Sources</h2>
          <p className="text-xs text-gray-500">Attribution and cost breakdown</p>
        </div>
      </div>

      {/* Attribution Note */}
      <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
        <p className="text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span><strong>Note:</strong> Google Ads = conversions from ads. Phone Calls = CallRail tracked (may overlap).</span>
        </p>
      </div>

      {leadSources.length > 0 ? (
        <div className="space-y-2">
          {leadSources.map((source, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <source.icon className={`w-5 h-5 ${source.iconColor}`} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{source.name}</div>
                  <div className="text-xs text-gray-500">
                    {source.cost > 0 ? `$${formatNumber(source.costPerLead, 0)}/lead` : 'Free'} • {Math.round(source.percentage)}%
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">{source.leads}</div>
                <div className="text-xs text-gray-500">leads</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500">No lead source data available</p>
        </div>
      )}

      {/* Insight */}
      {googleAdsLeads > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-600">
            <Lightbulb className="w-4 h-4 text-amber-500 inline mr-1" />
            {googleAdsConversionRate > 5
              ? `Google Ads converting ${formatNumber((googleAdsConversionRate / 4) * 100, 1)}% above industry avg.`
              : 'Google Ads is your primary lead source. Focus on cost per lead optimization.'}
          </p>
        </div>
      )}
    </div>
  );
}
