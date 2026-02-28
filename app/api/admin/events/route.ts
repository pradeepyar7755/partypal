import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'
import { verifyAdmin } from '@/lib/admin-auth'

// GET: List all events with their UIDs (admin only)
// POST: Migrate ALL events to a target UID (admin only)
export async function GET(req: NextRequest) {
    const admin = await verifyAdmin(req.headers.get('authorization'))
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getDb()
    const snapshot = await db.collection('events').limit(100).get()
    const events = snapshot.docs.map(doc => {
        const d = doc.data()
        return { id: doc.id, uid: d.uid || 'none', eventType: d.eventType, location: d.location }
    })
    const uniqueUids = [...new Set(events.map(e => e.uid))]
    return NextResponse.json({ total: events.length, uniqueUids, events })
}

export async function POST(req: NextRequest) {
    const admin = await verifyAdmin(req.headers.get('authorization'))
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { targetUid } = await req.json()
    if (!targetUid) return NextResponse.json({ error: 'Missing targetUid' }, { status: 400 })

    const db = getDb()
    const snapshot = await db.collection('events').limit(200).get()
    const updates = snapshot.docs.map(doc =>
        doc.ref.update({ uid: targetUid, migratedAt: new Date().toISOString() })
    )
    await Promise.all(updates)

    return NextResponse.json({ migrated: snapshot.size, targetUid })
}
