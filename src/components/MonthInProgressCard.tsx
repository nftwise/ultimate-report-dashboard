'use client';

import { formatNumber } from '@/lib/format-utils';
import { Clock, Calendar, Lightbulb } from 'lucide-react';

interface MonthInProgressCardProps {
  currentMonth: string;
  currentDay: number;
  currentPeriodLeads: number;
  currentPeriodSpend: number;
  currentPeriodCostPerLead: number;
  lastMonthSamePeriodLeads: number;
  lastMonthSamePeriodSpend: number;
  lastMonthSamePeriodCostPerLead: number;
  lastMonthName: string;
}

export function MonthInProgressCard({
  currentMonth,
  currentDay,
  currentPeriodLeads,
  currentPeriodSpend,
  currentPeriodCostPerLead,
  lastMonthSamePeriodLeads,
  lastMonthSamePeriodSpend,
  lastMonthSamePeriodCostPerLead,
  lastMonthName,
}: MonthInProgressCardProps) {

  // Calculate changes
  const leadsChange = lastMonthSamePeriodLeads > 0
    ? ((currentPeriodLeads - lastMonthSamePeriodLeads) / lastMonthSamePeriodLeads) * 100
    : 0;

  const spendChange = lastMonthSamePeriodSpend > 0
    ? ((currentPeriodSpend - lastMonthSamePeriodSpend) / lastMonthSamePeriodSpend) * 100
    : 0;

  const costPerLeadChange = lastMonthSamePeriodCostPerLead > 0
    ? ((currentPeriodCostPerLead - lastMonthSamePeriodCostPerLead) / lastMonthSamePeriodCostPerLead) * 100
    : 0;

  // Determine insight
  const getInsight = () => {
    if (Math.abs(leadsChange) < 10 && Math.abs(costPerLeadChange) < 10) {
      return "On track - performing consistently with last month's pace.";
    } else if (leadsChange > 10) {
      return `Ahead of pace! You're generating ${Math.round(leadsChange)}% more leads than this time last month.`;
    } else if (leadsChange < -10 && costPerLeadChange < 20) {
      return `Slightly behind ${lastMonthName}'s pace, but cost per lead is within normal range. Let's push harder in the second half of the month.`;
    } else if (costPerLeadChange < -10) {
      return `Great efficiency! Your cost per lead is down ${Math.round(Math.abs(costPerLeadChange))}% compared to last month.`;
    } else {
      return "Monitoring performance - we're adjusting campaigns to optimize results.";
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <Clock className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">{currentMonth} In Progress</h2>
          <p className="text-xs text-gray-500">Day {currentDay} - comparing to same period last month</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Last Month Same Period */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {lastMonthName} (Days 1-{currentDay})
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-gray-500">Leads</p>
              <p className="text-xl font-bold text-gray-900">{lastMonthSamePeriodLeads}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Spend</p>
              <p className="text-xl font-bold text-gray-900">${lastMonthSamePeriodSpend.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">CPL</p>
              <p className="text-xl font-bold text-gray-900">${formatNumber(lastMonthSamePeriodCostPerLead, 0)}</p>
            </div>
          </div>
        </div>

        {/* Current Month Same Period */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="text-xs font-medium text-blue-700 mb-3 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {currentMonth} (Days 1-{currentDay})
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-gray-500">Leads</p>
              <p className="text-xl font-bold text-gray-900 flex items-center gap-1">
                {currentPeriodLeads}
                {leadsChange !== 0 && (
                  <span className={`text-xs ${leadsChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {leadsChange > 0 ? '+' : ''}{Math.round(leadsChange)}%
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Spend</p>
              <p className="text-xl font-bold text-gray-900 flex items-center gap-1">
                ${currentPeriodSpend.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">CPL</p>
              <p className="text-xl font-bold text-gray-900 flex items-center gap-1">
                ${formatNumber(currentPeriodCostPerLead, 0)}
                {costPerLeadChange !== 0 && (
                  <span className={`text-xs ${costPerLeadChange < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {costPerLeadChange > 0 ? '+' : ''}{Math.round(costPerLeadChange)}%
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-sm text-gray-600">
          <Lightbulb className="w-4 h-4 text-amber-500 inline mr-1" />
          {getInsight()}
        </p>
      </div>
    </div>
  );
}
