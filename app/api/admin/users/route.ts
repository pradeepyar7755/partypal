import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'
import { verifyAdmin } from '@/lib/admin-auth'

// GET: Fetch all registered users with session analytics (ADMIN ONLY)
export async function GET(req: NextRequest) {
    try {
        const admin = await verifyAdmin(req.headers.get('authorization'))
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()

        // Fetch all registered users
        const usersSnap = await db.collection('users').get()
        const users: Record<string, {
            uid: string; email: string; displayName: string; role: string
            createdAt: string; signInMethod?: string; testAccount?: boolean
        }> = {}
        usersSnap.forEach(doc => {
            const d = doc.data()
            users[doc.id] = {
                uid: doc.id,
                email: (d.email as string) || '',
                displayName: (d.displayName as string) || '',
                role: (d.role as string) || 'user',
                createdAt: (d.createdAt as string) || '',
                signInMethod: (d.signInMethod as string) || undefined,
                testAccount: (d.testAccount as boolean) || false,
            }
        })

        // Fetch recent analytics events to compute per-user stats
        // Get last 30 days of analytics events
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const cutoff = thirtyDaysAgo.toISOString()

        const eventsSnap = await db.collection('analytics_events')
            .where('timestamp', '>=', cutoff)
            .orderBy('timestamp', 'desc')
            .limit(5000)
            .get()

        // Aggregate per-user stats
        const userStats: Record<string, {
            totalPageViews: number
            totalSessions: number
            sessions: Set<string>
            pages: Record<string, number>
            totalTimeOnPage: number
            timeEntries: number
            lastActive: string
            events: { event: string; page: string; timestamp: string; properties?: Record<string, unknown> }[]
            dailyActivity: Record<string, number>
            signUpMethod?: string
            locations: Record<string, number>
        }> = {}

        eventsSnap.forEach(doc => {
            const d = doc.data()
            const userId = d.userId as string
            if (!userId) return

            if (!userStats[userId]) {
                userStats[userId] = {
                    totalPageViews: 0,
                    totalSessions: 0,
                    sessions: new Set(),
                    pages: {},
                    totalTimeOnPage: 0,
                    timeEntries: 0,
                    lastActive: '',
                    events: [],
                    dailyActivity: {},
                    locations: {},
                }
            }

            const stats = userStats[userId]
            const event = d.event as string
            const timestamp = d.timestamp as string
            const sessionId = d.sessionId as string
            const page = d.page as string
            const properties = d.properties as Record<string, unknown> | undefined

            // Track sessions
            if (sessionId && !stats.sessions.has(sessionId)) {
                stats.sessions.add(sessionId)
                stats.totalSessions++
            }

            // Track page views
            if (event === 'page_view') {
                stats.totalPageViews++
                if (page) stats.pages[page] = (stats.pages[page] || 0) + 1

                // Track location from page view properties
                if (properties?.city) {
                    const loc = `${properties.city}${properties.region ? ', ' + properties.region : ''}`
                    stats.locations[loc] = (stats.locations[loc] || 0) + 1
                } else if (properties?.timezone) {
                    const tz = String(properties.timezone)
                    // Convert timezone like "America/New_York" to a readable location
                    const city = tz.split('/').pop()?.replace(/_/g, ' ') || tz
                    stats.locations[city] = (stats.locations[city] || 0) + 1
                }
            }

            // Track time on page
            if (event === 'page_exit' && properties?.timeOnPage) {
                const time = Number(properties.timeOnPage)
                if (!isNaN(time) && time > 0 && time < 3600) {
                    stats.totalTimeOnPage += time
                    stats.timeEntries++
                }
            }

            // Track sign-up method
            if (event === 'sign_up' && properties?.method) {
                stats.signUpMethod = properties.method as string
            }

            // Track daily activity
            if (timestamp) {
                const day = timestamp.split('T')[0]
                stats.dailyActivity[day] = (stats.dailyActivity[day] || 0) + 1
                if (!stats.lastActive || timestamp > stats.lastActive) {
                    stats.lastActive = timestamp
                }
            }

            // Keep recent events (last 20 per user)
            if (stats.events.length < 20) {
                stats.events.push({
                    event,
                    page: page || '',
                    timestamp: timestamp || '',
                    properties,
                })
            }
        })

        // Count events per user from events collection
        const eventsCountSnap = await db.collection('events').get()
        const userEventCounts: Record<string, number> = {}
        eventsCountSnap.forEach(doc => {
            const uid = doc.data().uid as string
            if (uid) userEventCounts[uid] = (userEventCounts[uid] || 0) + 1
        })

        // Build response
        const userList = Object.entries(users).map(([uid, user]) => {
            const stats = userStats[uid]
            return {
                ...user,
                totalPageViews: stats?.totalPageViews || 0,
                totalSessions: stats?.totalSessions || 0,
                avgTimePerSession: stats && stats.timeEntries > 0
                    ? Math.round(stats.totalTimeOnPage / stats.timeEntries)
                    : 0,
                totalTimeOnSite: stats?.totalTimeOnPage || 0,
                lastActive: stats?.lastActive || user.createdAt || '',
                topPages: stats ? Object.entries(stats.pages)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([page, views]) => ({ page, views }))
                    : [],
                recentEvents: stats?.events || [],
                dailyActivity: stats?.dailyActivity || {},
                signUpMethod: stats?.signUpMethod || user.signInMethod || 'unknown',
                eventsCreated: userEventCounts[uid] || 0,
                location: stats ? Object.entries(stats.locations)
                    .sort((a, b) => b[1] - a[1])
                    .map(([loc]) => loc)[0] || ''
                    : '',
                activeDays: stats ? Object.keys(stats.dailyActivity).length : 0,
            }
        })

        // Sort by last active (most recent first)
        userList.sort((a, b) => (b.lastActive || '').localeCompare(a.lastActive || ''))

        return NextResponse.json({
            users: userList,
            totalRegistered: userList.length,
        })
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Admin users error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
