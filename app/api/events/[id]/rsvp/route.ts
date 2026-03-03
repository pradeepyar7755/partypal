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
