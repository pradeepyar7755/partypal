import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

interface ContactData {
    id: string
    name: string
    email: string
    phone: string
    circles: string[]
    avatar: string
    color: string
    updatedAt?: string
    deletedAt?: string
}

// GET: Fetch contacts subcollection + circles from parent doc
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const uid = url.searchParams.get('uid')

        if (!uid) {
            return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
        }

        const db = getDb()

        // Fetch contacts subcollection (include soft-deleted for cross-device sync)
        const contactsSnap = await db.collection('user_data').doc(uid)
            .collection('contacts').get()
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
        const contacts = contactsSnap.docs
            .map(doc => doc.data() as ContactData)
            .filter(c => {
                // Exclude soft-deleted contacts older than 30 days
                if (c.deletedAt && new Date(c.deletedAt).getTime() < thirtyDaysAgo) return false
                return true
            })

        // Fetch circles from parent doc
        const userDoc = await db.collection('user_data').doc(uid).get()
        const userData = userDoc.data() || {}
        const circles = userData.circles || []
        const circlesUpdatedAt = userData.circlesUpdatedAt || ''

        return NextResponse.json({ contacts, circles, circlesUpdatedAt })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Contacts fetch error:', msg)
        return NextResponse.json({ error: 'Failed to fetch contacts', details: msg }, { status: 500 })
    }
}

// POST: Save contacts to subcollection + circles to parent doc
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { uid, contacts, circles } = body as {
            uid?: string
            contacts?: ContactData[]
            circles?: string[]
        }

        if (!uid) {
            return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
        }

        const db = getDb()

        // Batch write contacts to subcollection
        if (contacts && contacts.length > 0) {
            const batchSize = 500
            for (let i = 0; i < contacts.length; i += batchSize) {
                const batch = db.batch()
                const chunk = contacts.slice(i, i + batchSize)
                for (const contact of chunk) {
                    const ref = db.collection('user_data').doc(uid)
                        .collection('contacts').doc(contact.id)
                    batch.set(ref, {
                        ...contact,
                        updatedAt: contact.updatedAt || new Date().toISOString(),
                    }, { merge: true })
                }
                await batch.commit()
            }
        }

        // Update circles on parent doc
        if (circles) {
            await db.collection('user_data').doc(uid).set({
                circles,
                circlesUpdatedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }, { merge: true })
        }

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Contacts save error:', msg)
        return NextResponse.json({ error: 'Failed to save contacts', details: msg }, { status: 500 })
    }
}

// DELETE: Soft-delete contacts by setting deletedAt
export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json()
        const { uid, contactIds } = body as { uid?: string; contactIds?: string[] }

        if (!uid) {
            return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
        }
        if (!contactIds || contactIds.length === 0) {
            return NextResponse.json({ error: 'Missing contactIds' }, { status: 400 })
        }

        const db = getDb()
        const now = new Date().toISOString()
        const batch = db.batch()

        for (const id of contactIds) {
            const ref = db.collection('user_data').doc(uid)
                .collection('contacts').doc(id)
            batch.set(ref, { deletedAt: now, updatedAt: now }, { merge: true })
        }

        await batch.commit()

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Contacts delete error:', msg)
        return NextResponse.json({ error: 'Failed to delete contacts', details: msg }, { status: 500 })
    }
}
