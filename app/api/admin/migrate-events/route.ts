import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'
import { verifyAdmin } from '@/lib/admin-auth'

// POST: Migrate events from one user to another (admin only)
export async function POST(req: NextRequest) {
    try {
        const admin = await verifyAdmin(req.headers.get('authorization'))
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { fromUid, toUid } = await req.json()
        if (!fromUid || !toUid) {
            return NextResponse.json({ error: 'Missing fromUid or toUid' }, { status: 400 })
        }

        const db = getDb()

        // Find all events owned by fromUid
        const snapshot = await db.collection('events').where('uid', '==', fromUid).get()
        if (snapshot.empty) {
            return NextResponse.json({ migrated: 0, message: 'No events found for source user' })
        }

        // Update each event to the new owner
        const updates = snapshot.docs.map(doc =>
            doc.ref.update({ uid: toUid, migratedFrom: fromUid, migratedAt: new Date().toISOString() })
        )
        await Promise.all(updates)

        return NextResponse.json({
            migrated: snapshot.size,
            fromUid,
            toUid,
            eventIds: snapshot.docs.map(d => d.id),
        })
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
