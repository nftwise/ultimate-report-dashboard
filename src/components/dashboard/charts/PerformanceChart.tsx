interface PerformanceChartProps {
  clicksData: number[];
  impressionsData: number[];
  height?: number;
}

export function PerformanceChart({
  clicksData,
  impressionsData,
  height = 80
}: PerformanceChartProps) {
  if (!clicksData || clicksData.length === 0) return null;

  const maxClicks = Math.max(...clicksData, 1);
  const maxImpressions = Math.max(...impressionsData, 1);

  const getPath = (data: number[], max: number) => {
    return data.map((value, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = height - ((value / max) * (height - 10));
      return `${x},${y}`;
    }).join(' ');
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-4 justify-end mb-2 text-xs">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> Clicks</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400"></span> Impr</span>
      </div>
      <svg width="100%" height={height} className="overflow-visible">
        {/* Grid lines */}
        <line x1="0" y1={height/2} x2="100%" y2={height/2} stroke="#f0f0f0" strokeWidth="1" />

        {/* Impressions line (teal) */}
        <polyline
          points={getPath(impressionsData, maxImpressions)}
          fill="none"
          stroke="#5eead4"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Clicks line (red/coral) */}
        <polyline
          points={getPath(clicksData, maxClicks)}
          fill="none"
          stroke="#f87171"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
