import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// GET: Fetch all events for a user
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const uid = url.searchParams.get('uid')

        if (!uid) {
            return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
        }

        const db = getDb()
        const snapshot = await db.collection('events').where('uid', '==', uid).get()
        const events: Record<string, unknown>[] = []
        snapshot.forEach(doc => {
            events.push({ ...doc.data(), eventId: doc.id })
        })

        // Sort by updatedAt descending
        events.sort((a, b) => {
            const aTime = a.updatedAt ? new Date(a.updatedAt as string).getTime() : 0
            const bTime = b.updatedAt ? new Date(b.updatedAt as string).getTime() : 0
            return bTime - aTime
        })

        return NextResponse.json({ events })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Event fetch error:', msg)
        return NextResponse.json({ error: 'Failed to fetch events', details: msg }, { status: 500 })
    }
}

// POST: Save/update an event
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { eventId } = body

        if (!eventId) {
            return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
        }

        const db = getDb()
        const eventRef = db.collection('events').doc(eventId)

        // Build update data, only include fields that are present
        const updateData: Record<string, unknown> = {
            eventId,
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

        await eventRef.set(updateData, { merge: true })

        return NextResponse.json({ success: true, eventId })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Event save error:', msg)
        return NextResponse.json({ error: 'Failed to save event', details: msg }, { status: 500 })
    }
}

// DELETE: Remove an event
export async function DELETE(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const eventId = url.searchParams.get('eventId')

        if (!eventId) {
            return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
        }

        const db = getDb()
        await db.collection('events').doc(eventId).delete()

        return NextResponse.json({ success: true, eventId })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Event delete error:', msg)
        return NextResponse.json({ error: 'Failed to delete event', details: msg }, { status: 500 })
    }
}
