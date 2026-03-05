'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/admin/AdminLayout'
import { createClient } from '@supabase/supabase-js'
import {
  RefreshCw, Activity, Play, CheckCircle, AlertTriangle,
  XCircle, Calendar, Search, Filter,
} from 'lucide-react'

// ─── types ───────────────────────────────────────────────────────────────────

type SyncStatus = 'OK' | 'WARN' | 'ERROR' | 'N/A'

interface ServiceConfig {
  ga_property_id?: string | null
  gads_customer_id?: string | null
  gsc_site_url?: string | null
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
  return Math.floor((new Date(today).getTime() - new Date(dateStr).getTime()) / 86400000)
}

function toStatus(daysAgo: number | null, enabled: boolean): SyncStatus {
  if (!enabled) return 'N/A'
  if (daysAgo === null) return 'ERROR'
  if (daysAgo <= 2) return 'OK'
  if (daysAgo <= 5) return 'WARN'
  return 'ERROR'
}

function fmtShortDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDatesInRange(from: string, to: string): string[] {
  const dates: string[] = []
  const start = new Date(from + 'T12:00:00Z')
  const end   = new Date(to   + 'T12:00:00Z')
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

const STATUS_STYLE: Record<SyncStatus, { bg: string; color: string; label: string }> = {
  OK:    { bg: 'rgba(16,185,129,0.12)',  color: '#059669', label: 'OK'   },
  WARN:  { bg: 'rgba(245,158,11,0.12)',  color: '#d97706', label: 'WARN' },
  ERROR: { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626', label: 'ERR'  },
  'N/A': { bg: 'rgba(156,163,175,0.10)', color: '#9ca3af', label: '—'    },
}

const STATUS_RANK: Record<SyncStatus, number> = { ERROR: 0, WARN: 1, OK: 2, 'N/A': 3 }

function StatusCell({ status, lastDate, daysAgo }: { status: SyncStatus; lastDate: string | null; daysAgo: number | null }) {
  const s = STATUS_STYLE[status]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
      <div
        title={lastDate ? `${lastDate} (${daysAgo}d ago)` : 'No data'}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 48, height: 22, borderRadius: 5,
          background: s.bg, color: s.color,
          fontSize: '10px', fontWeight: 700, cursor: 'default',
        }}
      >
        {s.label}
      </div>
      <div style={{ fontSize: '10px', color: '#9ca3af', lineHeight: 1 }}>
        {status !== 'N/A' ? fmtShortDate(lastDate) : ''}
      </div>
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

  // ── data
  const [rows, setRows]               = useState<ClientRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // ── service run buttons
  const [running, setRunning]         = useState<Record<string, boolean>>({})
  const [runResults, setRunResults]   = useState<Record<string, string>>({})

  // ── backfill panel
  const [backfillOpen, setBackfillOpen] = useState(true)
  const caToday = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const defaultTo   = toISODate(new Date(caToday.getTime() - 86400000))
  const defaultFrom = toISODate(new Date(caToday.getTime() - 30 * 86400000))
  const [backfillFrom,     setBackfillFrom]     = useState(defaultFrom)
  const [backfillTo,       setBackfillTo]       = useState(defaultTo)
  const [backfillClientId, setBackfillClientId] = useState('')
  const [backfillRunning,  setBackfillRunning]  = useState(false)
  const [backfillProgress, setBackfillProgress] = useState<{ current: number; total: number } | null>(null)
  const [backfillResult,   setBackfillResult]   = useState<string | null>(null)

  // ── table filters
  const [searchQuery,    setSearchQuery]    = useState('')
  const [showIssuesOnly, setShowIssuesOnly] = useState(false)

  // ── per-client fix
  const [fixingClientId, setFixingClientId] = useState<string | null>(null)
  const [fixProgress,    setFixProgress]    = useState<{ current: number; total: number } | null>(null)
  const [fixResults,     setFixResults]     = useState<Record<string, string>>({})

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login')
  }, [authStatus, router])

  // ─── fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      )
      const caToday   = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
      const today     = toISODate(caToday)
      const cutoffDate = new Date(caToday); cutoffDate.setDate(cutoffDate.getDate() - 30)
      const cutoffStr  = toISODate(cutoffDate)

      const [{ data: clientsData }, { data: gbpLocData }] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, slug, is_active, service_configs(ga_property_id, gads_customer_id, gsc_site_url)')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('gbp_locations')
          .select('client_id')
          .eq('is_active', true),
      ])

      const fetchAllRows = async (table: string, extraFilter?: (q: any) => any) => {
        let allData: any[] = [], from = 0
        while (true) {
          let q = supabase.from(table).select('client_id, date')
            .gte('date', cutoffStr).order('date', { ascending: false }).range(from, from + 999)
          if (extraFilter) q = extraFilter(q)
          const { data } = await q
          if (!data || data.length === 0) break
          allData = allData.concat(data)
          if (data.length < 1000) break
          from += 1000
        }
        return allData
      }

      const [ga4Data, gscData, adsData, gbpData, rollupData] = await Promise.all([
        fetchAllRows('ga4_sessions'),
        fetchAllRows('gsc_daily_summary'),
        fetchAllRows('ads_campaign_metrics'),
        fetchAllRows('gbp_location_daily_metrics'),
        fetchAllRows('client_metrics_summary', (q: any) => q.eq('period_type', 'daily')),
      ])

      const maxDate = (rows: any[]) => {
        const m: Record<string, string> = {}
        for (const r of rows || []) {
          if (!m[r.client_id] || r.date > m[r.client_id]) m[r.client_id] = r.date
        }
        return m
      }

      const ga4Map    = maxDate(ga4Data)
      const gscMap    = maxDate(gscData)
      const adsMap    = maxDate(adsData)
      const gbpMap    = maxDate(gbpData)
      const rollupMap = maxDate(rollupData)

      const gbpClientIds = new Set<string>((gbpLocData || []).map((r: any) => r.client_id))

      const built: ClientRow[] = (clientsData || []).map((c: any) => {
        const cfg: ServiceConfig = Array.isArray(c.service_configs) ? (c.service_configs[0] || {}) : (c.service_configs || {})
        const hasGA4 = !!(cfg.ga_property_id?.trim())
        const hasGSC = !!(cfg.gsc_site_url?.trim())
        const hasAds = !!(cfg.gads_customer_id?.trim())
        const hasGBP = gbpClientIds.has(c.id)
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
          rollup: mk(rollupMap, true),
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

  // ─── run service cron (yesterday) ───────────────────────────────────────────

  const runCron = async (cronKey: string) => {
    const endpoint = CRON_ENDPOINTS[cronKey]
    if (!endpoint) return
    setRunning(p => ({ ...p, [cronKey]: true }))
    setRunResults(p => ({ ...p, [cronKey]: '' }))
    try {
      const res = await fetch('/api/admin/trigger-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      })
      const data = await res.json()
      setRunResults(p => ({
        ...p,
        [cronKey]: (res.ok && data.success !== false) ? 'success' : (data.error || 'Failed'),
      }))
      setTimeout(() => fetchData(true), 2000)
    } catch (err: any) {
      setRunResults(p => ({ ...p, [cronKey]: err.message || 'Error' }))
    } finally {
      setRunning(p => ({ ...p, [cronKey]: false }))
    }
  }

  // ─── backfill: run rollup for date range ────────────────────────────────────

  const runBackfill = async (specificClientId?: string) => {
    const clientId = specificClientId || (backfillClientId || undefined)
    const dates    = getDatesInRange(backfillFrom, backfillTo)
    if (dates.length === 0) return

    if (specificClientId) {
      setFixingClientId(specificClientId)
      setFixResults(p => ({ ...p, [specificClientId]: '' }))
      setFixProgress({ current: 0, total: dates.length })
    } else {
      setBackfillRunning(true)
      setBackfillResult(null)
      setBackfillProgress({ current: 0, total: dates.length })
    }

    let successCount = 0, errorCount = 0

    for (let i = 0; i < dates.length; i++) {
      if (specificClientId) {
        setFixProgress({ current: i + 1, total: dates.length })
      } else {
        setBackfillProgress({ current: i + 1, total: dates.length })
      }

      try {
        const res = await fetch('/api/admin/trigger-cron', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/api/admin/run-rollup',
            method:   'POST',
            params:   { date: dates[i], clientId },
          }),
        })
        const data = await res.json()
        if (res.ok && data.success !== false) successCount++
        else errorCount++
      } catch { errorCount++ }
    }

    const resultStr = errorCount === 0
      ? `success:${successCount} date${successCount !== 1 ? 's' : ''} done`
      : `warn:${successCount} OK, ${errorCount} error${errorCount !== 1 ? 's' : ''}`

    if (specificClientId) {
      setFixingClientId(null)
      setFixProgress(null)
      setFixResults(p => ({ ...p, [specificClientId]: resultStr }))
      setTimeout(() => setFixResults(p => ({ ...p, [specificClientId]: '' })), 8000)
    } else {
      setBackfillRunning(false)
      setBackfillProgress(null)
      setBackfillResult(resultStr)
      setTimeout(() => setBackfillResult(null), 12000)
    }

    setTimeout(() => fetchData(true), 1500)
  }

  // ─── derived / filtered ─────────────────────────────────────────────────────

  const countStatus = (svc: keyof Pick<ClientRow, 'ga4' | 'gsc' | 'ads' | 'gbp' | 'rollup'>, s: SyncStatus) =>
    rows.filter(r => r[svc].status === s).length

  const filteredRows = useMemo(() => {
    let r = rows
    if (searchQuery) r = r.filter(row => row.name.toLowerCase().includes(searchQuery.toLowerCase()))
    if (showIssuesOnly) {
      r = r.filter(row => [row.ga4, row.gsc, row.ads, row.gbp, row.rollup]
        .some(s => s.status === 'ERROR' || s.status === 'WARN'))
    }
    return [...r].sort((a, b) => {
      const worst = (row: ClientRow) => {
        const svcs = [row.ga4, row.gsc, row.ads, row.gbp, row.rollup].filter(s => s.status !== 'N/A')
        return Math.min(...svcs.map(s => STATUS_RANK[s.status]))
      }
      return worst(a) - worst(b)
    })
  }, [rows, searchQuery, showIssuesOnly])

  const services: Array<{
    key: keyof Pick<ClientRow, 'ga4' | 'gsc' | 'ads' | 'gbp' | 'rollup'>
    label: string; cronKey: string
  }> = [
    { key: 'ga4',    label: 'GA4',    cronKey: 'GA4'    },
    { key: 'gsc',    label: 'GSC',    cronKey: 'GSC'    },
    { key: 'ads',    label: 'Ads',    cronKey: 'Ads'    },
    { key: 'gbp',    label: 'GBP',    cronKey: 'GBP'    },
    { key: 'rollup', label: 'Rollup', cronKey: 'Rollup' },
  ]

  const totalIssues = rows.filter(r =>
    [r.ga4, r.gsc, r.ads, r.gbp, r.rollup].some(s => s.status === 'ERROR' || s.status === 'WARN')
  ).length

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
        .cron-table .col-client  { width: 23%; }
        .cron-table .col-svc     { width: 10%; text-align: center; }
        .cron-table .col-rollup  { width: 11%; text-align: center; border-left: 1px solid rgba(44,36,25,0.08); }
        .cron-table .col-overall { width: 9%;  text-align: center; }
        .cron-table .col-fix     { width: 13%; text-align: center; }
        input[type='date'], select.cron-sel {
          font-family: inherit; font-size: 12px; color: #2c2419;
          background: #f5f1ed; border: 1.5px solid transparent;
          border-radius: 8px; padding: 7px 10px; outline: none; cursor: pointer;
        }
        input[type='date']:focus, select.cron-sel:focus {
          background: #fff; border-color: #c4704f;
        }
      `}</style>

      {/* ── Sticky header ── */}
      <div className="sticky top-14 md:top-0 z-30 px-6 py-3" style={{
        background: 'rgba(245,241,237,0.98)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44,36,25,0.08)',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <Activity size={16} style={{ color: '#c4704f' }} />
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#2c2419' }}>Cron Monitor</span>
        {totalIssues > 0 && (
          <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#dc2626', padding: '2px 10px', borderRadius: '20px' }}>
            {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
          </span>
        )}
        {lastRefresh && (
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            · {lastRefresh.toLocaleTimeString()}
          </span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={() => fetchData(true)} disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: '#c4704f', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.7 : 1 }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── Data Lag Reference ── */}
        <div style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '16px', padding: '16px 20px', boxShadow: '0 2px 8px rgba(44,36,25,0.05)' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5c5850', margin: '0 0 12px 0' }}>
            Expected Data Lag — API vs Supabase
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {[
              { service: 'GA4', lag: '1–2 days', detail: 'Google Analytics processes sessions overnight. Data from yesterday is typically available by 10am.', color: '#10b981', warn: 2 },
              { service: 'Google Ads', lag: '1–2 days', detail: 'Ad performance data is finalized ~24h after the day ends. 1 day lag is completely normal.', color: '#10b981', warn: 2 },
              { service: 'GSC', lag: '3–4 days', detail: 'Search Console has a structural 2–3 day delay by design. Data marked "final" takes up to 72h.', color: '#d97706', warn: 4 },
              { service: 'GBP', lag: '3–7 days', detail: 'Business Profile performance API is the slowest. Call clicks and views can lag 5–7 days before appearing.', color: '#d97706', warn: 7 },
            ].map(({ service, lag, detail, color, warn }) => (
              <div key={service} style={{ background: 'rgba(245,241,237,0.5)', borderRadius: '10px', padding: '12px 14px', borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#2c2419' }}>{service}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color, background: `${color}18`, padding: '1px 8px', borderRadius: '6px' }}>{lag}</span>
                </div>
                <p style={{ fontSize: '11px', color: '#5c5850', margin: 0, lineHeight: 1.5 }}>{detail}</p>
                <p style={{ fontSize: '10px', color: '#9ca3af', margin: '5px 0 0 0' }}>
                  Status shows <span style={{ color: '#dc2626', fontWeight: 600 }}>ERR</span> only if lag &gt; {warn} days
                </p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: '#9ca3af', margin: '12px 0 0 0' }}>
            ℹ️ Crons run daily at 10:00–10:20 AM PT. Rollup aggregates all raw data into <code style={{ background: 'rgba(44,36,25,0.06)', padding: '1px 5px', borderRadius: '4px' }}>client_metrics_summary</code> at 10:15 AM.
          </p>
        </div>

        {/* ── Backfill Panel ── */}
        <div style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(245,158,11,0.06)' }}>
          <button
            onClick={() => setBackfillOpen(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: backfillOpen ? '1px solid rgba(245,158,11,0.15)' : 'none' }}
          >
            <Calendar size={14} style={{ color: '#d97706' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>Rollup Backfill</span>
            <span style={{ fontSize: '11px', color: '#b45309' }}>Fix historical data gaps by date range</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#b45309' }}>{backfillOpen ? 'Hide ▴' : 'Show ▾'}</span>
          </button>

          {backfillOpen && (
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                {/* From */}
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>From</label>
                  <input type="date" value={backfillFrom} max={backfillTo}
                    onChange={e => setBackfillFrom(e.target.value)} />
                </div>
                {/* To */}
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>To</label>
                  <input type="date" value={backfillTo} min={backfillFrom} max={defaultTo}
                    onChange={e => setBackfillTo(e.target.value)} />
                </div>
                {/* Date shortcuts */}
                <div style={{ display: 'flex', gap: '4px', alignSelf: 'flex-end', paddingBottom: '1px' }}>
                  {[
                    { label: '7D',  days: 7  },
                    { label: '30D', days: 30 },
                    { label: '90D', days: 90 },
                  ].map(p => (
                    <button key={p.label} onClick={() => {
                      const to   = toISODate(new Date(caToday.getTime() - 86400000))
                      const from = toISODate(new Date(caToday.getTime() - p.days * 86400000))
                      setBackfillFrom(from); setBackfillTo(to)
                    }}
                      style={{ padding: '6px 10px', background: 'rgba(44,36,25,0.06)', border: '1px solid rgba(44,36,25,0.12)', borderRadius: '7px', fontSize: '11px', fontWeight: 600, color: '#5c5850', cursor: 'pointer' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                {/* Client selector */}
                <div style={{ minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Client</label>
                  <select className="cron-sel" value={backfillClientId} onChange={e => setBackfillClientId(e.target.value)} style={{ width: '100%' }}>
                    <option value="">All active clients</option>
                    {rows.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                {/* Run button */}
                <button
                  onClick={() => runBackfill()}
                  disabled={backfillRunning || !backfillFrom || !backfillTo}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: backfillRunning ? '#f5f0e8' : '#d97706', color: backfillRunning ? '#8B7355' : '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: backfillRunning ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {backfillRunning
                    ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Running…</>
                    : <><Play size={12} /> Run Backfill</>
                  }
                </button>
                {/* Progress bar */}
                {backfillProgress && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 160px' }}>
                    <div style={{ flex: 1, height: '6px', background: 'rgba(44,36,25,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${(backfillProgress.current / backfillProgress.total) * 100}%`, height: '100%', background: '#d97706', borderRadius: '3px', transition: 'width 200ms' }} />
                    </div>
                    <span style={{ fontSize: '11px', color: '#b45309', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {backfillProgress.current} / {backfillProgress.total} dates
                    </span>
                  </div>
                )}
                {/* Result */}
                {backfillResult && (
                  <div style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: backfillResult.startsWith('success') ? '#d1fae5' : '#fef3c7', color: backfillResult.startsWith('success') ? '#065f46' : '#92400e' }}>
                    {backfillResult.startsWith('success') ? `✓ ${backfillResult.split(':')[1]}` : `⚠ ${backfillResult.split(':')[1]}`}
                  </div>
                )}
              </div>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '10px 0 0 0', lineHeight: 1.5 }}>
                Tip: use the <strong>Fix</strong> button on a specific client row to backfill just that client for the date range above.
                Running on all clients for large ranges may take several minutes.
              </p>
            </div>
          )}
        </div>

        {/* ── Service summary cards ── */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'stretch' }}>
          {services.map(({ key, label, cronKey }) => {
            const ok   = countStatus(key, 'OK')
            const warn = countStatus(key, 'WARN')
            const err  = countStatus(key, 'ERROR')
            const na   = countStatus(key, 'N/A')
            const isRunning = running[cronKey]
            const result    = runResults[cronKey]
            const hasProblem = err > 0 || warn > 0
            return (
              <div key={key} style={{
                flex: '1 1 150px', background: 'rgba(255,255,255,0.95)',
                border: `1px solid ${err > 0 ? 'rgba(239,68,68,0.25)' : warn > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(44,36,25,0.08)'}`,
                borderRadius: '14px', padding: '14px 16px',
                boxShadow: hasProblem ? '0 2px 12px rgba(239,68,68,0.06)' : '0 2px 10px rgba(44,36,25,0.05)',
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5c5850', marginBottom: '8px' }}>{label}</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#059669', padding: '2px 6px', borderRadius: '4px' }}>{ok} OK</span>
                  {warn > 0 && <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#d97706', padding: '2px 6px', borderRadius: '4px' }}>{warn} W</span>}
                  {err  > 0 && <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(239,68,68,0.12)',  color: '#dc2626', padding: '2px 6px', borderRadius: '4px' }}>{err} E</span>}
                  {na   > 0 && <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(156,163,175,0.1)', color: '#9ca3af', padding: '2px 6px', borderRadius: '4px' }}>{na} —</span>}
                </div>
                <button onClick={() => runCron(cronKey)} disabled={isRunning}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '6px 0', background: isRunning ? '#f5f0e8' : 'rgba(44,36,25,0.05)', color: isRunning ? '#8B7355' : '#5c5850', border: '1px solid rgba(44,36,25,0.12)', borderRadius: '7px', fontSize: '11px', fontWeight: 600, cursor: isRunning ? 'not-allowed' : 'pointer' }}>
                  {isRunning
                    ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Running…</>
                    : <><Play size={11} /> Run Now (yesterday)</>
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

        {/* ── Per-client table ── */}
        <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.06)' }}>

          {/* Table header */}
          <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#2c2419' }}>Sync Status by Client</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                {filteredRows.length} of {rows.length} clients · sorted by worst status · badges show last sync date
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              {[
                { bg: 'rgba(16,185,129,0.12)', color: '#059669', text: 'OK ≤2d'  },
                { bg: 'rgba(245,158,11,0.12)', color: '#d97706', text: 'WARN 3-5d'},
                { bg: 'rgba(239,68,68,0.12)',  color: '#dc2626', text: 'ERR ≥6d'  },
              ].map(l => (
                <span key={l.text} style={{ background: l.bg, color: l.color, padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>{l.text}</span>
              ))}
            </div>
          </div>

          {/* Filters row */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '280px' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Search clients…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '30px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px', background: '#f5f1ed', border: '1.5px solid transparent', borderRadius: '8px', fontSize: '12px', color: '#2c2419', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#c4704f' }}
                onBlur={e => { e.currentTarget.style.background = '#f5f1ed'; e.currentTarget.style.borderColor = 'transparent' }}
              />
            </div>
            <button
              onClick={() => setShowIssuesOnly(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: showIssuesOnly ? '#dc2626' : 'rgba(44,36,25,0.05)', color: showIssuesOnly ? '#fff' : '#5c5850', border: `1.5px solid ${showIssuesOnly ? '#dc2626' : 'rgba(44,36,25,0.12)'}`, borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              <Filter size={12} />
              {showIssuesOnly ? 'Issues Only (active)' : 'Issues Only'}
            </button>
            {showIssuesOnly && totalIssues === 0 && (
              <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600, alignSelf: 'center' }}>
                All clients synced!
              </span>
            )}
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
                    <th className="col-overall">Overall</th>
                    <th className="col-fix">Fix Rollup</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(row => {
                    const enabled = [row.ga4, row.gsc, row.ads, row.gbp, row.rollup].filter(s => s.status !== 'N/A')
                    const hasErr  = enabled.some(s => s.status === 'ERROR')
                    const hasWarn = enabled.some(s => s.status === 'WARN')
                    const overall: SyncStatus = hasErr ? 'ERROR' : hasWarn ? 'WARN' : 'OK'
                    const ov = STATUS_STYLE[overall]
                    const isFixing  = fixingClientId === row.id
                    const fixResult = fixResults[row.id]

                    return (
                      <tr key={row.id}>
                        <td className="col-client">
                          <button
                            onClick={() => router.push(`/admin-dashboard/${row.slug}`)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                          >
                            <div style={{ fontWeight: 600, color: '#2c2419', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>{row.name}</div>
                            <div style={{ fontSize: '10px', color: '#c4a882', marginTop: '1px' }}>open dashboard →</div>
                          </button>
                        </td>
                        {[row.ga4, row.gsc, row.ads, row.gbp].map((svc, i) => (
                          <td key={i} className="col-svc">
                            <StatusCell {...svc} />
                          </td>
                        ))}
                        <td className="col-rollup">
                          <StatusCell {...row.rollup} />
                        </td>
                        <td className="col-overall">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 700, background: ov.bg, color: ov.color }}>
                            {overall === 'OK'    && <CheckCircle size={10} />}
                            {overall === 'WARN'  && <AlertTriangle size={10} />}
                            {overall === 'ERROR' && <XCircle size={10} />}
                            {overall}
                          </span>
                        </td>
                        <td className="col-fix">
                          {fixResult ? (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: fixResult.startsWith('success') ? '#d1fae5' : '#fef3c7', color: fixResult.startsWith('success') ? '#065f46' : '#92400e' }}>
                              {fixResult.startsWith('success') ? '✓ Done' : '⚠ Partial'}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                              <button
                                onClick={e => { e.stopPropagation(); runBackfill(row.id) }}
                                disabled={isFixing || backfillRunning}
                                title={`Run rollup for ${row.name}: ${backfillFrom} → ${backfillTo}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: isFixing ? '#f5f0e8' : 'rgba(44,36,25,0.05)', color: isFixing ? '#8B7355' : '#5c5850', border: '1px solid rgba(44,36,25,0.12)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: (isFixing || backfillRunning) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                                {isFixing
                                  ? <><RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} />{fixProgress ? ` ${fixProgress.current}/${fixProgress.total}` : '…'}</>
                                  : <><Play size={10} /> Fix</>
                                }
                              </button>
                              {isFixing && fixProgress && (
                                <div style={{ width: '60px', height: '3px', background: 'rgba(44,36,25,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ width: `${(fixProgress.current / fixProgress.total) * 100}%`, height: '100%', background: '#d97706', transition: 'width 200ms' }} />
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
                        {showIssuesOnly ? 'All clients synced — no issues!' : 'No clients found'}
                      </td>
                    </tr>
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
