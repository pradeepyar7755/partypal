import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// GET: Look up a guest's existing RSVP by email
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const url = new URL(req.url)
        const email = url.searchParams.get('email')?.trim().toLowerCase()
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        const db = getDb()
        const snapshot = await db
            .collection('events').doc(params.id)
            .collection('rsvps')
            .where('email', '==', email)
            .limit(1)
            .get()

        if (snapshot.empty) {
            return NextResponse.json({ found: false })
        }

        const doc = snapshot.docs[0]
        return NextResponse.json({ found: true, rsvp: { id: doc.id, ...doc.data() } })
    } catch (error: unknown) {
        console.error('RSVP lookup error:', error)
        return NextResponse.json({ error: 'Failed to look up RSVP' }, { status: 500 })
    }
}

// PUT: Update an existing RSVP (host-side edits)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const body = await req.json()
        const { rsvpId, response, dietary, additionalGuests, totalPartySize, kidCount } = body

        if (!rsvpId) {
            return NextResponse.json({ error: 'rsvpId is required' }, { status: 400 })
        }

        const db = getDb()
        const docRef = db.collection('events').doc(params.id).collection('rsvps').doc(rsvpId)
        const doc = await docRef.get()

        if (!doc.exists) {
            return NextResponse.json({ error: 'RSVP not found' }, { status: 404 })
        }

        // Build update object with only provided fields
        const update: Record<string, unknown> = {}
        if (response !== undefined) update.response = response
        if (dietary !== undefined) update.dietary = dietary
        if (additionalGuests !== undefined) update.additionalGuests = additionalGuests
        if (totalPartySize !== undefined) update.totalPartySize = totalPartySize
        if (kidCount !== undefined) update.kidCount = kidCount

        await docRef.update(update)
        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('RSVP update error:', msg)
        return NextResponse.json({ error: 'Failed to update RSVP', details: msg }, { status: 500 })
    }
}

// DELETE: Remove a guest RSVP completely
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const url = new URL(req.url)
        const rsvpId = url.searchParams.get('rsvpId')

        if (!rsvpId) {
            return NextResponse.json({ error: 'rsvpId is required' }, { status: 400 })
        }

        const db = getDb()
        await db
            .collection('events').doc(params.id)
            .collection('rsvps').doc(rsvpId)
            .delete()

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        console.error('RSVP delete error:', error)
        return NextResponse.json({ error: 'Failed to delete RSVP' }, { status: 500 })
    }
}
