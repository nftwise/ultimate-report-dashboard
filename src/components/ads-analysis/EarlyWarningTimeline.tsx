import React from 'react'

interface TimelineEvent {
  day: number
  metric: string
  value: number | string
  status: 'warning' | 'alert' | 'critical' | 'forecast'
  message: string
}

interface EarlyWarningTimelineProps {
  events: TimelineEvent[]
}

export function EarlyWarningTimeline({ events }: EarlyWarningTimelineProps) {
  const getStatusIcon = (status: string) => {
    const icons = {
      warning: '⚠️',
      alert: '🔔',
      critical: '🚨',
      forecast: '🔮'
    }
    return icons[status as keyof typeof icons] || '•'
  }

  const getStatusColor = (status: string) => {
    const colors = {
      warning: 'text-yellow-600 border-yellow-300 bg-yellow-50',
      alert: 'text-orange-600 border-orange-300 bg-orange-50',
      critical: 'text-red-600 border-red-300 bg-red-50',
      forecast: 'text-purple-600 border-purple-300 bg-purple-50'
    }
    return colors[status as keyof typeof colors] || 'text-gray-600'
  }

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
      {events.map((event, idx) => (
        <div key={idx} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="text-2xl">{getStatusIcon(event.status)}</div>
            {idx < events.length - 1 && (
              <div className="w-1 h-12 bg-gray-300 mt-2"></div>
            )}
          </div>
          <div className={`flex-1 p-3 rounded border ${getStatusColor(event.status)}`}>
            <div className="font-semibold text-sm">
              Day {event.day}: {event.metric.toUpperCase()}
            </div>
            <div className="text-xs opacity-80 mt-1">{event.value}</div>
            <div className="text-sm mt-2">{event.message}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
