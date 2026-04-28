'use client'

import React from 'react'
import { BarChart2, Search, Target, MapPin, Bot, Facebook } from 'lucide-react'

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: BarChart2 },
  { id: 'analytics', label: 'Analytics & SEO', icon: Search },
  { id: 'google-ads', label: 'Google Ads', icon: Target },
  { id: 'google-business', label: 'Google Business', icon: MapPin },
  { id: 'ai-geo', label: 'AI GEO', icon: Bot },
  { id: 'facebook', label: 'Facebook', icon: Facebook }
]

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 border-r" style={{ borderColor: 'var(--border-color)' }}>
      <nav className="sticky top-0 p-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                isActive
                  ? 'font-bold shadow-sm'
                  : 'font-medium hover:bg-black/[0.03]'
              }`}
              style={{
                backgroundColor: isActive ? 'rgba(107,154,111,0.12)' : 'transparent',
                color: isActive ? 'var(--sage)' : 'var(--text-secondary)'
              }}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
