// ═══════════════════════════════════════════════════════
//  Pipeline Notification System
//  Sends email alerts to admin on pipeline events.
//  All sends are fire-and-forget — never blocks the pipeline.
// ═══════════════════════════════════════════════════════

import { sendEmail } from '@/lib/email'
import { pipelineNotificationEmail, PipelineEmailType } from '@/lib/email-templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://partypal.social'
const PIPELINE_URL = `${APP_URL}/admin/pipeline`

// Recipients for pipeline notifications
const PIPELINE_RECIPIENTS = [
    'admin@partypal.social',
    'pradeepyar@gmail.com',
]

const STAGE_LABELS: Record<string, string> = {
    triage: 'Triage',
    dev: 'Development',
    review: 'Code Review',
    test: 'Testing',
    deploy: 'Sandbox Deploy',
    shiproom: 'Shiproom',
}

// ── Core Send ─────────────────────────────────────────

async function notifyPipeline(params: {
    type: PipelineEmailType
    subject: string
    title: string
    subtitle?: string
    details: string[]
    actionLabel?: string
    urgency?: 'info' | 'warning' | 'critical'
}) {
    const html = pipelineNotificationEmail({
        ...params,
        actionUrl: PIPELINE_URL,
    })

    // Send to all recipients (fire-and-forget per recipient)
    await Promise.allSettled(
        PIPELINE_RECIPIENTS.map(to =>
            sendEmail({
                type: 'notifications',
                to,
                subject: `[Pipeline] ${params.subject}`,
                html,
            })
        )
    )
}

// ── Event-Specific Notifiers ──────────────────────────

/** When a new ticket is created (bug or feature) */
export async function notifyTicketCreated(ticket: {
    title: string
    type: 'bug' | 'feature'
    priority: string
    createdBy: string
}) {
    await notifyPipeline({
        type: 'ticket_created',
        subject: `New ${ticket.type}: ${ticket.title}`,
        title: `New ${ticket.type === 'bug' ? 'Bug Report' : 'Feature Request'}`,
        subtitle: 'A new ticket has entered the pipeline',
        details: [
            `Title: ${ticket.title}`,
            `Type: ${ticket.type === 'bug' ? '🐛 Bug' : '✨ Feature'}`,
            `Priority: ${ticket.priority}`,
            `Created by: ${ticket.createdBy}`,
        ],
        actionLabel: 'Review Ticket',
        urgency: ticket.priority === 'P0' ? 'critical' : 'info',
    })
}

/** When a user-submitted bug report auto-creates a pipeline ticket */
export async function notifyUserBugEscalated(bug: {
    category: string
    description: string
    page: string
    userName: string
    ticketId: string
}) {
    await notifyPipeline({
        type: 'ticket_created',
        subject: `User bug report: ${bug.category}`,
        title: 'User Bug Report Escalated',
        subtitle: 'An end-user bug report has been added to the pipeline',
        details: [
            `Category: ${bug.category}`,
            `Reported by: ${bug.userName || 'Anonymous'}`,
            `Page: ${bug.page}`,
            `Description: ${bug.description.slice(0, 200)}${bug.description.length > 200 ? '...' : ''}`,
            `Ticket ID: ${bug.ticketId}`,
        ],
        actionLabel: 'Triage This Bug',
        urgency: 'warning',
    })
}

/** When a stage needs human approval (gate) */
export async function notifyGateApprovalNeeded(params: {
    runId: string
    stage: string
    branch: string
    completedStages: string[]
}) {
    const stageLabel = STAGE_LABELS[params.stage] || params.stage
    await notifyPipeline({
        type: 'gate_needs_approval',
        subject: `Approval needed: ${stageLabel}`,
        title: `Gate: ${stageLabel} Needs Approval`,
        subtitle: `Pipeline run on branch "${params.branch}" is waiting for your review`,
        details: [
            `Stage: ${stageLabel}`,
            `Branch: ${params.branch}`,
            `Run ID: ${params.runId.slice(-8)}`,
            `Completed: ${params.completedStages.map(s => STAGE_LABELS[s] || s).join(' → ')}`,
        ],
        actionLabel: 'Review & Approve',
        urgency: 'warning',
    })
}

