import React from 'react';
import { formatNumber } from '@/lib/format-utils';

interface SummaryCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string | number;
}

export function SummaryCard({ icon, iconBg, label, value }: SummaryCardProps) {
  // Format number if value is a number
  const displayValue = typeof value === 'number' ? formatNumber(value) : value;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{displayValue}</p>
        </div>
      </div>
    </div>
  );
}
