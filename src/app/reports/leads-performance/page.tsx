'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'

interface ClientPerformance {
  name: string
  total_leads: number
  ads_conversions: number
  gbp_calls: number
  seo_form_submits: number
  is_active: boolean
}

export default function LeadsPerformancePage() {
  const [data, setData] = useState<ClientPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/clients/all-clients')
        const result = await res.json()

        if (!result.success) {
          setError(result.error || 'Failed to fetch data')
          return
        }

        // Filter active clients and sort by total leads
        const activeClients = result.clients
          .filter((c: any) => c.is_active)
          .sort((a: any, b: any) => b.total_leads - a.total_leads)

        setData(activeClients)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="text-center">
          <p className="text-gray-600">Loading data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="text-center">
          <p className="text-red-600">Error: {error}</p>
        </div>
      </div>
    )
  }

  const chartData = data.map(client => ({
    name: client.name.substring(0, 20),
    fullName: client.name,
    'Total Leads': client.total_leads,
    'Ads': client.ads_conversions,
    'SEO': client.seo_form_submits,
    'GBP': client.gbp_calls
  }))

  // Summary stats
  const totalLeads = data.reduce((sum, c) => sum + c.total_leads, 0)
  const totalAds = data.reduce((sum, c) => sum + c.ads_conversions, 0)
  const totalSEO = data.reduce((sum, c) => sum + c.seo_form_submits, 0)
  const totalGBP = data.reduce((sum, c) => sum + c.gbp_calls, 0)

  // Top 10 clients
  const top10 = chartData.slice(0, 10)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Leads Performance Report</h1>
          <p className="text-slate-600">Total leads by channel - Last 30 days</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-slate-600 text-sm font-medium">Total Leads</p>
            <p className="text-3xl font-bold text-slate-900">{totalLeads}</p>
            <p className="text-xs text-slate-500 mt-2">{data.length} active clients</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-slate-600 text-sm font-medium">Ads Conversions</p>
            <p className="text-3xl font-bold text-amber-600">{totalAds}</p>
            <p className="text-xs text-slate-500 mt-2">{((totalAds / totalLeads) * 100).toFixed(1)}% of total</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-slate-600 text-sm font-medium">SEO Forms</p>
            <p className="text-3xl font-bold text-emerald-600">{totalSEO}</p>
            <p className="text-xs text-slate-500 mt-2">{((totalSEO / totalLeads) * 100).toFixed(1)}% of total</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-slate-600 text-sm font-medium">GBP Calls</p>
            <p className="text-3xl font-bold text-blue-600">{totalGBP}</p>
            <p className="text-xs text-slate-500 mt-2">
              {totalGBP === 0 ? '⚠️ No data' : `${((totalGBP / totalLeads) * 100).toFixed(1)}% of total`}
            </p>
          </div>
        </div>

        {/* Top 10 Clients Chart */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Top 10 Clients - Total Leads</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={top10} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={120}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value) => value}
                labelFormatter={(label) => `${label}`}
              />
              <Legend />
              <Bar dataKey="Total Leads" fill="#c4704f" name="Total Leads" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Channel Breakdown Chart */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Top 10 Clients - Channel Breakdown</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={top10} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={120}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend />
              <Bar dataKey="Ads" fill="#d9a854" name="Ads Conversions" />
              <Bar dataKey="SEO" fill="#9db5a0" name="SEO Forms" />
              <Bar dataKey="GBP" fill="#60a5fa" name="GBP Calls" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* All Clients Table */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">All Active Clients Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">#</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Client Name</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Total Leads</th>
                  <th className="px-4 py-3 text-right font-semibold text-amber-600">Ads</th>
                  <th className="px-4 py-3 text-right font-semibold text-emerald-600">SEO</th>
                  <th className="px-4 py-3 text-right font-semibold text-blue-600">GBP</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Ads %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.map((client, idx) => (
                  <tr key={client.name} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-slate-600">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{client.name}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {client.total_leads}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600 font-medium">
                      {client.ads_conversions}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                      {client.seo_form_submits}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 font-medium">
                      {client.gbp_calls}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {client.total_leads > 0
                        ? `${((client.ads_conversions / client.total_leads) * 100).toFixed(0)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* GBP Data Notice */}
        {totalGBP > 0 && (
          <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
            <p className="text-blue-800">
              <strong>Note:</strong> GBP (Google Business Profile) calls include historical data that may extend beyond the 30-day period.
              Standard metrics (Leads, Ads, SEO) show last 30 days, while GBP shows all available data.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
