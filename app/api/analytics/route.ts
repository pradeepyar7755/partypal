import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'
import { verifyAdmin } from '@/lib/admin-auth'

// ═══════════════════════════════════════════════════════
//  Analytics API
//  POST: Batch write analytics events (public — no auth)
//  GET:  Query aggregated analytics (ADMIN ONLY)
// ═══════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
    try {
        const { events } = await req.json()
        if (!events || !Array.isArray(events) || events.length === 0) {
            return NextResponse.json({ ok: true })
        }

        const db = getDb()
        const now = new Date()
        const dateKey = now.toISOString().split('T')[0]

        // Write individual events
        const writePromises = events.slice(0, 50).map((evt: Record<string, unknown>) => {
            return db.collection('analytics_events').add({
                ...evt,
                dateKey,
                serverTimestamp: now.toISOString(),
            })
        })

        // Build aggregate update
        const eventCounts: Record<string, number> = {}
        const pages: Record<string, number> = {}
        let sessionCount = 0
        let userCount = 0
        const seenSessions = new Set<string>()
        const seenUsers = new Set<string>()

        for (const evt of events) {
            eventCounts[evt.event] = (eventCounts[evt.event] || 0) + 1
            if (evt.page) {
                const safeKey = evt.page.replace(/\//g, '_').replace(/^_/, 'root') || 'root'
                pages[safeKey] = (pages[safeKey] || 0) + 1
            }
            if (evt.sessionId && !seenSessions.has(evt.sessionId)) {
                seenSessions.add(evt.sessionId)
                sessionCount++
            }
            if (evt.userId && !seenUsers.has(evt.userId)) {
                seenUsers.add(evt.userId)
                userCount++
            }
        }

        // Read-modify-write the daily aggregate
        const aggregateRef = db.collection('analytics_daily').doc(dateKey)
        const aggregateDoc = await aggregateRef.get()
        const existing = aggregateDoc.exists ? aggregateDoc.data() || {} : {}

        const existingEvents = (existing.events || {}) as Record<string, number>
        const existingPages = (existing.pages || {}) as Record<string, number>

        for (const [event, count] of Object.entries(eventCounts)) {
            existingEvents[event] = (existingEvents[event] || 0) + count
        }
        for (const [page, count] of Object.entries(pages)) {
            existingPages[page] = (existingPages[page] || 0) + count
        }

        const aggregateData = {
            date: dateKey,
            lastUpdated: now.toISOString(),
            events: existingEvents,
            pages: existingPages,
            totalEvents: ((existing.totalEvents as number) || 0) + events.length,
            sessions: ((existing.sessions as number) || 0) + sessionCount,
            users: ((existing.users as number) || 0) + userCount,
        }

        await Promise.all([...writePromises, aggregateRef.set(aggregateData)])

        return NextResponse.json({ ok: true, tracked: events.length })
    } catch (error) {
        console.error('Analytics write error:', error)
        return NextResponse.json({ ok: true }) // Never fail the client
    }
}

// Quick-fail wrapper: prevents Firestore queries from hanging when credentials are missing
async function firestoreQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await Promise.race([
            fn(),
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ])
    } catch {
        return fallback
    }
}

