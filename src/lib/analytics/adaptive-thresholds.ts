export interface ThresholdSet {
  zScoreThreshold: number
  deviationPercent: number
  cusumThreshold: number
}

export interface ThresholdEvaluation {
  isAnomaly: boolean
  triggeredBy: string[]
  severity: 'critical' | 'high' | 'medium' | 'low'
  confidence: number
}

export function getMetricVolatility(metric: string): number {
  const volatilityMap: Record<string, number> = {
    impressions: 0.8,
    clicks: 1.0,
    conversions: 1.5,
    cost: 0.9,
    ctr: 1.1,
    cpc: 1.2,
    cpa: 1.8,
    roas: 1.6,
    quality_score: 1.3,
    conversion_rate: 1.7
  }
  return volatilityMap[metric] || 1.0
}

export function getAdaptiveThresholds(accountAge: number, metric: string, sensitivity: 'high' | 'medium' | 'low'): ThresholdSet {
  const baseThresholds = {
    high: { zScore: 1.96, deviation: 15, cusum: 2.0 },
    medium: { zScore: 2.58, deviation: 20, cusum: 3.0 },
    low: { zScore: 3.29, deviation: 30, cusum: 4.0 }
  }
  
  const base = baseThresholds[sensitivity]
  let maturityMultiplier = 1.0
  if (accountAge < 30) maturityMultiplier = 1.5
  else if (accountAge < 90) maturityMultiplier = 1.25
  
  const volatilityMultiplier = getMetricVolatility(metric)
  
  return {
    zScoreThreshold: base.zScore * maturityMultiplier,
    deviationPercent: base.deviation * maturityMultiplier,
    cusumThreshold: base.cusum * maturityMultiplier * volatilityMultiplier
  }
}

export function evaluateThresholds(metric: string, value: number, context: any): ThresholdEvaluation {
  const triggeredBy: string[] = []
  let maxSeverity: 'critical' | 'high' | 'medium' | 'low' = 'low'
  
  const zScore = (value - context.mean) / context.std
  if (Math.abs(zScore) > 3.29) {
    triggeredBy.push('z_score_extreme')
    maxSeverity = 'critical'
  } else if (Math.abs(zScore) > 2.58) {
    triggeredBy.push('z_score_significant')
    maxSeverity = 'high'
  }
  
  if (context.cohortPercentile <= 5 || context.cohortPercentile >= 95) {
    triggeredBy.push('cohort_outlier')
    if (maxSeverity !== 'critical') maxSeverity = 'high'
  }
  
  const isAnomaly = triggeredBy.length > 0
  const confidence = Math.min(100, (triggeredBy.length / 4) * 100)
  
  return {
    isAnomaly,
    triggeredBy,
    severity: maxSeverity,
    confidence
  }
}
