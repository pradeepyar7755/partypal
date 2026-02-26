import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// GET: Retrieve event by ID
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const db = getDb()
        const doc = await db.collection('events').doc(params.id).get()

        if (!doc.exists) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 })
        }

        return NextResponse.json(doc.data())
    } catch (error: unknown) {
        console.error('Event fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 })
    }
}

// POST: Save RSVP response for this event
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const body = await req.json()
        const { name, email, response, dietary, additionalGuests, totalPartySize } = body

        const db = getDb()
        const rsvpRef = db.collection('events').doc(params.id).collection('rsvps')

        await rsvpRef.add({
            name,
            email: email || '',
            response,
            dietary: dietary || 'None',
            additionalGuests: additionalGuests || [],
            totalPartySize: totalPartySize || 1,
            timestamp: new Date().toISOString(),
        })

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        console.error('RSVP save error:', error)
        return NextResponse.json({ error: 'Failed to save RSVP' }, { status: 500 })
    }
}
