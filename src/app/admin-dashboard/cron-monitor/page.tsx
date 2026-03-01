'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/admin/AdminLayout'
import { createClient } from '@supabase/supabase-js'
import { RefreshCw, Activity, Play, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

// ─── types ───────────────────────────────────────────────────────────────────

type SyncStatus = 'OK' | 'WARN' | 'ERROR' | 'N/A'

interface ServiceConfig {
  ga_property_id?: string | null
  gads_customer_id?: string | null
  gsc_site_url?: string | null
  gbp_location_id?: string | null
}

interface ClientRow {
  id: string
  name: string
  slug: string
  is_active: boolean
  service_configs: ServiceConfig[]
  ga4:    { status: SyncStatus; daysAgo: number | null; lastDate: string | null }
  gsc:    { status: SyncStatus; daysAgo: number | null; lastDate: string | null }
  ads:    { status: SyncStatus; daysAgo: number | null; lastDate: string | null }
  gbp:    { status: SyncStatus; daysAgo: number | null; lastDate: string | null }
  rollup: { status: SyncStatus; daysAgo: number | null; lastDate: string | null }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function daysAgoFromDate(dateStr: string | null, today: string): number | null {
  if (!dateStr) return null
  const diff = Math.floor(
    (new Date(today).getTime() - new Date(dateStr).getTime()) / 86400000
  )
  return diff
}

function toStatus(daysAgo: number | null, enabled: boolean): SyncStatus {
  if (!enabled) return 'N/A'
  if (daysAgo === null) return 'ERROR'
  if (daysAgo <= 2) return 'OK'
  if (daysAgo <= 5) return 'WARN'
  return 'ERROR'
}

const STATUS_STYLE: Record<SyncStatus, { bg: string; color: string; label: string }> = {
  OK:    { bg: 'rgba(16,185,129,0.12)',  color: '#059669', label: 'OK'   },
  WARN:  { bg: 'rgba(245,158,11,0.12)',  color: '#d97706', label: 'WARN' },
  ERROR: { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626', label: 'ERR'  },
  'N/A': { bg: 'rgba(156,163,175,0.10)', color: '#9ca3af', label: '—'    },
}

function StatusDot({ status, lastDate, daysAgo }: { status: SyncStatus; lastDate: string | null; daysAgo: number | null }) {
  const s = STATUS_STYLE[status]
  return (
    <div title={lastDate ? `${lastDate} (${daysAgo}d ago)` : 'No data'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 52, height: 26, borderRadius: 6,
        background: s.bg, color: s.color,
        fontSize: '11px', fontWeight: 700,
        cursor: 'default',
      }}>
      {s.label}
    </div>
  )
}

const CRON_ENDPOINTS: Record<string, string> = {
  GA4:    '/api/cron/sync-ga4',
  GSC:    '/api/cron/sync-gsc',
  Ads:    '/api/cron/sync-ads',
  GBP:    '/api/cron/sync-gbp',
  Rollup: '/api/admin/run-rollup',
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function CronMonitorPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()

  const [rows, setRows]           = useState<ClientRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [running, setRunning]     = useState<Record<string, boolean>>({})
  const [runResults, setRunResults] = useState<Record<string, string>>({})

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login')
  }, [authStatus, router])

  // ─── data fetch ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      )

      // Use California timezone for date calculations
      const caToday = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
      const today = `${caToday.getFullYear()}-${String(caToday.getMonth() + 1).padStart(2, '0')}-${String(caToday.getDate()).padStart(2, '0')}`
      const caCutoff = new Date(caToday)
      caCutoff.setDate(caCutoff.getDate() - 30)
      const cutoffStr = `${caCutoff.getFullYear()}-${String(caCutoff.getMonth() + 1).padStart(2, '0')}-${String(caCutoff.getDate()).padStart(2, '0')}`

      // Fetch all active clients with service configs
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name, slug, is_active, service_configs(ga_property_id, gads_customer_id, gsc_site_url, gbp_location_id)')
        .eq('is_active', true)
        .order('name')

      // Fetch latest date per client for each source (last 30 days)
      const [ga4Res, gscRes, adsRes, gbpRes, rollupRes] = await Promise.all([
        supabase.from('ga4_sessions').select('client_id, date').gte('date', cutoffStr).order('date', { ascending: false }),
        supabase.from('gsc_daily_summary').select('client_id, date').gte('date', cutoffStr).order('date', { ascending: false }),
        supabase.from('ads_campaign_metrics').select('client_id, date').gte('date', cutoffStr).order('date', { ascending: false }),
        supabase.from('gbp_location_daily_metrics').select('client_id, date').gte('date', cutoffStr).order('date', { ascending: false }),
        supabase.from('client_metrics_summary').select('client_id, date').eq('period_type', 'daily').gte('date', cutoffStr).order('date', { ascending: false }),
      ])

      // Build maxDate maps (client_id → latest date string)
      const maxDate = (rows: any[]) => {
        const m: Record<string, string> = {}
        for (const r of rows || []) {
          if (!m[r.client_id] || r.date > m[r.client_id]) m[r.client_id] = r.date
        }
        return m
      }

      const ga4Map    = maxDate(ga4Res.data    || [])
      const gscMap    = maxDate(gscRes.data    || [])
      const adsMap    = maxDate(adsRes.data    || [])
      const gbpMap    = maxDate(gbpRes.data    || [])
      const rollupMap = maxDate(rollupRes.data || [])

      const built: ClientRow[] = (clientsData || []).map((c: any) => {
        const cfg: ServiceConfig = Array.isArray(c.service_configs) ? (c.service_configs[0] || {}) : (c.service_configs || {})

        const hasGA4    = !!(cfg.ga_property_id?.trim())
        const hasGSC    = !!(cfg.gsc_site_url?.trim())
        const hasAds    = !!(cfg.gads_customer_id?.trim())
        const hasGBP    = !!(cfg.gbp_location_id?.trim())

        const mk = (map: Record<string, string>, enabled: boolean) => {
          const ld = enabled ? (map[c.id] || null) : null
          const da = ld ? daysAgoFromDate(ld, today) : null
          return { status: toStatus(da, enabled), daysAgo: da, lastDate: ld }
        }

        return {
          id: c.id, name: c.name, slug: c.slug, is_active: c.is_active,
          service_configs: c.service_configs,
          ga4:    mk(ga4Map,    hasGA4),
          gsc:    mk(gscMap,    hasGSC),
          ads:    mk(adsMap,    hasAds),
          gbp:    mk(gbpMap,    hasGBP),
          rollup: mk(rollupMap, true),    // rollup always relevant
        }
      })

      setRows(built)
      setLastRefresh(new Date())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const t = setInterval(() => fetchData(true), 60000)
    return () => clearInterval(t)
  }, [fetchData])

  // ─── run cron ──────────────────────────────────────────────────────────────

  const runCron = async (label: string) => {
    const endpoint = CRON_ENDPOINTS[label]
    if (!endpoint) return
    setRunning(p => ({ ...p, [label]: true }))
    setRunResults(p => ({ ...p, [label]: '' }))
    try {
      const res = await fetch(endpoint, { cache: 'no-store' })
      const data = await res.json()
      setRunResults(p => ({ ...p, [label]: (res.ok && data.success !== false) ? 'success' : (data.error || 'Failed') }))
      setTimeout(() => fetchData(true), 1500)
    } catch (err: any) {
      setRunResults(p => ({ ...p, [label]: err.message || 'Error' }))
    } finally {
      setRunning(p => ({ ...p, [label]: false }))
    }
  }

  // ─── derived stats ─────────────────────────────────────────────────────────

  const countStatus = (svc: keyof Pick<ClientRow, 'ga4' | 'gsc' | 'ads' | 'gbp' | 'rollup'>, s: SyncStatus) =>
    rows.filter(r => r[svc].status === s).length

  const services: Array<{ key: keyof Pick<ClientRow, 'ga4' | 'gsc' | 'ads' | 'gbp' | 'rollup'>; label: string; cronKey: string }> = [
    { key: 'ga4',    label: 'GA4',    cronKey: 'GA4'    },
    { key: 'gsc',    label: 'GSC',    cronKey: 'GSC'    },
    { key: 'ads',    label: 'Ads',    cronKey: 'Ads'    },
    { key: 'gbp',    label: 'GBP',    cronKey: 'GBP'    },
    { key: 'rollup', label: 'Rollup', cronKey: 'Rollup' },
  ]

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <style>{`
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        .cron-table { table-layout: fixed; width: 100%; border-collapse: separate; border-spacing: 0; }
        .cron-table th { padding: 9px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; border-bottom: 1.5px solid rgba(44,36,25,0.1); }
        .cron-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid rgba(44,36,25,0.05); vertical-align: middle; }
        .cron-table tbody tr:last-child td { border-bottom: none; }
        .cron-table tbody tr:hover td { background: rgba(196,112,79,0.03); }
        .cron-table .col-client { width: 26%; }
        .cron-table .col-svc    { width: 11%; text-align: center; }
        .cron-table .col-rollup { width: 13%; text-align: center; border-left: 1px solid rgba(44,36,25,0.08); }
      `}</style>

      {/* Sticky header */}
      <div className="sticky top-0 z-40 px-6 py-3" style={{
        background: 'rgba(245,241,237,0.98)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44,36,25,0.08)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <Activity size={16} style={{ color: '#c4704f' }} />
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#2c2419' }}>Cron Monitor</span>
        {lastRefresh && (
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => fetchData(true)} disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 13px', background: '#c4704f', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.7 : 1 }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Summary strip + Run Now buttons */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'stretch' }}>
          {services.map(({ key, label, cronKey }) => {
            const ok   = countStatus(key, 'OK')
            const warn = countStatus(key, 'WARN')
            const err  = countStatus(key, 'ERROR')
            const isRunning = running[cronKey]
            const result    = runResults[cronKey]
            return (
              <div key={key} style={{
                flex: '1 1 150px', background: 'rgba(255,255,255,0.95)',
                border: '1px solid rgba(44,36,25,0.08)', borderRadius: '14px',
                padding: '14px 16px', boxShadow: '0 2px 10px rgba(44,36,25,0.06)',
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5c5850', marginBottom: '8px' }}>{label}</div>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#059669', padding: '2px 7px', borderRadius: '4px' }}>{ok} OK</span>
                  {warn > 0 && <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#d97706', padding: '2px 7px', borderRadius: '4px' }}>{warn} W</span>}
                  {err > 0  && <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#dc2626', padding: '2px 7px', borderRadius: '4px' }}>{err} E</span>}
                </div>
                <button onClick={() => runCron(cronKey)} disabled={isRunning}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '6px 0', background: isRunning ? '#f5f0e8' : 'rgba(44,36,25,0.05)', color: isRunning ? '#8B7355' : '#5c5850', border: '1px solid rgba(44,36,25,0.12)', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: isRunning ? 'not-allowed' : 'pointer' }}>
                  {isRunning
                    ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Running…</>
                    : <><Play size={11} /> Run Now</>
                  }
                </button>
                {result && (
                  <div style={{ marginTop: '6px', padding: '4px 8px', borderRadius: '5px', fontSize: '11px', textAlign: 'center', background: result === 'success' ? '#d1fae5' : '#fee2e2', color: result === 'success' ? '#065f46' : '#991b1b' }}>
                    {result === 'success' ? '✓ Done' : result}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Per-client table */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(44,36,25,0.08)',
          borderRadius: '20px', padding: '24px',
          boxShadow: '0 4px 20px rgba(44,36,25,0.06)',
        }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#2c2419' }}>Sync Status by Client</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                {rows.length} active clients · hover badges for last sync date
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
              {[
                { bg: 'rgba(16,185,129,0.12)', color: '#059669', text: 'OK ≤ 2d' },
                { bg: 'rgba(245,158,11,0.12)', color: '#d97706', text: 'WARN 3-5d' },
                { bg: 'rgba(239,68,68,0.12)',  color: '#dc2626', text: 'ERR ≥6d' },
                { bg: 'rgba(156,163,175,0.1)', color: '#9ca3af', text: 'N/A' },
              ].map(l => (
                <span key={l.text} style={{ background: l.bg, color: l.color, padding: '3px 9px', borderRadius: '5px', fontWeight: 700 }}>{l.text}</span>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>Loading sync data…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="cron-table">
                <thead>
                  <tr>
                    <th className="col-client" style={{ textAlign: 'left' }}>Client</th>
                    <th className="col-svc">GA4</th>
                    <th className="col-svc">GSC</th>
                    <th className="col-svc">Ads</th>
                    <th className="col-svc">GBP</th>
                    <th className="col-rollup">Rollup</th>
                    <th style={{ width: '10%', textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af' }}>Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    // Overall: worst of enabled services
                    const enabled = [row.ga4, row.gsc, row.ads, row.gbp, row.rollup].filter(s => s.status !== 'N/A')
                    const hasErr  = enabled.some(s => s.status === 'ERROR')
                    const hasWarn = enabled.some(s => s.status === 'WARN')
                    const overall: SyncStatus = hasErr ? 'ERROR' : hasWarn ? 'WARN' : 'OK'
                    const ov = STATUS_STYLE[overall]

                    return (
                      <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/admin-dashboard/${row.slug}`)}>
                        <td className="col-client">
                          <div style={{ fontWeight: 600, color: '#2c2419', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
                        </td>
                        {[row.ga4, row.gsc, row.ads, row.gbp].map((svc, i) => (
                          <td key={i} className="col-svc">
                            <StatusDot {...svc} />
                          </td>
                        ))}
                        <td className="col-rollup">
                          <StatusDot {...row.rollup} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '5px', fontSize: '11px', fontWeight: 700, background: ov.bg, color: ov.color }}>
                            {overall === 'OK'    && <CheckCircle size={11} />}
                            {overall === 'WARN'  && <AlertTriangle size={11} />}
                            {overall === 'ERROR' && <XCircle size={11} />}
                            {overall}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  )
}
