'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/admin/AdminLayout'
import {
  RefreshCw, CheckCircle, AlertTriangle, XCircle,
  Clock, Database, Play, Activity
} from 'lucide-react'

interface SourceHealth {
  label: string
  table: string
  status: 'OK' | 'WARNING' | 'ERROR'
  lastDate: string | null
  daysAgo: number | null
  message: string
}

interface HealthData {
  overall: 'OK' | 'WARNING' | 'ERROR'
  checkedAt: string
  today: string
  sources: SourceHealth[]
  summary: { ok: number; warning: number; error: number }
}

const CRON_SCHEDULES: Record<string, string> = {
  GA4:          '10:00 UTC daily (2:00 AM PST)',
  'Google Ads': '10:05 UTC daily (2:05 AM PST)',
  GSC:          '10:10 UTC daily (2:10 AM PST)',
  GBP:          '10:12 UTC daily (2:12 AM PST)',
  Rollup:       '10:15 UTC daily (2:15 AM PST)',
}

const CRON_ENDPOINTS: Record<string, string> = {
  GA4:          '/api/cron/sync-ga4',
  'Google Ads': '/api/cron/sync-ads',
  GSC:          '/api/cron/sync-gsc',
  GBP:          '/api/cron/sync-gbp',
  Rollup:       '/api/admin/run-rollup',
}

