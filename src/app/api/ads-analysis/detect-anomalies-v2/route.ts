import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { stlDecomposition, isSeasonalAnomaly } from '@/lib/analytics/seasonal-decomposition'
import { compareAgainstCohort } from '@/lib/analytics/cohort-benchmarking'
import { calculateMahalanobisDistance } from '@/lib/analytics/multivariate-detection'
import { getAdaptiveThresholds } from '@/lib/analytics/adaptive-thresholds'

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId')
    const sensitivity = (request.nextUrl.searchParams.get('sensitivity') as 'high' | 'medium' | 'low') || 'medium'
    const dateRange = parseInt(request.nextUrl.searchParams.get('dateRange') || '30')

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })
    }

    // Fetch historical metrics
    const { data: metrics, error: metricsError } = await supabaseAdmin
      .from('ads_campaign_metrics')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000).toISOString())
      .order('date', { ascending: false })

    if (metricsError || !metrics) {
      return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
    }

    // Group by campaign
    const campaignMetrics: Record<string, any[]> = {}
    for (const m of metrics) {
      if (!campaignMetrics[m.campaign_id]) {
        campaignMetrics[m.campaign_id] = []
      }
      campaignMetrics[m.campaign_id].push(m)
    }

    const anomalies: any[] = []
    const keyMetrics = ['ctr', 'cpa', 'roas', 'quality_score', 'conversion_rate']

    for (const [campaignId, data] of Object.entries(campaignMetrics)) {
      const sortedData = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      
      for (const metric of keyMetrics) {
        const values = sortedData.map((d: any) => d[metric] || 0).filter((v: number) => !isNaN(v))
        
        if (values.length >= 7) {
          const stl = stlDecomposition(values, 7)
          const lastValue = values[values.length - 1]
          const lastDate = sortedData[sortedData.length - 1].date
          
          const seasonal = isSeasonalAnomaly(lastValue, stl, values.length - 1)
          
          if (seasonal.isAnomaly) {
            const mean = values.reduce((a: number, b: number) => a + b) / values.length
            const std = Math.sqrt(values.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2)) / (values.length - 1))
            
            anomalies.push({
              campaign_id: campaignId,
              metric: metric,
              current_value: lastValue,
              expected_value: mean,
              z_score: seasonal.zScore,
              confidence: Math.min(100, Math.abs(seasonal.zScore) * 10),
              detected_at: lastDate,
              interpretation: seasonal.interpretation
            })
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        clientId,
        sensitivity,
        dateRange,
        anomalies: anomalies.sort((a, b) => b.confidence - a.confidence).slice(0, 20),
        summary: {
          total_anomalies: anomalies.length,
          critical: anomalies.filter((a: any) => a.confidence > 80).length,
          high: anomalies.filter((a: any) => a.confidence > 60 && a.confidence <= 80).length,
          medium: anomalies.filter((a: any) => a.confidence > 40 && a.confidence <= 60).length
        }
      }
    })
  } catch (error) {
    console.error('Error in detect-anomalies-v2:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
