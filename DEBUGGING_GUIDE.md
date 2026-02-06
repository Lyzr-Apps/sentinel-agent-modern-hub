# Sentinel Agent - Debugging Guide

## JSON Parsing Error Fix

### Problem
The error "Unexpected token 'w', "workflow_s"... is not valid JSON" indicates that the agent response has text before the JSON starts.

### Solutions Applied

#### 1. Enhanced JSON Parser (`lib/jsonParser.ts`)
Added aggressive JSON extraction that:
- Finds the first `{` or `[` character in the response
- Extracts JSON starting from that position
- Ignores any preamble text before the JSON

#### 2. API Route Logging (`app/api/agent/route.ts`)
Added comprehensive logging to track:
- Raw response length and preview
- Parsed result type and structure
- Normalized response details

Check server logs (terminal running `npm run dev`) for these logs prefixed with `[Agent API]`.

#### 3. Frontend Error Handling (`app/page.tsx`)
Enhanced parsing logic that:
- Handles multiple response formats
- Strips preamble text from string responses
- Validates required fields before processing
- Shows detailed error messages

Check browser console (F12) for these logs:
- "AI Agent Response:" - Full response object
- "Response Data:" - Extracted result data
- "Parsed Governance Result:" - Final parsed structure
- Error details with stack traces

## Debugging Steps

### Step 1: Check Browser Console
1. Open Developer Tools (F12)
2. Go to Console tab
3. Submit a task on the dashboard
4. Look for the logs:
   ```
   AI Agent Response: {...}
   Response Data: {...}
   Parsed Governance Result: {...}
   ```

### Step 2: Check Server Logs
1. Look at the terminal running `npm run dev`
2. Find logs prefixed with `[Agent API]`:
   ```
   [Agent API] Raw response length: 5432
   [Agent API] Raw response preview: ...
   [Agent API] Parsed result type: object
   [Agent API] Parsed result keys: status, result, metadata
   ```

### Step 3: Use Test Page
1. Visit `http://localhost:3000/test-agent`
2. Submit the default test message or create your own
3. View the complete response structure including:
   - Success status
   - Response status
   - Response result structure
   - Full response object
   - Raw response text

### Step 4: Common Issues

#### Issue: "Invalid response structure from agent"
**Cause:** Response is missing `final_decision` or `risk_evaluation` fields
**Solution:** Check if the agent is returning the correct schema. View the test results in:
- `/app/nextjs-project/response_schemas/test_results/governance_coordinator_test_result.json`

#### Issue: "Failed to parse agent response"
**Cause:** Response is a string but contains invalid JSON or has text before JSON
**Solution:**
- Check browser console for the actual response string
- Enhanced parser should strip preamble automatically
- If it still fails, the JSON itself might be malformed

#### Issue: Agent returns text instead of JSON
**Cause:** Agent instructions not being followed
**Solution:**
- Agent has been configured to return pure JSON
- If problem persists, check agent instructions in the Lyzr dashboard
- Verify the agent ID is correct: `698599bc5eb49186d63e5d70`

## Response Structure

### Expected Structure
The Governance Coordinator should return:

```json
{
  "status": "success",
  "result": {
    "workflow_status": "APPROVED",
    "final_decision": "APPROVE",
    "task_overview": {
      "original_task": "...",
      "task_category": "...",
      "complexity_level": "..."
    },
    "execution_plan": {
      "plan_version": 1,
      "task_summary": "...",
      "execution_steps": [...],
      "resources_required": [...],
      "estimated_duration": "..."
    },
    "risk_evaluation": {
      "decision": "APPROVE",
      "overall_risk_score": 2,
      "severity_level": "LOW",
      "risk_breakdown": {
        "safety_score": 1,
        "irreversibility_score": 2,
        "ethics_score": 1,
        "financial_score": 3,
        "reputation_score": 2
      },
      "evaluation_summary": "...",
      "specific_concerns": [...]
    },
    "workflow_timeline": [...],
    "next_steps": "...",
    "replanning_count": 0
  },
  "metadata": {
    "agent_name": "Governance Coordinator",
    "timestamp": "...",
    "managed_agents": [...]
  }
}
```

### Handling Different Formats

The code handles these variations:
1. **Direct format:** `result.response.result = GovernanceResult`
2. **Wrapped format:** `result.response.result = { result: GovernanceResult }`
3. **String format:** `result.response.result = "stringified JSON"`
4. **String with preamble:** `result.response.result = "Some text {JSON...}"`

## Environment Variables

Make sure `.env.local` contains:
```
LYZR_API_KEY=your_api_key_here
```

## Contact & Support

If issues persist:
1. Check agent configuration in Lyzr dashboard
2. Verify agent IDs are correct
3. Review agent instructions for JSON output requirements
4. Test individual agents using the test page