/** When a pipeline stage completes or starts */
export async function notifyStageUpdate(params: {
    runId: string
    stage: string
    status: 'in_progress' | 'completed' | 'failed'
    branch: string
    updatedBy: string
}) {
    const stageLabel = STAGE_LABELS[params.stage] || params.stage

    if (params.status === 'failed') {
        await notifyPipeline({
            type: 'pipeline_blocked',
            subject: `BLOCKED: ${stageLabel} failed`,
            title: `Pipeline Blocked`,
            subtitle: `${stageLabel} stage has failed`,
            details: [
                `Stage: ${stageLabel}`,
                `Status: FAILED`,
                `Branch: ${params.branch}`,
                `Updated by: ${params.updatedBy}`,
            ],
            actionLabel: 'Investigate',
            urgency: 'critical',
        })
        return
    }

    // Map completed stages to specific notification types
    const typeMap: Record<string, PipelineEmailType> = {
        'triage:completed': 'triage_complete',
        'dev:in_progress': 'dev_started',
        'review:completed': 'review_ready',
        'test:completed': 'tests_passed',
        'deploy:completed': 'deploy_ready',
        'shiproom:completed': 'ship_decision',
    }
    const notifType = typeMap[`${params.stage}:${params.status}`]
    if (!notifType) return // Don't email on every single status change

    const subjectMap: Record<string, string> = {
        triage_complete: `Triage complete — review needed`,
        dev_started: `Development started on ${params.branch}`,
        review_ready: `Code review passed — approve to deploy`,
        tests_passed: `All tests passed`,
        deploy_ready: `Preview deployed — ready for ship review`,
        ship_decision: `Ship decision needed`,
    }

    const urgencyMap: Record<string, 'info' | 'warning' | 'critical'> = {
        triage_complete: 'warning',
        review_ready: 'warning',
        ship_decision: 'warning',
    }

    await notifyPipeline({
        type: notifType,
        subject: subjectMap[notifType] || `${stageLabel} ${params.status}`,
        title: subjectMap[notifType] || `${stageLabel} ${params.status}`,
        subtitle: `Pipeline run on "${params.branch}"`,
        details: [
            `Stage: ${stageLabel}`,
            `Status: ${params.status.toUpperCase()}`,
            `Branch: ${params.branch}`,
            `Updated by: ${params.updatedBy}`,
        ],
        actionLabel: urgencyMap[notifType] ? 'Review Now' : 'View Pipeline',
        urgency: urgencyMap[notifType] || 'info',
    })
}

/** When tests fail (golden or full suite) */
export async function notifyTestsFailed(params: {
    runId: string
    branch: string
    failedCount: number
    totalCount: number
    goldenFailed: boolean
}) {
    await notifyPipeline({
        type: 'tests_failed',
        subject: params.goldenFailed ? 'CRITICAL: Golden tests failing' : `${params.failedCount} tests failed`,
        title: params.goldenFailed ? 'Golden Tests Failing' : 'Test Suite Failed',
        subtitle: 'Pipeline is blocked until tests pass',
        details: [
            `Failed: ${params.failedCount} of ${params.totalCount}`,
            `Golden tests: ${params.goldenFailed ? 'FAILING' : 'Passing'}`,
            `Branch: ${params.branch}`,
            `Run: ${params.runId.slice(-8)}`,
        ],
        actionLabel: 'Fix Tests',
        urgency: 'critical',
    })
}

/** When a security issue is detected */
export async function notifySecurityAlert(params: {
    issue: string
    file?: string
    branch: string
}) {
    await notifyPipeline({
        type: 'security_alert',
        subject: `SECURITY: ${params.issue}`,
        title: 'Security Alert',
        subtitle: 'A security issue was detected in the codebase',
        details: [
            `Issue: ${params.issue}`,
            ...(params.file ? [`File: ${params.file}`] : []),
            `Branch: ${params.branch}`,
        ],
        actionLabel: 'Investigate Now',
        urgency: 'critical',
    })
}
