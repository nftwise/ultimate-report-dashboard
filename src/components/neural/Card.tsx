import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
  style?: React.CSSProperties
}

export function Card({ children, className = '', hover = true, onClick, style }: CardProps) {
  return (
    <div
      className={`neural-card ${hover ? 'hover:transform hover:translate-y-[-4px]' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  change?: {
    value: number
    isPositive: boolean
    label?: string
  }
  icon?: React.ReactNode
  className?: string
  lastUpdated?: Date
  trend?: 'up' | 'down' | 'neutral'
}

export function StatCard({ label, value, change, icon, className = '', lastUpdated, trend }: StatCardProps) {
  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className={`stat-card group ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="stat-label">{label}</div>
        {icon && (
          <div className="opacity-60 group-hover:opacity-100 transition-opacity">
            {icon}
          </div>
        )}
      </div>

      <div className="stat-value mb-3">{value}</div>

      <div className="flex items-center justify-between">
        {change && (
          <div className={`stat-change ${change.isPositive ? 'positive' : 'negative'}`}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {change.isPositive ? (
                <path d="M7 17L17 7M17 7H9M17 7V15" />
              ) : (
                <path d="M7 7L17 17M17 17H9M17 17V9" />
              )}
            </svg>
            <span className="font-semibold">
              {change.isPositive ? '+' : ''}{change.value}%
            </span>
            {change.label && <span className="opacity-60 ml-1">{change.label}</span>}
          </div>
        )}

        {lastUpdated && (
          <div className="text-xs opacity-40 transition-opacity hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
            {getTimeAgo(lastUpdated)}
          </div>
        )}
      </div>
    </div>
  )
}
