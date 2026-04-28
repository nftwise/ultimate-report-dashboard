'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from './neural/Header'
import { StatCard, Card } from './neural/Card'
import { Grid, Container } from './neural/Grid'
import { Badge } from './neural/Badge'
import { Loading } from './neural/Loading'
import { TrendingUp, DollarSign, Users, Search, Target, LayoutGrid, Table as TableIcon } from 'lucide-react'
import { formatNumber, formatCurrency } from '@/lib/utils/format-utils'

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

interface NeuralAdminOverviewProps {
  user: {
    email: string
    role: string
  }
}

type SortField = 'name' | 'totalLeads' | 'adSpend' | 'cpl' | 'googleRank'
type SortDirection = 'asc' | 'desc'

// Trend chart icons
const TrendUpChart = () => (
  <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
    <polyline points="0,15 10,12 20,8 30,5 40,2" stroke="#6b9a6f" strokeWidth="2" fill="none"/>
    <polyline points="0,15 10,12 20,8 30,5 40,2 40,20 0,20" fill="rgba(107,154,111,0.1)"/>
  </svg>
)

const TrendDownChart = () => (
  <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
    <polyline points="0,5 10,8 20,12 30,15 40,18" stroke="#c4704f" strokeWidth="2" fill="none"/>
    <polyline points="0,5 10,8 20,12 30,15 40,18 40,20 0,20" fill="rgba(196,112,79,0.1)"/>
  </svg>
)

const TrendStableChart = () => (
  <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
    <line x1="0" y1="10" x2="40" y2="10" stroke="#8B7355" strokeWidth="2"/>
    <rect x="0" y="9" width="40" height="2" fill="rgba(139,115,85,0.1)"/>
  </svg>
)

