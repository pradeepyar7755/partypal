// ═══════════════════════════════════════════════════════
//  Pipeline AI Agent Executor
//  Runs triage, code review, and shiproom agents via
//  Gemini 2.5 Flash. Results stored in Firestore.
// ═══════════════════════════════════════════════════════

import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// ── Agent Prompts ─────────────────────────────────────

const TRIAGE_PROMPT = `You are a Bug Triage Agent for PartyPal, a party planning web app (Next.js 14, TypeScript, Firestore, Vercel).

Given a bug/feature report, produce a JSON analysis:
{
  "severity": "P0|P1|P2|P3",
  "module": "Events|RSVP|Guests|AI Planning|Vendors|Budget|Collaboration|Email|Polls|Admin|Native|Auth|Dashboard",
  "root_cause_hypothesis": "Your best guess at the root cause",
  "affected_files": ["likely file paths"],
  "impact": "Who is affected and how",
  "suggested_fix": "High-level approach to fix this",
  "effort_estimate": "small|medium|large"
}

Severity guide:
- P0: App down, data loss, security vulnerability
- P1: Core feature broken, affects >30% users
- P2: Feature degraded, workaround exists, device-specific
- P3: Cosmetic, typo, edge case

Key architecture notes:
- localStorage is the primary data store, Firestore syncs for cross-device persistence
- API routes trust client-provided uid (no server-side token verification)
- CSS Modules only, no Tailwind
- Firestore uses named database 'partypal'
- Rate limiting on AI endpoints via lib/rate-limiter.ts

Respond with ONLY the JSON object, no markdown fencing.`

const REVIEW_PROMPT = `You are a Code Review Agent for PartyPal. Review the following code changes for:

1. SECURITY (blocking): hardcoded secrets, eval(), injection, missing ownership checks, missing rate limiting
2. CONVENTIONS (warning): API route patterns, error shapes, Firestore access via getDb(), set({merge:true}) for upserts, CSS Modules
3. LOGIC (warning): infinite loops, floating promises, race conditions, missing null checks
4. PERFORMANCE (info): N+1 queries, full collection scans, missing pagination

Produce a JSON review:
{
  "verdict": "PASS|FAIL|PASS_WITH_WARNINGS",
  "blocking_issues": [{"file": "path", "issue": "description", "suggestion": "fix"}],
  "warnings": [{"file": "path", "issue": "description"}],
  "summary": "One paragraph review",
  "risk_level": "LOW|MEDIUM|HIGH"
}

Respond with ONLY the JSON object, no markdown fencing.`

const SHIPROOM_PROMPT = `You are the Shiproom Review Agent for PartyPal. Given pipeline data (ticket, triage, review, test results), produce a ship decision brief.

Produce a JSON summary:
{
  "recommendation": "SHIP|HOLD|REJECT",
  "risk_level": "LOW|MEDIUM|HIGH",
  "summary": "2-3 sentence summary of changes",
  "key_risks": ["list of risks"],
  "experience_impact": "How users will experience this change",
  "requires_env_vars": false,
  "requires_migration": false
}

Ship criteria:
- SHIP: No blocking issues, tests pass, low risk
- HOLD: Warnings present, needs more review, medium risk
- REJECT: Blocking issues, tests failing, high risk

Respond with ONLY the JSON object, no markdown fencing.`

// ── Agent Types ───────────────────────────────────────

export type AgentType = 'triage' | 'review' | 'shiproom'

interface AgentResult {
    agent: AgentType
    status: 'success' | 'error'
    result: Record<string, unknown>
    model: string
    tokensUsed?: number
    durationMs: number
}

// ── Execute Agent ─────────────────────────────────────

export async function executeAgent(
    agent: AgentType,
    input: string,
): Promise<AgentResult> {
    const startTime = Date.now()

    const prompts: Record<AgentType, string> = {
        triage: TRIAGE_PROMPT,
        review: REVIEW_PROMPT,
        shiproom: SHIPROOM_PROMPT,
    }

    const systemPrompt = prompts[agent]
    if (!systemPrompt) {
        return {
            agent,
            status: 'error',
            result: { error: `Unknown agent: ${agent}` },
            model: 'none',
            durationMs: Date.now() - startTime,
        }
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\nInput:\n${input}` }] }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2048,
            },
        })

        const responseText = result.response.text()

        // Parse JSON from response (handle possible markdown fencing)
        let parsed: Record<string, unknown>
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/)
            parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: responseText }
        } catch {
            parsed = { raw: responseText, parseError: true }
        }

        return {
            agent,
            status: 'success',
            result: parsed,
            model: 'gemini-2.5-flash',
            tokensUsed: result.response.usageMetadata?.totalTokenCount,
            durationMs: Date.now() - startTime,
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return {
            agent,
            status: 'error',
            result: { error: msg },
            model: 'gemini-2.5-flash',
            durationMs: Date.now() - startTime,
        }
    }
}
