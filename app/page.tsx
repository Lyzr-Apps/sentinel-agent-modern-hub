'use client'

import { useState, useEffect } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Shield, Activity, TrendingUp, Settings, FileText, BarChart3, Menu, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

// TypeScript interfaces based on actual response data
interface ExecutionStep {
  step_number?: number
  action: string
  expected_outcome?: string
  considerations?: string
}

interface TimelineEvent {
  stage: string
  agent: string
  outcome: string
}

interface GovernanceResult {
  workflow_status: string
  final_decision: 'APPROVE' | 'MODIFY' | 'BLOCK' | 'CLARIFY' | 'APPROVE_WITH_CONDITIONS'
  task_overview: {
    original_task: string
    task_category: string
    complexity_level: string
  }
  execution_plan: {
    plan_version: number
    task_summary: string
    execution_steps: (string | ExecutionStep)[]
    resources_required: string[]
    estimated_duration: string
  }
  risk_evaluation: {
    decision: string
    overall_risk_score: number
    severity_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    risk_breakdown: {
      safety_score: number
      irreversibility_score: number
      ethics_score: number
      financial_score: number
      reputation_score: number
    }
    evaluation_summary: string
    specific_concerns?: string[]
    modification_guidance?: string | null
    blocked_reasons?: string[] | null
    clarification_requests?: string | null
    approved_with_conditions?: string | null
  }
  workflow_timeline: TimelineEvent[]
  next_steps: string
  replanning_count: number
  user_action_required?: string | null
}

interface AuditEntry {
  id: string
  timestamp: string
  task: string
  decision: string
  severity: string
  riskScore: number
  overridden: boolean
  overrideJustification?: string
  fullResult: GovernanceResult
}

// Constants
const GOVERNANCE_COORDINATOR_ID = '698599bc5eb49186d63e5d70'

const TASK_CONTEXTS = [
  'Business Operations',
  'Financial',
  'Code Deployment',
  'Customer Communication',
  'Data Management',
  'Marketing Campaign',
]

