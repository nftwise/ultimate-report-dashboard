import React, { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react'
import { Card } from '@/components/neural/Card'
import { Badge } from '@/components/neural/Badge'

interface ActionStep {
  step: number
  action: string
  priority: 'high' | 'medium' | 'low'
  estimatedMinutes: number
}

interface Hypothesis {
  cause: string
  probability: number
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

interface LeadQualityScore {
  cpa: number
  rating: 'green' | 'yellow' | 'red'
  label: string
  threshold: string
}

interface RootCauseAnalysis {
  alertId: string
  alertType: string
  metric: string
  currentValue: number | string
  expectedValue: number | string
  hypotheses: Hypothesis[]
  leadQualityScore: LeadQualityScore
  recommendedAction: {
    hypothesis: string
    reason: string
    actionSteps: ActionStep[]
  }
}

interface RootCauseAnalysisPanelProps {
  alertId: string
  alertType: string
  clientId: string
  isOpen: boolean
  onClose: () => void
}

export function RootCauseAnalysisPanel({
  alertId,
  alertType,
  clientId,
  isOpen,
  onClose,
}: RootCauseAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<RootCauseAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedHypothesis, setExpandedHypothesis] = useState<number>(0)

  useEffect(() => {
    if (isOpen && alertId) {
      fetchRootCauseAnalysis()
    }
  }, [isOpen, alertId])

  const fetchRootCauseAnalysis = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/ads-analysis/root-cause-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          alertId,
          alertType,
        }),
      })
      if (!res.ok) throw new Error('Failed to fetch analysis')
      const data = await res.json()
      setAnalysis(data.analysis)
    } catch (err) {
      console.error('Failed to fetch root cause analysis:', err)
      setError(err instanceof Error ? err.message : 'Error fetching analysis')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const getLeadQualityColor = (rating: string) => {
    switch (rating) {
      case 'green':
        return 'bg-green-50 border-l-4 border-green-500'
      case 'yellow':
        return 'bg-yellow-50 border-l-4 border-yellow-500'
      case 'red':
        return 'bg-red-50 border-l-4 border-red-500'
      default:
        return 'bg-gray-50'
    }
  }

  const getLeadQualityBadgeColor = (rating: string) => {
    switch (rating) {
      case 'green':
        return 'text-white bg-green-600'
      case 'yellow':
        return 'text-white bg-yellow-600'
      case 'red':
        return 'text-white bg-red-600'
      default:
        return 'text-white bg-gray-600'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-700 bg-red-50'
      case 'medium':
        return 'text-yellow-700 bg-yellow-50'
      case 'low':
        return 'text-blue-700 bg-blue-50'
      default:
        return 'text-gray-700 bg-gray-50'
    }
  }

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'coral'
      case 'medium':
        return 'gold'
      case 'low':
        return 'slate'
      default:
        return 'slate'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl rounded-lg">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Root Cause Analysis</h2>
            <p className="text-sm text-slate-600 mt-1">Alert ID: {alertId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="animate-spin inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <p className="text-sm opacity-60">Analyzing root causes...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
              <p className="text-sm text-red-600">Error: {error}</p>
            </div>
          )}

          {analysis && !loading && (
            <>
              {/* LEAD QUALITY SCORE */}
              <div className={`p-4 rounded-lg ${getLeadQualityColor(analysis.leadQualityScore.rating)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs opacity-60 mb-1">Lead Quality Score</div>
                    <div className="text-2xl font-bold">
                      ${analysis.leadQualityScore.cpa.toFixed(0)}
                      <span className="text-sm opacity-70 ml-2">per lead</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`inline-block px-3 py-1 rounded-full font-semibold text-sm ${getLeadQualityBadgeColor(analysis.leadQualityScore.rating)}`}
                    >
                      {analysis.leadQualityScore.label}
                    </div>
                    <div className="text-xs opacity-70 mt-2">{analysis.leadQualityScore.threshold}</div>
                  </div>
                </div>
              </div>

              {/* RECOMMENDED ACTION */}
              <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900">Recommended Action</h3>
                    <p className="text-sm text-blue-700 mt-1">{analysis.recommendedAction.hypothesis}</p>
                    <p className="text-xs text-blue-600 mt-2 italic">{analysis.recommendedAction.reason}</p>
                  </div>
                </div>

                {/* Action Steps */}
                <div className="space-y-2 mt-4 bg-white rounded p-3">
                  {analysis.recommendedAction.actionSteps.map((step) => (
                    <div key={step.step} className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                        {step.step}
                      </div>
                      <div className="flex-1 pt-0.5">
                        <div className="text-sm font-medium text-slate-900">{step.action}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(step.priority)}`}>
                            {step.priority.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-600">~{step.estimatedMinutes} min</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ALL HYPOTHESES */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  All Hypotheses ({analysis.hypotheses.length})
                </h3>

                <div className="space-y-3">
                  {analysis.hypotheses.map((hypothesis, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
                      {/* Hypothesis Header */}
                      <button
                        onClick={() =>
                          setExpandedHypothesis(expandedHypothesis === idx ? -1 : idx)
                        }
                        className="w-full p-4 hover:bg-slate-50 transition flex items-center justify-between gap-4"
                      >
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl font-bold text-slate-900 min-w-fit">
                              {hypothesis.probability}%
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-slate-900">{hypothesis.cause}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant={getConfidenceBadge(hypothesis.confidence)}>
                                  {hypothesis.confidence.toUpperCase()}
                                </Badge>
                                <span className="text-xs text-slate-600">
                                  {hypothesis.estimatedTimelineHours}h to fix
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {expandedHypothesis === idx ? (
                          <ChevronUp className="w-5 h-5 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-500" />
                        )}
                      </button>

                      {/* Hypothesis Details */}
                      {expandedHypothesis === idx && (
                        <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-4">
                          {/* Evidence */}
                          <div>
                            <h5 className="font-semibold text-sm text-slate-900 mb-2">Evidence</h5>
                            <ul className="space-y-1">
                              {hypothesis.evidence.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Expected Impact */}
                          <div className="bg-white rounded p-3">
                            <h5 className="font-semibold text-sm text-slate-900 mb-2">
                              Expected Impact
                            </h5>
                            <div className="text-sm text-slate-700">
                              <div className="mb-1">
                                <span className="font-medium">Metric:</span> {hypothesis.estimatedImpact.metric}
                              </div>
                              <div>
                                <span className="font-medium">Improvement:</span>{' '}
                                {hypothesis.estimatedImpact.expectedImprovement}
                              </div>
                            </div>
                          </div>

                          {/* Action Steps */}
                          <div>
                            <h5 className="font-semibold text-sm text-slate-900 mb-2">Action Steps</h5>
                            <div className="space-y-2 bg-white rounded p-3">
                              {hypothesis.actionSteps.map((step) => (
                                <div key={step.step} className="flex gap-3 items-start">
                                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                                    {step.step}
                                  </div>
                                  <div className="flex-1 pt-0.5">
                                    <div className="text-sm text-slate-900">{step.action}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(step.priority)}`}
                                      >
                                        {step.priority.toUpperCase()}
                                      </span>
                                      <span className="text-xs text-slate-600">
                                        ~{step.estimatedMinutes} min
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
