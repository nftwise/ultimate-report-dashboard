import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/db/supabase';

/**
 * GET /api/ads-analysis/detect-anomalies?clientId=xxx&metric=clicks&lookbackDays=30&sensitivity=medium
 * Detect anomalies in campaign metrics using multiple statistical methods
 */

interface AnomalyScore {
  z_score: number;
  p_value: number;
  cusum: number;
  isolation_forest?: number;
}

interface AnomalyResult {
  campaign_id: string;
  campaign_name: string;
  metric: string;
  detected_at: string;
  value: number;
  expected: number;
  deviation_percent: number;
  scores: AnomalyScore;
  is_anomaly: boolean;
  anomaly_type: 'spike' | 'drop' | 'drift' | 'pattern_break';
  confidence: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  likely_cause: string;
  suggested_action: string;
}

// Z-Score Calculation with Bonferroni Correction
function calculateZScore(value: number, mean: number, std: number, n: number = 1): { z: number; p: number } {
  if (std === 0) return { z: 0, p: 1 };
  
  const z = (value - mean) / std;
  
  // Approximate p-value from z-score
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  
  return { z, p: pValue };
}

// Normal CDF approximation (Abramowitz and Stegun)
function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * z);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;
  
  const y = 1.0 - (a5 * t5 + a4 * t4 + a3 * t3 + a2 * t2 + a1 * t) * Math.exp(-z * z);
  
  return 0.5 * (1.0 + sign * y);
}

// CUSUM (Cumulative Sum Control Chart)
function calculateCUSUM(data: number[], target: number, drift: number = 0.5): number {
  if (data.length === 0) return 0;
  
  const std = calculateStd(data);
  const k = drift * std;
  const h = 5 * std;
  
  let cusum = 0;
  for (let i = 0; i < data.length; i++) {
    cusum = Math.max(0, cusum + (data[i] - target - k));
    if (cusum > h) {
      return cusum;
    }
  }
  
  return cusum;
}

// Calculate standard deviation
function calculateStd(data: number[]): number {
  if (data.length < 2) return 0;
  
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (data.length - 1);
  
  return Math.sqrt(variance);
}

// Isolation Forest Score (simplified)
function calculateIsolationForestScore(dataPoint: number, recentData: number[]): number {
  if (recentData.length < 3) return 0.5;
  
  const sorted = [...recentData].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  
  if (iqr === 0) return 0.5;
  
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  
  if (dataPoint < lower) {
    return Math.min(1.0, (lower - dataPoint) / Math.max(1, iqr));
  } else if (dataPoint > upper) {
    return Math.min(1.0, (dataPoint - upper) / Math.max(1, iqr));
  }
  
  return 0;
}

// Determine anomaly type
function determineAnomalyType(current: number, expected: number, cusum: number, std: number): 'spike' | 'drop' | 'drift' | 'pattern_break' {
  const deviation = current - expected;
  const deviationPercent = Math.abs(deviation) / Math.max(1, expected) * 100;
  
  if (cusum > 3 * std) {
    return 'drift';
  } else if (deviationPercent > 50) {
    return deviation > 0 ? 'spike' : 'drop';
  } else if (deviationPercent > 20) {
    return 'pattern_break';
  }
  
  return 'pattern_break';
}

// Calculate confidence score
function calculateConfidence(zScore: number, cusum: number, isolationForest: number, std: number, businessRule: boolean): number {
  let confidence = 0;
  
  if (Math.abs(zScore) > 2) confidence += 0.3;
  if (Math.abs(zScore) > 3) confidence += 0.15;
  
  if (cusum > 2) confidence += 0.3;
  
  if (isolationForest > 0.5) confidence += 0.2;
  
  if (businessRule) confidence += 0.1;
  
  return Math.min(1.0, confidence);
}

// Determine severity
function determineSeverity(deviationPercent: number, confidence: number): 'critical' | 'high' | 'medium' | 'low' {
  if (confidence > 0.9 && deviationPercent > 50) return 'critical';
  if (confidence > 0.8 && deviationPercent > 30) return 'high';
  if (confidence > 0.7 && deviationPercent > 15) return 'medium';
  return 'low';
}

// Generate root cause
function generateRootCause(metric: string, anomalyType: string, value: number, expected: number): string {
  const direction = value > expected ? 'increase' : 'decrease';
  
  if (anomalyType === 'spike') {
    if (metric === 'clicks') return 'Unexpected traffic volume change';
    if (metric === 'cost') return 'Unexpected ad spend change';
    return `Sudden ${direction} in ${metric}`;
  } else if (anomalyType === 'drop') {
    if (metric === 'clicks') return 'Possible quality score degradation or bid reduction';
    if (metric === 'conversions') return 'Possible tracking issue or landing page problem';
    return `Sustained ${direction} in ${metric}`;
  } else if (anomalyType === 'drift') {
    return `Gradual ${direction} indicating performance trend`;
  }
  
  return 'Pattern change detected';
}

