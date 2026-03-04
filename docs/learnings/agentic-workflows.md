# Agentic Workflows

## Overview

Agentic workflows are patterns where AI acts as an agent that plans, executes multi-step tasks, learns from feedback, and improves over time. In a web app context, this means AI doesn't just answer questions — it generates structured plans, adapts based on user refinements, and uses cross-system context to make increasingly personalized decisions.

## Pattern 1: AI Plan Generation as a Multi-Step Workflow

The AI generates a complete structured plan (not just text) from event parameters:

```
User Input → AI Generation → Structured JSON → UI Rendering → User Refinement → Re-Generation
```

### Structured Output

Force the AI to return typed JSON, not free-form text:

```typescript
const prompt = `You are an expert planner. Generate a comprehensive plan.

Event: ${eventType} | Date: ${date} | Guests: ${guests} | Location: ${location}

Return ONLY valid JSON, no markdown, no backticks:
{
  "summary": "1-2 short sentences",
  "timeline": [
    {"weeks": "time period", "task": "5-8 word action", "category": "tag", "priority": "high|medium|low"}
  ],
  "checklist": [
    {"item": "Specific actionable task", "category": "matching_category", "done": false}
  ],
  "budget": {
    "total": "$X,XXX",
    "breakdown": [
      {"category": "Category", "amount": 500, "percentage": 25, "color": "#hex"}
    ]
  },
  "tips": ["Tip 1", "Tip 2"]
}
`
```

### JSON Parsing with Cleanup

AI models often wrap JSON in markdown. Always clean it:

```typescript
const result = await model.generateContent(prompt)
const text = result.response.text()
const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
const plan = JSON.parse(cleaned)
```

## Pattern 2: Iterative Refinement Loop

Users refine AI output with natural language, and the AI updates the plan while preserving unchanged parts:

```typescript
const isRefinement = refinement && existingTimeline

const prompt = isRefinement
    ? `Refine the planning timeline below based on user feedback.

Current Timeline:
${existingTimeline}

User's refinement request: "${refinement}"

Return ONLY valid JSON with the updated timeline. Keep items that don't need changing.`

    : `Generate a comprehensive plan from scratch...`
```

**Key Principle:** Refinement prompts include the existing output, so the AI modifies rather than regenerates. This preserves the user's prior edits and decisions.

### Handling Refinement Response Shape

Refinement returns a subset of the full plan. Normalize the response:

```typescript
if (isRefinement) {
    // Refinement only returns { timeline: [...] }
    // Wrap it to match the full plan shape
    return NextResponse.json({
        plan: { timeline: plan.timeline || plan },
        eventType, guests, location
    })
}
// Full generation returns the complete plan
return NextResponse.json({ plan, eventType, guests, location })
```

## Pattern 3: Context-Aware Re-Generation

Every AI call includes full cross-portal context (see `context-aware-ai-generation.md`). This means the AI "knows" about:

- Guest dietary restrictions → influences food recommendations
- Budget already spent → adjusts remaining recommendations to be cost-conscious
- Timeline progress → prioritizes overdue items
- User preferences → matches tone and detail level

```typescript
// Build context injection only if meaningful data exists
const contextBlock = hasContext(body)
    ? `\n${assembleContext(body, 'party planning')}\n`
    : ''

const prompt = `You are an expert planner.\n${contextBlock}\nEvent: ${eventType} | ...`
```

## Pattern 4: Behavioral Learning Loop

The AI gets smarter over time by observing user behavior:

```
User Action → Record Signal → Update Preferences → Feed Into Next AI Call
```

```typescript
// When user refines a plan
recordInteraction({ type: 'plan_refined', refinementText: userFeedback })

// When user shortlists a vendor
recordInteraction({ type: 'vendor_shortlisted', category: 'catering', vendorName: 'Tasty Bites' })