export async function GET(req: NextRequest) {
    try {
        // ── Server-side admin auth check ──
        const admin = await verifyAdmin(req.headers.get('authorization'))
        if (!admin) {
            return NextResponse.json(
                { error: 'Unauthorized — admin access required' },
                { status: 401 }
            )
        }

        const { searchParams } = new URL(req.url)
        const query = searchParams.get('q') || 'dashboard'
        const days = parseInt(searchParams.get('days') || '30')

        const db = getDb()

        switch (query) {
            case 'dashboard': {
                // Get daily aggregates for the last N days
                const startDate = new Date()
                startDate.setDate(startDate.getDate() - days)
                const startKey = startDate.toISOString().split('T')[0]

                const eventInsights = {
                    totalEventsCreated: 0,
                    eventTypes: {} as Record<string, number>,
                    avgGuests: 0,
                    locations: {} as Record<string, number>,
                    themes: {} as Record<string, number>,
                }

                // Run ALL Firestore queries in parallel (3s timeout each)
                const [dailyData, recentErrors, recentActivity, , totalRegisteredUsers, churnData, eventDeletionData, activityLogData] = await Promise.all([
                    firestoreQuery(
                        async () => {
                            const snap = await db.collection('analytics_daily')
                                .where('date', '>=', startKey)
                                .orderBy('date', 'desc')
                                .limit(days)
                                .get()
                            return snap.docs.map(doc => doc.data())
                        },
                        [] as Record<string, unknown>[]
                    ),
                    firestoreQuery(
                        async () => {
                            const snap = await db.collection('analytics_events')
                                .where('event', '==', 'error')
                                .orderBy('serverTimestamp', 'desc')
                                .limit(20)
                                .get()
                            return snap.docs.map(doc => {
                                const d = doc.data()
                                return { message: d.properties?.error || 'Unknown', source: d.properties?.source || '', page: d.page, timestamp: d.timestamp, userId: d.userId as string | undefined }
                            })
                        },
                        [] as { message: string; source: string; page: string; timestamp: string; userId: string | undefined }[]
                    ),
                    firestoreQuery(
                        async () => {
                            const snap = await db.collection('analytics_events')
                                .orderBy('serverTimestamp', 'desc')
                                .limit(50)
                                .get()
                            return snap.docs.map(doc => {
                                const d = doc.data()
                                return { event: d.event, page: d.page, timestamp: d.timestamp, userId: d.userId as string | undefined, properties: d.properties as Record<string, unknown> | undefined }
                            })
                        },
                        [] as { event: string; page: string; timestamp: string; userId: string | undefined; properties: Record<string, unknown> | undefined }[]
                    ),
                    firestoreQuery(
                        async () => {
                            const snap = await db.collection('events').orderBy('updatedAt', 'desc').limit(100).get()
                            eventInsights.totalEventsCreated = snap.size
                            let guestTotal = 0, guestCount = 0
                            for (const doc of snap.docs) {
                                const d = doc.data()
                                if (d.eventType) eventInsights.eventTypes[d.eventType as string] = (eventInsights.eventTypes[d.eventType as string] || 0) + 1
                                if (d.guests) { const g = parseInt(String(d.guests)); if (!isNaN(g)) { guestTotal += g; guestCount++ } }
                                if (d.location) { const loc = String(d.location).split(',')[0].trim(); eventInsights.locations[loc] = (eventInsights.locations[loc] || 0) + 1 }
                                if (d.theme) eventInsights.themes[d.theme as string] = (eventInsights.themes[d.theme as string] || 0) + 1
                            }
                            eventInsights.avgGuests = guestCount > 0 ? Math.round(guestTotal / guestCount) : 0
                        },
                        undefined
                    ),
                    firestoreQuery(
                        async () => {
                            const snap = await db.collection('users').count().get()
                            return snap.data().count
                        },
                        0
                    ),
                    // Churn / account deletion analytics
                    firestoreQuery(
                        async () => {
                            const allDeletions = await db.collection('account_deletions')
                                .orderBy('deletedAt', 'desc')
                                .limit(200)
                                .get()
                            const totalDeleted = allDeletions.size
                            const reasons: Record<string, number> = {}
                            let totalTenure = 0, totalEvents = 0, totalSessions = 0
                            let deletedInPeriod = 0
                            const deletionsByDay: Record<string, number> = {}
                            const recentDeletions: { displayName: string; email: string; tenureDays: number; reason: string; deletedAt: string; eventsCreated: number; totalSessions: number }[] = []

                            allDeletions.forEach(doc => {
                                const d = doc.data()
                                const deletedAt = (d.deletedAt as string) || ''
                                const reason = (d.reason as string) || 'not_specified'
                                const tenure = (d.tenureDays as number) || 0
                                const events = (d.eventsCreated as number) || 0
                                const sessions = (d.totalSessions as number) || 0

                                reasons[reason] = (reasons[reason] || 0) + 1
                                totalTenure += tenure
                                totalEvents += events
                                totalSessions += sessions

                                if (deletedAt >= startKey) {
                                    deletedInPeriod++
                                    const day = deletedAt.split('T')[0]
                                    deletionsByDay[day] = (deletionsByDay[day] || 0) + 1
                                }

                                if (recentDeletions.length < 10) {
                                    recentDeletions.push({
                                        displayName: (d.displayName as string) || '',
                                        email: ((d.email as string) || '').replace(/(.{2}).*(@.*)/, '$1***$2'),
                                        tenureDays: tenure,
                                        reason,
                                        deletedAt,
                                        eventsCreated: events,
                                        totalSessions: sessions,
                                    })
                                }
                            })

                            return {
                                totalDeleted,
                                deletedInPeriod,
                                deletionsByDay,
                                reasons,
                                avgTenureDays: totalDeleted > 0 ? Math.round(totalTenure / totalDeleted) : 0,
                                avgEventsCreated: totalDeleted > 0 ? parseFloat((totalEvents / totalDeleted).toFixed(1)) : 0,
                                avgSessions: totalDeleted > 0 ? parseFloat((totalSessions / totalDeleted).toFixed(1)) : 0,
                                recentDeletions,
                            }
                        },
                        {
                            totalDeleted: 0, deletedInPeriod: 0, deletionsByDay: {} as Record<string, number>,
                            reasons: {} as Record<string, number>, avgTenureDays: 0, avgEventsCreated: 0,
                            avgSessions: 0, recentDeletions: [] as { displayName: string; email: string; tenureDays: number; reason: string; deletedAt: string; eventsCreated: number; totalSessions: number }[],
                        }
                    ),
                    // Event deletion analytics
                    firestoreQuery(
                        async () => {
                            const snap = await db.collection('event_deletions')
                                .orderBy('deletedAt', 'desc')
                                .limit(200)
                                .get()
                            let deletedInPeriod = 0
                            const deletionsByDay: Record<string, number> = {}
                            const deletedEventTypes: Record<string, number> = {}
                            const recentDeletions: { eventId: string; eventType: string; deletedAt: string; uid: string }[] = []

                            snap.forEach(doc => {
                                const d = doc.data()
                                const deletedAt = (d.deletedAt as string) || ''
                                const eventType = (d.eventType as string) || 'Unknown'
                                deletedEventTypes[eventType] = (deletedEventTypes[eventType] || 0) + 1
                                if (deletedAt >= startKey) {
                                    deletedInPeriod++
                                    const day = deletedAt.split('T')[0]
                                    deletionsByDay[day] = (deletionsByDay[day] || 0) + 1
                                }
                                if (recentDeletions.length < 15) {
                                    recentDeletions.push({
                                        eventId: (d.eventId as string) || '',
                                        eventType,
                                        deletedAt,
                                        uid: ((d.uid as string) || '').slice(0, 8),
                                    })
                                }
                            })

                            return {
                                totalDeleted: snap.size,
                                deletedInPeriod,
                                deletionsByDay,
                                deletedEventTypes,
                                recentDeletions,
                            }
                        },
                        {
                            totalDeleted: 0, deletedInPeriod: 0,
                            deletionsByDay: {} as Record<string, number>,
                            deletedEventTypes: {} as Record<string, number>,
                            recentDeletions: [] as { eventId: string; eventType: string; deletedAt: string; uid: string }[],
                        }
                    ),
                    // Event activity log for admin
                    firestoreQuery(
                        async () => {
                            const snap = await db.collection('event_activity_log')
                                .orderBy('timestamp', 'desc')
                                .limit(100)
                                .get()
                            return snap.docs.map(doc => {
                                const d = doc.data()
                                return {
                                    eventId: (d.eventId as string) || '',
                                    uid: ((d.uid as string) || '').slice(0, 8),
                                    action: (d.action as string) || '',
                                    changes: (d.changes as { field: string; from: string; to: string }[]) || [],
                                    timestamp: (d.timestamp as string) || '',
                                }
                            })
                        },
                        [] as { eventId: string; uid: string; action: string; changes: { field: string; from: string; to: string }[]; timestamp: string }[]
                    ),
                ])

                // Calculate totals from daily data
                let totalPageViews = 0, totalSignUps = 0, totalPlansGenerated = 0
                let totalVendorSearches = 0, totalRSVPs = 0, totalErrors = 0
                let totalSessions = 0, totalUsers = 0, totalEvents = 0

                const pageViewsByDay: { date: string; views: number }[] = []
                const signUpsByDay: { date: string; count: number }[] = []

                for (const day of dailyData) {
                    const events = (day.events || {}) as Record<string, number>
                    const pv = events.page_view || 0
                    totalPageViews += pv
                    totalSignUps += events.sign_up || 0
                    totalPlansGenerated += events.plan_generated || 0
                    totalVendorSearches += events.vendor_search || 0
                    totalRSVPs += events.rsvp_submitted || 0
                    totalErrors += events.error || 0
                    totalSessions += (day.sessions as number) || 0
                    totalUsers += (day.users as number) || 0
                    totalEvents += (day.totalEvents as number) || 0
                    pageViewsByDay.push({ date: day.date as string, views: pv })
                    signUpsByDay.push({ date: day.date as string, count: events.sign_up || 0 })
                }

                // Fill empty chart data when no Firestore data exists
                if (pageViewsByDay.length === 0) {
                    for (let i = days - 1; i >= 0; i--) {
                        const d = new Date()
                        d.setDate(d.getDate() - i)
                        const dateStr = d.toISOString().split('T')[0]
                        pageViewsByDay.push({ date: dateStr, views: 0 })
                        signUpsByDay.push({ date: dateStr, count: 0 })
                    }
                }

                // Page popularity
                const pagePopularity: Record<string, number> = {}
                for (const day of dailyData) {
                    const pages = (day.pages || {}) as Record<string, number>
                    for (const [page, count] of Object.entries(pages)) {
                        pagePopularity[page] = (pagePopularity[page] || 0) + count
                    }
                }

                // Conversion rates
                const conversionRates = {
                    visitorToSignUp: totalPageViews > 0 ? ((totalSignUps / totalPageViews) * 100).toFixed(1) : '0',
                    signUpToPlan: totalSignUps > 0 ? ((totalPlansGenerated / totalSignUps) * 100).toFixed(1) : '0',
                    planToVendor: totalPlansGenerated > 0 ? ((totalVendorSearches / totalPlansGenerated) * 100).toFixed(1) : '0',
                }

                return NextResponse.json({
                    period: `${days} days`,
                    kpis: {
                        totalPageViews,
                        totalSessions,
                        totalUsers,
                        totalRegisteredUsers,
                        totalSignUps,
                        totalPlansGenerated,
                        totalVendorSearches,
                        totalRSVPs,
                        totalErrors,
                        totalEvents,
                    },
                    conversionRates,
                    pageViewsByDay: pageViewsByDay.reverse(),
                    signUpsByDay: signUpsByDay.reverse(),
                    pagePopularity,
                    recentErrors,
                    recentActivity,
                    eventInsights,
                    eventDeletions: eventDeletionData,
                    activityLog: activityLogData,
                    churn: {
                        ...churnData,
                        churnRate: totalRegisteredUsers > 0
                            ? parseFloat(((churnData.deletedInPeriod / (totalRegisteredUsers + churnData.totalDeleted)) * 100).toFixed(1))
                            : 0,
                        netGrowth: totalSignUps - churnData.deletedInPeriod,
                        retentionRate: totalRegisteredUsers > 0
                            ? parseFloat((100 - ((churnData.deletedInPeriod / (totalRegisteredUsers + churnData.totalDeleted)) * 100)).toFixed(1))
                            : 100,
                    },
                })
            }

            default:
                return NextResponse.json({ error: 'Unknown query' }, { status: 400 })
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Analytics read error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
