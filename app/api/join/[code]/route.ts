import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// GET: Look up event by joinCode
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
    try {
        const db = getDb()
        const snapshot = await db.collection('events').where('joinCode', '==', params.code).limit(1).get()

        if (snapshot.empty) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 })
        }

        const doc = snapshot.docs[0]
        const data = doc.data()

        return NextResponse.json({
            eventId: doc.id,
            eventType: data.eventType || 'Party',
            date: data.date || '',
            time: data.time || '',
            timezone: data.timezone || '',
            location: data.location || '',
            theme: data.theme || '',
            hostName: data.hostName || '',
            rsvpBy: data.rsvpBy || '',
            invite: data.invite || null,
            inviteVersions: data.inviteVersions || null,
            coverPhoto: data.invite?.coverPhoto || '',
            customImage: data.invite?.customImage || '',
        })
    } catch (error: unknown) {
        console.error('Join lookup error:', error)
        return NextResponse.json({ error: 'Failed to look up event' }, { status: 500 })
    }
}
