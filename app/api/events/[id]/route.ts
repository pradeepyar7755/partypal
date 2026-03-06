import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// GET: Retrieve event by ID (optionally include RSVPs)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const db = getDb()
        const doc = await db.collection('events').doc(params.id).get()

        if (!doc.exists) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 })
        }

        const data = doc.data()

        // Check if RSVPs are requested
        const url = new URL(req.url)
        if (url.searchParams.get('include') === 'rsvps') {
            const rsvpSnapshot = await db.collection('events').doc(params.id).collection('rsvps').orderBy('timestamp', 'desc').get()
            const rsvps = rsvpSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
            return NextResponse.json({ ...data, rsvps })
        }

        return NextResponse.json(data)
    } catch (error: unknown) {
        console.error('Event fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 })
    }
}

// POST: Save RSVP response for this event
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const body = await req.json()
        const { name, email, response, dietary, additionalGuests, totalPartySize, kidCount } = body

        const db = getDb()
        const rsvpRef = db.collection('events').doc(params.id).collection('rsvps')

        // Block duplicate email — each email can only RSVP once
        if (email) {
            const byEmail = await rsvpRef.where('email', '==', email.trim().toLowerCase()).limit(1).get()
            if (!byEmail.empty) {
                return NextResponse.json(
                    { error: 'duplicate_email', message: 'This email has already been used to RSVP. To update your response, use the "Update RSVP" link in your confirmation email.' },
                    { status: 409 }
                )
            }
        }

        await rsvpRef.add({
            name,
            email: email ? email.trim().toLowerCase() : '',
            response,
            dietary: dietary || 'None',
            additionalGuests: additionalGuests || [],
            totalPartySize: totalPartySize || 1,
            kidCount: kidCount || 0,
            timestamp: new Date().toISOString(),
        })

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        console.error('RSVP save error:', error)
        return NextResponse.json({ error: 'Failed to save RSVP' }, { status: 500 })
    }
}
