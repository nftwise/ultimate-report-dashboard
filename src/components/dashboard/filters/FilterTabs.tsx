type FilterType = 'all' | 'growing' | 'decaying';

interface FilterTabsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export function FilterTabs({ activeFilter, onFilterChange }: FilterTabsProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onFilterChange('all')}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
          activeFilter === 'all'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        All
      </button>
      <button
        onClick={() => onFilterChange('growing')}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
          activeFilter === 'growing'
            ? 'bg-green-500 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Growing
      </button>
      <button
        onClick={() => onFilterChange('decaying')}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
          activeFilter === 'decaying'
            ? 'bg-red-500 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Decaying
      </button>
    </div>
  );
}
