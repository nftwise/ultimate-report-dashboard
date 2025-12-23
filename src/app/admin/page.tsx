'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Users, LogOut, TrendingUp, Phone, DollarSign, AlertTriangle,
  ChevronUp, ChevronDown, Calendar, Trophy, FileText, Key,
  Smartphone, Target, Plus, Settings, RefreshCw, Download,
  Search, Filter
} from 'lucide-react'
import { formatNumber } from '@/lib/format-utils'
import { cachedFetch, clearCachePattern } from '@/lib/browser-cache'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

// Custom calendar styles
const calendarStyles = `
  .react-datepicker {
    border: none !important;
    box-shadow: none !important;
    font-family: inherit !important;
    font-size: 0.9rem !important;
    background-color: white !important;
  }
  .react-datepicker__month-container { background-color: white !important; }
  .react-datepicker__day {
    color: #1f2937 !important;
    font-weight: 500 !important;
    transition: all 0.15s ease-in-out !important;
    width: 2.2rem !important;
    height: 2.2rem !important;
    line-height: 2.2rem !important;
    margin: 0.2rem !important;
    background-color: white !important;
  }
  .react-datepicker__day:hover {
    background-color: #8B7355 !important;
    color: white !important;
    transform: scale(1.05);
    border-radius: 0.375rem !important;
  }
  .react-datepicker__day--in-selecting-range:not(.react-datepicker__day--outside-month),
  .react-datepicker__day--in-range:not(.react-datepicker__day--outside-month) {
    background-color: #F5F0E8 !important;
    color: #6B5344 !important;
  }
  .react-datepicker__day--outside-month {
    background-color: transparent !important;
    color: #d1d5db !important;
    pointer-events: none !important;
  }
  .react-datepicker__day--selected,
  .react-datepicker__day--range-start,
  .react-datepicker__day--range-end {
    background-color: #8B7355 !important;
    color: white !important;
    font-weight: 700 !important;
    border-radius: 0.375rem !important;
  }
  .react-datepicker__day--today {
    font-weight: 700 !important;
    color: #8B7355 !important;
    border: 2px solid #8B7355 !important;
    border-radius: 0.375rem !important;
    background-color: white !important;
  }
  .react-datepicker__header {
    background-color: #FAF8F5 !important;
    border-bottom: 2px solid #e5e7eb !important;
    padding-top: 0.75rem !important;
  }
  .react-datepicker__current-month {
    color: #111827 !important;
    font-weight: 700 !important;
  }
  .react-datepicker__day-name {
    color: #4b5563 !important;
    font-weight: 600 !important;
    width: 2.2rem !important;
  }
  .react-datepicker__navigation-icon::before {
    border-color: #8B7355 !important;
  }
`

interface ClientData {
  id: string
  name: string
  slug: string
  googleAdsConversions: number | null
  formFills: number | null
  gbpCalls: number | null
  adSpend: number | null
  cpl: number | null
  leadsChange?: number | null
  googleRank?: number | null
  topKeywords?: number | null
  totalLeads?: number | null
  sparkline?: number[]
  status?: 'excellent' | 'good' | 'watch' | 'critical'
  services?: {
    googleAds: boolean
    seo: boolean
    googleLocalService: boolean
    fbAds: boolean
  }
  isLoading?: boolean
}

interface Summary {
  totalClients: number
  totalLeads: number
  totalAdsConversions?: number
  totalSpend: number
  avgCPL: number
  needsAttention: number
  excellent: number
}

// Sparkline SVG Component
const Sparkline = ({ data, color }: { data: number[], color: string }) => {
  if (!data || data.length === 0) return null

  const max = Math.max(...data, 1)
  const width = 60
  const height = 20
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - (value / max) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="mx-auto">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
      />
    </svg>
  )
}

