'use client';

import { Button } from '@/components/ui/button';

interface TimeRangeSelectorProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  periods?: Array<{ value: string; label: string }>;
}

const DEFAULT_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7 Days' },
  { value: '30days', label: '30 Days' },
  { value: '90days', label: '90 Days' },
];

export function TimeRangeSelector({
  selectedPeriod,
  onPeriodChange,
  periods = DEFAULT_PERIODS,
}: TimeRangeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {periods.map((period) => (
        <Button
          key={period.value}
          variant={selectedPeriod === period.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPeriodChange(period.value)}
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
}