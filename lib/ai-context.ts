// ═══════════════════════════════════════════════════════
//  PartyPal Cross-Portal AI Context
//  Unified context builder that gives every AI surface
//  full awareness of the user's event, preferences,
//  guests, vendors, and behavioral patterns.
// ═══════════════════════════════════════════════════════

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

export interface GuestContext {
    totalGuests: number
    confirmedGuests: number
    dietaryRestrictions: string[]
    dietarySummary: string
    ageGroups?: string[]
    hasChildren?: boolean
}

export interface VendorContext {
    shortlistedVendors: { name: string; category: string; price: string }[]
    bookedCategories: string[]
    unbookedCategories: string[]
    budgetSpent: number
    budgetRemaining: number
}

export interface PlanContext {
    hasTimeline: boolean
    completedTasks: number
    totalTasks: number
    progressPercent: number
    overdueTasks: string[]
    upcomingTasks: string[]
}

export interface MoodboardContext {
    palette: string[]
    vibe: string
    decorStyle: string
    musicGenre: string
}

export interface UserPreferences {
    planningStyle: 'minimal' | 'detailed' | 'collaborative' | 'unknown'
    budgetTendency: 'frugal' | 'moderate' | 'lavish' | 'unknown'
    tonePreference: 'casual' | 'formal' | 'playful' | 'elegant' | 'unknown'
    favoriteCategories: string[]
    pastEventTypes: string[]
    refinementPatterns: string[]  // e.g., "user often asks for more formal language", "user prefers outdoor venues"
    interactionCount: number
    lastActiveDate: string
}

export interface CrossPortalContext {
    event: EventContext
    guests: GuestContext
    vendors: VendorContext
    plan: PlanContext
    moodboard: MoodboardContext
    preferences: UserPreferences
    signals: string[]  // Dynamic cross-feature insights
}

/**
 * Build a rich context string to inject into any AI prompt.
 * This gives the AI full awareness of the user's situation.
 */
export function buildContextPrompt(ctx: Partial<CrossPortalContext>, surface: string): string {
    const sections: string[] = []

    sections.push(`[CROSS-PORTAL CONTEXT — You have intelligence from across PartyPal's surfaces. Use this to make your ${surface} response deeply personalized and context-aware.]`)

    // Event context
    if (ctx.event) {
        const e = ctx.event
        const urgency = e.daysUntilEvent <= 3 ? '🔥 RUSH' : e.daysUntilEvent <= 7 ? '⚡ TIGHT' : e.daysUntilEvent <= 14 ? '⏰ SHORT' : '✅ COMFORTABLE'
        sections.push(`EVENT: ${e.eventType} | ${e.date} (${e.daysUntilEvent} days away — ${urgency}) | ${e.guests} guests | ${e.location} | Theme: ${e.theme} | Budget: ${e.budget}${e.time ? ` | Time: ${e.time}` : ''}`)
    }

    // Guest intelligence
    if (ctx.guests && ctx.guests.totalGuests > 0) {
        const g = ctx.guests
        let guestInfo = `GUESTS: ${g.totalGuests} invited, ${g.confirmedGuests} confirmed`
        if (g.dietaryRestrictions.length > 0) {
            guestInfo += ` | Dietary needs: ${g.dietarySummary}`
        }
        if (g.hasChildren) guestInfo += ' | Has children attending'
        sections.push(guestInfo)
    }

    // Vendor intelligence
    if (ctx.vendors) {
        const v = ctx.vendors
        if (v.shortlistedVendors.length > 0) {
            sections.push(`VENDORS: Shortlisted: ${v.shortlistedVendors.map(sv => `${sv.name} (${sv.category}, ${sv.price})`).join(', ')} | Budget spent: $${v.budgetSpent} of $${v.budgetSpent + v.budgetRemaining} ($${v.budgetRemaining} remaining) | Still need: ${v.unbookedCategories.join(', ') || 'All covered!'}`)
        }
    }

    // Plan progress
    if (ctx.plan && ctx.plan.hasTimeline) {
        const p = ctx.plan
        let planInfo = `PLAN: ${p.progressPercent}% complete (${p.completedTasks}/${p.totalTasks} tasks)`
        if (p.overdueTasks.length > 0) {
            planInfo += ` | ⚠️ OVERDUE: ${p.overdueTasks.slice(0, 3).join(', ')}`
        }
        if (p.upcomingTasks.length > 0) {
            planInfo += ` | Next up: ${p.upcomingTasks.slice(0, 2).join(', ')}`
        }
        sections.push(planInfo)
    }

    // Moodboard / aesthetic
    if (ctx.moodboard && ctx.moodboard.vibe) {
        sections.push(`AESTHETIC: ${ctx.moodboard.vibe} | Colors: ${ctx.moodboard.palette.join(', ')} | Music: ${ctx.moodboard.musicGenre}`)
    }

    // (User profile / behavioral preference sections removed to avoid creepy personalization)

    // Cross-feature signals
    if (ctx.signals && ctx.signals.length > 0) {
        sections.push(`INSIGHTS: ${ctx.signals.join(' | ')}`)
    }

    return sections.join('\n')
}

