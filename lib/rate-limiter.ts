// ═══════════════════════════════════════════════════════
//  Dynamic Rate Limiter for Gemini AI Calls
//  Scales per-user limits down as user base grows
//  to stay within API plan budget.
// ═══════════════════════════════════════════════════════

import { getDb } from '@/lib/firebase'

// ── Configuration ─────────────────────────────────────
// Gemini 2.5 Flash — Paid Tier 1 limits:
export const PLAN_CONFIG = {
    dailyRequestBudget: 1500,     // Paid Tier 1: 1,500 RPD
    requestsPerMinute: 300,       // Paid Tier 1: 300 RPM
    tokensPerMinute: 1_000_000,   // Paid Tier 1: 1M TPM

    // Cost estimates per endpoint (for the admin dashboard)
    costPerPlan: 0.01,            // ~2K input + ~2K output tokens
    costPerRefinement: 0.005,
    costPerMoodboard: 0.005,
    costPerGuestAction: 0.003,
    costPerVendorSearch: 0.01,    // ~20 vendor summaries

    // Scaling thresholds — per-user daily AI call limits
    // Each "call" = 1 user action (generate plan, search vendors, write invite, etc.)
    // A typical active planning session uses ~15-25 calls
    thresholds: [
        { maxUsers: 25, dailyLimitPerUser: 100, label: 'Early Stage', action: 'No limits enforced — tracking only', userExperience: 'Unlimited feel — users can plan freely' },
        { maxUsers: 50, dailyLimitPerUser: 50, label: 'Growing', action: 'Generous limits active', userExperience: '~3 full planning sessions per day' },
        { maxUsers: 100, dailyLimitPerUser: 25, label: 'Active', action: 'Standard limits enforced', userExperience: '1-2 full planning sessions per day' },
        { maxUsers: 250, dailyLimitPerUser: 15, label: 'Scaling', action: 'Moderate limits — monitor closely', userExperience: '1 solid planning session per day' },
        { maxUsers: 500, dailyLimitPerUser: 10, label: 'High Volume', action: 'Consider Tier 2 upgrade ($250 cumulative)', userExperience: 'Core actions only — may need to resume tomorrow' },
        { maxUsers: 1000, dailyLimitPerUser: 8, label: 'Tier 2 Required', action: 'Upgrade to Tier 2 (10K RPD)', userExperience: 'Limited — essential actions only' },
    ],
}

// ── Get current tier based on user count ──────────────
export function getCurrentTier(registeredUsers: number) {
    const tier = PLAN_CONFIG.thresholds.find(t => registeredUsers <= t.maxUsers)
        || PLAN_CONFIG.thresholds[PLAN_CONFIG.thresholds.length - 1]

    const prevTier = PLAN_CONFIG.thresholds.find(t => t.maxUsers > (tier?.maxUsers || 0))
    const nextThreshold = prevTier?.maxUsers || null

    return {
        ...tier,
        currentUsers: registeredUsers,
        totalDailyCapacity: PLAN_CONFIG.dailyRequestBudget,
        utilizationPercent: Math.round((registeredUsers * tier.dailyLimitPerUser / PLAN_CONFIG.dailyRequestBudget) * 100),
        nextThreshold,
        headroom: Math.max(0, tier.dailyLimitPerUser * registeredUsers <= PLAN_CONFIG.dailyRequestBudget
            ? PLAN_CONFIG.dailyRequestBudget - (registeredUsers * tier.dailyLimitPerUser)
            : 0),
        estimatedMonthlyCost: registeredUsers * tier.dailyLimitPerUser * 30 * 0.003, // rough cost estimate
    }
}

// ── Check rate limit for a user or IP ─────────────────
export async function checkRateLimit(
    identifier: string,   // uid or IP address
    endpoint: string
): Promise<{ allowed: boolean; remaining: number; limit: number; resetAt: string }> {
    const db = getDb()
    const today = new Date().toISOString().split('T')[0]
    const safeId = identifier.replace(/[./]/g, '_')   // sanitize IPs for Firestore doc ids
    const rateLimitRef = db.collection('rate_limits').doc(`${safeId}_${today}`)

    const doc = await rateLimitRef.get()
    const currentCount = doc.exists ? (doc.data()?.count || 0) : 0

    // Get current user count to determine tier
    const usersSnap = await db.collection('users').count().get()
    const registeredUsers = usersSnap.data().count || 1
    const tier = getCurrentTier(registeredUsers)

    const limit = tier.dailyLimitPerUser
    const remaining = Math.max(0, limit - currentCount)

    // If under the "no limits needed" threshold, always allow
    if (registeredUsers <= PLAN_CONFIG.thresholds[0].maxUsers) {
        // Still track for analytics, but don't block
        await rateLimitRef.set({
            uid: safeId,
            count: currentCount + 1,
            date: today,
            lastEndpoint: endpoint,
            updatedAt: new Date().toISOString(),
        }, { merge: true })

        return {
            allowed: true,
            remaining: limit - currentCount - 1,
            limit,
            resetAt: `${today}T23:59:59Z`,
        }
    }

    if (currentCount >= limit) {
        return {
            allowed: false,
            remaining: 0,
            limit,
            resetAt: `${today}T23:59:59Z`,
        }
    }

    // Increment counter
    await rateLimitRef.set({
        uid: safeId,
        count: currentCount + 1,
        date: today,
        lastEndpoint: endpoint,
        updatedAt: new Date().toISOString(),
    }, { merge: true })

    return {
        allowed: true,
        remaining: limit - currentCount - 1,
        limit,
        resetAt: `${today}T23:59:59Z`,
    }
}

// ── Get usage stats for admin dashboard ───────────────
export async function getUsageStats() {
    const db = getDb()
    const today = new Date().toISOString().split('T')[0]

    // Get today's total API calls across all users
    const todaySnap = await db.collection('rate_limits')
        .where('date', '==', today)
        .get()

    let todayTotalCalls = 0
    let todayActiveUsers = 0
    const userCalls: { uid: string; count: number }[] = []

    todaySnap.docs.forEach(doc => {
        const data = doc.data()
        todayTotalCalls += data.count || 0
        todayActiveUsers++
        userCalls.push({ uid: data.uid, count: data.count })
    })

    // Get registered user count
    const usersSnap = await db.collection('users').count().get()
    const registeredUsers = usersSnap.data().count || 0

    const tier = getCurrentTier(registeredUsers)

    // Get last 7 days usage
    const last7Days: { date: string; calls: number }[] = []
    for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const daySnap = await db.collection('rate_limits')
            .where('date', '==', dateStr)
            .get()
        let dayCalls = 0
        daySnap.docs.forEach(doc => { dayCalls += doc.data().count || 0 })
        last7Days.push({ date: dateStr, calls: dayCalls })
    }

    return {
        today: {
            totalCalls: todayTotalCalls,
            activeUsers: todayActiveUsers,
            budgetRemaining: PLAN_CONFIG.dailyRequestBudget - todayTotalCalls,
            budgetUsedPercent: Math.round((todayTotalCalls / PLAN_CONFIG.dailyRequestBudget) * 100),
        },
        tier,
        registeredUsers,
        topUsers: userCalls.sort((a, b) => b.count - a.count).slice(0, 5),
        last7Days,
        config: PLAN_CONFIG,
    }
}
