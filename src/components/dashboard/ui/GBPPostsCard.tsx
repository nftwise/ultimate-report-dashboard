'use client';

import { FileText, Eye, MousePointer, Clock, Calendar } from 'lucide-react';
import { formatNumber } from '@/lib/format-utils';

interface GBPPostsCardProps {
  postsCount: number;
  postsViews: number;
  postsClicks: number;
  daysSincePost: number | null;
}

export function GBPPostsCard({
  postsCount,
  postsViews,
  postsClicks,
  daysSincePost
}: GBPPostsCardProps) {
  const hasData = postsCount > 0 || postsViews > 0;

  // Determine status colors based on post recency
  const postStatus = daysSincePost === null ? 'text-gray-500' : daysSincePost <= 7 ? 'text-green-600' : daysSincePost <= 30 ? 'text-amber-600' : 'text-red-600';
  const postStatusBg = daysSincePost === null ? 'bg-gray-100' : daysSincePost <= 7 ? 'bg-green-100' : daysSincePost <= 30 ? 'bg-amber-100' : 'bg-red-100';
  const postStatusText = daysSincePost === null ? 'No data' : daysSincePost <= 7 ? 'Active' : daysSincePost <= 30 ? 'Needs Post' : 'Inactive';

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-blue-500" />
          <h4 className="text-sm font-semibold text-gray-700">GBP Posts</h4>
        </div>
        <p className="text-sm text-gray-500">No posts data available</p>
      </div>
    );
  }

  // Calculate engagement rate
  const engagementRate = postsViews > 0 ? ((postsClicks / postsViews) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" />
          <h4 className="text-sm font-semibold text-gray-700">GBP Posts</h4>
        </div>
        <span className={`px-2 py-0.5 ${postStatusBg} ${postStatus} text-xs font-medium rounded-full`}>
          {postStatusText}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Total Posts */}
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="w-8 h-8 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-1">
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-800">{postsCount}</div>
          <div className="text-xs text-blue-600">Posts</div>
        </div>

        {/* Post Views */}
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <div className="w-8 h-8 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-1">
            <Eye className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-purple-800">{formatNumber(postsViews)}</div>
          <div className="text-xs text-purple-600">Views</div>
        </div>

        {/* Post Clicks */}
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="w-8 h-8 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-1">
            <MousePointer className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-xl font-bold text-green-800">{formatNumber(postsClicks)}</div>
          <div className="text-xs text-green-600">Clicks</div>
        </div>
      </div>

      {/* Last Post & Engagement */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">Last post</span>
        </div>
        <span className={`text-sm font-medium ${postStatus}`}>
          {daysSincePost === null ? 'No data' : daysSincePost === 0 ? 'Today' : daysSincePost === 1 ? 'Yesterday' : `${daysSincePost} days ago`}
        </span>
      </div>

      {/* Engagement Rate */}
      {postsViews > 0 && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-gray-500">Engagement Rate</span>
          <span className="font-medium text-gray-700">{engagementRate}%</span>
        </div>
      )}
    </div>
  );
}
