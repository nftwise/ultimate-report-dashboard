import React from 'react'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button'
}: ButtonProps) {
  const baseClass = 'neural-btn'
  const variantClass = variant === 'primary' ? 'neural-btn-primary' : variant === 'outline' ? 'neural-btn-outline' : ''
  const sizeClass = size === 'sm' ? 'px-6 py-2 text-xs' : size === 'lg' ? 'px-10 py-5 text-base' : ''

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${variantClass} ${sizeClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  )
}
