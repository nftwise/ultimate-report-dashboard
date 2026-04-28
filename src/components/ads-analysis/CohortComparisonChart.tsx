import React from 'react'

interface CohortComparisonChartProps {
  metric: string
  clientValue: number
  clientPercentile: number
  cohortP5: number
  cohortP25: number
  cohortP50: number
  cohortP75: number
  cohortP95: number
  cohortName: string
}

export function CohortComparisonChart({
  metric,
  clientValue,
  clientPercentile,
  cohortP5,
  cohortP25,
  cohortP50,
  cohortP75,
  cohortP95,
  cohortName
}: CohortComparisonChartProps) {
  const min = Math.min(cohortP5, clientValue) * 0.95
  const max = Math.max(cohortP95, clientValue) * 1.05
  const range = max - min

  const getPercentX = (val: number) => ((val - min) / range) * 100

  return (
    <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
      <div className="mb-4">
        <h4 className="font-semibold text-sm mb-1">{metric} Benchmark</h4>
        <p className="text-xs opacity-60">{cohortName}</p>
      </div>

      <div className="mb-6">
        <div className="relative h-8 bg-white rounded border border-gray-200 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center">
            <div
              className="h-6 bg-blue-200 rounded transition-all"
              style={{
                left: `${getPercentX(cohortP25)}%`,
                right: `${100 - getPercentX(cohortP75)}%`
              }}
            ></div>
          </div>

          <div
            className="absolute top-1/2 -translate-y-1/2 w-1 h-full bg-blue-400"
            style={{ left: `${getPercentX(cohortP50)}%` }}
          ></div>

          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-lg transition-all"
            style={{ left: `calc(${getPercentX(clientValue)}% - 6px)` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 text-xs text-center mb-4">
        <div>
          <div className="opacity-60">P5</div>
          <div className="font-semibold">{cohortP5.toFixed(1)}</div>
        </div>
        <div>
          <div className="opacity-60">P25</div>
          <div className="font-semibold">{cohortP25.toFixed(1)}</div>
        </div>
        <div>
          <div className="opacity-60">P50</div>
          <div className="font-semibold text-blue-600">{cohortP50.toFixed(1)}</div>
        </div>
        <div>
          <div className="opacity-60">P75</div>
          <div className="font-semibold">{cohortP75.toFixed(1)}</div>
        </div>
        <div>
          <div className="opacity-60">P95</div>
          <div className="font-semibold">{cohortP95.toFixed(1)}</div>
        </div>
      </div>

      <div className="bg-white p-3 rounded border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Your Value</div>
          <div className="text-sm font-bold text-red-600">{clientValue.toFixed(1)}</div>
        </div>
        <div className="text-xs opacity-70">
          Percentile Rank: {clientPercentile}th ({clientPercentile > 50 ? 'above' : 'below'} average)
        </div>
      </div>
    </div>
  )
}
