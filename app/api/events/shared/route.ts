import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// GET: Fetch events shared with a user (where they are a collaborator)
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const uid = url.searchParams.get('uid')
        const email = url.searchParams.get('email')

        if (!uid && !email) {
            return NextResponse.json({ error: 'Missing uid or email' }, { status: 400 })
        }

        const db = getDb()
        const sharedEvents: Record<string, unknown>[] = []

        // Method 1: Check user_shared_events collection
        if (uid) {
            const userDoc = await db.collection('user_shared_events').doc(uid).get()
            if (userDoc.exists) {
                const eventRefs = userDoc.data()?.events || []
                for (const ref of eventRefs) {
                    const eventDoc = await db.collection('events').doc(ref.eventId).get()
                    if (eventDoc.exists) {
                        const eventData = eventDoc.data()!
                        // Skip trashed events
                        if (eventData.trashedAt) continue
                        sharedEvents.push({
                            ...eventData,
                            eventId: ref.eventId,
                            collaboratorRole: ref.role,
                            isShared: true,
                        })
                    }
                }
            }
        }

        // Method 2: Also check events where user's email is in collaborators array
        if (email) {
            const eventsSnapshot = await db.collection('events').get()
            eventsSnapshot.forEach(doc => {
                const data = doc.data()
                const collabs = data.collaborators || []
                const isCollab = collabs.some((c: { email: string; uid?: string }) =>
                    c.email === email || (uid && c.uid === uid)
                )
                if (isCollab && !sharedEvents.some(e => e.eventId === doc.id)) {
                    // Skip trashed events
                    if (data.trashedAt) return
                    const role = collabs.find((c: { email: string }) => c.email === email)?.role || 'Viewer'
                    sharedEvents.push({
                        ...data,
                        eventId: doc.id,
                        collaboratorRole: role,
                        isShared: true,
                    })
                }
            })
        }

        return NextResponse.json({ events: sharedEvents })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Shared events fetch error:', msg)
        return NextResponse.json({ error: 'Failed to fetch shared events', details: msg }, { status: 500 })
    }
}
