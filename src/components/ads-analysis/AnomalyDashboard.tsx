import React, { useEffect, useState } from 'react'
import { AnomalyAlertCard } from './AnomalyAlertCard'
import { EarlyWarningTimeline } from './EarlyWarningTimeline'
import { CohortComparisonChart } from './CohortComparisonChart'
import { Card } from '@/components/neural/Card'

interface AnomalyDashboardProps {
  clientId: string
  sensitivity?: 'high' | 'medium' | 'low'
}

export function AnomalyDashboard({ clientId, sensitivity = 'medium' }: AnomalyDashboardProps) {
  const [anomalies, setAnomalies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnomalies = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/ads-analysis/detect-anomalies-v2?clientId=${clientId}&sensitivity=${sensitivity}&dateRange=30`)
        if (!res.ok) throw new Error('Failed to fetch anomalies')
        const data = await res.json()
        setAnomalies(data.data.anomalies || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching anomalies')
      } finally {
        setLoading(false)
      }
    }

    fetchAnomalies()
  }, [clientId, sensitivity])

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-spin inline-block w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full"></div>
        <p className="mt-2 text-sm opacity-60">Analyzing anomalies...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-4 bg-red-50 border-l-4 border-red-500">
        <p className="text-sm text-red-600">Error: {error}</p>
      </Card>
    )
  }

  const criticalCount = anomalies.filter(a => a.confidence > 80).length
  const highCount = anomalies.filter(a => a.confidence > 60 && a.confidence <= 80).length

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{anomalies.length}</div>
          <div className="text-xs opacity-60">Total Anomalies</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
          <div className="text-xs opacity-60">Critical</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{highCount}</div>
          <div className="text-xs opacity-60">High Priority</div>
        </Card>
      </div>

      {/* Anomaly Cards */}
      {anomalies.length > 0 ? (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Detected Anomalies</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {anomalies.map((anomaly, idx) => (
              <AnomalyAlertCard
                key={idx}
                campaign_id={anomaly.campaign_id}
                campaign_name={`Campaign: ${anomaly.campaign_id}`}
                metric={anomaly.metric}
                current_value={anomaly.current_value}
                expected_value={anomaly.expected_value}
                z_score={anomaly.z_score}
                confidence={anomaly.confidence}
                detected_at={anomaly.detected_at}
                interpretation={anomaly.interpretation}
              />
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <div className="text-lg font-semibold text-green-600 mb-2">✓ No anomalies detected</div>
          <p className="text-sm opacity-60">Your campaigns are performing within expected ranges</p>
        </Card>
      )}
    </div>
  )
}
