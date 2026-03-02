import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// GET: Fetch user-level data (AI memory, settings, vendor shortlist)
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const uid = url.searchParams.get('uid')

        if (!uid) {
            return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
        }

        const db = getDb()
        const doc = await db.collection('user_data').doc(uid).get()

        if (!doc.exists) {
            return NextResponse.json({ data: {} })
        }

        return NextResponse.json({ data: doc.data() })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('User data fetch error:', msg)
        return NextResponse.json({ error: 'Failed to fetch user data', details: msg }, { status: 500 })
    }
}

// POST: Save user-level data (merge into user_data/{uid})
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { uid, ...fields } = body

        if (!uid) {
            return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
        }

        const db = getDb()
        const updateData: Record<string, unknown> = {
            ...fields,
            updatedAt: new Date().toISOString(),
        }

        await db.collection('user_data').doc(uid).set(updateData, { merge: true })

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('User data save error:', msg)
        return NextResponse.json({ error: 'Failed to save user data', details: msg }, { status: 500 })
    }
}
