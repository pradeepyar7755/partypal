import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// GET: Fetch all events for a user
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const uid = url.searchParams.get('uid')
        const includeTrashed = url.searchParams.get('includeTrashed') === 'true'

        if (!uid) {
            return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
        }

        const db = getDb()
        const snapshot = await db.collection('events').where('uid', '==', uid).get()
        const events: Record<string, unknown>[] = []
        const trashedEvents: Record<string, unknown>[] = []
        snapshot.forEach(doc => {
            const data: Record<string, unknown> = { ...doc.data(), eventId: doc.id }
            if (data.trashedAt) {
                // Auto-purge: permanently delete events trashed >30 days ago
                const trashedTime = new Date(data.trashedAt as string).getTime()
                if (Date.now() - trashedTime > THIRTY_DAYS_MS) {
                    // Fire-and-forget permanent cleanup
                    permanentDelete(db, doc.id, data).catch(() => {})
                    return
                }
                if (includeTrashed) trashedEvents.push(data)
            } else {
                events.push(data)
            }
        })

        // Sort by updatedAt descending
        events.sort((a, b) => {
            const aTime = a.updatedAt ? new Date(a.updatedAt as string).getTime() : 0
            const bTime = b.updatedAt ? new Date(b.updatedAt as string).getTime() : 0
            return bTime - aTime
        })
        trashedEvents.sort((a, b) => {
            const aTime = a.trashedAt ? new Date(a.trashedAt as string).getTime() : 0
            const bTime = b.trashedAt ? new Date(b.trashedAt as string).getTime() : 0
            return bTime - aTime
        })

        return NextResponse.json({ events, ...(includeTrashed ? { trashedEvents } : {}) })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Event fetch error:', msg)
        return NextResponse.json({ error: 'Failed to fetch events', details: msg }, { status: 500 })
    }
}

// Generate a random 6-char alphanumeric join code
function generateJoinCode(): string {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789' // no ambiguous chars (0/O, 1/l, i)
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
}

// POST: Save/update an event (with activity logging for admin)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { eventId } = body

        if (!eventId) {
            return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
        }

        const db = getDb()
        const eventRef = db.collection('events').doc(eventId)

        // Check if event already has a joinCode
        const existingDoc = await eventRef.get()
        const existingData = existingDoc.exists ? existingDoc.data() : null
        const joinCode = existingData?.joinCode || generateJoinCode()

        // Build update data, only include fields that are present
        const updateData: Record<string, unknown> = {
            eventId,
            joinCode,
            updatedAt: new Date().toISOString(),
        }
        // Scope event to user if uid provided
        if (body.uid) updateData.uid = body.uid
        if (body.eventType !== undefined) updateData.eventType = body.eventType
        if (body.date !== undefined) updateData.date = body.date
        if (body.guests !== undefined) updateData.guests = body.guests
        if (body.location !== undefined) updateData.location = body.location
        if (body.theme !== undefined) updateData.theme = body.theme
        if (body.budget !== undefined) updateData.budget = body.budget
        if (body.time !== undefined) updateData.time = body.time
        if (body.plan !== undefined) updateData.plan = body.plan
        if (body.invite !== undefined) updateData.invite = body.invite
        if (body.rsvpBy !== undefined) updateData.rsvpBy = body.rsvpBy
        if (body.hostName !== undefined) updateData.hostName = body.hostName
        if (body.timezone !== undefined) updateData.timezone = body.timezone
        if (body.inviteVersion) {
            // Store versioned invite: inviteVersions.{versionId} = { subject, message, smsVersion, customImage, coverPhoto, createdAt }
            updateData[`inviteVersions.${body.inviteVersion.id}`] = {
                subject: body.inviteVersion.subject || '',
                message: body.inviteVersion.message || '',
                smsVersion: body.inviteVersion.smsVersion || '',
                customImage: body.inviteVersion.customImage || '',
                coverPhoto: body.inviteVersion.coverPhoto || '',
                createdAt: new Date().toISOString(),
            }
        }
        if (body.collaborators !== undefined) updateData.collaborators = body.collaborators
        if (body.vendors !== undefined) updateData.vendors = body.vendors
        if (body.guestContacts !== undefined) updateData.guestContacts = body.guestContacts
        if (body.moodboardData !== undefined) updateData.moodboardData = body.moodboardData

        await eventRef.set(updateData, { merge: true })

        // Log activity for admin (fire-and-forget, track key field changes)
        if (existingData) {
            const trackedFields = ['eventType', 'date', 'guests', 'location', 'theme', 'budget', 'time', 'hostName']
            const changes: { field: string; from: string; to: string }[] = []
            for (const field of trackedFields) {
                if (body[field] !== undefined && existingData[field] !== undefined && String(body[field]) !== String(existingData[field])) {
                    changes.push({ field, from: String(existingData[field]).slice(0, 100), to: String(body[field]).slice(0, 100) })
                }
            }
            if (changes.length > 0) {
                db.collection('event_activity_log').add({
                    eventId,
                    uid: body.uid || existingData.uid || null,
                    action: 'updated',
                    changes,
                    timestamp: new Date().toISOString(),
                }).catch(() => {})
            }
        } else {
            // New event created
            db.collection('event_activity_log').add({
                eventId,
                uid: body.uid || null,
                action: 'created',
                changes: [{ field: 'eventType', from: '', to: String(body.eventType || '').slice(0, 100) }],
                timestamp: new Date().toISOString(),
            }).catch(() => {})
        }

        return NextResponse.json({ success: true, eventId, joinCode })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Event save error:', msg)
        return NextResponse.json({ error: 'Failed to save event', details: msg }, { status: 500 })
    }
}