export default function CronMonitorPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [running, setRunning] = useState<Record<string, boolean>>({})
  const [runResults, setRunResults] = useState<Record<string, string>>({})
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const fetchHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/admin/cron-health', { cache: 'no-store' })
      const data = await res.json()
      setHealth(data)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Failed to fetch health:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(() => fetchHealth(true), 30000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  const runCron = async (label: string) => {
    const endpoint = CRON_ENDPOINTS[label]
    if (!endpoint) return

    setRunning(prev => ({ ...prev, [label]: true }))
    setRunResults(prev => ({ ...prev, [label]: '' }))

    try {
      const res = await fetch(endpoint, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        setRunResults(prev => ({ ...prev, [label]: 'success' }))
      } else {
        setRunResults(prev => ({ ...prev, [label]: data.error || 'Failed' }))
      }
      // Re-fetch health after running
      setTimeout(() => fetchHealth(true), 1000)
    } catch (err: any) {
      setRunResults(prev => ({ ...prev, [label]: err.message || 'Error' }))
    } finally {
      setRunning(prev => ({ ...prev, [label]: false }))
    }
  }

  if (status === 'loading' || loading) {
    return (
      <AdminLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center' }}>
            <Activity size={40} color="#8B7355" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: '#8B7355', fontSize: 16 }}>Loading cron status...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const overallColor = health?.overall === 'OK' ? '#10b981' : health?.overall === 'WARNING' ? '#f59e0b' : '#ef4444'
  const overallBg = health?.overall === 'OK' ? '#d1fae5' : health?.overall === 'WARNING' ? '#fef3c7' : '#fee2e2'

  return (
    <AdminLayout>
      <div style={{ padding: '32px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#2c2419', margin: 0 }}>Cron Monitor</h1>
            <p style={{ color: '#8B7355', margin: '4px 0 0', fontSize: 14 }}>
              Daily sync jobs — checks GA4, Ads, GSC, GBP, Rollup
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {lastRefresh && (
              <span style={{ color: '#9ca3af', fontSize: 12 }}>
                Checked {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => fetchHealth(true)}
              disabled={refreshing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#8B7355', color: 'white', border: 'none',
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, opacity: refreshing ? 0.7 : 1
              }}
            >
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
        </div>

        {/* Overall Status Banner */}
        {health && (
          <div style={{
            background: overallBg, border: `1px solid ${overallColor}40`,
            borderRadius: 12, padding: '16px 20px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            {health.overall === 'OK'
              ? <CheckCircle size={24} color={overallColor} />
              : health.overall === 'WARNING'
              ? <AlertTriangle size={24} color={overallColor} />
              : <XCircle size={24} color={overallColor} />
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: overallColor, fontSize: 16 }}>
                Overall: {health.overall}
              </div>
              <div style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
                {health.summary.ok} OK &nbsp;·&nbsp; {health.summary.warning} Warning &nbsp;·&nbsp; {health.summary.error} Error
                &nbsp;·&nbsp; Checked at {new Date(health.checkedAt).toLocaleTimeString()}
              </div>
            </div>
            <div style={{
              background: overallColor, color: 'white',
              borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700
            }}>
              {health.overall}
            </div>
          </div>
        )}

        {/* Source Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {health?.sources.map((source) => {
            const isOk = source.status === 'OK'
            const isWarn = source.status === 'WARNING'
            const statusColor = isOk ? '#10b981' : isWarn ? '#f59e0b' : '#ef4444'
            const statusBg = isOk ? '#d1fae5' : isWarn ? '#fef3c7' : '#fee2e2'
            const isRunning = running[source.label]
            const runResult = runResults[source.label]

            return (
              <div key={source.label} style={{
                background: 'white', borderRadius: 12,
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                padding: 20, border: `1px solid ${statusColor}30`
              }}>
                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Database size={16} color="#8B7355" />
                    <span style={{ fontWeight: 700, color: '#2c2419', fontSize: 15 }}>{source.label}</span>
                  </div>
                  <span style={{
                    background: statusBg, color: statusColor,
                    borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700
                  }}>
                    {source.status}
                  </span>
                </div>

                {/* Status Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  {isOk
                    ? <CheckCircle size={18} color={statusColor} />
                    : isWarn
                    ? <AlertTriangle size={18} color={statusColor} />
                    : <XCircle size={18} color={statusColor} />
                  }
                  <span style={{ color: '#374151', fontSize: 13 }}>{source.message}</span>
                </div>

                {/* Details */}
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>Last date</span>
                    <span style={{ color: '#374151', fontSize: 12, fontWeight: 600 }}>
                      {source.lastDate || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>Days ago</span>
                    <span style={{ color: source.daysAgo !== null && source.daysAgo > 5 ? '#ef4444' : '#374151', fontSize: 12, fontWeight: 600 }}>
                      {source.daysAgo !== null ? `${source.daysAgo}d` : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>Table</span>
                    <span style={{ color: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}>{source.table}</span>
                  </div>
                </div>

                {/* Schedule */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <Clock size={12} color="#9ca3af" />
                  <span style={{ color: '#9ca3af', fontSize: 11 }}>{CRON_SCHEDULES[source.label]}</span>
                </div>

                {/* Run Button */}
                <button
                  onClick={() => runCron(source.label)}
                  disabled={isRunning}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: isRunning ? '#e5e7eb' : '#f5f0e8',
                    color: isRunning ? '#9ca3af' : '#8B7355',
                    border: `1px solid ${isRunning ? '#e5e7eb' : '#d4c5a9'}`,
                    borderRadius: 8, padding: '8px 0', cursor: isRunning ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: 600, transition: 'all 0.15s'
                  }}
                >
                  {isRunning
                    ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Running...</>
                    : <><Play size={13} /> Run Now</>
                  }
                </button>

                {/* Run Result */}
                {runResult && (
                  <div style={{
                    marginTop: 8, padding: '6px 10px', borderRadius: 6,
                    background: runResult === 'success' ? '#d1fae5' : '#fee2e2',
                    color: runResult === 'success' ? '#065f46' : '#991b1b',
                    fontSize: 12, textAlign: 'center'
                  }}>
                    {runResult === 'success' ? 'Completed successfully' : runResult}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{
          marginTop: 24, background: 'white', borderRadius: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '16px 20px'
        }}>
          <div style={{ fontWeight: 600, color: '#2c2419', marginBottom: 10, fontSize: 13 }}>Status Rules</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { color: '#10b981', bg: '#d1fae5', label: 'OK', desc: 'Data updated within last 2 days' },
              { color: '#f59e0b', bg: '#fef3c7', label: 'WARNING', desc: 'Data is 3–5 days old (cron may have missed)' },
              { color: '#ef4444', bg: '#fee2e2', label: 'ERROR', desc: 'Data is 6+ days old or missing' },
            ].map(({ color, bg, label, desc }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: bg, color, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{label}</span>
                <span style={{ color: '#6b7280', fontSize: 12 }}>{desc}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, color: '#9ca3af', fontSize: 12 }}>
            Auto-refreshes every 30 seconds. Use "Run Now" to manually trigger a sync.
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      </div>
    </AdminLayout>
  )
}
