import React from 'react'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div className={`border-b ${className}`} style={{ borderColor: 'var(--border)' }}>
      <div className="flex gap-1 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`
                px-6 py-4 text-sm font-semibold whitespace-nowrap
                transition-all duration-200 border-b-2 flex items-center gap-2
                ${isActive ? '' : 'opacity-50 hover:opacity-75'}
              `}
              style={{
                color: 'var(--chocolate)',
                borderColor: isActive ? 'var(--chocolate)' : 'transparent'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Hide scrollbar for tab overflow
const scrollbarStyles = `
<style>
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
`
