import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { getDb } from '@/lib/firebase'

// POST: Backfill pipeline tickets from existing bug reports (one-time use)
export async function POST(req: NextRequest) {
    const admin = await verifyAdmin(req.headers.get('authorization'))
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const db = getDb()

        // Category mapping
        const categoryConfig: Record<string, { type: string; priority: string; label: string }> = {
            bug:        { type: 'bug',     priority: 'P1', label: 'Bug' },
            tab:        { type: 'bug',     priority: 'P2', label: 'Navigation Issue' },
            feature:    { type: 'bug',     priority: 'P2', label: 'Feature Not Working' },
            experience: { type: 'feature', priority: 'P3', label: 'UX Issue' },
            suggestion: { type: 'feature', priority: 'P3', label: 'Suggestion' },
            other:      { type: 'bug',     priority: 'P3', label: 'Other' },
        }

        // Skip junk entries
        const skipDescriptions = new Set(['hi', 'Hi', 'Hi!', "I don't", 'Pipeline test: verifying bug escalation creates pipeline ticket'])

        // Check which bugs already have pipeline tickets (by sourceBugId)
        const existingTicketsSnap = await db.collection('pipeline_tickets').get()
        const existingBugIds = new Set<string>()
        existingTicketsSnap.forEach(doc => {
            const data = doc.data()
            if (data.sourceBugId) existingBugIds.add(data.sourceBugId as string)
        })

        // Fetch all bug reports
        const bugsSnap = await db.collection('bugReports').orderBy('createdAt', 'desc').get()
        const created: string[] = []
        const skipped: string[] = []

        for (const doc of bugsSnap.docs) {
            const b = doc.data()
            const bugId = b.id || doc.id

            // Skip if already has a pipeline ticket
            if (existingBugIds.has(bugId)) {
                skipped.push(`${bugId}: already has ticket`)
                continue
            }

            // Skip junk
            if (skipDescriptions.has((b.description || '').trim())) {
                skipped.push(`${bugId}: junk entry`)
                continue
            }

            const cat = (b.category as string) || 'other'
            const config = categoryConfig[cat] || categoryConfig.other

            // Map status
            const bugStatus = (b.status as string) || 'new'
            let ticketStatus = 'open'
            if (bugStatus === 'fixed') ticketStatus = 'done'
            else if (bugStatus === 'reviewed') ticketStatus = 'in_progress'

            const ticket = {
                title: `[User Report] ${config.label}: ${((b.description as string) || '').slice(0, 80)}`,
                description: b.description || '',
                type: config.type,
                priority: config.priority,
                status: ticketStatus,
                createdAt: b.createdAt || new Date().toISOString(),
                createdBy: 'system:backfill',
                sourceBugId: bugId,
                sourceCategory: cat,
                sourcePage: b.page || '',
                agentResults: {},
            }

            await db.collection('pipeline_tickets').add(ticket)
            created.push(`${bugId}: ${ticket.title}`)
        }

        return NextResponse.json({
            success: true,
            created: created.length,
            skipped: skipped.length,
            details: { created, skipped },
        })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        return NextResponse.json({ error: 'Backfill failed', details: msg }, { status: 500 })
    }
}