/**
 * Generate cross-feature signals by analyzing context relationships.
 * These are smart observations that connect dots across surfaces.
 */
export function generateSignals(ctx: Partial<CrossPortalContext>): string[] {
    const signals: string[] = []

    const event = ctx.event
    const guests = ctx.guests
    const vendors = ctx.vendors
    const plan = ctx.plan

    if (!event) return signals

    // Budget signals
    if (vendors && event.budgetAmount > 0) {
        const spentPercent = (vendors.budgetSpent / event.budgetAmount) * 100
        if (spentPercent > 80) signals.push(`⚠️ Budget is ${Math.round(spentPercent)}% allocated — remaining recommendations should be budget-conscious`)
        if (spentPercent < 30 && event.daysUntilEvent < 14) signals.push(`Budget is only ${Math.round(spentPercent)}% used with ${event.daysUntilEvent} days left — user may want premium options`)
    }

    // Guest-to-food signals
    if (guests && guests.dietaryRestrictions.length > 0) {
        signals.push(`${guests.dietaryRestrictions.length} dietary restriction types — food/catering recommendations should accommodate: ${guests.dietaryRestrictions.join(', ')}`)
    }

    // Guest count signals 
    if (guests && guests.totalGuests > 0) {
        if (guests.totalGuests > 50) signals.push('Large event (50+ guests) — prioritize vendors with capacity for large parties')
        if (guests.totalGuests <= 15) signals.push('Intimate gathering — suggest cozy, boutique-style vendors')
        if (guests.hasChildren) signals.push('Children attending — entertainment and food should include kid-friendly options')
    }

    // Timeline urgency signals
    if (event.daysUntilEvent <= 7 && plan && plan.progressPercent < 50) {
        signals.push('⚡ Event is within a week with less than 50% planning done — prioritize essentials, skip nice-to-haves')
    }

    // Theme-vendor alignment
    if (vendors && vendors.unbookedCategories.length > 0) {
        signals.push(`Still need vendors for: ${vendors.unbookedCategories.join(', ')} — prioritize these in recommendations`)
    }

    // Moodboard signals
    if (ctx.moodboard && ctx.moodboard.vibe) {
        signals.push(`Aesthetic direction: "${ctx.moodboard.vibe}" — align recommendations with this vibe`)
    }

    return signals
}

/**
 * Parse a budget string like "$2,000" into a number
 */
export function parseBudget(budget: string): number {
    if (!budget) return 0
    const cleaned = budget.replace(/[^0-9.]/g, '')
    return parseFloat(cleaned) || 0
}

/**
 * Calculate days until event from a date string
 */
export function daysUntilEvent(dateStr: string): number {
    if (!dateStr) return 999
    try {
        const eventDate = new Date(dateStr + 'T12:00:00')
        const today = new Date()
        today.setHours(12, 0, 0, 0)
        const diff = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return Math.max(0, diff)
    } catch {
        return 999
    }
}
