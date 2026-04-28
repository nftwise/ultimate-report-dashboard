export interface CohortAssignment {
  industry: string
  size: string
  maturity: string
  geography: string
  campaign_type: string
}

export interface CohortStats {
  p5: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  p95: number
  mean: number
  std: number
  count: number
}

export interface BenchmarkComparison {
  metric: string
  clientValue: number
  cohortP50: number
  cohortP25: number
  cohortP75: number
  clientPercentile: number
  status: 'excellent' | 'above_average' | 'average' | 'below_average' | 'poor'
  gap: number
  interpretation: string
}

export function identifyMaturity(accountAgeDays: number): string {
  if (accountAgeDays < 30) return 'new'
  if (accountAgeDays < 90) return 'growing'
  return 'mature'
}

export function identifySize(monthlyBudgetUSD: number): string {
  if (monthlyBudgetUSD < 500) return 'micro'
  if (monthlyBudgetUSD < 2000) return 'small'
  if (monthlyBudgetUSD < 10000) return 'medium'
  return 'large'
}

export function calculatePercentileRank(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0
  const count = sortedValues.filter(v => v < value).length
  return Math.round((count / sortedValues.length) * 100)
}

export function compareAgainstCohort(clientValue: number, cohortStats: CohortStats, metric: string, higherIsBetter: boolean = true): BenchmarkComparison {
  const gap = ((clientValue - cohortStats.p50) / cohortStats.p50) * 100
  const clientPercentile = calculatePercentileRank(clientValue, [cohortStats.p5, cohortStats.p25, cohortStats.p50, cohortStats.p75, cohortStats.p95])
  
  let status: BenchmarkComparison['status']
  if (higherIsBetter) {
    if (clientPercentile >= 75) status = 'excellent'
    else if (clientPercentile >= 60) status = 'above_average'
    else if (clientPercentile >= 40) status = 'average'
    else if (clientPercentile >= 25) status = 'below_average'
    else status = 'poor'
  } else {
    if (clientPercentile <= 25) status = 'excellent'
    else if (clientPercentile <= 40) status = 'above_average'
    else if (clientPercentile <= 60) status = 'average'
    else if (clientPercentile <= 75) status = 'below_average'
    else status = 'poor'
  }

  let interpretation = ''
  if (status === 'excellent') {
    interpretation = `Your ${metric} is in top 25%. Keep it up!`
  } else if (status === 'poor') {
    interpretation = `Your ${metric} is in bottom 25%. Needs attention.`
  } else if (status === 'below_average') {
    interpretation = `Your ${metric} is below median. Room for improvement.`
  }

  return {
    metric,
    clientValue,
    cohortP50: cohortStats.p50,
    cohortP25: cohortStats.p25,
    cohortP75: cohortStats.p75,
    clientPercentile,
    status,
    gap,
    interpretation
  }
}
