import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'
import { verifyAdmin } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
    const admin = await verifyAdmin(req.headers.get('authorization'))
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getDb()
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    const docId = url.searchParams.get('id')

    if (action === 'delete' && docId) {
        await db.collection('events').doc(docId).delete()
        return NextResponse.json({ deleted: docId })
    }

    // List all events
    const snap = await db.collection('events').get()
    const events = snap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().eventName || 'unnamed',
        type: doc.data().type || doc.data().eventType || '',
        userId: doc.data().userId || doc.data().uid || '',
        createdAt: doc.data().createdAt || '',
    }))
    return NextResponse.json({ events })
}
