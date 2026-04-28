import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'gold' | 'sage' | 'coral' | 'slate'
  className?: string
}

export function Badge({ children, variant = 'gold', className = '' }: BadgeProps) {
  const variantClass = `badge-${variant}`

  return (
    <span className={`neural-badge ${variantClass} ${className}`}>
      {children}
    </span>
  )
}
