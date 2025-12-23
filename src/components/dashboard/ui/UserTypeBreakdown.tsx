'use client';

import { UserPlus, UserCheck } from 'lucide-react';

interface UserTypeBreakdownProps {
  newUsers: number;
  returningUsers: number;
}

export function UserTypeBreakdown({ newUsers, returningUsers }: UserTypeBreakdownProps) {
  const total = newUsers + returningUsers;
  const newPercent = total > 0 ? Math.round((newUsers / total) * 100) : 0;
  const returningPercent = total > 0 ? Math.round((returningUsers / total) * 100) : 0;

  if (total === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">User Type</h4>
        <p className="text-sm text-gray-500">No user data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">User Type</h4>

      <div className="space-y-3">
        {/* New Users */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <UserPlus className="w-4 h-4 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">New Users</span>
              <span className="text-sm font-bold text-gray-900">{newPercent}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${newPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{newUsers.toLocaleString()} users</span>
          </div>
        </div>

        {/* Returning Users */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Returning</span>
              <span className="text-sm font-bold text-gray-900">{returningPercent}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${returningPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{returningUsers.toLocaleString()} users</span>
          </div>
        </div>
      </div>
    </div>
  );
}
