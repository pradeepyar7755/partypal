// ═══════════════════════════════════════════════════════
//  Server-side AI Context Assembler
//  Converts raw request data into a CrossPortalContext
//  and generates the context prompt injection.
// ═══════════════════════════════════════════════════════

import {
    type CrossPortalContext,
    type EventContext,
    type GuestContext,
    type VendorContext,
    type PlanContext,
    type MoodboardContext,
    type UserPreferences,
    buildContextPrompt,
    generateSignals,
    parseBudget,
    daysUntilEvent,
} from './ai-context'

/**
 * Build context from raw request body data.
 * API routes pass through whatever context the frontend sends.
 */
export function assembleContext(body: Record<string, unknown>, surface: string): string {
    const ctx: Partial<CrossPortalContext> = {}

    // ── Event Context ─────────────────────────────────
    if (body.eventType || body.date || body.location) {
        const budgetStr = (body.budget as string) || ''
        const dateStr = (body.date as string) || ''
        ctx.event = {
            eventType: (body.eventType as string) || '',
            date: dateStr,
            daysUntilEvent: daysUntilEvent(dateStr),
            guests: (body.guests as string) || '',
            guestCount: parseInt(String(body.guests || body.guestCount || '0')) || 0,
            location: (body.location as string) || '',
            theme: (body.theme as string) || '',
            budget: budgetStr,
            budgetAmount: parseBudget(budgetStr),
            time: (body.time as string) || undefined,
        }
    }

    // ── Guest Context ─────────────────────────────────
    const guestData = body.guestContext as Record<string, unknown> | undefined
    if (guestData) {
        ctx.guests = {
            totalGuests: (guestData.totalGuests as number) || 0,
            confirmedGuests: (guestData.confirmedGuests as number) || 0,
            dietaryRestrictions: (guestData.dietaryRestrictions as string[]) || [],
            dietarySummary: (guestData.dietarySummary as string) || '',
            hasChildren: (guestData.hasChildren as boolean) || false,
        }
    }

    // ── Vendor Context ────────────────────────────────
    const vendorData = body.vendorContext as Record<string, unknown> | undefined
    if (vendorData) {
        ctx.vendors = {
            shortlistedVendors: (vendorData.shortlistedVendors as { name: string; category: string; price: string }[]) || [],
            bookedCategories: (vendorData.bookedCategories as string[]) || [],
            unbookedCategories: (vendorData.unbookedCategories as string[]) || [],
            budgetSpent: (vendorData.budgetSpent as number) || 0,
            budgetRemaining: (vendorData.budgetRemaining as number) || 0,
        }
    }

    // ── Plan Context ──────────────────────────────────
    const planData = body.planContext as Record<string, unknown> | undefined
    if (planData) {
        ctx.plan = {
            hasTimeline: (planData.hasTimeline as boolean) || false,
            completedTasks: (planData.completedTasks as number) || 0,
            totalTasks: (planData.totalTasks as number) || 0,
            progressPercent: (planData.progressPercent as number) || 0,
            overdueTasks: (planData.overdueTasks as string[]) || [],
            upcomingTasks: (planData.upcomingTasks as string[]) || [],
        }
    }

    // ── Moodboard Context ─────────────────────────────
    const moodData = body.moodboardContext as Record<string, unknown> | undefined
    if (moodData) {
        ctx.moodboard = {
            palette: (moodData.palette as string[]) || [],
            vibe: (moodData.vibe as string) || '',
            decorStyle: (moodData.decorStyle as string) || '',
            musicGenre: (moodData.musicGenre as string) || '',
        }
    }

    // ── User Preferences ──────────────────────────────
    const prefData = body.userPreferences as Record<string, unknown> | undefined
    if (prefData && (prefData.interactionCount as number) > 0) {
        ctx.preferences = prefData as unknown as UserPreferences
    }

    // ── Generate Cross-Feature Signals ────────────────
    ctx.signals = generateSignals(ctx)

    // Build the prompt injection
    return buildContextPrompt(ctx, surface)
}

/**
 * Helper to check if meaningful context exists
 */
export function hasContext(body: Record<string, unknown>): boolean {
    return !!(body.guestContext || body.vendorContext || body.planContext || body.moodboardContext || body.userPreferences)
}

// Re-export types
export type { CrossPortalContext, EventContext, GuestContext, VendorContext, PlanContext, MoodboardContext, UserPreferences }
