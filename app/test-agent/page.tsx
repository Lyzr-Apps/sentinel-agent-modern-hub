'use client'

import { useState } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const GOVERNANCE_COORDINATOR_ID = '698599bc5eb49186d63e5d70'

export default function TestAgentPage() {
  const [message, setMessage] = useState('Send promotional email to all customers with 50% discount')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testAgent = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      console.log('Testing agent with message:', message)
      const result = await callAIAgent(message, GOVERNANCE_COORDINATOR_ID)

      console.log('Full Result:', result)
      console.log('Result Success:', result.success)
      console.log('Response Status:', result.response?.status)
      console.log('Response Result:', result.response?.result)

      setResponse(result)
    } catch (err) {
      console.error('Test error:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-cyan-400">Test Governance Coordinator Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Test Message</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                placeholder="Enter test message..."
              />
            </div>

            <Button
              onClick={testAgent}
              disabled={loading || !message.trim()}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {loading ? 'Testing...' : 'Test Agent'}
            </Button>

            {error && (
              <div className="bg-red-950/30 border border-red-900 rounded p-4">
                <h3 className="text-red-400 font-semibold mb-2">Error</h3>
                <pre className="text-red-300 text-xs overflow-auto">{error}</pre>
              </div>
            )}

            {response && (
              <div className="space-y-4">
                <div className="bg-slate-800 border border-slate-700 rounded p-4">
                  <h3 className="text-cyan-400 font-semibold mb-2">Success Status</h3>
                  <pre className="text-white text-sm">
                    {JSON.stringify(response.success, null, 2)}
                  </pre>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded p-4">
                  <h3 className="text-cyan-400 font-semibold mb-2">Response Status</h3>
                  <pre className="text-white text-sm">
                    {JSON.stringify(response.response?.status, null, 2)}
                  </pre>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded p-4">
                  <h3 className="text-cyan-400 font-semibold mb-2">Response Result Structure</h3>
                  <pre className="text-white text-xs overflow-auto max-h-96">
                    {JSON.stringify(response.response?.result, null, 2)}
                  </pre>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded p-4">
                  <h3 className="text-cyan-400 font-semibold mb-2">Full Response</h3>
                  <pre className="text-white text-xs overflow-auto max-h-96">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded p-4">
                  <h3 className="text-cyan-400 font-semibold mb-2">Raw Response</h3>
                  <pre className="text-white text-xs overflow-auto max-h-96">
                    {response.raw_response || 'No raw response available'}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
