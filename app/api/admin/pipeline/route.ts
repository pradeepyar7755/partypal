import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { getDb } from '@/lib/firebase'
import {
    notifyTicketCreated,
    notifyStageUpdate,
    notifyGateApprovalNeeded,
    notifyTestsFailed,
} from '@/lib/pipeline-notify'

// ── Stage definitions ──────────────────────────────────
const VALID_STAGES = ['triage', 'dev', 'review', 'test', 'deploy', 'shiproom']
const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'failed']

// Stages that have a human gate AFTER them (require approval before next starts)
const GATED_STAGES = ['triage', 'review']

// Stages that auto-start the next stage when completed (if no gate blocks)
const AUTO_ADVANCE: Record<string, string> = {
    triage: 'dev',    // After triage approved → dev starts
    dev: 'review',    // After dev completes → review starts
    review: 'test',   // After review approved → test starts
    test: 'deploy',   // After tests pass → deploy starts
    deploy: 'shiproom', // After deploy → shiproom starts
}

// GET: Fetch pipeline data (runs, reports, agent stats)
export async function GET(req: NextRequest) {
    const admin = await verifyAdmin(req.headers.get('authorization'))
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const db = getDb()
        const url = new URL(req.url)
        const action = url.searchParams.get('action') || 'dashboard'

        if (action === 'dashboard') {
            const runsSnap = await db.collection('pipeline_runs')
                .orderBy('startedAt', 'desc')
                .limit(20)
                .get()
            const runs = runsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

            const configSnap = await db.collection('pipeline_config').doc('agents').get()
            const agentConfig = configSnap.exists ? configSnap.data() : getDefaultConfig()

            const ticketsSnap = await db.collection('pipeline_tickets')
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get()
            const tickets = ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

            const stats = {
                totalRuns: runs.length,
                successfulRuns: runs.filter(r => (r as Record<string, unknown>).status === 'shipped').length,
                failedRuns: runs.filter(r => (r as Record<string, unknown>).status === 'failed').length,
                pendingRuns: runs.filter(r => (r as Record<string, unknown>).status === 'pending' || (r as Record<string, unknown>).status === 'in_progress').length,
                totalTickets: tickets.length,
                openTickets: tickets.filter(t => (t as Record<string, unknown>).status === 'open').length,
                goldenTestsLastRun: (agentConfig as Record<string, unknown>)?.lastGoldenTestResult || null,
            }

            return NextResponse.json({ runs, tickets, agentConfig, stats })
        }

        if (action === 'runs') {
            const runsSnap = await db.collection('pipeline_runs')
                .orderBy('startedAt', 'desc')
                .limit(50)
                .get()
            return NextResponse.json({ runs: runsSnap.docs.map(d => ({ id: d.id, ...d.data() })) })
        }

        if (action === 'tickets') {
            const ticketsSnap = await db.collection('pipeline_tickets')
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get()
            return NextResponse.json({ tickets: ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() })) })
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Pipeline API error:', msg)
        return NextResponse.json({ error: 'Failed to fetch pipeline data', details: msg }, { status: 500 })
    }
}

