type PositionType = 'top3' | 'top10' | 'top50' | 'all';

interface PositionFilterProps {
  activePosition: PositionType;
  onPositionChange: (position: PositionType) => void;
}

export function PositionFilter({ activePosition, onPositionChange }: PositionFilterProps) {
  const positions = [
    { id: 'top3' as const, label: 'Top 3' },
    { id: 'top10' as const, label: 'Top 10' },
    { id: 'top50' as const, label: 'Top 50' },
    { id: 'all' as const, label: 'All' },
  ];

  return (
    <div className="flex items-center gap-2">
      {positions.map(pos => (
        <button
          key={pos.id}
          onClick={() => onPositionChange(pos.id)}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
            activePosition === pos.id
              ? 'bg-amber-700 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {pos.label}
        </button>
      ))}
    </div>
  );
}
