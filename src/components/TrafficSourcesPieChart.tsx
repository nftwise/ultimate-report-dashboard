'use client';

import { useMemo } from 'react';
import { formatNumber } from '@/lib/format-utils';

interface TrafficSourcesPieChartProps {
  trafficSourcesData: any[];
}

export function TrafficSourcesPieChart({ trafficSourcesData }: TrafficSourcesPieChartProps) {
  const chartData = useMemo(() => {
    // Process data for pie chart - top 6 sources
    const topSources = trafficSourcesData.slice(0, 6);
    const totalSessions = topSources.reduce((sum, source) => sum + (source.sessions || 0), 0);

    const pieSlices = topSources.map((source) => {
      const sessions = source.sessions || 0;
      const percentage = totalSessions > 0 ? ((sessions / totalSessions) * 100) : 0;
      return {
        name: `${source.source} / ${source.medium}`,
        sessions,
        users: source.users || 0,
        percentage
      };
    });

    const pieColors = [
      'rgb(34, 197, 94)',   // green
      'rgb(59, 130, 246)',  // blue
      'rgb(249, 115, 22)',  // orange
      'rgb(168, 85, 247)',  // purple
      'rgb(236, 72, 153)',  // pink
      'rgb(20, 184, 166)',  // teal
    ];

    return { pieSlices, pieColors, totalSessions };
  }, [trafficSourcesData]);

  const { pieSlices, pieColors, totalSessions } = chartData;

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Pie Chart */}
        <div className="flex items-center justify-center">
          <div className="relative w-64 h-64">
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
              {/* Center circle for donut effect */}
              <circle cx="100" cy="100" r="50" fill="white" />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <div className="text-2xl font-bold text-gray-900">{totalSessions.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Sessions</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col justify-center space-y-2">
          {pieSlices.map((slice, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: pieColors[index % pieColors.length] }}
                ></div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{slice.name}</div>
                  <div className="text-xs text-gray-500">{slice.users.toLocaleString()} users</div>
                </div>
              </div>
              <div className="text-right ml-2 flex-shrink-0">
                <div className="text-sm font-bold text-gray-900">{slice.sessions.toLocaleString()}</div>
                <div className="text-xs text-gray-500">{formatNumber(slice.percentage, 1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
