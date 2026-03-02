// ═══════════════════════════════════════════════════════
//  PartyPal AI Memory — User Preference Learning
//  Observes user behavior across surfaces and builds
//  a preference profile that makes AI smarter over time.
// ═══════════════════════════════════════════════════════

import type { UserPreferences } from './ai-context'

const MEMORY_KEY = 'partypal_ai_memory'

// Default preferences for new users
export function defaultPreferences(): UserPreferences {
    return {
        planningStyle: 'unknown',
        budgetTendency: 'unknown',
        tonePreference: 'unknown',
        favoriteCategories: [],
        pastEventTypes: [],
        refinementPatterns: [],
        interactionCount: 0,
        lastActiveDate: new Date().toISOString().split('T')[0],
    }
}

/**
 * Load user preferences from localStorage
 */
export function loadPreferences(): UserPreferences {
    if (typeof window === 'undefined') return defaultPreferences()
    try {
        const stored = localStorage.getItem(MEMORY_KEY)
        if (stored) {
            return { ...defaultPreferences(), ...JSON.parse(stored) }
        }
    } catch { /* ignore */ }
    return defaultPreferences()
}

/**
 * Save preferences to localStorage + cloud (fire-and-forget)
 */
export function savePreferences(prefs: UserPreferences, uid?: string): void {
    if (typeof window === 'undefined') return
    try {
        prefs.lastActiveDate = new Date().toISOString().split('T')[0]
        localStorage.setItem(MEMORY_KEY, JSON.stringify(prefs))
        // Sync to cloud if user is logged in
        if (uid) {
            fetch('/api/user-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid, aiMemory: prefs }),
            }).catch(() => { })
        }
    } catch { /* ignore */ }
}

/**
 * Load preferences from cloud and merge with local (cloud wins for newer data)
 */
export async function loadFromCloud(uid: string): Promise<UserPreferences> {
    try {
        const res = await fetch(`/api/user-data?uid=${uid}`)
        const { data } = await res.json()
        if (data?.aiMemory) {
            const cloudPrefs = { ...defaultPreferences(), ...data.aiMemory } as UserPreferences
            const localPrefs = loadPreferences()
            // Cloud wins if it has more interactions
            if (cloudPrefs.interactionCount >= localPrefs.interactionCount) {
                localStorage.setItem(MEMORY_KEY, JSON.stringify(cloudPrefs))
                return cloudPrefs
            }
        }
    } catch { /* ignore */ }
    return loadPreferences()
}

/**
 * Record an interaction and update preferences based on signals
 */
export function recordInteraction(
    signal: InteractionSignal,
): UserPreferences {
    const prefs = loadPreferences()
    prefs.interactionCount++

    switch (signal.type) {
        case 'plan_generated':
            if (signal.eventType && !prefs.pastEventTypes.includes(signal.eventType)) {
                prefs.pastEventTypes.push(signal.eventType)
            }
            break

        case 'plan_refined':
            if (signal.refinementText) {
                // Learn tone preferences from refinement language
                const text = signal.refinementText.toLowerCase()
                if (text.includes('formal') || text.includes('elegant') || text.includes('professional')) {
                    prefs.tonePreference = 'formal'
                } else if (text.includes('casual') || text.includes('relaxed') || text.includes('chill')) {
                    prefs.tonePreference = 'casual'
                } else if (text.includes('fun') || text.includes('playful') || text.includes('silly')) {
                    prefs.tonePreference = 'playful'
                }

                // Track refinement patterns (keep last 10)
                const pattern = signal.refinementText.slice(0, 80)
                prefs.refinementPatterns = [pattern, ...prefs.refinementPatterns.slice(0, 9)]
            }
            break

        case 'vendor_shortlisted':
            if (signal.category && !prefs.favoriteCategories.includes(signal.category)) {
                prefs.favoriteCategories.push(signal.category)
            }
            break

        case 'budget_adjusted':
            if (signal.budgetDirection === 'up') {
                prefs.budgetTendency = prefs.budgetTendency === 'lavish' ? 'lavish' : 'moderate'
            } else if (signal.budgetDirection === 'down') {
                prefs.budgetTendency = prefs.budgetTendency === 'frugal' ? 'frugal' : 'moderate'
            }
            break

        case 'invite_style_chosen':
            if (signal.style) {
                const s = signal.style.toLowerCase()
                if (s.includes('formal') || s.includes('elegant') || s.includes('classic')) {
                    prefs.tonePreference = 'formal'
                } else if (s.includes('fun') || s.includes('playful') || s.includes('modern')) {
                    prefs.tonePreference = 'playful'
                } else if (s.includes('casual') || s.includes('relaxed')) {
                    prefs.tonePreference = 'casual'
                }
            }
            break

        case 'theme_selected':
            // Could infer aesthetic preferences
            if (signal.refinementText) {
                const theme = signal.refinementText.toLowerCase()
                if (theme.includes('minimalist') || theme.includes('modern') || theme.includes('clean')) {
                    prefs.planningStyle = 'minimal'
                } else if (theme.includes('grand') || theme.includes('elaborate') || theme.includes('luxury')) {
                    prefs.planningStyle = 'detailed'
                    prefs.budgetTendency = 'lavish'
                }
            }
            break

        case 'moodboard_generated':
            // Track that user engages with visual planning
            prefs.planningStyle = prefs.planningStyle === 'unknown' ? 'detailed' : prefs.planningStyle
            break
    }

    savePreferences(prefs)
    return prefs
}

// ── Interaction Signal Types ──────────────────────────
export type InteractionSignal =
    | { type: 'plan_generated'; eventType: string }
    | { type: 'plan_refined'; refinementText: string }
    | { type: 'vendor_shortlisted'; category: string; vendorName: string }
    | { type: 'vendor_removed'; category: string }
    | { type: 'budget_adjusted'; budgetDirection: 'up' | 'down'; amount: number }
    | { type: 'invite_style_chosen'; style: string }
    | { type: 'invite_refined'; refinementText: string }
    | { type: 'theme_selected'; refinementText: string }
    | { type: 'moodboard_generated' }
    | { type: 'guest_added'; hasEmail: boolean; hasDietary: boolean }
    | { type: 'checklist_completed'; taskCategory: string }
