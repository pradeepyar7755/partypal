// ═══════════════════════════════════════════════════════
//  PartyPal AI Context Hook
//  Frontend hook that gathers context from all surfaces
//  and bundles it with every AI API call.
// ═══════════════════════════════════════════════════════

import { useMemo, useCallback } from 'react'
import { loadPreferences, recordInteraction, type InteractionSignal } from './ai-memory'
import { parseBudget } from './ai-context'
import type { UserPreferences } from './ai-context'

interface PlanData {
    eventId?: string
    eventType?: string
    date?: string
    guests?: string
    location?: string
    theme?: string
    budget?: string
    time?: string
    plan?: {
        timeline?: { task: string; weeks: string; category?: string }[]
        moodboard?: {
            palette?: string[]
            vibe?: string
            musicGenre?: string
            decorIdeas?: string[]
        }
        budget?: {
            breakdown?: { category: string; amount: number }[]
        }
    }
}

interface EventGuest {
    name: string
    email?: string
    status?: string
    dietary?: string
    age?: string
}

/**
 * React hook that assembles cross-portal AI context
 * from the current event data, guests, vendors, and user memory.
 */
export function useAIContext(planData: PlanData | null, eventGuests: EventGuest[]) {

    // Gather guest context
    const guestContext = useMemo(() => {
        if (!planData?.eventId) return null

        // Also try to load from GuestManager storage
        let allGuests = [...eventGuests]
        try {
            const storageKey = `partypal_eventguests_${planData.eventId}`
            const stored = localStorage.getItem(storageKey)
            if (stored) {
                const parsed = JSON.parse(stored) as EventGuest[]
                if (Array.isArray(parsed)) {
                    // Merge, dedup by email
                    const existingEmails = new Set(allGuests.map(g => g.email).filter(Boolean))
                    parsed.forEach(g => {
                        if (g.email && !existingEmails.has(g.email)) {
                            allGuests.push(g)
                        }
                    })
                }
            }
        } catch { /* ignore */ }

        const dietaryMap: Record<string, number> = {}
        let hasChildren = false
        let confirmed = 0

        allGuests.forEach(g => {
            if (g.dietary && g.dietary !== 'None' && g.dietary !== 'none') {
                dietaryMap[g.dietary] = (dietaryMap[g.dietary] || 0) + 1
            }
            if (g.age && (g.age.includes('kid') || g.age.includes('child') || parseInt(g.age) < 13)) {
                hasChildren = true
            }
            if (g.status === 'confirmed' || g.status === 'going') confirmed++
        })

        const restrictions = Object.keys(dietaryMap)
        const summary = restrictions.map(r => `${dietaryMap[r]} ${r}`).join(', ')

        return {
            totalGuests: allGuests.length,
            confirmedGuests: confirmed,
            dietaryRestrictions: restrictions,
            dietarySummary: summary || 'No special requirements tracked',
            hasChildren,
        }
    }, [planData?.eventId, eventGuests])

    // Gather vendor context
    const vendorContext = useMemo(() => {
        try {
            const shortlistData = JSON.parse(localStorage.getItem('partypal_shortlist_data') || '{}')
            const shortlisted = Object.values(shortlistData) as { name: string; category: string; price: string }[]

            const allCategories = ['Venue', 'Decor', 'Baker', 'Food', 'Photos', 'Music', 'Drinks', 'Entertain']
            const bookedCategories = Array.from(new Set(shortlisted.map(v => v.category)))
            const unbookedCategories = allCategories.filter(c => !bookedCategories.includes(c))

            // Try to get budget data
            let budgetSpent = 0
            let budgetTotal = parseBudget(planData?.budget || '')

            if (planData?.plan?.budget?.breakdown) {
                budgetSpent = planData.plan.budget.breakdown.reduce((sum, b) => sum + (b.amount || 0), 0)
            }

            return {
                shortlistedVendors: shortlisted.slice(0, 8),
                bookedCategories,
                unbookedCategories,
                budgetSpent,
                budgetRemaining: Math.max(0, budgetTotal - budgetSpent),
            }
        } catch {
            return null
        }
    }, [planData?.budget, planData?.plan?.budget?.breakdown])

    // Gather plan context
    const planContext = useMemo(() => {
        if (!planData?.plan?.timeline) return null

        const timeline = planData.plan.timeline
        // Try to get checklist data
        let completedTasks = 0
        let totalTasks = 0
        const overdueTasks: string[] = []
        const upcomingTasks: string[] = []

        try {
            const checklistKey = planData.eventId ? `partypal_checklist_${planData.eventId}` : 'partypal_checklist'
            const stored = localStorage.getItem(checklistKey)
            if (stored) {
                const items = JSON.parse(stored) as { item: string; done: boolean }[]
                totalTasks = items.length
                completedTasks = items.filter(i => i.done).length
                items.filter(i => !i.done).slice(0, 3).forEach(i => upcomingTasks.push(i.item))
            } else {
                totalTasks = timeline.length
            }
        } catch {
            totalTasks = timeline.length
        }

        // Check for overdue items
        const today = new Date()
        timeline.forEach(t => {
            if (t.weeks && (t.weeks.toLowerCase().includes('overdue') || t.weeks.toLowerCase().includes('now'))) {
                overdueTasks.push(t.task)
            }
        })

        return {
            hasTimeline: true,
            completedTasks,
            totalTasks,
            progressPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            overdueTasks,
            upcomingTasks,
        }
    }, [planData?.plan?.timeline, planData?.eventId])

    // Gather moodboard context
    const moodboardContext = useMemo(() => {
        const mb = planData?.plan?.moodboard
        if (!mb) return null
        return {
            palette: mb.palette || [],
            vibe: mb.vibe || '',
            decorStyle: (mb.decorIdeas || []).join(', '),
            musicGenre: mb.musicGenre || '',
        }
    }, [planData?.plan?.moodboard])

    // Load user preferences
    const userPreferences = useMemo(() => {
        return loadPreferences()
    }, [])

    /**
     * Bundle all context into a payload that gets sent with API calls.
     * Frontend components call this and spread it into their fetch body.
     */
    const getContextPayload = useCallback(() => {
        const payload: Record<string, unknown> = {}

        if (guestContext && guestContext.totalGuests > 0) {
            payload.guestContext = guestContext
        }
        if (vendorContext && vendorContext.shortlistedVendors.length > 0) {
            payload.vendorContext = vendorContext
        }
        if (planContext) {
            payload.planContext = planContext
        }
        if (moodboardContext && moodboardContext.vibe) {
            payload.moodboardContext = moodboardContext
        }
        if (userPreferences.interactionCount > 0) {
            payload.userPreferences = userPreferences
        }

        return payload
    }, [guestContext, vendorContext, planContext, moodboardContext, userPreferences])

    /**
     * Record an interaction signal to the learning system
     */
    const learn = useCallback((signal: InteractionSignal): UserPreferences => {
        return recordInteraction(signal)
    }, [])

    return {
        guestContext,
        vendorContext,
        planContext,
        moodboardContext,
        userPreferences,
        getContextPayload,
        learn,
    }
}
