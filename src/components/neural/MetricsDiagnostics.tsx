import React from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react'

interface DiagnosticIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'good'
  metric: string
  value: string | number
  target: string
  issue: string
  fixes: string[]
}

interface MetricsDiagnosticsProps {
  conversions: number
  clicks: number
  spend: number
  impressions: number
  conversionValue: number
  ctr: number
  cpc: number
  cpa: number
  roas: number
  convRate: number
  qualityScore: number
  impressionShare: number
  targetCPA?: number
}

export function MetricsDiagnostics({
  conversions,
  clicks,
  spend,
  impressions,
  conversionValue,
  ctr,
  cpc,
  cpa,
  roas,
  convRate,
  qualityScore,
  impressionShare,
  targetCPA = 100
}: MetricsDiagnosticsProps) {
  const issues: DiagnosticIssue[] = []

  // 1. Check Conversions Tracking
  if (conversions === 0) {
    issues.push({
      severity: 'critical',
      metric: 'Conversions',
      value: 0,
      target: '> 0',
      issue: 'Conversion tracking may not be setup correctly',
      fixes: ['Verify GA4 implementation', 'Check conversion pixel', 'Test conversion tracking']
    })
  }

  // 2. Check Conversion Rate
  if (conversions > 0 && convRate < 1) {
    issues.push({
      severity: 'high',
      metric: 'Conversion Rate',
      value: convRate.toFixed(2) + '%',
      target: '> 2%',
      issue: 'Landing page conversion rate is very low',
      fixes: ['A/B test landing page', 'Improve page speed', 'Reduce form fields', 'Test mobile']
    })
  }

  // 3. Check CPA vs Target
  if (cpa > targetCPA * 1.2) {
    issues.push({
      severity: 'high',
      metric: 'CPA',
      value: `$${cpa.toFixed(2)}`,
      target: `$${targetCPA}`,
      issue: 'Cost per acquisition above target',
      fixes: ['Improve ad copy if CTR low', 'Optimize landing page if conversion rate low']
    })
  }

  // 4. Check CTR
  if (ctr < 1) {
    issues.push({
      severity: 'high',
      metric: 'CTR',
      value: ctr.toFixed(2) + '%',
      target: '> 2%',
      issue: 'Click-through rate is below average',
      fixes: ['Rewrite ad copy', 'Add ad extensions', 'Review keywords']
    })
  }

  // 5. Check Quality Score
  if (qualityScore < 5) {
    issues.push({
      severity: 'high',
      metric: 'Quality Score',
      value: qualityScore,
      target: '> 7',
      issue: 'Quality score is low',
      fixes: ['Improve ad relevance', 'Optimize landing page', 'Test keywords']
    })
  }

  // 6. Check Impression Share
  if (impressionShare < 50) {
    issues.push({
      severity: 'medium',
      metric: 'Impression Share',
      value: impressionShare.toFixed(1) + '%',
      target: '> 80%',
      issue: 'Missing market share',
      fixes: ['Increase budget', 'Increase bid', 'Improve Quality Score']
    })
  }

  // 7. Check ROAS
  if (roas < 1 && conversions > 0) {
    issues.push({
      severity: 'critical',
      metric: 'ROAS',
      value: roas.toFixed(2) + ':1',
      target: '> 3:1',
      issue: 'Losing money! ROAS below break-even',
      fixes: ['Reduce bid', 'Pause underperforming keywords', 'Review margins']
    })
  }

  const criticalCount = issues.filter(i => i.severity === 'critical').length
  const highCount = issues.filter(i => i.severity === 'high').length

  let statusColor: string
  let statusMessage: string

  if (criticalCount > 0) {
    statusColor = 'var(--coral)'
    statusMessage = `🚨 CRITICAL: ${criticalCount} issue(s)`
  } else if (highCount > 0) {
    statusColor = 'var(--accent)'
    statusMessage = `⚠️ WARNING: ${highCount} opportunity(ies)`
  } else {
    statusColor = 'var(--sage)'
    statusMessage = `✅ HEALTHY: Campaign performing well`
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5" style={{ color: 'var(--coral)' }} />
      case 'high':
        return <AlertTriangle className="w-5 h-5" style={{ color: 'var(--accent)' }} />
      default:
        return <Info className="w-5 h-5" style={{ color: 'var(--slate)' }} />
    }
  }

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'rgba(196, 112, 79, 0.08)'
      case 'high':
        return 'rgba(217, 168, 84, 0.08)'
      default:
        return 'rgba(92, 88, 80, 0.08)'
    }
  }

  return (
    <div className="w-full space-y-6">
      {/* Overall Status */}
      <div
        className="p-6 rounded-xl border"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.5)',
          borderColor: statusColor,
          borderLeft: `4px solid ${statusColor}`
        }}
      >
        <div className="text-lg font-black" style={{ color: statusColor }}>
          {statusMessage}
        </div>
        <div className="text-sm opacity-60 mt-1">
          {issues.length} item(s) to address
        </div>
      </div>

      {/* Issues List */}
      {issues.length > 0 && (
        <div className="space-y-3">
          {issues.map((issue, idx) => (
            <div
              key={idx}
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: getSeverityBg(issue.severity),
                borderColor: 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getSeverityIcon(issue.severity)}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm mb-1">{issue.metric}</div>
                  <div className="text-xs opacity-70 mb-2">{issue.issue}</div>
                  <div className="flex gap-4 text-xs mb-2">
                    <div><span className="opacity-60">Current: </span>{issue.value}</div>
                    <div><span className="opacity-60">Target: </span>{issue.target}</div>
                  </div>
                  <div className="text-xs space-y-1">
                    {issue.fixes.map((fix, i) => (
                      <div key={i}>• {fix}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}