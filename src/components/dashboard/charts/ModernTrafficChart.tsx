'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface TrafficData {
  date: string;
  sessions?: number;
  users?: number;
  leads?: number;
  conversions?: number;
}

interface ModernTrafficChartProps {
  data: TrafficData[];
}

export function ModernTrafficChart({ data }: ModernTrafficChartProps) {
  const [tooltip, setTooltip] = useState<{ show: boolean, x: number, y: number, value: number, date: string, users: number }>({
    show: false, x: 0, y: 0, value: 0, date: '', users: 0
  });

  if (!data || data.length === 0) {
    return (
      <div className="bg-gradient-to-br from-amber-50 via-white to-orange-50 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-amber-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Analytics Data</h3>
        <p className="text-gray-600">Connect your Google Analytics to see traffic insights</p>
      </div>
    );
  }

  const sessions = data.map(d => d.sessions || 0);
  const users = data.map(d => d.users || 0);
  const leads = data.map(d => d.leads || d.conversions || 0);

  const totalSessions = sessions.reduce((a, b) => a + b, 0);
  const totalUsers = users.reduce((a, b) => a + b, 0);
  const totalLeads = leads.reduce((a, b) => a + b, 0);

  const maxSessions = Math.max(...sessions);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Google Analytics Traffic</h2>
      </div>

      {/* Top KPIs */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-xs text-gray-500 font-medium mb-1">Users</div>
            <div className="text-2xl font-bold text-gray-900">{totalUsers.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">Unique visitors</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 font-medium mb-1">Sessions</div>
            <div className="text-2xl font-bold text-gray-900">{totalSessions.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">Total visits</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 font-medium mb-1">Conversions</div>
            <div className="text-2xl font-bold text-green-600">{totalLeads}</div>
            <div className="text-xs text-gray-400 mt-1">Leads generated</div>
          </div>
        </div>
      </div>

      {/* Line Chart */}
      <div className="px-6 pb-8 border-t border-gray-50">
        <div className="pt-6">
          <div className="relative ml-12">
            <div className="relative h-80">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="gaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#8B7355" stopOpacity="0.15"/>
                    <stop offset="100%" stopColor="#8B7355" stopOpacity="0.02"/>
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[20, 40, 60, 80].map(y => (
                  <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#f8f9fa" strokeWidth="0.5" />
                ))}

                {/* Area Fill */}
                <path
                  d={`M 0 90 ` +
                    sessions.map((value, i) => {
                      const x = (i / Math.max(sessions.length - 1, 1)) * 100;
                      const y = 90 - ((value / Math.max(maxSessions * 1.1, 1)) * 75);
                      return `L ${x} ${y}`;
                    }).join(' ') +
                    ` L 100 90 Z`}
                  fill="url(#gaGradient)"
                />

                {/* Line */}
                <path
                  fill="none"
                  stroke="#8B7355"
                  strokeWidth="0.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={(() => {
                    if (sessions.length === 0) return '';
                    let path = '';
                    sessions.forEach((value, i) => {
                      const x = (i / Math.max(sessions.length - 1, 1)) * 100;
                      const y = 90 - ((value / Math.max(maxSessions * 1.1, 1)) * 75);
                      if (i === 0) {
                        path += `M ${x} ${y}`;
                      } else {
                        path += ` L ${x} ${y}`;
                      }
                    });
                    return path;
                  })()}
                />
              </svg>

              {/* Y-axis Labels */}
              <div className="absolute -left-12 top-0 h-full flex flex-col justify-between text-sm text-gray-600 w-10 font-bold">
                {(() => {
                  const max = Math.ceil(maxSessions / 100) * 100;
                  return [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0].map((val, i) => (
                    <span key={i} className="text-right text-sm leading-none font-bold">
                      {val >= 1000 ? `${Math.round(val / 1000)}k` : Math.round(val)}
                    </span>
                  ));
                })()}
              </div>

              {/* Interactive Overlay */}
              <div className="absolute inset-0 flex">
                {data.map((d, i) => (
                  <div
                    key={i}
                    className="flex-1 group relative cursor-pointer"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        show: true,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 20,
                        value: d.sessions || 0,
                        users: d.users || 0,
                        date: d.date
                      });
                    }}
                    onMouseLeave={() => setTooltip(prev => ({ ...prev, show: false }))}
                  >
                    <div className="w-full h-full relative">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* X-axis Labels */}
            <div className="flex justify-between mt-4 text-xs text-gray-400">
              {data.length > 0 && (() => {
                let showEvery: number;
                let dateFormat: (date: string) => string;

                if (data.length <= 7) {
                  showEvery = 1;
                  dateFormat = (date: string) => {
                    const d = new Date(date);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  };
                } else if (data.length <= 30) {
                  showEvery = 7;
                  dateFormat = (date: string) => {
                    const d = new Date(date);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  };
                } else {
                  showEvery = Math.floor(data.length / 6);
                  dateFormat = (date: string) => {
                    const d = new Date(date);
                    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                  };
                }

                return data.filter((_, i) => i % showEvery === 0 || i === data.length - 1)
                  .filter(d => d.date && d.date !== '' && !isNaN(new Date(d.date).getTime()))
                  .map((d, i) => (
                    <span key={i} className="font-bold text-xs text-gray-600">
                      {dateFormat(d.date)}
                    </span>
                  ));
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip.show && (
        <div
          className="fixed z-50 bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200 text-sm pointer-events-none"
          style={{
            left: tooltip.x - 70,
            top: tooltip.y - 65,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-xs text-gray-500 mb-1">
            {tooltip.date && !isNaN(new Date(tooltip.date).getTime()) ?
              new Date(tooltip.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                weekday: 'short'
              }) :
              formatDate(tooltip.date)
            }
          </div>
          <div className="font-semibold text-gray-900">
            Sessions: {tooltip.value.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
