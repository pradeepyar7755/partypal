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
        const { name, email, response, dietary, additionalGuests, totalPartySize } = body

        const db = getDb()
        const rsvpRef = db.collection('events').doc(params.id).collection('rsvps')

        // Check if this person already RSVP'd (by email or name) and update instead of adding
        let existingDoc = null
        if (email) {
            const byEmail = await rsvpRef.where('email', '==', email).limit(1).get()
            if (!byEmail.empty) existingDoc = byEmail.docs[0]
        }
        if (!existingDoc) {
            const byName = await rsvpRef.where('name', '==', name).limit(1).get()
            if (!byName.empty) existingDoc = byName.docs[0]
        }

        const rsvpData = {
            name,
            email: email || '',
            response,
            dietary: dietary || 'None',
            additionalGuests: additionalGuests || [],
            totalPartySize: totalPartySize || 1,
            timestamp: new Date().toISOString(),
        }

        if (existingDoc) {
            await existingDoc.ref.update(rsvpData)
        } else {
            await rsvpRef.add(rsvpData)
        }

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        console.error('RSVP save error:', error)
        return NextResponse.json({ error: 'Failed to save RSVP' }, { status: 500 })
    }
}