// Generate action
function generateAction(anomalyType: string, metric: string, severity: string): string {
  if (severity === 'critical') {
    return 'Immediate review required. Check campaign settings and account health.';
  }
  
  if (anomalyType === 'spike') {
    return `Investigate sudden ${metric} change. Review bids, budgets, and quality scores.`;
  } else if (anomalyType === 'drop') {
    return `Monitor ${metric} trend. Consider adjusting bids or reviewing ad copy.`;
  }
  
  return 'Continue monitoring for further changes.';
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const metric = (searchParams.get('metric') || 'clicks') as string;
    const lookbackDays = parseInt(searchParams.get('lookbackDays') || '30', 10);
    const sensitivity = (searchParams.get('sensitivity') || 'medium') as 'low' | 'medium' | 'high';

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    // Fetch historical data
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('ads_campaign_metrics')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (campaignsError || !campaigns || campaigns.length === 0) {
      return NextResponse.json({ error: 'No campaign data found' }, { status: 404 });
    }

    // Group by campaign
    const campaignGroups = new Map<string, any[]>();
    campaigns.forEach((campaign: any) => {
      const key = campaign.campaign_id || 'unknown';
      if (!campaignGroups.has(key)) {
        campaignGroups.set(key, []);
      }
      campaignGroups.get(key)!.push(campaign);
    });

    // Analyze each campaign
    const anomalies: AnomalyResult[] = [];

    campaignGroups.forEach((data, campaignId) => {
      if (data.length < 7) return;

      const metricValues = data.map((d: any) => d[metric] || 0).filter((v: number) => !isNaN(v) && v >= 0);
      if (metricValues.length < 7) return;

      const lastValue = metricValues[metricValues.length - 1];
      const baselineValues = metricValues.slice(0, -1);

      const mean = baselineValues.reduce((a: number, b: number) => a + b, 0) / baselineValues.length;
      const std = calculateStd(baselineValues);

      // Z-Score
      const { z: zScore, p: pValue } = calculateZScore(lastValue, mean, std);

      // CUSUM
      const cusum = calculateCUSUM(baselineValues, mean);

      // Isolation Forest
      const isolationScore = calculateIsolationForestScore(lastValue, baselineValues);

      // Confidence
      const confidenceThreshold = sensitivity === 'high' ? 0.6 : sensitivity === 'medium' ? 0.7 : 0.8;
      const confidence = calculateConfidence(zScore, cusum / Math.max(1, std), isolationScore, std, Math.abs(zScore) > 2);

      if (confidence > confidenceThreshold && Math.abs(zScore) > 1.5) {
        const deviationPercent = Math.abs((lastValue - mean) / Math.max(1, mean) * 100);
        const anomalyType = determineAnomalyType(lastValue, mean, cusum, std);
        const severity = determineSeverity(deviationPercent, confidence);

        anomalies.push({
          campaign_id: campaignId,
          campaign_name: data[0].campaign_name || campaignId,
          metric,
          detected_at: new Date().toISOString(),
          value: lastValue,
          expected: mean,
          deviation_percent: deviationPercent,
          scores: {
            z_score: zScore,
            p_value: pValue,
            cusum: cusum / Math.max(1, std),
            isolation_forest: isolationScore,
          },
          is_anomaly: true,
          anomaly_type: anomalyType,
          confidence,
          severity,
          likely_cause: generateRootCause(metric, anomalyType, lastValue, mean),
          suggested_action: generateAction(anomalyType, metric, severity),
        });
      }
    });

    anomalies.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      success: true,
      data: {
        clientId,
        metric,
        lookbackDays,
        sensitivity,
        analysisDate: new Date().toISOString(),
        anomalies: anomalies.slice(0, 20),
        summary: {
          total_analyzed: campaignGroups.size,
          anomalies_found: anomalies.length,
          critical_count: anomalies.filter((a) => a.severity === 'critical').length,
          high_count: anomalies.filter((a) => a.severity === 'high').length,
          avg_confidence: anomalies.length > 0 ? anomalies.reduce((sum, a) => sum + a.confidence, 0) / anomalies.length : 0,
        },
      },
    });
  } catch (error: any) {
    console.error('Error detecting anomalies:', error);
    return NextResponse.json({ error: 'Failed to detect anomalies', details: error.message }, { status: 500 });
  }
}
