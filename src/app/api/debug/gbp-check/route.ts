import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to check GBP data in database
 * Usage: /api/debug/gbp-check?days=30
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30', 10)

    // Calculate date range
    const dateTo = new Date()
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - days)

    const dateFromStr = dateFrom.toISOString().split('T')[0]
    const dateToStr = dateTo.toISOString().split('T')[0]

    console.log('[gbp-check] Querying GBP data:', { dateFromStr, dateToStr, days })

    // Query 1: Total GBP records in date range
    const { data: gbpRecords, error: gbpError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, date, gbp_calls')
      .gte('date', dateFromStr)
      .lte('date', dateToStr)
      .gt('gbp_calls', 0)

    if (gbpError) {
      return NextResponse.json({ error: gbpError.message }, { status: 500 })
    }

    // Query 2: Get aggregated GBP by client
    const { data: allMetrics, error: allError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, gbp_calls')
      .gte('date', dateFromStr)
      .lte('date', dateToStr)

    if (allError) {
      return NextResponse.json({ error: allError.message }, { status: 500 })
    }

    // Aggregate
    const gbpByClient: { [key: string]: number } = {}
    ;(allMetrics || []).forEach((m: any) => {
      if (!gbpByClient[m.client_id]) gbpByClient[m.client_id] = 0
      gbpByClient[m.client_id] += m.gbp_calls || 0
    })

    // Get client names
    const { data: clients } = await supabaseAdmin
      .from('clients')
      .select('id, name')

    const clientMap: { [key: string]: string } = {}
    ;(clients || []).forEach((c: any) => {
      clientMap[c.id] = c.name
    })

    // Format response
    const gbpByClientName = Object.entries(gbpByClient)
      .filter(([_, calls]) => calls > 0)
      .map(([clientId, calls]) => ({
        clientId,
        clientName: clientMap[clientId] || clientId,
        totalCalls: calls
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls)

    return NextResponse.json({
      dateRange: { from: dateFromStr, to: dateToStr, days },
      totalRecordsChecked: allMetrics?.length || 0,
      recordsWithGBP: gbpRecords?.length || 0,
      clientsWithGBP: Object.keys(gbpByClient).filter(id => gbpByClient[id] > 0).length,
      gbpByClient: gbpByClientName,
      topClients: gbpByClientName.slice(0, 5)
    })
  } catch (error: any) {
    console.error('Error in gbp-check:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