// POST: Create ticket, trigger agent, update config
export async function POST(req: NextRequest) {
    const admin = await verifyAdmin(req.headers.get('authorization'))
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const db = getDb()
        const body = await req.json()
        const { action } = body

        // ── Create Ticket ──────────────────────────
        if (action === 'create_ticket') {
            const { title, description, type, priority } = body
            if (!title || !type) {
                return NextResponse.json({ error: 'Missing title or type' }, { status: 400 })
            }
            const ticket = {
                title,
                description: description || '',
                type,
                priority: priority || 'P2',
                status: 'open',
                createdAt: new Date().toISOString(),
                createdBy: admin.email,
                agentResults: {},
            }
            const ref = await db.collection('pipeline_tickets').add(ticket)

            // Fire-and-forget: email notification
            notifyTicketCreated({
                title,
                type,
                priority: priority || 'P2',
                createdBy: admin.email,
            }).catch(() => {})

            return NextResponse.json({ success: true, ticketId: ref.id, ticket })
        }

        // ── Update Ticket ──────────────────────────
        if (action === 'update_ticket') {
            const { ticketId, updates } = body
            if (!ticketId) return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 })
            await db.collection('pipeline_tickets').doc(ticketId).set(
                { ...updates, updatedAt: new Date().toISOString() },
                { merge: true }
            )
            return NextResponse.json({ success: true })
        }

        // ── Create Pipeline Run ────────────────────
        if (action === 'create_run') {
            const { ticketId, branch } = body
            const run = {
                ticketId: ticketId || null,
                branch: branch || 'main',
                status: 'pending',
                stages: {
                    triage: { status: 'pending', startedAt: null, completedAt: null, result: null },
                    dev: { status: 'pending', startedAt: null, completedAt: null, result: null },
                    review: { status: 'pending', startedAt: null, completedAt: null, result: null },
                    test: { status: 'pending', startedAt: null, completedAt: null, result: null },
                    deploy: { status: 'pending', startedAt: null, completedAt: null, result: null },
                    shiproom: { status: 'pending', startedAt: null, completedAt: null, result: null },
                },
                startedAt: new Date().toISOString(),
                completedAt: null,
                triggeredBy: admin.email,
            }
            const ref = await db.collection('pipeline_runs').add(run)
            return NextResponse.json({ success: true, runId: ref.id, run })
        }

        // ── Update Stage (with triggers) ───────────
        if (action === 'update_stage') {
            const { runId, stage, status, result } = body
            if (!runId || !stage) return NextResponse.json({ error: 'Missing runId or stage' }, { status: 400 })

            if (!VALID_STAGES.includes(stage)) return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
            if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

            // Enforce stage ordering: can't advance past an incomplete predecessor
            const stageIdx = VALID_STAGES.indexOf(stage)
            interface RunData { stages: Record<string, { status: string }>; branch?: string }
            let runData: RunData | null = null

            if (stageIdx > 0 && (status === 'in_progress' || status === 'completed')) {
                const runDoc = await db.collection('pipeline_runs').doc(runId).get()
                if (runDoc.exists) {
                    runData = runDoc.data() as RunData
                    for (let i = 0; i < stageIdx; i++) {
                        const prevStage = VALID_STAGES[i]
                        const prevStatus = runData!.stages?.[prevStage]?.status
                        if (prevStatus !== 'completed') {
                            return NextResponse.json({
                                error: `Cannot ${status === 'in_progress' ? 'start' : 'complete'} "${stage}" — previous stage "${prevStage}" is "${prevStatus || 'pending'}"`,
                            }, { status: 400 })
                        }
                    }
                }
            }

            // If we haven't fetched runData yet, do it now for branch info
            if (!runData) {
                const runDoc = await db.collection('pipeline_runs').doc(runId).get()
                if (runDoc.exists) {
                    runData = runDoc.data() as RunData
                }
            }
            const branch = runData?.branch || 'main'

            // Write the stage update
            const updates: Record<string, unknown> = {
                [`stages.${stage}.status`]: status,
                updatedAt: new Date().toISOString(),
                [`stages.${stage}.updatedBy`]: admin.email,
            }
            if (status === 'in_progress') updates[`stages.${stage}.startedAt`] = new Date().toISOString()
            if (status === 'completed' || status === 'failed') {
                updates[`stages.${stage}.completedAt`] = new Date().toISOString()
                if (result) updates[`stages.${stage}.result`] = result
            }

            // Update overall run status
            if (status === 'failed') {
                updates.status = 'failed'
            } else if (status === 'in_progress') {
                updates.status = 'in_progress'
            } else if (status === 'completed' && stage === 'shiproom') {
                updates.status = 'shipped'
                updates.completedAt = new Date().toISOString()
            }

            await db.collection('pipeline_runs').doc(runId).set(updates, { merge: true })

            // ── TRIGGERS (fire-and-forget) ─────────

            // 1. Email notification on stage completion/failure
            notifyStageUpdate({
                runId,
                stage,
                status: status as 'in_progress' | 'completed' | 'failed',
                branch,
                updatedBy: admin.email,
            }).catch(() => {})

            // 2. If this was a gated stage completing → email asking for approval
            if (status === 'completed' && GATED_STAGES.includes(stage)) {
                const completedStages = VALID_STAGES.filter((s, i) => {
                    if (i <= stageIdx) return true
                    return runData?.stages?.[s]?.status === 'completed'
                })
                notifyGateApprovalNeeded({
                    runId,
                    stage: AUTO_ADVANCE[stage] || stage,
                    branch,
                    completedStages,
                }).catch(() => {})
            }

            // 3. Auto-advance to next stage if no gate blocks
            if (status === 'completed' && AUTO_ADVANCE[stage]) {
                const nextStage = AUTO_ADVANCE[stage]
                const isGated = GATED_STAGES.includes(stage)

                // Load config to check if gate is enabled
                const configSnap = await db.collection('pipeline_config').doc('agents').get()
                const config = configSnap.exists ? configSnap.data() : getDefaultConfig()
                const gateKey = stage === 'triage' ? 'afterTriage' : stage === 'review' ? 'afterReview' : null
                const gates = (config as { gates?: Record<string, boolean> })?.gates || {}
                const gateEnabled = gateKey ? gates[gateKey] !== false : false

                if (!isGated || !gateEnabled) {
                    // No gate or gate disabled → auto-start next stage
                    await db.collection('pipeline_runs').doc(runId).set({
                        [`stages.${nextStage}.status`]: 'in_progress',
                        [`stages.${nextStage}.startedAt`]: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    }, { merge: true })
                }
            }

            // 4. If test stage failed → special notification
            if (status === 'failed' && stage === 'test') {
                notifyTestsFailed({
                    runId,
                    branch,
                    failedCount: 1,
                    totalCount: 39,
                    goldenFailed: true,
                }).catch(() => {})
            }

            return NextResponse.json({ success: true })
        }

        // ── Update Config ──────────────────────────
        if (action === 'update_config') {
            const { config } = body
            await db.collection('pipeline_config').doc('agents').set(
                { ...config, updatedAt: new Date().toISOString(), updatedBy: admin.email },
                { merge: true }
            )
            return NextResponse.json({ success: true })
        }

        // ── Save Golden Test Results ───────────────
        if (action === 'save_golden_results') {
            const { results } = body
            await db.collection('pipeline_config').doc('agents').set(
                { lastGoldenTestResult: results, lastGoldenTestAt: new Date().toISOString() },
                { merge: true }
            )
            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Pipeline POST error:', msg)
        return NextResponse.json({ error: 'Failed', details: msg }, { status: 500 })
    }
}

// DELETE: Remove a ticket
export async function DELETE(req: NextRequest) {
    const admin = await verifyAdmin(req.headers.get('authorization'))
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const db = getDb()
        const url = new URL(req.url)
        const ticketId = url.searchParams.get('ticketId')
        if (!ticketId) return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 })

        await db.collection('pipeline_tickets').doc(ticketId).delete()
        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        return NextResponse.json({ error: 'Failed to delete ticket', details: msg }, { status: 500 })
    }
}

function getDefaultConfig() {
    return {
        agents: {
            triage: { enabled: true, autoRun: false },
            prioritize: { enabled: true, autoRun: false },
            dev: { enabled: true, autoRun: false },
            review: { enabled: true, autoRun: true },
            test: { enabled: true, autoRun: true },
            deploy: { enabled: true, autoRun: false },
            shiproom: { enabled: true, autoRun: true },
        },
        gates: {
            afterTriage: true,
            afterReview: true,
        },
        goldenTestsRequired: true,
    }
}
