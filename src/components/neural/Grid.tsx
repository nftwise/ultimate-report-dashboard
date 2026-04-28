import React from 'react'

interface GridProps {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  gap?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Grid({ children, columns = 4, gap = 'md', className = '' }: GridProps) {
  const columnClass = `neural-grid-${columns}`
  const gapClass = gap === 'sm' ? 'gap-4' : gap === 'lg' ? 'gap-12' : ''

  return (
    <div className={`neural-grid ${columnClass} ${gapClass} ${className}`}>
      {children}
    </div>
  )
}

interface ContainerProps {
  children: React.ReactNode
  className?: string
}

export function Container({ children, className = '' }: ContainerProps) {
  return (
    <div className={`neural-container ${className}`}>
      {children}
    </div>
  )
}
