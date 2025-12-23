interface RankingBadgeProps {
  range: string;
  count: number;
  change?: number;
  color: string;
}

export function RankingBadge({ range, count, change, color }: RankingBadgeProps) {
  return (
    <div className="text-center">
      <div className={`${color} text-white text-xs font-bold rounded-full px-3 py-1 mb-1`}>
        {range}
      </div>
      <div className="text-lg font-bold text-gray-900">{count.toLocaleString()}</div>
      {change !== undefined && (
        <div className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {change >= 0 ? '+' : ''}{change}
        </div>
      )}
    </div>
  );
}