export default function NeuralAdminOverview({ user }: NeuralAdminOverviewProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [clients, setClients] = useState<ClientData[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [sortField, setSortField] = useState<SortField>('totalLeads')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Date range state
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    new Date()
  ])

  const [startDate, endDate] = dateRange

  // Fetch data from API
  useEffect(() => {
    if (!startDate || !endDate) return

    const fetchData = async () => {
      try {
        setLoading(true)

        const start = startDate.toISOString().split('T')[0]
        const end = endDate.toISOString().split('T')[0]

        // Fetch client list
        const listRes = await fetch('/api/admin/clients-list')
        const listData = await listRes.json()

        if (listData.success && listData.clients) {
          const clientsWithLoading = listData.clients.map((c: ClientData) => ({
            ...c,
            isLoading: true
          }))
          setClients(clientsWithLoading)
          setLoading(false)
          setMetricsLoading(true)

          // Fetch metrics
          const metricsRes = await fetch(`/api/admin/overview-fast?startDate=${start}&endDate=${end}`)
          const metricsData = await metricsRes.json()

          if (metricsData.success && metricsData.clients) {
            const clientsWithData = metricsData.clients.map((c: ClientData) => ({
              ...c,
              isLoading: false
            }))
            setClients(clientsWithData)
            setSummary(metricsData.summary)
          }
          setMetricsLoading(false)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Error fetching admin overview:', error)
        setLoading(false)
        setMetricsLoading(false)
      }
    }

    fetchData()
  }, [startDate, endDate])

  const handleDateChange = (dates: [Date | null, Date | null]) => {
    setDateRange(dates)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

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
  }, [clients, searchQuery, sortField, sortDirection])

  const handleClientClick = useCallback((clientSlug: string) => {
    router.push(`/dashboard?clientId=${clientSlug}`)
  }, [router])

  const getStatusClass = useCallback((status?: string) => {
    switch (status) {
      case 'excellent': return 'status-excellent'
      case 'good': return 'status-good'
      case 'watch': return 'status-watch'
      case 'critical': return 'status-critical'
      default: return 'status-good'
    }
  }, [])

  const getStatusLabel = useCallback((status?: string) => {
    switch (status) {
      case 'excellent': return 'Excellent'
      case 'good': return 'Good'
      case 'watch': return 'Watch'
      case 'critical': return 'Critical'
      default: return 'Good'
    }
  }, [])

  const getTrendChart = useCallback((leadsChange?: number | null) => {
    if (leadsChange === null || leadsChange === undefined) {
      return <TrendStableChart />
    }
    if (leadsChange > 5) {
      return <TrendUpChart />
    } else if (leadsChange < -5) {
      return <TrendDownChart />
    } else {
      return <TrendStableChart />
    }
  }, [])

  if (loading) {
    return <Loading text="Loading team overview..." />
  }

  const totalLeads = summary?.totalLeads || 0
  const totalSpend = summary?.totalSpend || 0
  const avgCPL = summary?.avgCPL || 0
  const totalClients = summary?.totalClients || 0

  // Mock last updated timestamp (in real app, this would come from API)
  const lastUpdated = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago

  return (
    <div className="min-h-screen">
      {/* Header */}
      <Header
        user={user}
        showDatePicker={true}
        startDate={startDate || undefined}
        endDate={endDate || undefined}
        onDateChange={handleDateChange}
      />

      {/* Hero Section */}
      <div
        className="py-16 lg:py-20"
        style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)' }}
      >
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10">
          <div className="text-center">
            <div className="text-sm font-semibold mb-4 tracking-wide" style={{ color: 'white', opacity: 0.9 }}>
              TEAM OVERVIEW
            </div>
            <h1 className="text-5xl lg:text-7xl font-black mb-4" style={{ color: 'white' }}>
              Client Performance
            </h1>
            <p className="text-lg opacity-90" style={{ color: 'white' }}>
              {startDate && endDate && (
                <>
                  {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                  {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-12">
        {/* Summary Stats */}
        <section className="mb-8 animate-fade-in">
          <Grid columns={4} className="stagger-children">
            <StatCard
              label="Total Clients"
              value={formatNumber(totalClients)}
              change={{ value: 12.5, isPositive: true, label: 'vs last month' }}
              lastUpdated={lastUpdated}
            />
            <StatCard
              label="Total Leads"
              value={formatNumber(totalLeads)}
              change={{ value: 8.3, isPositive: true, label: 'vs last month' }}
              lastUpdated={lastUpdated}
            />
            <StatCard
              label="Total Ad Spend"
              value={formatCurrency(totalSpend)}
              change={{ value: 2.1, isPositive: false, label: 'optimization' }}
              lastUpdated={lastUpdated}
            />
            <StatCard
              label="Avg. Cost Per Lead"
              value={formatCurrency(avgCPL)}
              change={{ value: 5.7, isPositive: false, label: 'efficiency' }}
              lastUpdated={lastUpdated}
            />
          </Grid>
        </section>

        {/* Monthly Leads Trend Chart */}
        <section className="mb-8">
          <Card className="p-6">
            <h2 className="text-2xl font-black mb-6" style={{ color: 'var(--text-primary)' }}>
              Monthly Leads Trend
            </h2>
            {(() => {
              // Calculate monthly leads from client data
              const monthlyData: Record<string, number> = {}

              // Get last 6 months
              const months = []
              for (let i = 5; i >= 0; i--) {
                const d = new Date()
                d.setMonth(d.getMonth() - i)
                const monthKey = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                months.push(monthKey)
                monthlyData[monthKey] = 0
              }

              // Simulate monthly data (in real app, this would come from API)
              // For now, distribute total leads across months with variation
              months.forEach((month, idx) => {
                const baseLeads = totalLeads / 6
                const variance = (Math.sin(idx) * 0.3 + 1) * baseLeads
                monthlyData[month] = Math.round(variance)
              })

              const maxLeads = Math.max(...Object.values(monthlyData))

              const minLeads = Math.min(...Object.values(monthlyData))
              const dataRange = maxLeads - minLeads

              return (
                <div className="space-y-4">
                  {/* Line Chart like Google Analytics */}
                  <div className="relative h-80 overflow-visible pt-8">
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-8 bottom-10 w-16 flex flex-col justify-between text-xs pr-2 text-right" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                      <span>{formatNumber(maxLeads)}</span>
                      <span>{formatNumber(Math.round((maxLeads + minLeads) / 2))}</span>
                      <span>{formatNumber(minLeads)}</span>
                    </div>

                    {/* Grid lines - more visible */}
                    <div className="absolute left-20 right-4 top-8 bottom-10 flex flex-col justify-between">
                      <div className="border-t" style={{ borderColor: 'rgba(0,0,0,0.1)' }} />
                      <div className="border-t" style={{ borderColor: 'rgba(0,0,0,0.1)' }} />
                      <div className="border-t" style={{ borderColor: 'rgba(0,0,0,0.1)' }} />
                    </div>

                    {/* Chart area */}
                    <svg
                      className="absolute left-20 right-4 top-8 bottom-10 w-[calc(100%-6rem)] h-[calc(100%-4.5rem)]"
                      viewBox="0 0 1000 200"
                      preserveAspectRatio="none"
                      style={{ overflow: 'hidden' }}
                    >
                      {/* Area fill */}
                      <defs>
                        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" style={{ stopColor: 'var(--sage)', stopOpacity: 0.2 }} />
                          <stop offset="100%" style={{ stopColor: 'var(--sage)', stopOpacity: 0 }} />
                        </linearGradient>
                      </defs>

                      {/* Build smooth path */}
                      {(() => {
                        const chartPoints = months.map((month, idx) => {
                          const leads = monthlyData[month]
                          const x = (idx / (months.length - 1)) * 1000
                          const y = 200 - ((leads - minLeads) / dataRange) * 200
                          return { x, y, leads, month }
                        })

                        // Create area path
                        const areaPath = `
                          M 0,200
                          L ${chartPoints.map(p => `${p.x},${p.y}`).join(' L ')}
                          L 1000,200
                          Z
                        `

                        // Create line path
                        const linePath = `M ${chartPoints.map(p => `${p.x},${p.y}`).join(' L ')}`

                        return (
                          <>
                            {/* Area */}
                            <path
                              d={areaPath}
                              fill="url(#areaGradient)"
                            />
                            {/* Line */}
                            <path
                              d={linePath}
                              fill="none"
                              stroke="var(--sage)"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </>
                        )
                      })()}
                    </svg>

                    {/* Data points with hover tooltips */}
                    <div className="absolute left-20 right-4 top-8 bottom-10 w-[calc(100%-6rem)] h-[calc(100%-4.5rem)]">
                      {months.map((month, idx) => {
                        const leads = monthlyData[month]
                        const x = (idx / (months.length - 1)) * 100
                        const y = 100 - ((leads - minLeads) / dataRange) * 100

                        // Determine if tooltip should show above or below based on y position
                        const showTooltipBelow = y < 30

                        return (
                          <div
                            key={month}
                            className="absolute group"
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          >
                            {/* Larger hover area for easier interaction */}
                            <div className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer" />

                            {/* Data point - larger and more visible */}
                            <div
                              className="w-4 h-4 rounded-full border-[3px] bg-white transition-all group-hover:w-5 group-hover:h-5 group-hover:border-4 shadow-sm"
                              style={{ borderColor: 'var(--sage)' }}
                            />

                            {/* Tooltip - responsive position with better styling */}
                            <div
                              className={`absolute left-1/2 -translate-x-1/2 ${showTooltipBelow ? 'top-full mt-3' : 'bottom-full mb-3'} px-4 py-2.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none shadow-xl z-10`}
                              style={{
                                backgroundColor: 'var(--bg-primary)',
                                border: '2px solid var(--sage)',
                              }}
                            >
                              <div className="text-xs font-bold mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                                {month}
                              </div>
                              <div className="text-lg font-black" style={{ color: 'var(--sage)' }}>
                                {formatNumber(leads)}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                leads
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* X-axis labels */}
                    <div className="absolute left-20 right-4 bottom-0 h-10 flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                      {months.map((month) => (
                        <span key={month} className="flex-1 text-center">{month.split(' ')[0]}</span>
                      ))}
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="text-center">
                      <div className="text-xs opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Highest Month</div>
                      <div className="text-lg font-black" style={{ color: 'var(--coral)' }}>
                        {formatNumber(maxLeads)}
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {(() => {
                          const maxMonth = months.find(m => monthlyData[m] === maxLeads)
                          return maxMonth?.split(' ')[0]
                        })()}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Lowest Month</div>
                      <div className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
                        {formatNumber(minLeads)}
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {(() => {
                          const minMonth = months.find(m => monthlyData[m] === minLeads)
                          return minMonth?.split(' ')[0]
                        })()}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Average</div>
                      <div className="text-lg font-black" style={{ color: 'var(--sage)' }}>
                        {formatNumber(Math.round(totalLeads / 6))}
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        per month
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </Card>
        </section>

        {/* Top Metrics Section */}
        <section className="mb-8">
          <div className="top-metrics-container">
            <h2 className="text-2xl font-black mb-6" style={{ color: 'var(--text-primary)' }}>
              Top Metrics
            </h2>

            <div className="metrics-grid">
              {/* Top Performers */}
              <div className="metric-card">
                <div className="metric-header">
                  <h3 className="metric-title">Top Performers</h3>
                  <span className="metric-count">{filteredClients.filter(c => c.status === 'excellent').length}</span>
                </div>
                <div className="metric-list">
                  {filteredClients
                    .filter(c => c.status === 'excellent')
                    .slice(0, 3)
                    .map((client) => (
                      <div key={client.id} className="metric-item" onClick={() => handleClientClick(client.slug)}>
                        <div className="metric-item-content">
                          <div className="metric-client-name">{client.name}</div>
                          <div className="metric-client-meta">
                            {client.leadsChange && client.leadsChange > 0 ? (
                              <span style={{ color: 'var(--sage)' }}>↑ {client.leadsChange}% growth</span>
                            ) : (
                              <span>{formatNumber(client.totalLeads || 0)} leads</span>
                            )}
                          </div>
                        </div>
                        <div className="metric-value" style={{ color: 'var(--sage)' }}>
                          {formatCurrency(client.cpl || 0)}
                        </div>
                      </div>
                    ))}
                  {filteredClients.filter(c => c.status === 'excellent').length === 0 && (
                    <div className="metric-empty">No excellent performers yet</div>
                  )}
                </div>
              </div>

              {/* Needs Attention */}
              <div className="metric-card">
                <div className="metric-header">
                  <h3 className="metric-title">Needs Attention</h3>
                  <span className="metric-count" style={{ color: 'var(--coral)' }}>
                    {filteredClients.filter(c => c.status === 'critical' || c.status === 'watch').length}
                  </span>
                </div>
                <div className="metric-list">
                  {filteredClients
                    .filter(c => c.status === 'critical' || c.status === 'watch')
                    .slice(0, 3)
                    .map((client) => (
                      <div key={client.id} className="metric-item" onClick={() => handleClientClick(client.slug)}>
                        <div className="metric-item-content">
                          <div className="metric-client-name">{client.name}</div>
                          <div className="metric-client-meta">
                            {client.leadsChange && client.leadsChange < 0 ? (
                              <span style={{ color: 'var(--coral)' }}>↓ {Math.abs(client.leadsChange)}% decline</span>
                            ) : (
                              <span>{client.status === 'critical' ? 'Critical' : 'Watch'}</span>
                            )}
                          </div>
                        </div>
                        <div className="metric-value" style={{ color: 'var(--coral)' }}>
                          {client.leadsChange && client.leadsChange < 0 ? `${client.leadsChange}%` : formatCurrency(client.cpl || 0)}
                        </div>
                      </div>
                    ))}
                  {filteredClients.filter(c => c.status === 'critical' || c.status === 'watch').length === 0 && (
                    <div className="metric-empty">All clients performing well</div>
                  )}
                </div>
              </div>

              {/* Growth Opportunities */}
              <div className="metric-card">
                <div className="metric-header">
                  <h3 className="metric-title">Growth Opportunities</h3>
                  <span className="metric-count" style={{ color: 'var(--accent)' }}>
                    {filteredClients.filter(c => {
                      const hasAllServices = c.services?.googleAds && c.services?.seo && c.services?.googleLocalService
                      return !hasAllServices
                    }).length}
                  </span>
                </div>
                <div className="metric-list">
                  {filteredClients
                    .filter(c => {
                      const hasAllServices = c.services?.googleAds && c.services?.seo && c.services?.googleLocalService
                      return !hasAllServices
                    })
                    .slice(0, 3)
                    .map((client) => {
                      const missingServices = []
                      if (!client.services?.googleAds) missingServices.push('Ads')
                      if (!client.services?.seo) missingServices.push('SEO')
                      if (!client.services?.googleLocalService) missingServices.push('GBP')

                      return (
                        <div key={client.id} className="metric-item" onClick={() => handleClientClick(client.slug)}>
                          <div className="metric-item-content">
                            <div className="metric-client-name">{client.name}</div>
                            <div className="metric-client-meta">
                              <span>Add {missingServices[0]}</span>
                            </div>
                          </div>
                          <div className="metric-value" style={{ color: 'var(--accent)' }}>
                            💰
                          </div>
                        </div>
                      )
                    })}
                  {filteredClients.filter(c => {
                    const hasAllServices = c.services?.googleAds && c.services?.seo && c.services?.googleLocalService
                    return !hasAllServices
                  }).length === 0 && (
                    <div className="metric-empty">All clients fully serviced</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Search Bar */}
        <section className="mb-8">
          <Card>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search clients by name or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 text-lg border-none focus:outline-none"
                style={{
                  background: 'white',
                  color: 'var(--text-primary)',
                  borderRadius: '16px'
                }}
              />
            </div>
          </Card>
        </section>

        {/* Table / Cards */}
        <section>
          <div className="table-container-card">
            <div className="table-header">
              <h2 className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
                Client Performance {filteredClients.length > 0 && `(${filteredClients.length})`}
              </h2>

              <div className="view-toggle">
                <button
                  className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                >
                  <TableIcon className="w-4 h-4 inline mr-2" />
                  Table View
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewMode('cards')}
                >
                  <LayoutGrid className="w-4 h-4 inline mr-2" />
                  Card View
                </button>
              </div>
            </div>

            {metricsLoading && (
              <div className="text-center py-8">
                <div className="neural-spinner mb-4 mx-auto" />
                <p className="text-sm opacity-60">Loading metrics...</p>
              </div>
            )}

            {viewMode === 'table' ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="neural-table">
                  <thead>
                    <tr>
                      <th className="client-name-cell sortable" onClick={() => handleSort('name')} style={{ fontWeight: 900 }}>
                        CLIENT {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="services-cell" style={{ fontWeight: 900 }}>SERVICES</th>
                      <th className="metric-cell sortable" onClick={() => handleSort('totalLeads')} style={{ fontWeight: 900 }}>
                        TOTAL LEADS {sortField === 'totalLeads' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="metric-cell sortable" onClick={() => handleSort('adSpend')} style={{ fontWeight: 900 }}>
                        AD SPEND {sortField === 'adSpend' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="metric-cell sortable" onClick={() => handleSort('cpl')} style={{ fontWeight: 900 }}>
                        CPL {sortField === 'cpl' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="metric-cell sortable" onClick={() => handleSort('googleRank')} style={{ fontWeight: 900 }}>
                        SEO RANK {sortField === 'googleRank' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="metric-cell" style={{ fontWeight: 900 }}>GBP CALLS</th>
                      <th className="metric-cell" style={{ fontWeight: 900 }}>ADS CONV.</th>
                      <th className="metric-cell" style={{ fontWeight: 900 }}>TREND</th>
                      <th className="metric-cell" style={{ fontWeight: 900 }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr key={client.id} onClick={() => handleClientClick(client.slug)}>
                        <td className="client-name-cell">
                          <div className="client-name">{client.name}</div>
                          <div className="client-slug">@{client.slug}</div>
                        </td>
                        <td className="services-cell">
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {client.services?.seo && <Badge variant="gold">SEO</Badge>}
                            {client.services?.googleAds && <Badge variant="slate">Ads</Badge>}
                            {client.services?.googleLocalService && <Badge variant="sage">GBP</Badge>}
                            {client.services?.fbAds && <Badge variant="coral">Facebook</Badge>}
                          </div>
                        </td>
                        <td className="metric-cell">
                          {client.isLoading ? (
                            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                          ) : (
                            <span className="metric-value">{formatNumber(client.totalLeads || 0)}</span>
                          )}
                        </td>
                        <td className="metric-cell">
                          {client.isLoading ? (
                            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                          ) : (
                            <span className="metric-value">{formatCurrency(client.adSpend || 0)}</span>
                          )}
                        </td>
                        <td className="metric-cell">
                          {client.isLoading ? (
                            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                          ) : (
                            <span className="metric-value">{formatCurrency(client.cpl || 0)}</span>
                          )}
                        </td>
                        <td className="metric-cell">
                          {client.isLoading ? (
                            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                          ) : client.googleRank ? (
                            <>
                              <span className="metric-value">#{client.googleRank}</span>
                              {client.topKeywords && (
                                <span className="metric-label">{client.topKeywords} Keywords</span>
                              )}
                            </>
                          ) : (
                            <span className="metric-value">-</span>
                          )}
                        </td>
                        <td className="metric-cell">
                          {client.isLoading ? (
                            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                          ) : (
                            <span className="metric-value">{formatNumber(client.gbpCalls || 0)}</span>
                          )}
                        </td>
                        <td className="metric-cell">
                          {client.isLoading ? (
                            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                          ) : (
                            <span className="metric-value">
                              {client.googleAdsConversions ? formatNumber(client.googleAdsConversions) : '-'}
                            </span>
                          )}
                        </td>
                        <td className="metric-cell">
                          {client.isLoading ? (
                            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {getTrendChart(client.leadsChange)}
                            </div>
                          )}
                        </td>
                        <td className="metric-cell">
                          {client.isLoading ? (
                            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                          ) : (
                            <Badge
                              variant={
                                client.status === 'excellent' ? 'sage' :
                                client.status === 'good' ? 'gold' :
                                client.status === 'watch' ? 'slate' :
                                'coral'
                              }
                            >
                              {getStatusLabel(client.status)}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Grid columns={3}>
                {filteredClients.map((client) => (
                  <Card
                    key={client.id}
                    className="cursor-pointer hover:shadow-xl transition-all duration-300"
                    onClick={() => handleClientClick(client.slug)}
                  >
                    {/* Client Name & Status */}
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h4 className="text-xl font-bold mb-2" style={{ color: 'var(--chocolate)' }}>
                          {client.name}
                        </h4>
                        <p className="text-sm opacity-50">@{client.slug}</p>
                      </div>
                      {client.status && (
                        <Badge
                          variant={
                            client.status === 'excellent' ? 'sage' :
                            client.status === 'good' ? 'gold' :
                            client.status === 'watch' ? 'slate' :
                            'coral'
                          }
                        >
                          {client.status}
                        </Badge>
                      )}
                    </div>

                    {/* Services */}
                    {client.services && (
                      <div className="flex gap-2 mb-6 flex-wrap">
                        {client.services.googleAds && <Badge variant="slate">Google Ads</Badge>}
                        {client.services.seo && <Badge variant="sage">SEO</Badge>}
                        {client.services.googleLocalService && <Badge variant="gold">GBP</Badge>}
                        {client.services.fbAds && <Badge variant="coral">Facebook</Badge>}
                      </div>
                    )}

                    {/* Metrics */}
                    {client.isLoading ? (
                      <div className="space-y-4">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm opacity-70">Total Leads</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{formatNumber(client.totalLeads || 0)}</span>
                            {client.leadsChange !== null && client.leadsChange !== undefined && (
                              <span
                                className="text-xs font-semibold"
                                style={{
                                  color: client.leadsChange > 0 ? 'var(--sage)' : 'var(--coral)'
                                }}
                              >
                                {client.leadsChange > 0 ? '+' : ''}{client.leadsChange}%
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-sm opacity-70">Ad Spend</span>
                          <span className="font-bold">{formatCurrency(client.adSpend || 0)}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-sm opacity-70">Cost Per Lead</span>
                          <span className="font-bold">{formatCurrency(client.cpl || 0)}</span>
                        </div>

                        {client.googleRank && (
                          <div className="flex justify-between">
                            <span className="text-sm opacity-70">Google Rank</span>
                            <span className="font-bold">#{client.googleRank}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </Grid>
            )}

            {filteredClients.length === 0 && !metricsLoading && (
              <div className="text-center py-16">
                <p className="text-lg opacity-50">No clients found matching "{searchQuery}"</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