// Preferences are automatically included in next AI call via CrossPortalContext
```

Over many interactions, the AI learns:
- **Tone preference** — inferred from refinement language ("make it more formal" → formal tone)
- **Budget tendency** — inferred from budget adjustments (up → moderate/lavish, down → frugal)
- **Planning style** — inferred from theme choices ("minimalist" → minimal, "grand" → detailed)
- **Favorite categories** — tracked from vendor shortlisting behavior

## Pattern 5: Fire-and-Forget Side Effects

Non-critical operations (analytics, sync, logging) run async without blocking the main flow:

```typescript
// Log API usage — fire-and-forget, never fails the main request
logApiCall('plan', 'gemini', identifier)

// Sync preferences to cloud — fire-and-forget
fetch('/api/user-data', {
    method: 'POST',
    body: JSON.stringify({ uid, aiMemory: prefs }),
}).catch(() => {})

// Track analytics event — fire-and-forget
trackEvent('plan_generated', { eventType, guestCount })
```

**Rule:** Fire-and-forget is appropriate for:
- Analytics and usage tracking
- Preference/profile syncing
- Non-critical notifications
- Cache warming

**Not appropriate for:**
- Data the user expects to see immediately
- Deletions or destructive operations
- Payment processing

## Pattern 6: Rate Limiting for AI APIs

Protect against abuse with dynamic per-user rate limiting:

```typescript
const rateCheck = await checkRateLimit(identifier, 'plan')
if (!rateCheck.allowed) {
    return NextResponse.json({
        error: `Daily AI limit reached (${rateCheck.limit} requests/day). Try again tomorrow.`,
        rateLimit: rateCheck,
    }, { status: 429 })
}
```

Rate limits scale dynamically based on total user count:
- < 25 users → 100 requests/day each (tracking only, never blocks)
- 25-50 users → 50/day
- 50-100 users → 25/day
- 100-250 users → 15/day
- etc.

## Pattern 7: Prompt Engineering for Consistent Output

Use explicit rules in prompts to get reliable structured output:

```typescript
// Force chronological ordering
'Milestones MUST be in chronological order (earliest first, event day last)'

// Force required sections
'NON-NEGOTIABLE: These three MUST appear in every plan: Venue, Guests, Food'

// Prevent irrelevant suggestions
'Casual game parties: Skip photographer, DJ. Focus on food, drinks, games.'

// Force conciseness
'Keep deliverables CONCISE: 3-5 milestones MAXIMUM. Each task 5-8 words max.'

// Prevent name leakage
'Do NOT include any personal names in generated content.'

// Force realistic estimates
'Use CONSERVATIVE per-guest benchmarks. Casual party: $15-30/guest total.'
```

## Pattern 8: Admin Automation & Health Monitoring

Build automated admin dashboards that track system health:

```typescript
// Automated churn analytics
// Track users who haven't logged in within X days

// Health alerts
// Monitor API error rates, rate limit hits, failed syncs

// Usage KPIs with trend charts
// Daily active users, plans generated, vendors searched

// Cost estimation
// Track AI API calls × cost per call for budget monitoring
```

## Reusable Checklist

- [ ] **Force structured JSON output** — Include the exact JSON schema in the prompt with "Return ONLY valid JSON"
- [ ] **Clean AI responses** — Strip markdown code blocks before parsing JSON
- [ ] **Separate refinement from generation** — Different prompt templates, different response shapes
- [ ] **Include full context in every AI call** — Cross-portal context makes responses personalized
- [ ] **Record user interactions** — Build a preference profile from observed behavior
- [ ] **Use fire-and-forget for side effects** — Analytics, sync, logging should never block
- [ ] **Rate limit AI endpoints** — Dynamic per-user limits that scale with user count
- [ ] **Use explicit prompt rules** — Force chronological order, required sections, conciseness, no names
- [ ] **Normalize response shapes** — Wrap partial responses to match the full expected shape
- [ ] **Build admin health monitoring** — Track API usage, costs, error rates, churn
