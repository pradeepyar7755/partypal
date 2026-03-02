import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// POST: Submit a new bug report
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { category, description, page, userAgent, email, name, uid } = body

        if (!category || !description?.trim()) {
            return NextResponse.json({ error: 'Category and description are required' }, { status: 400 })
        }

        const db = getDb()
        const docRef = db.collection('bugReports').doc()

        const bugReport = {
            id: docRef.id,
            category: category || 'other',
            description: description.trim(),
            page: page || 'unknown',
            userAgent: userAgent || 'unknown',
            email: email || '',
            name: name || '',
            uid: uid || '',
            status: 'new',
            createdAt: new Date().toISOString(),
        }

        await docRef.set(bugReport)

        return NextResponse.json({ success: true, id: docRef.id })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Bug report save error:', msg)
        return NextResponse.json({ error: 'Failed to save bug report', details: msg }, { status: 500 })
    }
}

// GET: Fetch bug reports (admin use / workflow use)
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const status = url.searchParams.get('status')

        const db = getDb()
        let query: FirebaseFirestore.Query = db.collection('bugReports').orderBy('createdAt', 'desc')

        if (status) {
            query = query.where('status', '==', status)
        }

        const snapshot = await query.get()
        const bugs: Record<string, unknown>[] = []
        snapshot.forEach(doc => {
            bugs.push(doc.data())
        })

        return NextResponse.json({ bugs, total: bugs.length })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Bug report fetch error:', msg)
        return NextResponse.json({ error: 'Failed to fetch bug reports', details: msg }, { status: 500 })
    }
}

// PATCH: Update bug report status (mark as reviewed/fixed)
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json()
        const { id, status: newStatus } = body

        if (!id || !newStatus) {
            return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
        }

        if (!['new', 'reviewed', 'fixed'].includes(newStatus)) {
            return NextResponse.json({ error: 'Invalid status. Must be: new, reviewed, or fixed' }, { status: 400 })
        }

        const db = getDb()
        await db.collection('bugReports').doc(id).update({
            status: newStatus,
            updatedAt: new Date().toISOString(),
        })

        return NextResponse.json({ success: true, id, status: newStatus })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Bug report update error:', msg)
        return NextResponse.json({ error: 'Failed to update bug report', details: msg }, { status: 500 })
    }
}