// PATCH: Restore a trashed event or permanently delete
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json()
        const { eventId, uid, action } = body

        if (!eventId || !action) {
            return NextResponse.json({ error: 'Missing eventId or action' }, { status: 400 })
        }

        const db = getDb()
        const eventRef = db.collection('events').doc(eventId)
        const doc = await eventRef.get()

        if (!doc.exists) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 })
        }

        const d = doc.data()!

        // Verify ownership
        if (uid && d.uid && d.uid !== uid) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
        }

        if (action === 'restore') {
            await eventRef.update({ trashedAt: null, updatedAt: new Date().toISOString() })
            db.collection('event_activity_log').add({
                eventId, uid: d.uid || null, action: 'restored',
                changes: [], timestamp: new Date().toISOString(),
            }).catch(() => {})
            return NextResponse.json({ success: true, eventId })
        }

        if (action === 'permanent_delete') {
            await permanentDelete(db, eventId, d)
            return NextResponse.json({ success: true, eventId })
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Event patch error:', msg)
        return NextResponse.json({ error: 'Failed', details: msg }, { status: 500 })
    }
}

// Helper: permanently delete an event and all related data
async function permanentDelete(db: FirebaseFirestore.Firestore, eventId: string, d: Record<string, unknown>) {
    const eventRef = db.collection('events').doc(eventId)

    // Snapshot for admin analytics
    await db.collection('event_deletions').add({
        eventId,
        uid: d.uid || null,
        eventType: d.eventType || null,
        guests: d.guests || null,
        location: d.location || null,
        createdAt: d.createdAt || null,
        deletedAt: new Date().toISOString(),
    })

    // Clean up RSVP subcollection
    const rsvpSnap = await eventRef.collection('rsvps').limit(500).get()
    if (!rsvpSnap.empty) {
        const batch = db.batch()
        rsvpSnap.docs.forEach(rsvpDoc => batch.delete(rsvpDoc.ref))
        await batch.commit()
    }

    // Clean up collaborator references
    const collaborators = (d.collaborators as { uid?: string; email?: string }[]) || []
    for (const collab of collaborators) {
        if (!collab.uid) continue
        const sharedRef = db.collection('user_shared_events').doc(collab.uid)
        const sharedDoc = await sharedRef.get()
        if (sharedDoc.exists) {
            const sharedData = sharedDoc.data()
            const events = (sharedData?.events || []) as { eventId: string }[]
            const filtered = events.filter(e => e.eventId !== eventId)
            await sharedRef.set({ events: filtered }, { merge: true })
        }
    }

    // Clean up collaborator invites
    const inviteSnap = await db.collection('collaborator_invites')
        .where('eventId', '==', eventId).limit(50).get()
    if (!inviteSnap.empty) {
        const batch = db.batch()
        inviteSnap.docs.forEach(inviteDoc => batch.delete(inviteDoc.ref))
        await batch.commit()
    }

    // Log activity
    db.collection('event_activity_log').add({
        eventId, uid: d.uid || null, action: 'permanently_deleted',
        changes: [{ field: 'eventType', from: String(d.eventType || ''), to: '' }],
        timestamp: new Date().toISOString(),
    }).catch(() => {})

    // Delete the event document
    await eventRef.delete()
}

// DELETE: Soft-delete (trash) an event
export async function DELETE(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const eventId = url.searchParams.get('eventId')
        const uid = url.searchParams.get('uid')

        if (!eventId) {
            return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
        }

        const db = getDb()
        const eventRef = db.collection('events').doc(eventId)

        // Fetch event for ownership check
        const doc = await eventRef.get()
        if (!doc.exists) {
            return NextResponse.json({ success: true, eventId })
        }

        const d = doc.data()!

        // Verify ownership: if uid is provided, it must match the event owner
        if (uid && d.uid && d.uid !== uid) {
            return NextResponse.json({ error: 'Not authorized to delete this event' }, { status: 403 })
        }

        // Soft delete: set trashedAt timestamp (auto-purged after 30 days)
        await eventRef.update({ trashedAt: new Date().toISOString() })

        // Log activity
        db.collection('event_activity_log').add({
            eventId, uid: d.uid || null, action: 'trashed',
            changes: [{ field: 'eventType', from: String(d.eventType || ''), to: '' }],
            timestamp: new Date().toISOString(),
        }).catch(() => {})

        return NextResponse.json({ success: true, eventId })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Event delete error:', msg)
        return NextResponse.json({ error: 'Failed to delete event', details: msg }, { status: 500 })
    }
}
