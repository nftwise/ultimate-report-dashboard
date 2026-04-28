import React from 'react'

interface SegmentedBarProps {
  segments: {
    value: number
    color: 'coral' | 'slate' | 'sage'
    label: string
  }[]
  className?: string
}

export function SegmentedBar({ segments, className = '' }: SegmentedBarProps) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0)

  const colorMap = {
    coral: 'var(--coral)',
    slate: 'var(--slate)',
    sage: 'var(--sage)'
  }

  return (
    <div className={className}>
      <div className="segmented-bar">
        {segments.map((segment, index) => (
          <div
            key={index}
            className="bar-segment"
            style={{
              width: `${(segment.value / total) * 100}%`,
              backgroundColor: colorMap[segment.color]
            }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-6 mt-4 text-sm">
        {segments.map((segment, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colorMap[segment.color] }}
            />
            <span className="font-medium">{segment.label}</span>
            <span className="opacity-50">({segment.value})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  showPercentage?: boolean
}

export function ProgressBar({ value, max = 100, className = '', showPercentage = false }: ProgressBarProps) {
  const percentage = (value / max) * 100

  return (
    <div className={className}>
      {showPercentage && (
        <div className="flex justify-between text-sm mb-2">
          <span className="opacity-50">Progress</span>
          <span className="font-semibold">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

interface TrendChartProps {
  data: { label: string; value: number }[]
  height?: number
  color?: string
  showGrid?: boolean
  formatValue?: (value: number) => string
}

export function TrendChart({
  data,
  height = 280,
  color = 'var(--coral)',
  showGrid = false,
  formatValue = (v) => `$${(v).toLocaleString()}`
}: TrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 })

  if (data.length === 0) return null

  const max = Math.max(...data.map(d => d.value))
  const min = Math.min(...data.map(d => d.value))
  const range = max - min || 1

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = 100 - ((d.value - min) / range) * 100
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `0,100 ${points} 100,100`

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = (x / rect.width) * 100
    const index = Math.round((percentage / 100) * (data.length - 1))

    if (index >= 0 && index < data.length) {
      setHoveredIndex(index)
      setTooltipPos({ x: percentage, y: 15 })
    }
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
  }

  const hoveredData = hoveredIndex !== null ? data[hoveredIndex] : null

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          {/* Gradient Fill */}
          <defs>
            <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.15 }} />
              <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.02 }} />
            </linearGradient>
          </defs>

          {/* Area under curve */}
          <polygon points={areaPoints} fill="url(#trendGradient)" />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Overlay */}
          <rect
            width="100"
            height="100"
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: 'pointer' }}
          />

          {/* Hover Line & Circle */}
          {hoveredIndex !== null && (
            <>
              {/* Vertical Line */}
              <line
                x1={`${(hoveredIndex / (data.length - 1)) * 100}`}
                y1="0"
                x2={`${(hoveredIndex / (data.length - 1)) * 100}`}
                y2="100"
                stroke={color}
                strokeWidth="1"
                opacity="0.2"
                vectorEffect="non-scaling-stroke"
              />
              {/* Point Circle */}
              <circle
                cx={`${(hoveredIndex / (data.length - 1)) * 100}`}
                cy={`${100 - ((data[hoveredIndex].value - min) / range) * 100}`}
                r="2.5"
                fill={color}
                opacity="1"
              />
            </>
          )}
        </svg>

        {/* Tooltip */}
        {hoveredData && (
          <div
            className="absolute rounded-lg p-3 z-10 text-center"
            style={{
              left: `calc(${tooltipPos.x}% - 60px)`,
              top: `${tooltipPos.y}px`,
              minWidth: '120px',
              backgroundColor: 'rgba(44, 36, 25, 0.95)',
              backdropFilter: 'blur(8px)',
              borderRadius: '6px',
              pointerEvents: 'none'
            }}
          >
            <div className="text-xs mb-1" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              {hoveredData.label}
            </div>
            <div className="text-sm font-bold" style={{ color: color }}>
              {formatValue(hoveredData.value)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
}

export function Sparkline({
  data,
  width = 60,
  height = 24,
  color = 'var(--primary)'
}: SparklineProps) {
  if (data.length === 0) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface ComparisonBarProps {
  current: number
  previous: number
  label: string
  maxValue?: number
}

export function ComparisonBar({ current, previous, label, maxValue }: ComparisonBarProps) {
  const max = maxValue || Math.max(current, previous)
  const currentPercent = (current / max) * 100
  const previousPercent = (previous / max) * 100
  const change = ((current - previous) / previous) * 100

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={`text-xs font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
        </span>
      </div>
      <div className="space-y-1.5">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="opacity-60">Current</span>
            <span className="font-semibold">{current.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${currentPercent}%`, background: 'var(--primary)' }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="opacity-60">Previous</span>
            <span className="font-semibold opacity-60">{previous.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-300 rounded-full transition-all duration-500"
              style={{ width: `${previousPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}