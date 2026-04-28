import React from 'react'

interface LoadingProps {
  text?: string
  fullScreen?: boolean
}

export function Loading({ text = 'Loading...', fullScreen = true }: LoadingProps) {
  if (fullScreen) {
    return (
      <div className="neural-loading">
        <div className="text-center">
          <div className="neural-spinner mb-4" />
          <p className="text-lg font-medium" style={{ color: 'var(--chocolate)', opacity: 0.6 }}>
            {text}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="neural-spinner mb-4" />
        <p className="text-sm opacity-60">{text}</p>
      </div>
    </div>
  )
}
