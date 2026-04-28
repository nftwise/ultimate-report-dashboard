import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

interface Hypothesis {
  cause: string
  probability: number // 0-100
  confidence: 'high' | 'medium' | 'low'
  evidence: string[]
  actionSteps: ActionStep[]
  estimatedTimelineHours: number
  estimatedImpact: {
    metric: string
    expectedImprovement: string
    impactValue?: number
  }
}

interface ActionStep {
  step: number
  action: string
  priority: 'high' | 'medium' | 'low'
  estimatedMinutes: number
}

interface RootCauseAnalysis {
  alertId: string
  alertType: string
  metric: string
  currentValue: number | string
  expectedValue: number | string
  hypotheses: Hypothesis[]
  leadQualityScore: {
    cpa: number
    rating: 'green' | 'yellow' | 'red'
    label: string
    threshold: string
  }
  recommendedAction: {
    hypothesis: string
    reason: string
    actionSteps: ActionStep[]
  }
}

// Lead Quality Scoring Logic
function getLeadQualityScore(cpa: number | null) {
  if (cpa === null || cpa === undefined) {
    return { cpa: 0, rating: 'yellow' as const, label: 'Unknown', threshold: 'N/A' }
  }

  if (cpa < 80) {
    return { cpa, rating: 'green' as const, label: 'Good Leads', threshold: '< $80' }
  } else if (cpa <= 120) {
    return { cpa, rating: 'yellow' as const, label: 'Acceptable Leads', threshold: '$80-$120' }
  } else {
    return { cpa, rating: 'red' as const, label: 'Expensive Leads', threshold: '$150+' }
  }
}

// Calculate CPA from campaign data
function calculateCPA(conversions: number, cost: number): number {
  if (conversions === 0) return 0
  return Math.round((cost / conversions) * 100) / 100
}

