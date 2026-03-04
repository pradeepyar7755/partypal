# Context-Aware AI Generation

## Overview

Context-aware AI generation means giving the AI model full awareness of the user's current situation across all features of the app — not just the immediate prompt. This produces deeply personalized responses that reference the user's specific data (guests, vendors, budget, timeline progress) without the user having to repeat themselves.

## Architecture: Cross-Portal Context

The system has three layers:

```
┌─────────────────────────────────────────────────────────┐
│ 1. AI Context Types (lib/ai-context.ts)                 │
│    Defines the shape of all context data                │
├─────────────────────────────────────────────────────────┤
│ 2. Server-Side Assembler (lib/ai-context-server.ts)     │
│    Converts raw request body → structured context       │
│    → natural language prompt injection                  │
├─────────────────────────────────────────────────────────┤
│ 3. AI Memory (lib/ai-memory.ts)                         │
│    Observes user behavior → builds preference profile   │
│    → feeds back into future context                     │
└─────────────────────────────────────────────────────────┘
```

## Layer 1: Context Types

Define TypeScript interfaces for every data domain:

```typescript
// lib/ai-context.ts

export interface CrossPortalContext {
    event: EventContext        // Event type, date, location, budget
    guests: GuestContext       // Guest count, dietary needs, children
    vendors: VendorContext     // Shortlisted vendors, budget spent/remaining
    plan: PlanContext          // Timeline progress, overdue tasks
    moodboard: MoodboardContext // Colors, vibe, decor style, music
    preferences: UserPreferences // Learned user behavior patterns
    signals: string[]          // Dynamic cross-feature insights
}

export interface EventContext {
    eventType: string
    date: string
    daysUntilEvent: number
    guests: string
    guestCount: number
    location: string
    theme: string
    budget: string
    budgetAmount: number
    time?: string
}

export interface UserPreferences {
    planningStyle: 'minimal' | 'detailed' | 'collaborative' | 'unknown'
    budgetTendency: 'frugal' | 'moderate' | 'lavish' | 'unknown'
    tonePreference: 'casual' | 'formal' | 'playful' | 'elegant' | 'unknown'
    favoriteCategories: string[]
    pastEventTypes: string[]
    refinementPatterns: string[]  // e.g., "user often asks for more formal language"
    interactionCount: number
    lastActiveDate: string
}
```

## Layer 2: Context Prompt Injection

Convert structured context into a natural language block injected into AI prompts:

```typescript
export function buildContextPrompt(ctx: Partial<CrossPortalContext>, surface: string): string {
    const sections: string[] = []

    sections.push(`[CROSS-PORTAL CONTEXT — You have intelligence from across the app. Use this to make your ${surface} response deeply personalized.]`)

    // Event context with urgency signals
    if (ctx.event) {
        const e = ctx.event
        const urgency = e.daysUntilEvent <= 3 ? 'RUSH'
            : e.daysUntilEvent <= 7 ? 'TIGHT'
            : e.daysUntilEvent <= 14 ? 'SHORT'
            : 'COMFORTABLE'
        sections.push(`EVENT: ${e.eventType} | ${e.date} (${e.daysUntilEvent} days — ${urgency}) | ${e.guests} guests | Budget: ${e.budget}`)
    }

    // Guest intelligence
    if (ctx.guests?.totalGuests > 0) {
        let info = `GUESTS: ${ctx.guests.totalGuests} invited, ${ctx.guests.confirmedGuests} confirmed`
        if (ctx.guests.dietaryRestrictions.length > 0)
            info += ` | Dietary: ${ctx.guests.dietarySummary}`
        if (ctx.guests.hasChildren) info += ' | Has children attending'
        sections.push(info)
    }

    // User behavioral preferences — with name exclusion instruction
    if (ctx.preferences?.interactionCount > 0) {
        const prefs: string[] = []
        if (ctx.preferences.tonePreference !== 'unknown') prefs.push(`prefers ${ctx.preferences.tonePreference} tone`)
        if (ctx.preferences.budgetTendency !== 'unknown') prefs.push(`${ctx.preferences.budgetTendency} spender`)
        sections.push(`STYLE PROFILE (do NOT include any personal names in your output): ${prefs.join(' | ')}`)
    }

    return sections.join('\n')
}
```

**Key Pattern: Name Sanitization** — The inline instruction `"do NOT include any personal names in your output"` is embedded directly in the context block. This prevents the AI from leaking host names in generated content that might be shared publicly.

### Cross-Feature Signal Generation

Analyze relationships between context areas to produce actionable insights:

```typescript
export function generateSignals(ctx: Partial<CrossPortalContext>): string[] {
    const signals: string[] = []

    // Budget vs timeline
    if (vendors && event.budgetAmount > 0) {
        const spentPercent = (vendors.budgetSpent / event.budgetAmount) * 100
        if (spentPercent > 80)
            signals.push(`Budget is ${Math.round(spentPercent)}% allocated — be budget-conscious`)
    }

    // Guest dietary → food recommendations
    if (guests?.dietaryRestrictions.length > 0) {
        signals.push(`${guests.dietaryRestrictions.length} dietary types — food must accommodate: ${guests.dietaryRestrictions.join(', ')}`)
    }

    // Timeline urgency + low progress
    if (event.daysUntilEvent <= 7 && plan?.progressPercent < 50) {
        signals.push('Event within a week with <50% done — prioritize essentials only')
    }

    // Children attending → kid-friendly options
    if (guests?.hasChildren) {
        signals.push('Children attending — include kid-friendly options')
    }

    return signals
}
```

