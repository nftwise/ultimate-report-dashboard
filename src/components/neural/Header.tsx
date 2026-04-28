'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LogOut, User, Calendar } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

interface HeaderProps {
  user: {
    email: string
    role: string
    companyName?: string
  }
  showDatePicker?: boolean
  startDate?: Date
  endDate?: Date
  onDateChange?: (dates: [Date | null, Date | null]) => void
  onBackClick?: () => void
}

export function Header({
  user,
  showDatePicker = false,
  startDate,
  endDate,
  onDateChange,
  onBackClick
}: HeaderProps) {
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = React.useState(false)

  return (
    <header className="bg-white/90 backdrop-blur-sm border-b" style={{ borderColor: 'var(--border-color)' }}>
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Back */}
          <div className="flex items-center gap-6">
            {onBackClick && (
              <button
                onClick={onBackClick}
                className="text-sm font-medium hover:opacity-70 transition-opacity"
                style={{ color: 'var(--text-primary)' }}
              >
                ← Back
              </button>
            )}
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Analytics
            </h1>
          </div>

          {/* Date Picker with Presets */}
          {showDatePicker && onDateChange && (
            <div className="hidden md:flex items-center gap-3">
              <Calendar className="w-5 h-5" style={{ color: 'var(--text-secondary)', opacity: 0.7 }} />

              {/* Quick Date Presets */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const end = new Date()
                    const start = new Date()
                    start.setDate(end.getDate() - 30)
                    onDateChange([start, end])
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  30 Days
                </button>
                <button
                  onClick={() => {
                    const end = new Date()
                    const start = new Date()
                    start.setDate(end.getDate() - 90)
                    onDateChange([start, end])
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  90 Days
                </button>
                <button
                  onClick={() => {
                    const end = new Date()
                    const start = new Date()
                    start.setMonth(end.getMonth() - 1, 1)
                    end.setDate(0)
                    onDateChange([start, end])
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Last Month
                </button>
              </div>

              <DatePicker
                selected={startDate}
                onChange={onDateChange}
                startDate={startDate}
                endDate={endDate}
                selectsRange
                dateFormat="MMMM d, yyyy"
                className="neural-btn neural-btn-outline text-sm font-medium px-8 min-w-[360px]"
                placeholderText="Select date range"
              />
            </div>
          )}

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 hover:opacity-70 transition-opacity"
            >
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {user.companyName || user.email}
                </div>
                <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                  {user.role}
                </div>
              </div>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <User className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
              </div>
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div
                className="absolute right-0 mt-3 w-64 neural-card py-2 z-50"
                style={{ boxShadow: '0 4px 20px var(--shadow)' }}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {user.email}
                  </div>
                  <div className="text-xs mt-1 opacity-50" style={{ color: 'var(--text-secondary)' }}>
                    {user.companyName}
                  </div>
                </div>

                <button
                  onClick={() => {
                    signOut({ callbackUrl: '/login' })
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-medium flex items-center gap-3 hover:bg-black/5 transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Date Picker */}
        {showDatePicker && onDateChange && (
          <div className="md:hidden pb-4 flex items-center gap-3">
            <Calendar className="w-5 h-5" style={{ color: 'var(--text-secondary)', opacity: 0.7 }} />
            <DatePicker
              selected={startDate}
              onChange={onDateChange}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              dateFormat="MMMM d, yyyy"
              className="neural-btn neural-btn-outline text-sm font-medium px-4 w-full"
              placeholderText="Select date range"
            />
          </div>
        )}
      </div>
    </header>
  )
}
