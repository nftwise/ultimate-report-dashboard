'use client';

import { Smartphone, Monitor } from 'lucide-react';

interface DeviceBreakdownProps {
  mobile: number;
  desktop: number;
}

export function DeviceBreakdown({ mobile, desktop }: DeviceBreakdownProps) {
  const total = mobile + desktop;
  const mobilePercent = total > 0 ? Math.round((mobile / total) * 100) : 0;
  const desktopPercent = total > 0 ? Math.round((desktop / total) * 100) : 0;

  if (total === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Device Breakdown</h4>
        <p className="text-sm text-gray-500">No device data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Device Breakdown</h4>

      <div className="space-y-3">
        {/* Mobile */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Mobile</span>
              <span className="text-sm font-bold text-gray-900">{mobilePercent}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${mobilePercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{mobile.toLocaleString()} sessions</span>
          </div>
        </div>

        {/* Desktop */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <Monitor className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Desktop</span>
              <span className="text-sm font-bold text-gray-900">{desktopPercent}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${desktopPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{desktop.toLocaleString()} sessions</span>
          </div>
        </div>
      </div>
    </div>
  );
}
