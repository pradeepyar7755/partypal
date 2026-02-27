import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// GET: Fetch invite details by token
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const token = url.searchParams.get('token')
        if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

        const db = getDb()
        const doc = await db.collection('collaborator_invites').doc(token).get()
        if (!doc.exists) return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 })

        const data = doc.data()!
        // Get event name from events collection
        let eventName = data.eventName
        if (data.eventId) {
            const eventDoc = await db.collection('events').doc(data.eventId).get()
            if (eventDoc.exists) {
                eventName = eventDoc.data()?.eventType || eventName
            }
        }

        return NextResponse.json({
            eventId: data.eventId,
            eventName,
            inviterName: data.inviterName,
            role: data.role,
            status: data.status,
            email: data.email,
        })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        return NextResponse.json({ error: 'Failed to fetch invite', details: msg }, { status: 500 })
    }
}

// POST: Accept invite
export async function POST(req: NextRequest) {
    try {
        const { token, uid, email, displayName } = await req.json()
        if (!token || !uid) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

        const db = getDb()
        const inviteRef = db.collection('collaborator_invites').doc(token)
        const doc = await inviteRef.get()
        if (!doc.exists) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

        const invite = doc.data()!
        if (invite.status === 'accepted') return NextResponse.json({ error: 'Already accepted', eventId: invite.eventId })

        // Mark invite as accepted
        await inviteRef.update({ status: 'accepted', acceptedBy: uid, acceptedAt: new Date().toISOString() })

        // Add user to event's collaborators in Firestore
        const eventRef = db.collection('events').doc(invite.eventId)
        const eventDoc = await eventRef.get()
        const eventData = eventDoc.exists ? eventDoc.data() : {}
        const existing = eventData?.collaborators || []
        const alreadyAdded = existing.some((c: { email: string }) => c.email === (email || invite.email))

        if (!alreadyAdded) {
            existing.push({
                uid,
                email: email || invite.email,
                name: displayName || invite.name || 'Collaborator',
                role: invite.role || 'Viewer',
                acceptedAt: new Date().toISOString(),
            })
            await eventRef.set({ collaborators: existing }, { merge: true })
        }

        // Also store in a user-level collection for easy lookup
        await db.collection('user_shared_events').doc(uid).set({
            events: (await db.collection('user_shared_events').doc(uid).get()).data()?.events
                ? [...((await db.collection('user_shared_events').doc(uid).get()).data()?.events || []), { eventId: invite.eventId, role: invite.role, addedAt: new Date().toISOString() }]
                : [{ eventId: invite.eventId, role: invite.role, addedAt: new Date().toISOString() }],
        }, { merge: true })

        return NextResponse.json({ success: true, eventId: invite.eventId, role: invite.role })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Accept invite error:', msg)
        return NextResponse.json({ error: 'Failed to accept invite', details: msg }, { status: 500 })
    }
}