## Layer 3: AI Memory (Behavioral Learning)

Observe user actions and build a preference profile that makes AI smarter over time.

### Recording Interactions

Use a discriminated union for type-safe interaction signals:

```typescript
export type InteractionSignal =
    | { type: 'plan_generated'; eventType: string }
    | { type: 'plan_refined'; refinementText: string }
    | { type: 'vendor_shortlisted'; category: string; vendorName: string }
    | { type: 'budget_adjusted'; budgetDirection: 'up' | 'down'; amount: number }
    | { type: 'invite_style_chosen'; style: string }
    | { type: 'theme_selected'; refinementText: string }
    | { type: 'moodboard_generated' }

export function recordInteraction(signal: InteractionSignal): UserPreferences {
    const prefs = loadPreferences()
    prefs.interactionCount++

    switch (signal.type) {
        case 'plan_refined':
            // Learn tone from refinement language
            const text = signal.refinementText.toLowerCase()
            if (text.includes('formal') || text.includes('elegant'))
                prefs.tonePreference = 'formal'
            else if (text.includes('casual') || text.includes('relaxed'))
                prefs.tonePreference = 'casual'

            // Track refinement patterns (keep last 10)
            prefs.refinementPatterns = [
                signal.refinementText.slice(0, 80),
                ...prefs.refinementPatterns.slice(0, 9)
            ]
            break

        case 'vendor_shortlisted':
            if (!prefs.favoriteCategories.includes(signal.category))
                prefs.favoriteCategories.push(signal.category)
            break

        case 'budget_adjusted':
            if (signal.budgetDirection === 'up')
                prefs.budgetTendency = prefs.budgetTendency === 'lavish' ? 'lavish' : 'moderate'
            break
    }

    savePreferences(prefs)
    return prefs
}
```

### Storage: localStorage-First with Cloud Sync

```typescript
// Save locally first (instant), then sync to cloud (fire-and-forget)
export function savePreferences(prefs: UserPreferences, uid?: string): void {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(prefs))
    if (uid) {
        fetch('/api/user-data', {
            method: 'POST',
            body: JSON.stringify({ uid, aiMemory: prefs }),
        }).catch(() => {})
    }
}

// Cloud merge: cloud wins if it has more data
export async function loadFromCloud(uid: string): Promise<UserPreferences> {
    const cloudPrefs = await fetchFromAPI(uid)
    const localPrefs = loadPreferences()
    if (cloudPrefs.interactionCount >= localPrefs.interactionCount) {
        localStorage.setItem(MEMORY_KEY, JSON.stringify(cloudPrefs))
        return cloudPrefs
    }
    return localPrefs
}
```

## Server-Side Usage in API Routes

```typescript
// app/api/plan/route.ts
import { assembleContext, hasContext } from '@/lib/ai-context-server'

export async function POST(req: NextRequest) {
    const body = await req.json()

    // Build context injection (only if meaningful context exists)
    const contextBlock = hasContext(body)
        ? `\n${assembleContext(body, 'party planning')}\nUse this to personalize your response.\n\n`
        : ''

    const prompt = `You are an expert planner.\n${contextBlock}\nEvent: ${body.eventType} | ...`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    // ... parse and return
}
```

## Key Gotchas

1. **Name leakage** — AI models will parrot back personal names if they're in the context. Add an explicit instruction in the context block: `"do NOT include any personal names in your output"`.

2. **Context bloat** — Don't dump everything into every prompt. Use `hasContext()` to skip the context block when there's nothing meaningful to add.

3. **Refinement vs new generation** — Handle these as two different prompt templates. Refinement prompts include the existing output and the user's feedback. New generation prompts start fresh.

4. **JSON output parsing** — AI models often wrap JSON in markdown code blocks. Strip them: `text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()`.

5. **Preference defaults** — Always spread defaults before stored data: `{ ...defaultPreferences(), ...storedData }`. This ensures new preference fields added later don't break existing users.

6. **Interaction count as version** — Using `interactionCount` as a merge tiebreaker is simple and effective. Higher count = more authoritative data.

## Reusable Checklist

- [ ] **Define context interfaces** for every data domain in your app
- [ ] **Build a context assembler** that converts raw data → structured context → natural language prompt block
- [ ] **Add cross-feature signal generation** that finds insights across data domains
- [ ] **Sanitize personal information** from AI context with inline instructions
- [ ] **Implement behavioral memory** with discriminated union signal types
- [ ] **Use localStorage-first storage** with fire-and-forget cloud sync for preferences
- [ ] **Use `interactionCount`** as a merge tiebreaker for cloud ↔ local sync
- [ ] **Separate refinement from new generation** prompts
- [ ] **Strip markdown wrapping** from AI JSON responses
- [ ] **Gate context injection** with a `hasContext()` check
