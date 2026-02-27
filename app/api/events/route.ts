import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

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
            // Store versioned invite: inviteVersions.{versionId} = { subject, message, smsVersion, createdAt }
            updateData[`inviteVersions.${body.inviteVersion.id}`] = {
                subject: body.inviteVersion.subject || '',
                message: body.inviteVersion.message || '',
                smsVersion: body.inviteVersion.smsVersion || '',
                createdAt: new Date().toISOString(),
            }
        }

        await eventRef.set(updateData, { merge: true })

        return NextResponse.json({ success: true, eventId })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Event save error:', msg)
        return NextResponse.json({ error: 'Failed to save event', details: msg }, { status: 500 })
    }
}
