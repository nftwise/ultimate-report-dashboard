export interface DetectionContext {
  mean: number
  std: number
  accountAge: number
  cohortPercentile: number
  cohortStats: any
  seasonalBaseline: number
  seasonalStd: number
}

function calculateCovarianceMatrix(data: number[][]): number[][] {
  if (data.length === 0) return []
  const n = data[0].length
  const means = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    means[i] = data.reduce((sum, row) => sum + row[i], 0) / data.length
  }
  const cov: number[][] = Array(n).fill(0).map(() => Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0
      for (let k = 0; k < data.length; k++) {
        sum += (data[k][i] - means[i]) * (data[k][j] - means[j])
      }
      cov[i][j] = sum / (data.length - 1)
    }
  }
  return cov
}

export function calculateMahalanobisDistance(currentMetrics: number[], historicalData: number[][]): number {
  if (historicalData.length < 2) return 0
  
  const n = currentMetrics.length
  const mean = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    mean[i] = historicalData.reduce((sum, row) => sum + row[i], 0) / historicalData.length
  }
  
  const cov = calculateCovarianceMatrix(historicalData)
  
  const diff = currentMetrics.map((val, i) => val - mean[i])
  
  let distance = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (Math.abs(cov[i][j]) > 0.0001) {
        distance += diff[i] * diff[j] / cov[i][j]
      }
    }
  }
  
  return Math.sqrt(Math.max(0, distance))
}

export function detectMultivariateAnomaly(currentVector: number[], historicalMatrix: number[][], threshold: number = 15.09): { isAnomaly: boolean; distance: number; interpretation: string } {
  const distance = calculateMahalanobisDistance(currentVector, historicalMatrix)
  const isAnomaly = distance > threshold
  
  let interpretation = ''
  if (isAnomaly) {
    interpretation = `Multivariate anomaly detected (distance=${distance.toFixed(2)} > ${threshold})`
  } else {
    interpretation = `Within normal multivariate range (distance=${distance.toFixed(2)})`
  }
  
  return { isAnomaly, distance, interpretation }
}
