export interface STLResult {
  trend: number[]
  seasonal: number[]
  residual: number[]
}

export interface SeasonalBaseline {
  dayOfWeek: number
  weekOfMonth: number
  month: number
  expectedValue: number
  std: number
  sampleSize: number
}

function calculateStd(data: number[]): number {
  if (data.length < 2) return 0
  const mean = data.reduce((a, b) => a + b, 0) / data.length
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (data.length - 1)
  return Math.sqrt(variance)
}

function movingAverage(data: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(period / 2))
    const end = Math.min(data.length, i + Math.floor(period / 2) + 1)
    const window = data.slice(start, end)
    const avg = window.reduce((a, b) => a + b, 0) / window.length
    result.push(avg)
  }
  return result
}

function extractSeasonalPattern(detrended: number[], period: number): number[] {
  const seasonal = new Array(period).fill(0)
  const counts = new Array(period).fill(0)
  for (let i = 0; i < detrended.length; i++) {
    const pos = i % period
    seasonal[pos] += detrended[i]
    counts[pos]++
  }
  for (let i = 0; i < period; i++) {
    seasonal[i] = counts[i] > 0 ? seasonal[i] / counts[i] : 0
  }
  const seasonalMean = seasonal.reduce((a, b) => a + b, 0) / period
  return seasonal.map(s => s - seasonalMean)
}

export function stlDecomposition(data: number[], period: number = 7): STLResult {
  if (data.length < 2 * period) {
    return { trend: data, seasonal: new Array(data.length).fill(0), residual: new Array(data.length).fill(0) }
  }
  const trend = movingAverage(data, period)
  const detrended = data.map((val, i) => val - trend[i])
  const seasonalPattern = extractSeasonalPattern(detrended, period)
  const seasonal = data.map((_, i) => seasonalPattern[i % period])
  const residual = data.map((val, i) => val - trend[i] - seasonal[i])
  return { trend, seasonal, residual }
}

export function isSeasonalAnomaly(value: number, stl: STLResult, index: number, zScoreThreshold: number = 3): { isAnomaly: boolean; zScore: number; interpretation: string } {
  if (index >= stl.residual.length) return { isAnomaly: false, zScore: 0, interpretation: "Index out of range" }
  const residual = stl.residual[index]
  const residualStd = calculateStd(stl.residual)
  if (residualStd === 0) return { isAnomaly: false, zScore: 0, interpretation: "No variation" }
  const zScore = residual / residualStd
  const isAnomaly = Math.abs(zScore) > zScoreThreshold
  const interpretation = isAnomaly ? `${Math.abs(zScore).toFixed(1)}σ away` : "Within normal variation"
  return { isAnomaly, zScore, interpretation }
}

export function getWeekOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7)
}
