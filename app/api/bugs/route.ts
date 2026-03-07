import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'
import { sendEmail } from '@/lib/email'
import { SITE_EMAILS } from '@/lib/constants'
import { notifyUserBugEscalated } from '@/lib/pipeline-notify'

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

        // Escalate bug/feature reports to pipeline (fire-and-forget)
        escalateToPipeline(db, {
            id: docRef.id,
            category: category || 'other',
            description: description.trim(),
            page: page || 'unknown',
            name: name || '',
        }).catch(() => {})

        // Send an email notification to the feedback inbox
        try {
            await sendEmail({
                type: 'feedback', // Use the feedback sender alias
                to: SITE_EMAILS.feedback, // Send TO the feedback inbox
                subject: `[${category.toUpperCase()}] New Feedback from ${name || email || 'Anonymous'}`,
                replyTo: email || undefined,
                html: `
                    <h2>New Feedback Submitted</h2>
                    <p><strong>Category:</strong> ${category}</p>
                    <p><strong>Name:</strong> ${name || 'N/A'}</p>
                    <p><strong>Email:</strong> ${email || 'N/A'}</p>
                    <p><strong>Page:</strong> ${page}</p>
                    <p><strong>User Agent:</strong> ${userAgent}</p>
                    <hr />
                    <p><strong>Description:</strong></p>
                    <p style="white-space: pre-wrap;">${description}</p>
                `,
            })
        } catch (emailErr) {
            console.error('Failed to send feedback email notification:', emailErr)
            // We don't fail the request if just the email fails
        }

        return NextResponse.json({ success: true, id: docRef.id })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Bug report save error:', msg)
        return NextResponse.json({ error: 'Failed to save bug report', details: msg }, { status: 500 })
    }
}

// POST also creates a pipeline ticket for bug reports (fire-and-forget)
async function escalateToPipeline(db: FirebaseFirestore.Firestore, bugReport: {
    id: string; category: string; description: string; page: string; name: string
}) {
    try {
        // Only escalate actual bugs, not suggestions or other feedback
        const bugCategories = ['bug', 'tab', 'feature']
        if (!bugCategories.includes(bugReport.category)) return

        const ticket = {
            title: `[User Report] ${bugReport.category}: ${bugReport.description.slice(0, 80)}`,
            description: bugReport.description,
            type: 'bug' as const,
            priority: 'P2',
            status: 'open',
            createdAt: new Date().toISOString(),
            createdBy: 'system:bug-report',
            sourceBugId: bugReport.id,
            agentResults: {},
        }
        const ref = await db.collection('pipeline_tickets').add(ticket)

        // Notify admin
        notifyUserBugEscalated({
            category: bugReport.category,
            description: bugReport.description,
            page: bugReport.page,
            userName: bugReport.name || 'Anonymous',
            ticketId: ref.id,
        }).catch(() => {})
    } catch {
        // Fire-and-forget — never fail the user's bug report submission
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