export async function POST(request: Request) {
  try {
    const { clientId, alertId, alertType, campaignData, last3DaysData, last7DaysData } =
      await request.json()

    if (!clientId || !alertId || !alertType) {
      return Response.json(
        { success: false, error: 'Missing required fields: clientId, alertId, alertType' },
        { status: 400 }
      )
    }

    let hypotheses: Hypothesis[] = []
    let leadQualityScore = getLeadQualityScore(null)

    // Fetch recent campaign data for context
    const { data: recentData } = await getSupabase()
      .from('ads_campaigns')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(30)

    // Calculate CPA from recent data
    const totalConversions = recentData?.reduce((sum, d) => sum + (Number(d.conversions) || 0), 0) || 0
    const totalCost = recentData?.reduce((sum, d) => sum + (Number(d.cost) || 0), 0) || 0
    const currentCPA = calculateCPA(totalConversions, totalCost)
    leadQualityScore = getLeadQualityScore(currentCPA)

    // ============================================
    // ROOT CAUSE ANALYSIS BY ALERT TYPE
    // ============================================

    if (alertType === 'conversions-zero') {
      hypotheses = [
        {
          cause: 'Conversion tracking disabled or broken',
          probability: 60,
          confidence: 'high',
          evidence: [
            'Zero conversions reported for last 3 days',
            'Impressions and clicks still normal',
            'Issue is sudden, not gradual decline',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Check Google Analytics 4 - Verify conversion event is firing',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 2,
              action: 'Check Google Ads conversion tracking status in Settings',
              priority: 'high',
              estimatedMinutes: 3,
            },
            {
              step: 3,
              action: 'Verify conversion pixel/tag is deployed on confirmation page',
              priority: 'high',
              estimatedMinutes: 10,
            },
          ],
          estimatedTimelineHours: 0.5,
          estimatedImpact: {
            metric: 'Conversions',
            expectedImprovement: 'Resume tracking immediately',
            impactValue: 25,
          },
        },
        {
          cause: 'Call tracking number not ringing or forwarding disabled',
          probability: 25,
          confidence: 'medium',
          evidence: [
            'Calls should be counted as conversions for local service',
            'Online conversions might be zero but calls still happening',
            'Common for chiropractors - calls are actual appointments',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Test call tracking number - verify it rings and forwards',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 2,
              action: 'Check call forwarding settings in call tracking platform',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 3,
              action: 'Verify call tracking is linked to Google Ads conversion',
              priority: 'high',
              estimatedMinutes: 10,
            },
          ],
          estimatedTimelineHours: 0.5,
          estimatedImpact: {
            metric: 'Conversions',
            expectedImprovement: 'Restore call tracking data',
            impactValue: 20,
          },
        },
        {
          cause: 'Landing page technical issue or redirects broken',
          probability: 10,
          confidence: 'low',
          evidence: [
            'Visitors may not reach conversion page',
            'Possible redirect chain broken',
            'SSL certificate or page load error',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Test landing page - verify it loads and is accessible',
              priority: 'medium',
              estimatedMinutes: 5,
            },
            {
              step: 2,
              action: 'Check page speed and mobile responsiveness',
              priority: 'medium',
              estimatedMinutes: 5,
            },
            {
              step: 3,
              action: 'Test form submission - ensure form works end-to-end',
              priority: 'high',
              estimatedMinutes: 10,
            },
          ],
          estimatedTimelineHours: 1,
          estimatedImpact: {
            metric: 'Conversions',
            expectedImprovement: 'Restore form submissions',
            impactValue: 15,
          },
        },
      ]
    } else if (alertType === 'impressions-drop') {
      hypotheses = [
        {
          cause: 'Quality Score decreased - ads being shown less frequently',
          probability: 45,
          confidence: 'high',
          evidence: [
            'Impression drop coincides with recent changes',
            'Quality Score impacts ad eligibility and positioning',
            'Most common cause of sudden impression decline',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Check Quality Score in Google Ads - campaign and keyword level',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 2,
              action: 'Review low-performing keywords - disable ones with QS < 5',
              priority: 'high',
              estimatedMinutes: 15,
            },
            {
              step: 3,
              action: 'Improve ad copy relevance to keywords',
              priority: 'high',
              estimatedMinutes: 30,
            },
            {
              step: 4,
              action: 'Improve landing page relevance - ensure fast load time',
              priority: 'medium',
              estimatedMinutes: 20,
            },
          ],
          estimatedTimelineHours: 1.25,
          estimatedImpact: {
            metric: 'Impressions',
            expectedImprovement: 'Restore impressions to baseline',
            impactValue: 30,
          },
        },
        {
          cause: 'Impression Share lost to budget constraints',
          probability: 30,
          confidence: 'high',
          evidence: [
            'Daily budget might be too low',
            'Ads stop showing when budget depleted',
            'Check Lost IS Budget metric > 10%',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Check daily budget in campaign settings',
              priority: 'high',
              estimatedMinutes: 3,
            },
            {
              step: 2,
              action: 'Verify budget was not reduced or capped',
              priority: 'high',
              estimatedMinutes: 3,
            },
            {
              step: 3,
              action: 'Increase daily budget by 15-20% to regain impressions',
              priority: 'high',
              estimatedMinutes: 5,
            },
          ],
          estimatedTimelineHours: 0.25,
          estimatedImpact: {
            metric: 'Impressions',
            expectedImprovement: 'Increase impressions by 15-20%',
            impactValue: 25,
          },
        },
        {
          cause: 'Seasonality or market trend - industry-wide impression drop',
          probability: 15,
          confidence: 'medium',
          evidence: [
            'Need to check if all accounts in cohort dropped impressions',
            'Seasonal factors (holidays, weather) affect search volume',
            'Competitor activity changes',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Compare against industry benchmarks - check cohort performance',
              priority: 'medium',
              estimatedMinutes: 5,
            },
            {
              step: 2,
              action: 'Check Google Trends for search volume changes',
              priority: 'low',
              estimatedMinutes: 10,
            },
          ],
          estimatedTimelineHours: 0.5,
          estimatedImpact: {
            metric: 'Impressions',
            expectedImprovement: 'Understand market context',
            impactValue: 10,
          },
        },
      ]
    } else if (alertType === 'clicks-drop') {
      hypotheses = [
        {
          cause: 'Click-Through Rate (CTR) declined - ad copy not appealing',
          probability: 50,
          confidence: 'high',
          evidence: [
            'If impressions stable but clicks down → CTR issue',
            'Ad copy fatigue or relevance decreased',
            'Ad extensions missing or outdated',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Review current ad copy - compare against historical performance',
              priority: 'high',
              estimatedMinutes: 10,
            },
            {
              step: 2,
              action: 'Refresh ad variations - test new headlines and descriptions',
              priority: 'high',
              estimatedMinutes: 30,
            },
            {
              step: 3,
              action: 'Add/update ad extensions (call, location, promotion)',
              priority: 'high',
              estimatedMinutes: 15,
            },
            {
              step: 4,
              action: 'Test different value propositions - focus on unique selling points',
              priority: 'medium',
              estimatedMinutes: 20,
            },
          ],
          estimatedTimelineHours: 1.25,
          estimatedImpact: {
            metric: 'Clicks',
            expectedImprovement: '10-20% CTR improvement',
            impactValue: 25,
          },
        },
        {
          cause: 'Bid amount too low - ads shown in lower positions',
          probability: 30,
          confidence: 'medium',
          evidence: [
            'Lower position = fewer clicks even with same impressions',
            'Ad position declined recently',
            'Competitors may have increased bids',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Check average ad position - should be < 3 for good CTR',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 2,
              action: 'Review bid strategy - consider target CPA or maximize clicks',
              priority: 'high',
              estimatedMinutes: 10,
            },
            {
              step: 3,
              action: 'Increase bid by 10-15% to improve position',
              priority: 'medium',
              estimatedMinutes: 5,
            },
          ],
          estimatedTimelineHours: 0.5,
          estimatedImpact: {
            metric: 'Clicks',
            expectedImprovement: 'Improve ad position and clicks',
            impactValue: 20,
          },
        },
        {
          cause: 'Impressions also dropped - see impressions-drop analysis',
          probability: 15,
          confidence: 'medium',
          evidence: [
            'If impressions down, clicks will follow automatically',
            'Root cause is impressions, not CTR',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Review impressions-drop root causes first',
              priority: 'high',
              estimatedMinutes: 0,
            },
          ],
          estimatedTimelineHours: 0,
          estimatedImpact: {
            metric: 'Clicks',
            expectedImprovement: 'Fix impressions = fix clicks',
            impactValue: 20,
          },
        },
      ]
    } else if (alertType === 'ctr-low') {
      hypotheses = [
        {
          cause: 'Ad copy not compelling - low engagement messaging',
          probability: 55,
          confidence: 'high',
          evidence: [
            'CTR < 2% indicates ads not attractive',
            'Most common reason for low CTR in local service',
            'Ad copy is first impression',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Write 2-3 new ad variations with stronger value propositions',
              priority: 'high',
              estimatedMinutes: 30,
            },
            {
              step: 2,
              action: 'Test headlines emphasizing benefits (speed, expertise, results)',
              priority: 'high',
              estimatedMinutes: 20,
            },
            {
              step: 3,
              action: 'Use numbers and specifics (e.g., "Same-day appointments", "20+ years")',
              priority: 'high',
              estimatedMinutes: 15,
            },
            {
              step: 4,
              action: 'Test emotional triggers appropriate for healthcare (trust, relief)',
              priority: 'medium',
              estimatedMinutes: 15,
            },
          ],
          estimatedTimelineHours: 1.25,
          estimatedImpact: {
            metric: 'CTR',
            expectedImprovement: '0.5-1.0% CTR increase',
            impactValue: 25,
          },
        },
        {
          cause: 'Keywords too broad - attracting wrong audience',
          probability: 25,
          confidence: 'medium',
          evidence: [
            'Broad keywords show ads to irrelevant searches',
            'People not clicking because not searching for exactly what you offer',
            'Need keyword specificity (long-tail keywords)',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Review keyword list - identify overly broad keywords',
              priority: 'high',
              estimatedMinutes: 15,
            },
            {
              step: 2,
              action: 'Add negative keywords to exclude irrelevant searches',
              priority: 'high',
              estimatedMinutes: 20,
            },
            {
              step: 3,
              action: 'Add more specific long-tail keywords (e.g., "emergency chiro" vs "chiro")',
              priority: 'high',
              estimatedMinutes: 20,
            },
          ],
          estimatedTimelineHours: 1,
          estimatedImpact: {
            metric: 'CTR',
            expectedImprovement: 'Better audience relevance = higher CTR',
            impactValue: 20,
          },
        },
        {
          cause: 'Ad extensions missing - less real estate/appeal',
          probability: 15,
          confidence: 'medium',
          evidence: [
            'Extensions increase click-ability and appear more prominent',
            'Location, call, promotion extensions boost CTR',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Add location extensions - show address and distance',
              priority: 'high',
              estimatedMinutes: 10,
            },
            {
              step: 2,
              action: 'Add call extension - make it easy to call directly',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 3,
              action: 'Add promotion extensions - highlight specials or offers',
              priority: 'medium',
              estimatedMinutes: 10,
            },
          ],
          estimatedTimelineHours: 0.5,
          estimatedImpact: {
            metric: 'CTR',
            expectedImprovement: '0.3-0.5% CTR increase',
            impactValue: 15,
          },
        },
      ]
    } else if (alertType === 'cpc-spike') {
      hypotheses = [
        {
          cause: 'Quality Score decreased - lower score = higher CPC',
          probability: 50,
          confidence: 'high',
          evidence: [
            'Google penalizes low QS with higher CPC',
            'Mathematical relationship: low QS = higher bid needed for same position',
            'Most direct cause of CPC spike',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Review Quality Score trends - identify drop dates',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 2,
              action: 'Find keywords with QS < 5 - replace or improve',
              priority: 'high',
              estimatedMinutes: 20,
            },
            {
              step: 3,
              action: 'Improve landing page - ensure relevance to keywords',
              priority: 'high',
              estimatedMinutes: 30,
            },
            {
              step: 4,
              action: 'Improve expected CTR - rewrite ad copy to be more relevant',
              priority: 'high',
              estimatedMinutes: 20,
            },
          ],
          estimatedTimelineHours: 1.25,
          estimatedImpact: {
            metric: 'CPC',
            expectedImprovement: '10-20% CPC reduction',
            impactValue: 30,
          },
        },
        {
          cause: 'Bid increased - manual bid raise or algorithm adjustment',
          probability: 25,
          confidence: 'medium',
          evidence: [
            'Someone may have manually increased bids',
            'Bid strategy (maximize conversions) may have auto-adjusted',
            'Increased competition may have driven bids up',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Check bid adjustment history - any recent manual changes?',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 2,
              action: 'Review bid strategy settings - is it auto-optimizing?',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 3,
              action: 'Consider switching to target CPA strategy for better cost control',
              priority: 'medium',
              estimatedMinutes: 15,
            },
          ],
          estimatedTimelineHours: 0.5,
          estimatedImpact: {
            metric: 'CPC',
            expectedImprovement: 'Better bid control',
            impactValue: 15,
          },
        },
        {
          cause: 'Search volume spike - more competition = higher bids',
          probability: 15,
          confidence: 'low',
          evidence: [
            'More advertisers bidding = auction prices increase',
            'Seasonal spikes can drive bid increases',
            'Competitor activity changes',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Check search volume trends - did searches increase?',
              priority: 'medium',
              estimatedMinutes: 10,
            },
            {
              step: 2,
              action: 'Monitor competitor activity - are they bidding more?',
              priority: 'low',
              estimatedMinutes: 10,
            },
          ],
          estimatedTimelineHours: 0.5,
          estimatedImpact: {
            metric: 'CPC',
            expectedImprovement: 'Monitor and adapt strategy',
            impactValue: 10,
          },
        },
      ]
    } else if (alertType === 'impression-share-low') {
      hypotheses = [
        {
          cause: 'Budget constraints - daily budget too low',
          probability: 50,
          confidence: 'high',
          evidence: [
            'Low IS often due to budget limiting ad shows',
            'When budget exhausted, ads stop showing',
            'Check Lost IS - Budget metric',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Review daily budget - is it enough for your market?',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 2,
              action: 'Calculate recommended budget based on search volume',
              priority: 'high',
              estimatedMinutes: 10,
            },
            {
              step: 3,
              action: 'Increase daily budget by 20-30% to improve IS',
              priority: 'high',
              estimatedMinutes: 5,
            },
          ],
          estimatedTimelineHours: 0.5,
          estimatedImpact: {
            metric: 'Impression Share',
            expectedImprovement: 'Increase IS to 70%+',
            impactValue: 30,
          },
        },
        {
          cause: 'Bid amount too low - ads not competitive',
          probability: 35,
          confidence: 'medium',
          evidence: [
            'Low bid = ads shown less frequently',
            'Check Lost IS - Rank metric for confirmation',
            'Competitors bidding higher',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Check average position - should be top 3 for good IS',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 2,
              action: 'Review bid strategy - consider target CPA or maximize IS',
              priority: 'high',
              estimatedMinutes: 10,
            },
            {
              step: 3,
              action: 'Increase bid by 15-20% to improve competitiveness',
              priority: 'high',
              estimatedMinutes: 5,
            },
          ],
          estimatedTimelineHours: 0.5,
          estimatedImpact: {
            metric: 'Impression Share',
            expectedImprovement: 'Increase IS to 70%+',
            impactValue: 25,
          },
        },
        {
          cause: 'Quality Score too low - ads less eligible',
          probability: 10,
          confidence: 'medium',
          evidence: [
            'Low QS reduces ad eligibility and position',
            'Google may not show ads if QS very low',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Review QS by keyword - identify low performers',
              priority: 'high',
              estimatedMinutes: 10,
            },
            {
              step: 2,
              action: 'Improve landing page relevance',
              priority: 'high',
              estimatedMinutes: 30,
            },
          ],
          estimatedTimelineHours: 1,
          estimatedImpact: {
            metric: 'Impression Share',
            expectedImprovement: 'Restore impression eligibility',
            impactValue: 15,
          },
        },
      ]
    } else if (alertType === 'lost-is-budget') {
      hypotheses = [
        {
          cause: 'Daily budget is too low for your market',
          probability: 90,
          confidence: 'high',
          evidence: [
            "Lost IS - Budget > 10% confirms budget is the limiter",
            'Ads stop showing when daily budget exhausted',
            'This metric directly measures budget constraint',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Calculate current daily budget utilization rate',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 2,
              action: 'Determine optimal budget needed to reach Lost IS < 5%',
              priority: 'high',
              estimatedMinutes: 10,
            },
            {
              step: 3,
              action: 'Increase daily budget immediately - test with +50% for 1 week',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 4,
              action: 'Monitor results - measure IS recovery and ROI impact',
              priority: 'high',
              estimatedMinutes: 0,
            },
          ],
          estimatedTimelineHours: 0.5,
          estimatedImpact: {
            metric: 'Impression Share',
            expectedImprovement: 'Increase IS by 20-50%',
            impactValue: 50,
          },
        },
      ]
    } else if (alertType === 'lost-is-rank') {
      hypotheses = [
        {
          cause: 'Bid amount insufficient - losing to higher bids',
          probability: 85,
          confidence: 'high',
          evidence: [
            "Lost IS - Rank > 20% confirms rank is the issue",
            'You have budget but ads not shown due to low rank',
            'Competitors bidding higher',
          ],
          actionSteps: [
            {
              step: 1,
              action: 'Review current average position - identify underperformers',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 2,
              action: 'Calculate bid increase needed to reach top 3 positions',
              priority: 'high',
              estimatedMinutes: 10,
            },
            {
              step: 3,
              action: 'Increase bid by 20-30% to improve rank and IS',
              priority: 'high',
              estimatedMinutes: 5,
            },
            {
              step: 4,
              action: 'Alternatively: Improve Quality Score to lower effective CPC',
              priority: 'medium',
              estimatedMinutes: 45,
            },
          ],
          estimatedTimelineHours: 1.25,
          estimatedImpact: {
            metric: 'Impression Share',
            expectedImprovement: 'Increase IS by 15-30%',
            impactValue: 35,
          },
        },
        {
          cause: 'Quality Score declined - lower eligibility',
          probability: 10,
          confidence: 'low',
          evidence: ['Low QS can reduce ad eligibility even with reasonable bids'],
          actionSteps: [
            {
              step: 1,
              action: 'Check QS by keyword - improve low performers',
              priority: 'high',
              estimatedMinutes: 10,
            },
          ],
          estimatedTimelineHours: 0.5,
          estimatedImpact: {
            metric: 'Impression Share',
            expectedImprovement: 'Restore eligibility',
            impactValue: 10,
          },
        },
      ]
    }

    // Find the top hypothesis (highest probability + high confidence)
    const topHypothesis = hypotheses.reduce((prev, current) =>
      (current.probability * (current.confidence === 'high' ? 1.5 : 1)) >
      (prev.probability * (prev.confidence === 'high' ? 1.5 : 1))
        ? current
        : prev
    )

    const recommendedAction = {
      hypothesis: topHypothesis.cause,
      reason: `This hypothesis has ${topHypothesis.probability}% probability and is based on high-confidence signals. It offers the best ROI for effort invested.`,
      actionSteps: topHypothesis.actionSteps,
    }

    const analysis: RootCauseAnalysis = {
      alertId,
      alertType,
      metric: 'Unknown',
      currentValue: 0,
      expectedValue: 0,
      hypotheses: hypotheses.sort((a, b) => b.probability - a.probability),
      leadQualityScore,
      recommendedAction,
    }

    return Response.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in root-cause-analysis:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
