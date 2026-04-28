import React, { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, TrendingDown, Phone, Eye, MousePointerClick, Zap } from 'lucide-react'
import { Card } from '@/components/neural/Card'
import { Badge } from '@/components/neural/Badge'
import { RootCauseAnalysisPanel } from './RootCauseAnalysisPanel'

interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  metric: string
  currentValue: number | string
  expectedValue?: number | string
  change?: number
  recommendation: string
  icon: React.ReactNode
}

interface LocalServiceAlertPanelProps {
  clientId: string
}

export function LocalServiceAlertPanel({ clientId }: LocalServiceAlertPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null)
  const [showRootCauseAnalysis, setShowRootCauseAnalysis] = useState(false)

  useEffect(() => {
    if (clientId) {
      fetchAlerts()
    }
  }, [clientId])

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/ads-analysis/local-service-alerts?clientId=${clientId}`)
      if (!res.ok) throw new Error('Failed to fetch alerts')
      const data = await res.json()
      setAlerts(data.alerts || [])
    } catch (err) {
      console.error('Failed to fetch alerts:', err)
      setError(err instanceof Error ? err.message : 'Error fetching alerts')
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const warningCount = alerts.filter(a => a.severity === 'warning').length
  const healthScore = Math.max(0, 100 - criticalCount * 25 - warningCount * 10)

  if (loading) {
    return (
      <Card className="p-6 mb-8 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex items-center justify-center gap-3">
          <div className="animate-spin inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <p className="text-sm opacity-60">Analyzing campaign health...</p>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 mb-8 bg-red-50 border-l-4 border-red-500">
        <p className="text-sm text-red-600">Error loading alerts: {error}</p>
      </Card>
    )
  }

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-l-4 border-red-500'
      case 'warning':
        return 'bg-yellow-50 border-l-4 border-yellow-500'
      default:
        return 'bg-blue-50 border-l-4 border-blue-500'
    }
  }

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />
      default:
        return <CheckCircle className="w-5 h-5 text-blue-600" />
    }
  }

  return (
    <>
      {/* ALERT SUMMARY HEADER */}
      <div className="mb-8">
        <div className="grid grid-cols-4 gap-3 mb-4">
          {/* Health Score */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
            <div className="text-xs opacity-60 mb-2">Health Score</div>
            <div className="flex items-end gap-2">
              <div className="text-3xl font-black" style={{ color: healthScore > 70 ? 'var(--sage)' : healthScore > 40 ? 'var(--accent)' : 'var(--coral)' }}>
                {Math.round(healthScore)}
              </div>
              <div className="text-xs opacity-60 mb-1">/100</div>
            </div>
          </div>

          {/* Critical Alerts */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-red-50 to-red-100 border border-red-200">
            <div className="text-xs opacity-60 mb-2">🔴 Critical</div>
            <div className="text-3xl font-black text-red-600">{criticalCount}</div>
            <div className="text-xs opacity-60">Need immediate action</div>
          </div>

          {/* Warnings */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200">
            <div className="text-xs opacity-60 mb-2">🟡 Warnings</div>
            <div className="text-3xl font-black text-yellow-600">{warningCount}</div>
            <div className="text-xs opacity-60">Monitor closely</div>
          </div>

          {/* OK Status */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
            <div className="text-xs opacity-60 mb-2">✅ Good</div>
            <div className="text-3xl font-black text-green-600">{Math.max(0, 5 - criticalCount - warningCount)}</div>
            <div className="text-xs opacity-60">All metrics normal</div>
          </div>
        </div>

        {/* ALERTS LIST */}
        {alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map(alert => (
              <Card key={alert.id} className={`p-4 ${getAlertColor(alert.severity)}`}>
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getAlertIcon(alert.severity)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {alert.title}
                        </h4>
                        <p className="text-xs opacity-70 mt-1">{alert.metric}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={alert.severity === 'critical' ? 'coral' : alert.severity === 'warning' ? 'gold' : 'slate'}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <button
                          onClick={() => {
                            setSelectedAlertId(alert.id)
                            setShowRootCauseAnalysis(true)
                          }}
                          className="ml-2 p-1.5 hover:bg-white/50 rounded transition"
                          title="Analyze root causes"
                        >
                          <Zap className="w-4 h-4 text-amber-600" />
                        </button>
                      </div>
                    </div>

                    {/* Values */}
                    <div className="flex items-center gap-3 mb-3">
                      <div>
                        <div className="text-xs opacity-60">Current</div>
                        <div className="font-bold text-lg">{alert.currentValue}</div>
                      </div>
                      {alert.expectedValue && (
                        <>
                          <div className="text-xs opacity-40">vs</div>
                          <div>
                            <div className="text-xs opacity-60">Expected</div>
                            <div className="font-bold text-lg">{alert.expectedValue}</div>
                          </div>
                        </>
                      )}
                      {alert.change !== undefined && (
                        <>
                          <div className="text-xs opacity-40">•</div>
                          <div className={`font-bold text-lg ${alert.change < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {alert.change < 0 ? '▼' : '▲'} {Math.abs(alert.change)}%
                          </div>
                        </>
                      )}
                    </div>

                    {/* Recommendation */}
                    <div className="bg-white/50 rounded p-2.5 text-xs">
                      <span className="font-medium">💡 Action:</span> {alert.recommendation}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center bg-green-50 border-l-4 border-green-500">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div className="text-lg font-semibold text-green-600">All Systems Normal ✓</div>
              <p className="text-sm opacity-60">No issues detected in your campaigns</p>
            </div>
          </Card>
        )}
      </div>

      {/* ROOT CAUSE ANALYSIS MODAL */}
      {selectedAlertId && (
        <RootCauseAnalysisPanel
          alertId={selectedAlertId}
          alertType={selectedAlertId}
          clientId={clientId}
          isOpen={showRootCauseAnalysis}
          onClose={() => {
            setShowRootCauseAnalysis(false)
            setSelectedAlertId(null)
          }}
        />
      )}
    </>
  )
}
