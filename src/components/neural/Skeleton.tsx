import React from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave'
}

export function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse'
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200 rounded'
  const animationClasses = animation === 'pulse' ? 'animate-pulse' : 'skeleton-wave'

  const variantClasses = {
    text: 'h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses} ${className}`}
      style={style}
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <Skeleton width={100} height={12} />
        <Skeleton variant="circular" width={20} height={20} />
      </div>
      <Skeleton width={120} height={48} className="mb-3" />
      <div className="flex items-center justify-between">
        <Skeleton width={80} height={24} />
        <Skeleton width={60} height={12} />
      </div>
    </div>
  )
}

export function TableRowSkeleton({ columns = 9 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="metric-cell">
          <Skeleton width={i === 0 ? 180 : 60} height={16} />
          {i === 0 && <Skeleton width={100} height={12} className="mt-1" />}
        </td>
      ))}
    </tr>
  )
}

export function MetricCardSkeleton() {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <Skeleton width={120} height={12} />
        <Skeleton variant="circular" width={32} height={32} />
      </div>
      <div className="metric-list">
        {[1, 2, 3].map((i) => (
          <div key={i} className="metric-item">
            <div className="metric-item-content">
              <Skeleton width={140} height={14} className="mb-2" />
              <Skeleton width={80} height={12} />
            </div>
            <Skeleton width={50} height={16} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="neural-card">
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1">
          <Skeleton width={180} height={20} className="mb-2" />
          <Skeleton width={100} height={14} />
        </div>
        <Skeleton variant="rectangular" width={80} height={28} />
      </div>

      <div className="flex gap-2 mb-6">
        <Skeleton variant="rectangular" width={60} height={24} />
        <Skeleton variant="rectangular" width={70} height={24} />
        <Skeleton variant="rectangular" width={50} height={24} />
      </div>

      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between">
            <Skeleton width={100} height={14} />
            <Skeleton width={60} height={18} />
          </div>
        ))}
      </div>
    </div>
  )
}