// Status Badge Component
const StatusBadge = ({ status }: { status?: string }) => {
  const styles = {
    excellent: 'bg-green-100 text-green-800',
    good: 'bg-blue-100 text-blue-800',
    watch: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800',
  }
  const labels = {
    excellent: 'Excellent',
    good: 'Good',
    watch: 'Watch',
    critical: 'Critical',
  }
  const style = styles[status as keyof typeof styles] || styles.good
  const label = labels[status as keyof typeof labels] || 'Good'

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${style}`}>
      {label}
    </span>
  )
}

// Change Badge Component
const ChangeBadge = ({ change }: { change: number | null | undefined }) => {
  if (change === null || change === undefined) return null

  const isPositive = change > 0
  const isNegative = change < 0
  const style = isPositive
    ? 'bg-green-100 text-green-800'
    : isNegative
    ? 'bg-red-100 text-red-800'
    : 'bg-gray-100 text-gray-600'

  return (
    <span className={`ml-1 px-1.5 py-0.5 text-xs font-medium rounded ${style}`}>
      {isPositive ? '+' : ''}{change}%
    </span>
  )
}

// Skeleton loader
const SkeletonCell = ({ width = 'w-12' }: { width?: string }) => (
  <div className={`${width} h-6 bg-gray-200 rounded animate-pulse mx-auto`}></div>
)

type SortField = 'name' | 'totalLeads' | 'adSpend' | 'cpl' | 'googleRank' | 'topKeywords'
type SortDirection = 'asc' | 'desc'
type FilterType = 'all' | 'googleAds' | 'seo' | 'gbp' | 'growing' | 'declining'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [clients, setClients] = useState<ClientData[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<string>('last-7-days')
  const [startDate, setStartDate] = useState<Date | null>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  const [endDate, setEndDate] = useState<Date | null>(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [sortField, setSortField] = useState<SortField>('totalLeads')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  // Calculate dates based on selected range - always use startDate and endDate state
  const getDateRange = useCallback(() => {
    if (startDate && endDate) {
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }
    }
    // Fallback to 7 days if no dates set
    const today = new Date()
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    }
  }, [startDate, endDate])

  const handlePresetChange = (preset: string) => {
    setDateRange(preset)
    setShowDatePicker(false)
    setMetricsLoading(true) // Show loading indicator immediately

    const now = new Date()
    // Set time to end of day to avoid timezone issues
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    let start = new Date()

    switch (preset) {
      case 'last-7-days':
        start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'last-30-days':
        start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'last-90-days':
        start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'last-180-days':
        start = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000)
        break
      case 'last-365-days':
        start = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      case 'this-month':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case 'last-month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const end = new Date(today.getFullYear(), today.getMonth(), 0)
        setStartDate(start)
        setEndDate(end)
        return
    }

    setStartDate(start)
    setEndDate(today)
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  // Filter and sort clients
  const filteredClients = useMemo(() => {
    let filtered = [...clients]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.slug.toLowerCase().includes(query)
      )
    }

    // Service/status filter
    switch (activeFilter) {
      case 'googleAds':
        filtered = filtered.filter(c => c.services?.googleAds)
        break
      case 'seo':
        filtered = filtered.filter(c => c.services?.seo)
        break
      case 'gbp':
        filtered = filtered.filter(c => c.services?.googleLocalService)
        break
      case 'growing':
        filtered = filtered.filter(c => c.leadsChange && c.leadsChange > 0)
        break
      case 'declining':
        filtered = filtered.filter(c => c.leadsChange && c.leadsChange < 0)
        break
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: string | number = a[sortField] || 0
      let bVal: string | number = b[sortField] || 0

      if (sortField === 'name') {
        aVal = a.name.toLowerCase()
        bVal = b.name.toLowerCase()
        return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
      }

      return sortDirection === 'asc' ? (Number(aVal) - Number(bVal)) : (Number(bVal) - Number(aVal))
    })

    return filtered
  }, [clients, searchQuery, activeFilter, sortField, sortDirection])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }, [sortField, sortDirection])

  // Fetch data
  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.role !== 'admin') return

    const fetchData = async () => {
      setLoading(true)

      try {
        // Clear browser cache on date change for fresh data
        const { startDate: start, endDate: end } = getDateRange()
        if (!start || !end) {
          setLoading(false)
          return
        }

        // Clear old cache patterns
        clearCachePattern('admin-clients')
        clearCachePattern('admin-overview')

        // Get client list with caching (5 min TTL)
        const listCacheKey = `admin-clients-list`
        const listData = await cachedFetch(listCacheKey, async () => {
          const res = await fetch('/api/admin/clients-list')
          return res.json()
        })

        if (listData.success && listData.clients) {
          const clientsWithLoading = listData.clients.map((c: ClientData) => ({
            ...c,
            isLoading: true
          }))
          setClients(clientsWithLoading)
          setLoading(false)
          setMetricsLoading(true)

          console.log(`⚡ [Admin] Fetching metrics: ${start} to ${end}`)

          // Fetch metrics with caching
          const metricsCacheKey = `admin-overview-${start}-${end}`
          const fastData = await cachedFetch(metricsCacheKey, async () => {
            const res = await fetch(`/api/admin/overview-fast?startDate=${start}&endDate=${end}`)
            return res.json()
          })

          console.log(`⚡ [Admin] Received ${fastData.clients?.length} clients, summary:`, fastData.summary)

          if (fastData.success && fastData.clients) {
            setClients(fastData.clients.map((c: ClientData) => ({
              ...c,
              isLoading: false
            })))
            setSummary(fastData.summary)
          }
          setMetricsLoading(false)
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('Error:', err)
        setLoading(false)
        setMetricsLoading(false)
      }
    }

    fetchData()
  }, [status, session, startDate?.getTime(), endDate?.getTime(), refreshTrigger, getDateRange])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#8B7355] mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session || session.user.role !== 'admin') return null

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <style dangerouslySetInnerHTML={{ __html: calendarStyles }} />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#8B7355]">
              <span className="text-white font-bold text-sm">U</span>
            </div>
            <h1 className="font-semibold text-lg text-gray-900">Client Overview</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:border-[#8B7355]"
              />
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            {/* Date Picker Controls */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
              <button
                onClick={() => handlePresetChange('last-7-days')}
                className={`text-xs px-2 py-1 rounded transition-colors ${dateRange === 'last-7-days' ? 'bg-white shadow-sm font-medium' : 'hover:bg-gray-200'}`}
              >7D</button>
              <button
                onClick={() => handlePresetChange('last-30-days')}
                className={`text-xs px-2 py-1 rounded transition-colors ${dateRange === 'last-30-days' ? 'bg-white shadow-sm font-medium' : 'hover:bg-gray-200'}`}
              >30D</button>
              <button
                onClick={() => handlePresetChange('last-90-days')}
                className={`text-xs px-2 py-1 rounded transition-colors ${dateRange === 'last-90-days' ? 'bg-white shadow-sm font-medium' : 'hover:bg-gray-200'}`}
              >90D</button>
              <button
                onClick={() => handlePresetChange('last-180-days')}
                className={`text-xs px-2 py-1 rounded transition-colors ${dateRange === 'last-180-days' ? 'bg-white shadow-sm font-medium' : 'hover:bg-gray-200'}`}
              >6M</button>
              <button
                onClick={() => handlePresetChange('last-365-days')}
                className={`text-xs px-2 py-1 rounded transition-colors ${dateRange === 'last-365-days' ? 'bg-white shadow-sm font-medium' : 'hover:bg-gray-200'}`}
              >1Y</button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-2 hover:bg-gray-200 rounded px-2 py-1 transition-colors"
              >
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {startDate && endDate
                    ? `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'Custom'}
                </span>
              </button>
            </div>

            {/* Date Picker Dropdown */}
            {showDatePicker && (
              <div className="absolute top-16 right-4 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 min-w-[600px]">
                <div className="flex gap-4">
                  <div className="flex flex-col gap-2 border-r border-gray-200 pr-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Quick Select</h3>
                    {[
                      { value: 'last-7-days', label: 'Last 7 Days' },
                      { value: 'last-30-days', label: 'Last 30 Days' },
                      { value: 'last-90-days', label: 'Last 90 Days' },
                      { value: 'last-180-days', label: 'Last 6 Months' },
                      { value: 'last-365-days', label: 'Last Year' },
                      { value: 'this-month', label: 'This Month' },
                      { value: 'last-month', label: 'Last Month' },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => handlePresetChange(preset.value)}
                        className={`px-4 py-2 rounded-md text-left text-sm transition-colors ${
                          dateRange === preset.value
                            ? 'bg-[#8B7355] text-white'
                            : 'bg-gray-50 text-gray-700 hover:bg-[#F5F0E8]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Custom Range</h3>
                    <DatePicker
                      selected={startDate}
                      onChange={(dates) => {
                        const [start, end] = dates as [Date | null, Date | null]
                        setStartDate(start)
                        setEndDate(end)
                        if (start && end) setDateRange('custom')
                      }}
                      startDate={startDate}
                      endDate={endDate}
                      selectsRange
                      inline
                      monthsShown={2}
                      maxDate={new Date()}
                    />
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        onClick={() => setShowDatePicker(false)}
                        className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                      >Cancel</button>
                      <button
                        onClick={() => {
                          if (startDate && endDate) {
                            setDateRange('custom')
                            setRefreshTrigger(prev => prev + 1)
                            setShowDatePicker(false)
                          }
                        }}
                        className="px-4 py-2 text-sm bg-[#8B7355] text-white rounded-md hover:bg-[#6B5344] disabled:opacity-50"
                        disabled={!startDate || !endDate}
                      >Apply</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Refresh */}
            <button
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              className="p-2 rounded-lg hover:bg-gray-100"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 text-gray-500 ${metricsLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Add Client */}
            <button
              onClick={() => router.push('/admin/add-client')}
              className="flex items-center gap-2 px-3 py-2 bg-[#8B7355] text-white hover:bg-[#6B5344] rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Client
            </button>

            {/* Logout */}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-2 rounded-lg hover:bg-gray-100"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Active Clients */}
          <div className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Active Clients</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-gray-900">
                {loading ? '-' : summary?.totalClients || clients.length}
              </span>
              <Users className="w-8 h-8 text-[#8B7355] opacity-50" />
            </div>
          </div>

          {/* Total Leads */}
          <div className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Total Leads</span>
              {summary && summary.totalLeads > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                  {dateRange === 'last-7-days' ? '7d' :
                   dateRange === 'last-30-days' ? '30d' :
                   dateRange === 'last-90-days' ? '90d' :
                   dateRange === 'last-180-days' ? '6mo' :
                   dateRange === 'last-365-days' ? '1yr' : 'period'}
                </span>
              )}
            </div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-gray-900">
                {loading || metricsLoading ? '-' : formatNumber(summary?.totalLeads || 0)}
              </span>
              <Target className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </div>

          {/* Total Spend */}
          <div className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Ad Spend</span>
              <span className="text-xs text-gray-400" title="CPL = Ad Spend / Ads Conversions">
                CPL: ${summary?.avgCPL || 0}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-gray-900">
                {loading || metricsLoading ? '-' : `$${formatNumber(summary?.totalSpend || 0)}`}
              </span>
              <DollarSign className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {summary?.totalAdsConversions ? `${summary.totalAdsConversions} Ads Conversions` : ''}
            </div>
          </div>

          {/* Needs Attention */}
          <div className={`bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow border-l-4 ${
            (summary?.needsAttention || 0) > 0 ? 'border-yellow-400' : 'border-green-400'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Needs Attention</span>
              {(summary?.needsAttention || 0) > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                  Action Required
                </span>
              )}
            </div>
            <div className="flex items-end justify-between">
              <span className={`text-3xl font-bold ${(summary?.needsAttention || 0) > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                {loading || metricsLoading ? '-' : summary?.needsAttention || 0}
              </span>
              <AlertTriangle className={`w-8 h-8 opacity-50 ${(summary?.needsAttention || 0) > 0 ? 'text-yellow-500' : 'text-green-500'}`} />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                activeFilter === 'all' ? 'bg-[#8B7355] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >All ({clients.length})</button>
            <button
              onClick={() => setActiveFilter('googleAds')}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                activeFilter === 'googleAds' ? 'bg-[#8B7355] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >Google Ads ({clients.filter(c => c.services?.googleAds).length})</button>
            <button
              onClick={() => setActiveFilter('seo')}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                activeFilter === 'seo' ? 'bg-[#8B7355] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >SEO ({clients.filter(c => c.services?.seo).length})</button>
            <button
              onClick={() => setActiveFilter('gbp')}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                activeFilter === 'gbp' ? 'bg-[#8B7355] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >GBP ({clients.filter(c => c.services?.googleLocalService).length})</button>
            <span className="text-gray-300 mx-1">|</span>
            <button
              onClick={() => setActiveFilter('growing')}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                activeFilter === 'growing' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >Growing ({clients.filter(c => c.leadsChange && c.leadsChange > 0).length})</button>
            <button
              onClick={() => setActiveFilter('declining')}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                activeFilter === 'declining' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >Declining ({clients.filter(c => c.leadsChange && c.leadsChange < 0).length})</button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Last updated: 2:00 AM today</span>
            <button className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center gap-1">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Client Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead>
              {/* Group Headers */}
              <tr className="bg-gray-100 border-b border-gray-200">
                <th colSpan={2} className="py-2 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left"></th>
                <th className="py-2 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">All</th>
                <th colSpan={4} className="py-2 px-4 text-xs font-semibold text-blue-600 uppercase tracking-wider text-center bg-blue-50/50">📊 Google Ads</th>
                <th colSpan={2} className="py-2 px-4 text-xs font-semibold text-green-600 uppercase tracking-wider text-center bg-green-50/50">🔍 SEO</th>
                <th className="py-2 px-4 text-xs font-semibold text-orange-600 uppercase tracking-wider text-center bg-orange-50/50">📍 GBP</th>
                <th colSpan={2} className="py-2 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center"></th>
              </tr>
              {/* Column Headers */}
              <tr className="bg-gray-50 border-b border-gray-200">
                <th
                  className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Client
                    {sortField === 'name' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Services</th>
                <th
                  className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalLeads')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Leads
                    {sortField === 'totalLeads' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                {/* Ads Columns */}
                <th className="text-right py-3 px-4 text-xs font-medium text-blue-600 uppercase tracking-wider bg-blue-50/30">Conv</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-blue-600 uppercase tracking-wider bg-blue-50/30">Forms</th>
                <th
                  className="text-right py-3 px-4 text-xs font-medium text-blue-600 uppercase tracking-wider cursor-pointer hover:bg-blue-100/50 bg-blue-50/30"
                  onClick={() => handleSort('adSpend')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Spend
                    {sortField === 'adSpend' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="text-right py-3 px-4 text-xs font-medium text-blue-600 uppercase tracking-wider cursor-pointer hover:bg-blue-100/50 bg-blue-50/30"
                  onClick={() => handleSort('cpl')}
                  title="Cost Per Lead (based on Ads Conversions only)"
                >
                  <div className="flex items-center justify-end gap-1">
                    CPL
                    {sortField === 'cpl' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                {/* SEO Columns */}
                <th
                  className="text-right py-3 px-4 text-xs font-medium text-green-600 uppercase tracking-wider cursor-pointer hover:bg-green-100/50 bg-green-50/30"
                  onClick={() => handleSort('googleRank')}
                  title="Average Google Rank for chiropractic keywords"
                >
                  <div className="flex items-center justify-end gap-1">
                    Rank
                    {sortField === 'googleRank' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="text-right py-3 px-4 text-xs font-medium text-green-600 uppercase tracking-wider cursor-pointer hover:bg-green-100/50 bg-green-50/30"
                  onClick={() => handleSort('topKeywords')}
                  title="Keywords ranking in Top 10"
                >
                  <div className="flex items-center justify-end gap-1">
                    Top 10
                    {sortField === 'topKeywords' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                {/* GBP Column */}
                <th className="text-right py-3 px-4 text-xs font-medium text-orange-600 uppercase tracking-wider bg-orange-50/30">Calls</th>
                {/* Status Columns */}
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredClients.map((client) => {
                const isLoading = client.isLoading
                const statusColor = {
                  excellent: '#10b981',
                  good: '#3b82f6',
                  watch: '#f59e0b',
                  critical: '#ef4444',
                }[client.status || 'good']

                return (
                  <tr
                    key={client.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      client.status === 'critical' ? 'bg-red-50/30' : ''
                    }`}
                    onClick={() => router.push(`/dashboard?clientId=${client.slug}`)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: statusColor }}
                        />
                        <div>
                          <div className="font-medium text-gray-900">{client.name}</div>
                          <div className="text-xs text-gray-500">{client.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {client.services?.googleAds && (
                          <span className="w-6 h-6 rounded bg-blue-100 text-blue-600 text-xs flex items-center justify-center" title="Google Ads">G</span>
                        )}
                        {client.services?.seo && (
                          <span className="w-6 h-6 rounded bg-green-100 text-green-600 text-xs flex items-center justify-center" title="SEO">S</span>
                        )}
                        {client.services?.googleLocalService && (
                          <span className="w-6 h-6 rounded bg-orange-100 text-orange-600 text-xs flex items-center justify-center" title="GBP">B</span>
                        )}
                        {!client.services?.googleAds && !client.services?.seo && !client.services?.googleLocalService && (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isLoading ? (
                        <SkeletonCell />
                      ) : (
                        <>
                          <span className="text-lg font-bold text-gray-900">{client.totalLeads || 0}</span>
                          <ChangeBadge change={client.leadsChange} />
                        </>
                      )}
                    </td>
                    {/* Ads Columns */}
                    <td className="py-3 px-4 text-right text-blue-700 bg-blue-50/20">
                      {isLoading ? <SkeletonCell width="w-8" /> : client.googleAdsConversions || '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-blue-700 bg-blue-50/20">
                      {isLoading ? <SkeletonCell width="w-8" /> : client.formFills || '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-blue-700 bg-blue-50/20">
                      {isLoading ? <SkeletonCell width="w-16" /> : `$${formatNumber(client.adSpend || 0)}`}
                    </td>
                    <td className="py-3 px-4 text-right bg-blue-50/20">
                      {isLoading ? (
                        <SkeletonCell width="w-10" />
                      ) : (
                        <span className={`font-medium ${
                          (client.cpl || 0) > 80 ? 'text-red-600' :
                          (client.cpl || 0) > 50 ? 'text-yellow-600' : 'text-blue-600'
                        }`}>
                          ${client.cpl || 0}
                        </span>
                      )}
                    </td>
                    {/* SEO Columns */}
                    <td className="py-3 px-4 text-right bg-green-50/20">
                      {isLoading ? (
                        <SkeletonCell width="w-8" />
                      ) : client.googleRank ? (
                        <span className={`font-medium ${
                          client.googleRank <= 3 ? 'text-green-600' :
                          client.googleRank <= 10 ? 'text-green-500' :
                          client.googleRank <= 20 ? 'text-yellow-600' : 'text-gray-500'
                        }`}>
                          {client.googleRank}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right bg-green-50/20">
                      {isLoading ? (
                        <SkeletonCell width="w-8" />
                      ) : client.topKeywords ? (
                        <span className={`font-medium ${
                          client.topKeywords >= 10 ? 'text-green-600' :
                          client.topKeywords >= 5 ? 'text-green-500' :
                          client.topKeywords > 0 ? 'text-yellow-600' : 'text-gray-400'
                        }`}>
                          {client.topKeywords}
                        </span>
                      ) : '-'}
                    </td>
                    {/* GBP Column */}
                    <td className="py-3 px-4 text-right text-orange-700 bg-orange-50/20">
                      {isLoading ? <SkeletonCell width="w-8" /> : client.gbpCalls || '-'}
                    </td>
                    {/* Status Columns */}
                    <td className="py-3 px-4">
                      {isLoading ? (
                        <SkeletonCell width="w-16" />
                      ) : (
                        <Sparkline data={client.sparkline || []} color={statusColor} />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isLoading ? (
                        <SkeletonCell width="w-16" />
                      ) : (
                        <StatusBadge status={client.status} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination / Footer */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
            <span className="text-sm text-gray-500">
              Showing {filteredClients.length} of {clients.length} clients
            </span>
          </div>
        </div>

        {/* Alert Banner */}
        {summary && summary.needsAttention > 0 && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 border-l-4 border-l-yellow-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <div>
                  <span className="font-medium text-yellow-800">{summary.needsAttention} clients need attention:</span>
                  <span className="text-yellow-700 text-sm ml-2">
                    {clients.filter(c => c.status === 'critical' || c.status === 'watch').slice(0, 3).map(c => c.name).join(', ')}
                    {summary.needsAttention > 3 && ` and ${summary.needsAttention - 3} more`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveFilter('declining')}
                className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
              >
                View All
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-400">
        Data refreshes daily at 2:00 AM UTC via Vercel Cron
      </footer>
    </div>
  )
}
