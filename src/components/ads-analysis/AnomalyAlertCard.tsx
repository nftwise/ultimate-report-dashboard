import React from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, TrendingDown, ZapOff } from 'lucide-react'
import { Card } from '@/components/neural/Card'

interface AnomalyAlertCardProps {
  campaign_id: string
  campaign_name: string
  metric: string
  current_value: number
  expected_value: number
  z_score: number
  confidence: number
  detected_at: string
  interpretation: string
  onDismiss?: () => void
}

export function AnomalyAlertCard({
  campaign_id,
  campaign_name,
  metric,
  current_value,
  expected_value,
  z_score,
  confidence,
  detected_at,
  interpretation,
  onDismiss
}: AnomalyAlertCardProps) {
  const deviation = ((current_value - expected_value) / expected_value) * 100
  const getSeverity = (conf: number): 'critical' | 'high' | 'medium' | 'low' => {
    if (conf > 80) return 'critical'
    if (conf > 60) return 'high'
    if (conf > 40) return 'medium'
    return 'low'
  }
  
  const severity = getSeverity(confidence)
  const severityColors = {
    critical: 'border-red-500 bg-red-50',
    high: 'border-orange-500 bg-orange-50',
    medium: 'border-yellow-500 bg-yellow-50',
    low: 'border-blue-500 bg-blue-50'
  }
  
  const severityBadgeColors = {
    critical: 'bg-red-200 text-red-800',
    high: 'bg-orange-200 text-orange-800',
    medium: 'bg-yellow-200 text-yellow-800',
    low: 'bg-blue-200 text-blue-800'
  }
  
  const getIcon = () => {
    if (severity === 'critical') return <AlertTriangle className="w-5 h-5 text-red-600" />
    if (severity === 'high') return <AlertCircle className="w-5 h-5 text-orange-600" />
    return <TrendingDown className="w-5 h-5 text-blue-600" />
  }

  return (
    <Card className={`border-l-4 ${severityColors[severity]} mb-4`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          {getIcon()}
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1">{campaign_name}</h4>
            <p className="text-xs opacity-60">{metric.toUpperCase()} anomaly detected</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-semibold ${severityBadgeColors[severity]}`}>
          {Math.round(confidence)}% confidence
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div>
          <div className="text-xs opacity-60 mb-1">Current</div>
          <div className="font-bold text-lg">{current_value.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs opacity-60 mb-1">Expected</div>
          <div className="font-bold text-lg">{expected_value.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs opacity-60 mb-1">Deviation</div>
          <div className={`font-bold text-lg ${deviation > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="bg-white rounded p-3 mb-4 text-sm border border-gray-100">
        <p className="opacity-70">{interpretation}</p>
      </div>

      <div className="flex gap-2 justify-end">
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="px-3 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100 transition"
          >
            Dismiss
          </button>
        )}
        <button className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition">
          Investigate
        </button>
      </div>
    </Card>
  )
}
