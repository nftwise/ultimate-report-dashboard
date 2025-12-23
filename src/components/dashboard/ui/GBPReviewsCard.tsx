'use client';

import { Star, MessageCircle, Clock, TrendingUp } from 'lucide-react';

interface GBPReviewsCardProps {
  totalReviews: number;
  averageRating: number;
  newReviews: number;
  daysSinceReview: number | null;
}

export function GBPReviewsCard({
  totalReviews,
  averageRating,
  newReviews,
  daysSinceReview
}: GBPReviewsCardProps) {
  const hasData = totalReviews > 0 || averageRating > 0;

  // Determine status colors based on metrics
  const ratingColor = averageRating >= 4.5 ? 'text-green-600' : averageRating >= 4.0 ? 'text-amber-600' : 'text-red-600';
  const ratingBg = averageRating >= 4.5 ? 'bg-green-100' : averageRating >= 4.0 ? 'bg-amber-100' : 'bg-red-100';
  const reviewsStatus = daysSinceReview === null ? 'text-gray-500' : daysSinceReview <= 7 ? 'text-green-600' : daysSinceReview <= 30 ? 'text-amber-600' : 'text-red-600';

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-amber-500" />
          <h4 className="text-sm font-semibold text-gray-700">GBP Reviews</h4>
        </div>
        <p className="text-sm text-gray-500">No reviews data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          <h4 className="text-sm font-semibold text-gray-700">GBP Reviews</h4>
        </div>
        {newReviews > 0 && (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            +{newReviews} new
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Rating */}
        <div className={`${ratingBg} rounded-lg p-3 text-center`}>
          <div className="flex items-center justify-center gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-3 h-3 ${star <= Math.round(averageRating) ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`}
              />
            ))}
          </div>
          <div className={`text-2xl font-bold ${ratingColor}`}>{averageRating.toFixed(1)}</div>
          <div className="text-xs text-gray-600">Rating</div>
        </div>

        {/* Total Reviews */}
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="w-8 h-8 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-1">
            <MessageCircle className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalReviews}</div>
          <div className="text-xs text-gray-600">Total Reviews</div>
        </div>
      </div>

      {/* Last Review */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">Last review</span>
        </div>
        <span className={`text-sm font-medium ${reviewsStatus}`}>
          {daysSinceReview === null ? 'No data' : daysSinceReview === 0 ? 'Today' : daysSinceReview === 1 ? 'Yesterday' : `${daysSinceReview} days ago`}
        </span>
      </div>
    </div>
  );
}