export default function Home() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'audit' | 'analytics' | 'settings'>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Dashboard state
  const [currentTask, setCurrentTask] = useState('')
  const [taskContext, setTaskContext] = useState('Business Operations')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<GovernanceResult | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Override modal state
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideJustification, setOverrideJustification] = useState('')
  const [overrideAcknowledged, setOverrideAcknowledged] = useState(false)

  // Audit log state
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [auditFilters, setAuditFilters] = useState({
    decision: 'All',
    severity: 'All',
    search: '',
  })
  const [expandedAuditRows, setExpandedAuditRows] = useState<Set<string>>(new Set())

  // Load audit log from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('sentinel_audit_log')
    if (stored) {
      try {
        setAuditLog(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to load audit log', e)
      }
    }
  }, [])

  // Save audit log to localStorage whenever it changes
  useEffect(() => {
    if (auditLog.length > 0) {
      localStorage.setItem('sentinel_audit_log', JSON.stringify(auditLog))
    }
  }, [auditLog])

  const analyzeTask = async () => {
    if (!currentTask.trim()) {
      setError('Please enter a task description')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setAnalysisResult(null)

    try {
      const result = await callAIAgent(
        `Task: ${currentTask}\nContext: ${taskContext}`,
        GOVERNANCE_COORDINATOR_ID
      )

      console.log('AI Agent Response:', result)

      if (result.success && result.response.status === 'success') {
        let governanceResult: GovernanceResult

        // Handle different response structures
        const responseData = result.response.result

        console.log('Response Data:', responseData)

        // Check if result is already a GovernanceResult or if it's wrapped
        if (responseData && typeof responseData === 'object') {
          // If response has the expected structure directly
          if ('workflow_status' in responseData && 'final_decision' in responseData) {
            governanceResult = responseData as GovernanceResult
          }
          // If response is wrapped in another result object
          else if (responseData.result && typeof responseData.result === 'object') {
            governanceResult = responseData.result as GovernanceResult
          }
          // If response is a string that needs parsing
          else if (typeof responseData === 'string') {
            try {
              const parsed = JSON.parse(responseData)
              governanceResult = parsed.result || parsed
            } catch (parseError) {
              console.error('Failed to parse response string:', parseError)
              setError('Failed to parse agent response')
              return
            }
          } else {
            governanceResult = responseData as GovernanceResult
          }

          console.log('Parsed Governance Result:', governanceResult)

          // Validate the governance result has required fields
          if (!governanceResult.final_decision || !governanceResult.risk_evaluation) {
            console.error('Invalid governance result structure:', governanceResult)
            setError('Invalid response structure from agent')
            return
          }

          setAnalysisResult(governanceResult)

          // Save to audit log
          const auditEntry: AuditEntry = {
            id: `audit_${Date.now()}`,
            timestamp: new Date().toISOString(),
            task: currentTask,
            decision: governanceResult.final_decision,
            severity: governanceResult.risk_evaluation.severity_level,
            riskScore: governanceResult.risk_evaluation.overall_risk_score,
            overridden: false,
            fullResult: governanceResult,
          }

          setAuditLog(prev => [auditEntry, ...prev])
        } else {
          console.error('Invalid response data:', responseData)
          setError('Invalid response from agent')
        }
      } else {
        const errorMsg = result.error || result.response?.message || 'Analysis failed. Please try again.'
        console.error('Agent call failed:', errorMsg, result)
        setError(errorMsg)
      }
    } catch (err) {
      console.error('Error in analyzeTask:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const toggleStep = (index: number) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedSteps(newExpanded)
  }

  const handleOverride = () => {
    if (!analysisResult) return

    if (overrideJustification.length < 50) {
      alert('Justification must be at least 50 characters')
      return
    }

    if (!overrideAcknowledged) {
      alert('You must acknowledge responsibility')
      return
    }

    // Update audit log with override
    setAuditLog(prev => {
      const updated = [...prev]
      if (updated.length > 0) {
        updated[0] = {
          ...updated[0],
          overridden: true,
          overrideJustification,
        }
      }
      return updated
    })

    setShowOverrideModal(false)
    setOverrideJustification('')
    setOverrideAcknowledged(false)

    alert('Override recorded. This action has been logged in the audit trail.')
  }

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'APPROVE':
        return 'bg-green-600'
      case 'APPROVE_WITH_CONDITIONS':
        return 'bg-yellow-600'
      case 'MODIFY':
        return 'bg-yellow-600'
      case 'CLARIFY':
        return 'bg-yellow-600'
      case 'BLOCK':
        return 'bg-red-600'
      default:
        return 'bg-gray-600'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getRiskMeterColor = (score: number) => {
    if (score <= 3) return 'bg-green-500'
    if (score <= 5) return 'bg-yellow-500'
    if (score <= 7) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const toggleAuditRow = (id: string) => {
    const newExpanded = new Set(expandedAuditRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedAuditRows(newExpanded)
  }

  const filteredAuditLog = auditLog.filter(entry => {
    if (auditFilters.decision !== 'All' && entry.decision !== auditFilters.decision) {
      return false
    }
    if (auditFilters.severity !== 'All' && entry.severity !== auditFilters.severity) {
      return false
    }
    if (auditFilters.search && !entry.task.toLowerCase().includes(auditFilters.search.toLowerCase())) {
      return false
    }
    return true
  })

  // Analytics calculations
  const decisionCounts = auditLog.reduce((acc, entry) => {
    acc[entry.decision] = (acc[entry.decision] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const severityCounts = auditLog.reduce((acc, entry) => {
    acc[entry.severity] = (acc[entry.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const overrideRate = auditLog.length > 0
    ? ((auditLog.filter(e => e.overridden).length / auditLog.length) * 100).toFixed(1)
    : '0.0'

  const avgRiskScore = auditLog.length > 0
    ? (auditLog.reduce((sum, e) => sum + e.riskScore, 0) / auditLog.length).toFixed(1)
    : '0.0'

  return (
    <div className="min-h-screen bg-black text-gray-100">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-950 border-b border-cyan-900/30 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-cyan-400" />
              <div>
                <h1 className="text-xl font-bold text-cyan-400">SENTINEL</h1>
                <p className="text-xs text-gray-400">AI Governance Control Tower</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-cyan-600 text-cyan-400 bg-cyan-950/30">
              <Activity className="h-3 w-3 mr-1" />
              System Active
            </Badge>
          </div>
        </div>
      </header>

      {/* Layout */}
      <div className="flex pt-20">
        {/* Sidebar */}
        <aside
          className={`fixed left-0 top-20 bottom-0 w-64 bg-gray-950 border-r border-cyan-900/30 transition-transform duration-300 z-40 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
        >
          <nav className="p-4 space-y-2">
            <Button
              variant={currentPage === 'dashboard' ? 'default' : 'ghost'}
              className={`w-full justify-start ${
                currentPage === 'dashboard'
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  : 'text-gray-300 hover:text-cyan-400 hover:bg-cyan-950/30'
              }`}
              onClick={() => setCurrentPage('dashboard')}
            >
              <Shield className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button
              variant={currentPage === 'audit' ? 'default' : 'ghost'}
              className={`w-full justify-start ${
                currentPage === 'audit'
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  : 'text-gray-300 hover:text-cyan-400 hover:bg-cyan-950/30'
              }`}
              onClick={() => setCurrentPage('audit')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Audit Log
            </Button>
            <Button
              variant={currentPage === 'analytics' ? 'default' : 'ghost'}
              className={`w-full justify-start ${
                currentPage === 'analytics'
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  : 'text-gray-300 hover:text-cyan-400 hover:bg-cyan-950/30'
              }`}
              onClick={() => setCurrentPage('analytics')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            <Button
              variant={currentPage === 'settings' ? 'default' : 'ghost'}
              className={`w-full justify-start ${
                currentPage === 'settings'
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  : 'text-gray-300 hover:text-cyan-400 hover:bg-cyan-950/30'
              }`}
              onClick={() => setCurrentPage('settings')}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </nav>

          {/* Sidebar Stats */}
          <div className="p-4 mt-8 border-t border-cyan-900/30">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-3">System Stats</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Reviews</span>
                <span className="text-cyan-400 font-semibold">{auditLog.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avg Risk</span>
                <span className="text-cyan-400 font-semibold">{avgRiskScore}/10</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Override Rate</span>
                <span className="text-cyan-400 font-semibold">{overrideRate}%</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : ''}`}>
          <div className="p-6 max-w-7xl mx-auto">
            {/* Dashboard Page */}
            {currentPage === 'dashboard' && (
              <div className="space-y-6">
                {/* Task Input Area */}
                <Card className="bg-gray-900 border-cyan-900/30">
                  <CardHeader>
                    <CardTitle className="text-cyan-400">Task Submission</CardTitle>
                    <CardDescription className="text-gray-400">
                      Submit a task for governance review and risk evaluation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="task-input" className="text-gray-300">Task Description</Label>
                      <Textarea
                        id="task-input"
                        placeholder="Enter task for governance review (e.g., 'Send promotional email to all customers with 50% discount code')"
                        value={currentTask}
                        onChange={(e) => setCurrentTask(e.target.value)}
                        className="mt-2 min-h-[100px] bg-gray-950 border-cyan-900/30 text-gray-100 placeholder:text-gray-600 focus:border-cyan-600 focus:ring-cyan-600"
                        disabled={isAnalyzing}
                      />
                    </div>

                    <div>
                      <Label htmlFor="context-select" className="text-gray-300">Task Context</Label>
                      <Select value={taskContext} onValueChange={setTaskContext} disabled={isAnalyzing}>
                        <SelectTrigger id="context-select" className="mt-2 bg-gray-950 border-cyan-900/30 text-gray-100 focus:border-cyan-600 focus:ring-cyan-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-950 border-cyan-900/30">
                          {TASK_CONTEXTS.map(ctx => (
                            <SelectItem key={ctx} value={ctx} className="text-gray-100 focus:bg-cyan-950/50 focus:text-cyan-400">
                              {ctx}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {error && (
                      <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-red-400 font-semibold mb-1">Analysis Error</h4>
                            <p className="text-red-300 text-sm">{error}</p>
                            <p className="text-red-400/70 text-xs mt-2">
                              Check the browser console (F12) for more details.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={analyzeTask}
                      disabled={isAnalyzing || !currentTask.trim()}
                      className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Control Tower Analyzing...
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          Submit Task
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Loading State */}
                {isAnalyzing && (
                  <Card className="bg-gray-900 border-cyan-600/50 shadow-lg shadow-cyan-600/20">
                    <CardContent className="py-12">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin text-cyan-400" />
                        <div className="text-center">
                          <p className="text-lg font-semibold text-cyan-400">Control Tower Analyzing</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Worker Agent planning • Sentinel evaluating risks • Coordinator finalizing
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Results Panels */}
                {!isAnalyzing && analysisResult && (
                  <div className="space-y-6">
                    {/* Three Panel Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Panel 1: User Request */}
                      <Card className="bg-gray-900 border-cyan-900/30">
                        <CardHeader>
                          <CardTitle className="text-cyan-400 text-lg flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            User Request
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Original Task</p>
                            <p className="text-gray-200">{analysisResult.task_overview.original_task}</p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Category</p>
                            <Badge variant="outline" className="border-cyan-600 text-cyan-400 bg-cyan-950/30">
                              {analysisResult.task_overview.task_category}
                            </Badge>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Complexity</p>
                            <Badge className={`${
                              analysisResult.task_overview.complexity_level === 'HIGH' ? 'bg-orange-600' :
                              analysisResult.task_overview.complexity_level === 'MEDIUM' ? 'bg-yellow-600' :
                              'bg-green-600'
                            }`}>
                              {analysisResult.task_overview.complexity_level}
                            </Badge>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Replanning Cycles</p>
                            <p className="text-2xl font-bold text-cyan-400">{analysisResult.replanning_count}</p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Panel 2: Worker Plan */}
                      <Card className="bg-gray-900 border-cyan-900/30">
                        <CardHeader>
                          <CardTitle className="text-cyan-400 text-lg flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Execution Plan
                          </CardTitle>
                          <CardDescription className="text-gray-400">
                            Version {analysisResult.execution_plan.plan_version}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Summary</p>
                            <p className="text-sm text-gray-300">{analysisResult.execution_plan.task_summary}</p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Execution Steps</p>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                              {analysisResult.execution_plan.execution_steps.map((step, idx) => {
                                const isObject = typeof step === 'object'
                                const stepNumber = isObject ? step.step_number || idx + 1 : idx + 1
                                const action = isObject ? step.action : step
                                const isExpanded = expandedSteps.has(idx)

                                return (
                                  <div
                                    key={idx}
                                    className="bg-gray-950 border border-cyan-900/30 rounded-lg p-3"
                                  >
                                    <div
                                      className="flex items-start gap-2 cursor-pointer"
                                      onClick={() => toggleStep(idx)}
                                    >
                                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center font-semibold mt-0.5">
                                        {stepNumber}
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-sm text-gray-200">{action}</p>
                                      </div>
                                      {isObject && (step.expected_outcome || step.considerations) && (
                                        <div className="flex-shrink-0">
                                          {isExpanded ? (
                                            <ChevronUp className="h-4 w-4 text-cyan-400" />
                                          ) : (
                                            <ChevronDown className="h-4 w-4 text-cyan-400" />
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {isObject && isExpanded && (
                                      <div className="mt-3 ml-8 space-y-2 text-xs border-t border-cyan-900/30 pt-2">
                                        {step.expected_outcome && (
                                          <div>
                                            <p className="text-gray-500 font-semibold">Expected Outcome:</p>
                                            <p className="text-gray-400">{step.expected_outcome}</p>
                                          </div>
                                        )}
                                        {step.considerations && (
                                          <div>
                                            <p className="text-gray-500 font-semibold">Considerations:</p>
                                            <p className="text-gray-400">{step.considerations}</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Resources Required</p>
                            <div className="flex flex-wrap gap-1">
                              {analysisResult.execution_plan.resources_required.slice(0, 3).map((resource, idx) => (
                                <Badge key={idx} variant="outline" className="border-gray-700 text-gray-300 text-xs">
                                  {resource}
                                </Badge>
                              ))}
                              {analysisResult.execution_plan.resources_required.length > 3 && (
                                <Badge variant="outline" className="border-gray-700 text-gray-300 text-xs">
                                  +{analysisResult.execution_plan.resources_required.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Estimated Duration</p>
                            <p className="text-sm text-cyan-400 font-semibold">{analysisResult.execution_plan.estimated_duration}</p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Panel 3: Sentinel Verdict */}
                      <Card className={`border-2 ${
                        analysisResult.final_decision === 'APPROVE' ? 'border-green-600 bg-green-950/20' :
                        analysisResult.final_decision === 'BLOCK' ? 'border-red-600 bg-red-950/20' :
                        'border-yellow-600 bg-yellow-950/20'
                      }`}>
                        <CardHeader>
                          <CardTitle className="text-cyan-400 text-lg flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Sentinel Verdict
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Large Decision Badge */}
                          <div className="text-center py-6">
                            <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-bold text-xl ${getDecisionColor(analysisResult.final_decision)}`}>
                              {analysisResult.final_decision === 'APPROVE' && <CheckCircle2 className="h-6 w-6" />}
                              {analysisResult.final_decision === 'BLOCK' && <XCircle className="h-6 w-6" />}
                              {(analysisResult.final_decision === 'MODIFY' ||
                                analysisResult.final_decision === 'CLARIFY' ||
                                analysisResult.final_decision === 'APPROVE_WITH_CONDITIONS') && (
                                <AlertTriangle className="h-6 w-6" />
                              )}
                              {analysisResult.final_decision.replace(/_/g, ' ')}
                            </div>
                          </div>

                          {/* Severity & Risk Score */}
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Severity</p>
                              <Badge className={getSeverityColor(analysisResult.risk_evaluation.severity_level)}>
                                {analysisResult.risk_evaluation.severity_level}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Overall Risk</p>
                              <p className="text-3xl font-bold text-cyan-400">
                                {analysisResult.risk_evaluation.overall_risk_score}
                                <span className="text-lg text-gray-500">/10</span>
                              </p>
                            </div>
                          </div>

                          {/* Risk Breakdown */}
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-3">Risk Breakdown</p>
                            <div className="space-y-2">
                              {Object.entries(analysisResult.risk_evaluation.risk_breakdown).map(([key, value]) => (
                                <div key={key}>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-400 capitalize">
                                      {key.replace('_score', '').replace('_', ' ')}
                                    </span>
                                    <span className="text-gray-300 font-semibold">{value}/10</span>
                                  </div>
                                  <div className="w-full bg-gray-800 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full transition-all ${getRiskMeterColor(value)}`}
                                      style={{ width: `${(value / 10) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Evaluation Summary */}
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Summary</p>
                            <p className="text-sm text-gray-300">{analysisResult.risk_evaluation.evaluation_summary}</p>
                          </div>

                          {/* Specific Concerns */}
                          {analysisResult.risk_evaluation.specific_concerns &&
                           analysisResult.risk_evaluation.specific_concerns.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Specific Concerns</p>
                              <ul className="space-y-1">
                                {analysisResult.risk_evaluation.specific_concerns.map((concern, idx) => (
                                  <li key={idx} className="text-xs text-gray-400 flex items-start gap-2">
                                    <span className="text-yellow-500 mt-0.5">•</span>
                                    <span>{concern}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Modification Guidance */}
                          {analysisResult.risk_evaluation.modification_guidance && (
                            <div className="bg-yellow-950/30 border border-yellow-900/50 rounded-lg p-3">
                              <p className="text-xs text-yellow-500 uppercase font-semibold mb-1">Modification Guidance</p>
                              <p className="text-xs text-yellow-200">{analysisResult.risk_evaluation.modification_guidance}</p>
                            </div>
                          )}

                          {/* Blocked Reasons */}
                          {analysisResult.risk_evaluation.blocked_reasons &&
                           analysisResult.risk_evaluation.blocked_reasons.length > 0 && (
                            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3">
                              <p className="text-xs text-red-500 uppercase font-semibold mb-2">Blocked Reasons</p>
                              <ul className="space-y-1">
                                {analysisResult.risk_evaluation.blocked_reasons.map((reason, idx) => (
                                  <li key={idx} className="text-xs text-red-200 flex items-start gap-2">
                                    <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    <span>{reason}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Clarification Requests */}
                          {analysisResult.risk_evaluation.clarification_requests && (
                            <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg p-3">
                              <p className="text-xs text-blue-500 uppercase font-semibold mb-1">Clarification Required</p>
                              <p className="text-xs text-blue-200">{analysisResult.risk_evaluation.clarification_requests}</p>
                            </div>
                          )}

                          {/* Approved with Conditions */}
                          {analysisResult.risk_evaluation.approved_with_conditions && (
                            <div className="bg-green-950/30 border border-green-900/50 rounded-lg p-3">
                              <p className="text-xs text-green-500 uppercase font-semibold mb-1">Approved With Conditions</p>
                              <p className="text-xs text-green-200">{analysisResult.risk_evaluation.approved_with_conditions}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Action Bar */}
                    <Card className="bg-gray-900 border-cyan-900/30">
                      <CardContent className="py-4">
                        <div className="flex flex-wrap gap-3">
                          <Button
                            disabled={analysisResult.final_decision !== 'APPROVE'}
                            className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Execute Plan
                          </Button>

                          <Button
                            variant="outline"
                            onClick={() => setShowOverrideModal(true)}
                            className="border-yellow-600 text-yellow-400 hover:bg-yellow-950/30"
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Override Decision
                          </Button>

                          <Button
                            variant="ghost"
                            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Full Report
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Workflow Timeline */}
                    <Card className="bg-gray-900 border-cyan-900/30">
                      <CardHeader>
                        <CardTitle className="text-cyan-400 text-lg">Workflow Timeline</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {analysisResult.workflow_timeline.map((event, idx) => (
                            <div key={idx} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className="w-3 h-3 rounded-full bg-cyan-500" />
                                {idx < analysisResult.workflow_timeline.length - 1 && (
                                  <div className="w-0.5 h-full bg-cyan-900/30 mt-1" />
                                )}
                              </div>
                              <div className="flex-1 pb-4">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="border-cyan-600 text-cyan-400 bg-cyan-950/30 text-xs">
                                    {event.agent}
                                  </Badge>
                                  <span className="text-xs text-gray-500">{event.stage}</span>
                                </div>
                                <p className="text-sm text-gray-300">{event.outcome}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Next Steps */}
                    <Card className="bg-gray-900 border-cyan-900/30">
                      <CardHeader>
                        <CardTitle className="text-cyan-400 text-lg">Next Steps</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-300">{analysisResult.next_steps}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {/* Audit Log Page */}
            {currentPage === 'audit' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-cyan-400 mb-2">Audit Log</h2>
                  <p className="text-gray-400">Complete history of all governance decisions</p>
                </div>

                {/* Filters */}
                <Card className="bg-gray-900 border-cyan-900/30">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-gray-300">Decision Type</Label>
                        <Select
                          value={auditFilters.decision}
                          onValueChange={(value) => setAuditFilters(prev => ({ ...prev, decision: value }))}
                        >
                          <SelectTrigger className="mt-2 bg-gray-950 border-cyan-900/30 text-gray-100">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-950 border-cyan-900/30">
                            <SelectItem value="All" className="text-gray-100">All Decisions</SelectItem>
                            <SelectItem value="APPROVE" className="text-gray-100">APPROVE</SelectItem>
                            <SelectItem value="APPROVE_WITH_CONDITIONS" className="text-gray-100">APPROVE WITH CONDITIONS</SelectItem>
                            <SelectItem value="MODIFY" className="text-gray-100">MODIFY</SelectItem>
                            <SelectItem value="BLOCK" className="text-gray-100">BLOCK</SelectItem>
                            <SelectItem value="CLARIFY" className="text-gray-100">CLARIFY</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-gray-300">Severity Level</Label>
                        <Select
                          value={auditFilters.severity}
                          onValueChange={(value) => setAuditFilters(prev => ({ ...prev, severity: value }))}
                        >
                          <SelectTrigger className="mt-2 bg-gray-950 border-cyan-900/30 text-gray-100">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-950 border-cyan-900/30">
                            <SelectItem value="All" className="text-gray-100">All Severities</SelectItem>
                            <SelectItem value="LOW" className="text-gray-100">LOW</SelectItem>
                            <SelectItem value="MEDIUM" className="text-gray-100">MEDIUM</SelectItem>
                            <SelectItem value="HIGH" className="text-gray-100">HIGH</SelectItem>
                            <SelectItem value="CRITICAL" className="text-gray-100">CRITICAL</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2">
                        <Label className="text-gray-300">Search Tasks</Label>
                        <Input
                          placeholder="Search task descriptions..."
                          value={auditFilters.search}
                          onChange={(e) => setAuditFilters(prev => ({ ...prev, search: e.target.value }))}
                          className="mt-2 bg-gray-950 border-cyan-900/30 text-gray-100 placeholder:text-gray-600"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Audit Table */}
                <Card className="bg-gray-900 border-cyan-900/30">
                  <CardContent className="p-0">
                    {filteredAuditLog.length === 0 ? (
                      <div className="py-12 text-center text-gray-500">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No audit entries found</p>
                        <p className="text-sm mt-1">Submit a task to create your first governance review</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-cyan-900/30">
                        {filteredAuditLog.map((entry) => (
                          <div key={entry.id} className="p-4 hover:bg-gray-950/50 transition-colors">
                            <div
                              className="flex items-start gap-4 cursor-pointer"
                              onClick={() => toggleAuditRow(entry.id)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className={getDecisionColor(entry.decision)}>
                                    {entry.decision}
                                  </Badge>
                                  <Badge className={getSeverityColor(entry.severity)}>
                                    {entry.severity}
                                  </Badge>
                                  {entry.overridden && (
                                    <Badge className="bg-orange-600">OVERRIDDEN</Badge>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    {new Date(entry.timestamp).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-gray-200 truncate">{entry.task}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">Risk Score</p>
                                  <p className="text-lg font-bold text-cyan-400">{entry.riskScore}/10</p>
                                </div>
                                {expandedAuditRows.has(entry.id) ? (
                                  <ChevronUp className="h-5 w-5 text-cyan-400" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-cyan-400" />
                                )}
                              </div>
                            </div>

                            {expandedAuditRows.has(entry.id) && (
                              <div className="mt-4 pl-4 border-l-2 border-cyan-600 space-y-3">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Full Task</p>
                                  <p className="text-sm text-gray-300">{entry.fullResult.task_overview.original_task}</p>
                                </div>

                                <div>
                                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Evaluation Summary</p>
                                  <p className="text-sm text-gray-300">{entry.fullResult.risk_evaluation.evaluation_summary}</p>
                                </div>

                                {entry.overrideJustification && (
                                  <div className="bg-orange-950/30 border border-orange-900/50 rounded-lg p-3">
                                    <p className="text-xs text-orange-500 uppercase font-semibold mb-1">Override Justification</p>
                                    <p className="text-sm text-orange-200">{entry.overrideJustification}</p>
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" className="text-cyan-400 border-cyan-600 hover:bg-cyan-950/30">
                                    View Full Report
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Analytics Page */}
            {currentPage === 'analytics' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-cyan-400 mb-2">Analytics Dashboard</h2>
                  <p className="text-gray-400">Pattern tracking and system improvement insights</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-gray-900 border-cyan-900/30">
                    <CardContent className="pt-6">
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Total Reviews</p>
                      <p className="text-3xl font-bold text-cyan-400">{auditLog.length}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-cyan-900/30">
                    <CardContent className="pt-6">
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Avg Risk Score</p>
                      <p className="text-3xl font-bold text-cyan-400">{avgRiskScore}/10</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-cyan-900/30">
                    <CardContent className="pt-6">
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Override Rate</p>
                      <p className="text-3xl font-bold text-cyan-400">{overrideRate}%</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-cyan-900/30">
                    <CardContent className="pt-6">
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Approval Rate</p>
                      <p className="text-3xl font-bold text-cyan-400">
                        {auditLog.length > 0
                          ? (((decisionCounts['APPROVE'] || 0) / auditLog.length) * 100).toFixed(1)
                          : '0.0'}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Decision Distribution */}
                  <Card className="bg-gray-900 border-cyan-900/30">
                    <CardHeader>
                      <CardTitle className="text-cyan-400">Decision Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(decisionCounts).map(([decision, count]) => (
                          <div key={decision}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-300">{decision.replace(/_/g, ' ')}</span>
                              <span className="text-cyan-400 font-semibold">{count}</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${getDecisionColor(decision)}`}
                                style={{ width: `${(count / auditLog.length) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Severity Distribution */}
                  <Card className="bg-gray-900 border-cyan-900/30">
                    <CardHeader>
                      <CardTitle className="text-cyan-400">Severity Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(severityCounts).map(([severity, count]) => (
                          <div key={severity}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-300">{severity}</span>
                              <span className="text-cyan-400 font-semibold">{count}</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${getRiskMeterColor(
                                  severity === 'CRITICAL' ? 9 :
                                  severity === 'HIGH' ? 7 :
                                  severity === 'MEDIUM' ? 5 : 2
                                )}`}
                                style={{ width: `${(count / auditLog.length) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card className="bg-gray-900 border-cyan-900/30">
                  <CardHeader>
                    <CardTitle className="text-cyan-400">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {auditLog.slice(0, 5).length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No activity yet</p>
                    ) : (
                      <div className="space-y-3">
                        {auditLog.slice(0, 5).map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-950 rounded-lg border border-cyan-900/30">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-200 truncate">{entry.task}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(entry.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <Badge className={getDecisionColor(entry.decision)}>
                                {entry.decision}
                              </Badge>
                              <span className="text-cyan-400 font-semibold">{entry.riskScore}/10</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Settings Page */}
            {currentPage === 'settings' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-cyan-400 mb-2">Settings</h2>
                  <p className="text-gray-400">Configure governance platform preferences</p>
                </div>

                <Card className="bg-gray-900 border-cyan-900/30">
                  <CardHeader>
                    <CardTitle className="text-cyan-400">Agent Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-gray-300">Governance Coordinator ID</Label>
                      <Input
                        value={GOVERNANCE_COORDINATOR_ID}
                        disabled
                        className="mt-2 bg-gray-950 border-cyan-900/30 text-gray-400"
                      />
                    </div>

                    <div className="bg-cyan-950/30 border border-cyan-900/50 rounded-lg p-4">
                      <p className="text-sm text-cyan-300">
                        System is configured and operational. All agents are responding normally.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-900 border-cyan-900/30">
                  <CardHeader>
                    <CardTitle className="text-cyan-400">Data Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      variant="outline"
                      className="w-full border-red-600 text-red-400 hover:bg-red-950/30"
                      onClick={() => {
                        if (confirm('Are you sure you want to clear all audit log data? This cannot be undone.')) {
                          localStorage.removeItem('sentinel_audit_log')
                          setAuditLog([])
                        }
                      }}
                    >
                      Clear All Audit Data
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Override Modal */}
      <Dialog open={showOverrideModal} onOpenChange={setShowOverrideModal}>
        <DialogContent className="bg-gray-900 border-cyan-900/30 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 text-xl">Override Governance Decision</DialogTitle>
            <DialogDescription className="text-gray-400">
              You are about to override a Sentinel risk evaluation decision
            </DialogDescription>
          </DialogHeader>

          {analysisResult && (
            <div className="space-y-4">
              {/* Warning Banner */}
              <div className={`rounded-lg p-4 border ${
                analysisResult.risk_evaluation.severity_level === 'CRITICAL' ? 'bg-red-950/30 border-red-900/50' :
                analysisResult.risk_evaluation.severity_level === 'HIGH' ? 'bg-orange-950/30 border-orange-900/50' :
                'bg-yellow-950/30 border-yellow-900/50'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                    analysisResult.risk_evaluation.severity_level === 'CRITICAL' ? 'text-red-500' :
                    analysisResult.risk_evaluation.severity_level === 'HIGH' ? 'text-orange-500' :
                    'text-yellow-500'
                  }`} />
                  <div>
                    <p className={`font-semibold ${
                      analysisResult.risk_evaluation.severity_level === 'CRITICAL' ? 'text-red-400' :
                      analysisResult.risk_evaluation.severity_level === 'HIGH' ? 'text-orange-400' :
                      'text-yellow-400'
                    }`}>
                      You are overriding a {analysisResult.risk_evaluation.severity_level} risk decision
                    </p>
                    <p className={`text-sm mt-1 ${
                      analysisResult.risk_evaluation.severity_level === 'CRITICAL' ? 'text-red-300' :
                      analysisResult.risk_evaluation.severity_level === 'HIGH' ? 'text-orange-300' :
                      'text-yellow-300'
                    }`}>
                      Original Decision: {analysisResult.final_decision} | Risk Score: {analysisResult.risk_evaluation.overall_risk_score}/10
                    </p>
                  </div>
                </div>
              </div>

              {/* Justification */}
              <div>
                <Label htmlFor="override-justification" className="text-gray-300">
                  Override Justification (Required - minimum 50 characters)
                </Label>
                <Textarea
                  id="override-justification"
                  placeholder="Explain why you are overriding this governance decision..."
                  value={overrideJustification}
                  onChange={(e) => setOverrideJustification(e.target.value)}
                  className="mt-2 min-h-[100px] bg-gray-950 border-cyan-900/30 text-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {overrideJustification.length}/50 characters
                </p>
              </div>

              {/* Acknowledgment */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="override-acknowledge"
                  checked={overrideAcknowledged}
                  onCheckedChange={(checked) => setOverrideAcknowledged(checked === true)}
                  className="mt-1 border-cyan-600 data-[state=checked]:bg-cyan-600"
                />
                <Label htmlFor="override-acknowledge" className="text-gray-300 cursor-pointer">
                  I accept full responsibility for this action and understand it will be permanently logged in the audit trail
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowOverrideModal(false)
                setOverrideJustification('')
                setOverrideAcknowledged(false)
              }}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleOverride}
              disabled={overrideJustification.length < 50 || !overrideAcknowledged}
              className="bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50"
            >
              Submit Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
