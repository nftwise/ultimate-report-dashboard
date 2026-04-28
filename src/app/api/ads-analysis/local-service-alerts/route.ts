import { createClient } from '@supabase/supabase-js'
import { stlDecomposition, isSeasonalAnomaly } from '@/lib/analytics/seasonal-decomposition'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  metric: string
  currentValue: number | string
  expectedValue?: number | string
  change?: number
  recommendation: string
}

const BASELINE_DAYS = 14
const ALERT_DURATION_DAYS = 3

const LOCAL_SERVICE_METRICS = {
  impressions: { target: 'stable', lowThreshold: 30, highThreshold: 20 },
  clicks: { target: 'stable', lowThreshold: 25, highThreshold: 20 },
  conversions: { target: 'high', lowThreshold: 40, highThreshold: 0 },
  ctr: { target: 'high', lowThreshold: 30, highThreshold: 0, min: 2 },
  cpc: { target: 'low', lowThreshold: 50, highThreshold: 0 },
  impression_share: { target: 'high', lowThreshold: 15, highThreshold: 0, min: 65 },
  search_lost_is_budget: { target: 'low', lowThreshold: 50, highThreshold: 0, max: 10 },
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return Response.json(
        { success: false, error: 'Missing clientId' },
        { status: 400 }
      )
    }

    // Fetch last 14 days of data
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - BASELINE_DAYS)

    const { data: campaigns, error: campaignsError } = await getSupabase()
      .from('ads_campaigns')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', fourteenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (campaignsError) throw campaignsError

    if (!campaigns || campaigns.length === 0) {
      return Response.json({
        success: true,
        alerts: [],
        message: 'No data available for analysis'
      })
    }

    const alerts: Alert[] = []
    const lastThreeDays = campaigns.slice(-3)
    const allData = campaigns

    // ============================================
    // 1. CONVERSIONS = 0 (CRITICAL)
    // ============================================
    const lastDayConversions = lastThreeDays.reduce((sum, c) => sum + (Number(c.conversions) || 0), 0)
    if (lastDayConversions === 0) {
      alerts.push({
        id: 'conversions-zero',
        severity: 'critical',
        title: 'No Conversions Detected',
        metric: 'Conversions',
        currentValue: '0',
        recommendation: 'Check if conversion tracking is setup in GA4. Verify call tracking is working. Check landing page.',
      })
    }

    // ============================================
    // 2. IMPRESSIONS DROP > 30% (WARNING)
    // ============================================
    const impressionsByDay = allData.reduce((acc: any, c: any) => {
      const date = c.date
      acc[date] = (acc[date] || 0) + Number(c.impressions || 0)
      return acc
    }, {})

    const dates = Object.keys(impressionsByDay).sort()
    if (dates.length >= 7) {
      const last7DaysAvg = dates.slice(-7).reduce((sum, d) => sum + impressionsByDay[d], 0) / 7
      const last3DaysAvg = dates.slice(-3).reduce((sum, d) => sum + impressionsByDay[d], 0) / 3
      const impressionChange = ((last3DaysAvg - last7DaysAvg) / last7DaysAvg) * 100

      if (impressionChange < -30) {
        alerts.push({
          id: 'impressions-drop',
          severity: 'warning',
          title: 'Impressions Declining',
          metric: 'Impressions',
          currentValue: Math.round(last3DaysAvg),
          expectedValue: Math.round(last7DaysAvg),
          change: impressionChange,
          recommendation: 'Check Quality Score (may be too low). Check if Impression Share dropped. Verify bid amount is competitive.',
        })
      }
    }

    // ============================================
    // 3. CLICKS DROP > 25% (WARNING)
    // ============================================
    const clicksByDay = allData.reduce((acc: any, c: any) => {
      const date = c.date
      acc[date] = (acc[date] || 0) + Number(c.clicks || 0)
      return acc
    }, {})

    if (dates.length >= 7) {
      const last7DaysClicksAvg = dates.slice(-7).reduce((sum, d) => sum + clicksByDay[d], 0) / 7
      const last3DaysClicksAvg = dates.slice(-3).reduce((sum, d) => sum + clicksByDay[d], 0) / 3
      const clicksChange = ((last3DaysClicksAvg - last7DaysClicksAvg) / last7DaysClicksAvg) * 100

      if (clicksChange < -25) {
        alerts.push({
          id: 'clicks-drop',
          severity: 'warning',
          title: 'Clicks Declining',
          metric: 'Clicks',
          currentValue: Math.round(last3DaysClicksAvg),
          expectedValue: Math.round(last7DaysClicksAvg),
          change: clicksChange,
          recommendation: 'Check CTR (if low, improve ad copy). Check bid amount. Check if impressions are still stable.',
        })
      }
    }

    // ============================================
    // 4. CTR < 2% (WARNING)
    // ============================================
    const totalLastWeekClicks = dates.slice(-7).reduce((sum, d) => sum + clicksByDay[d], 0)
    const totalLastWeekImpressions = dates.slice(-7).reduce((sum, d) => sum + impressionsByDay[d], 0)
    const currentCTR = (totalLastWeekClicks / totalLastWeekImpressions) * 100

    if (currentCTR < 2) {
      alerts.push({
        id: 'ctr-low',
        severity: 'warning',
        title: 'CTR Below Target',
        metric: 'Click-Through Rate',
        currentValue: currentCTR.toFixed(2) + '%',
        expectedValue: '2%+',
        recommendation: 'Rewrite ad copy to be more compelling. Improve ad extensions. Review keyword relevance.',
      })
    }

    // ============================================
    // 5. CPC SPIKE > 50% (WARNING)
    // ============================================
    const cpcByDay = allData.map(c => ({
      date: c.date,
      cpc: Number(c.cost || 0) / (Number(c.clicks || 1) || 1)
    }))

    if (cpcByDay.length >= 7) {
      const last7DaysCPCAvg = cpcByDay.slice(-7).reduce((sum, d) => sum + d.cpc, 0) / 7
      const last3DaysCPCAvg = cpcByDay.slice(-3).reduce((sum, d) => sum + d.cpc, 0) / 3
      const cpcChange = ((last3DaysCPCAvg - last7DaysCPCAvg) / last7DaysCPCAvg) * 100

      if (cpcChange > 50) {
        alerts.push({
          id: 'cpc-spike',
          severity: 'warning',
          title: 'CPC Increased Significantly',
          metric: 'Cost Per Click',
          currentValue: '$' + last3DaysCPCAvg.toFixed(2),
          expectedValue: '$' + last7DaysCPCAvg.toFixed(2),
          change: cpcChange,
          recommendation: 'Increase Quality Score to lower CPC. Check if competitors raised bids. Consider reducing bid amount.',
        })
      }
    }

    // ============================================
    // 6. IMPRESSION SHARE < 65% (WARNING)
    // ============================================
    const lastWeekImpressionShare = allData
      .slice(-7)
      .reduce((sum, c) => sum + (Number(c.impression_share) || 0), 0) / 7

    if (lastWeekImpressionShare < 65) {
      alerts.push({
        id: 'impression-share-low',
        severity: 'warning',
        title: 'Low Impression Share',
        metric: 'Impression Share',
        currentValue: Math.round(lastWeekImpressionShare) + '%',
        expectedValue: '65%+',
        recommendation: 'Increase daily budget (if Lost IS Budget > 10%). Increase bids (if Lost IS Rank > 20%). Improve Quality Score.',
      })
    }

    // ============================================
    // 7. SEARCH LOST IS - BUDGET > 10% (WARNING)
    // ============================================
    const lastWeekLostISBudget = allData
      .slice(-7)
      .reduce((sum, c) => sum + (Number(c.search_lost_is_budget) || 0), 0) / 7

    if (lastWeekLostISBudget > 10) {
      alerts.push({
        id: 'lost-is-budget',
        severity: 'warning',
        title: 'Budget Running Out (Lost IS)',
        metric: 'Search Lost IS - Budget',
        currentValue: Math.round(lastWeekLostISBudget) + '%',
        expectedValue: '< 10%',
        recommendation: 'Increase daily budget immediately. You\'re missing impressions due to budget constraints.',
      })
    }

    // ============================================
    // 8. SEARCH LOST IS - RANK > 20% (WARNING)
    // ============================================
    const lastWeekLostISRank = allData
      .slice(-7)
      .reduce((sum, c) => sum + (Number(c.search_lost_is_rank) || 0), 0) / 7

    if (lastWeekLostISRank > 20) {
      alerts.push({
        id: 'lost-is-rank',
        severity: 'warning',
        title: 'Not Competitive Enough (Lost IS)',
        metric: 'Search Lost IS - Rank',
        currentValue: Math.round(lastWeekLostISRank) + '%',
        expectedValue: '< 20%',
        recommendation: 'Increase bid amount to be more competitive. Improve Quality Score to lower CPC and improve rank.',
      })
    }

    return Response.json({
      success: true,
      alerts,
      summary: {
        totalAlerts: alerts.length,
        criticalCount: alerts.filter(a => a.severity === 'critical').length,
        warningCount: alerts.filter(a => a.severity === 'warning').length,
        lastAnalyzed: new Date().toISOString(),
      }
    })
  } catch (error) {
    console.error('Error in local-service-alerts:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
