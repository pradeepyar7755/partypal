'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { SITE_EMAILS } from '@/lib/constants'
import styles from './pipeline.module.css'

// ── Types ─────────────────────────────────────────────

interface StageData {
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    startedAt: string | null
    completedAt: string | null
    result: Record<string, unknown> | null
}

interface PipelineRun {
    id: string
    ticketId: string | null
    branch: string
    status: string
    stages: Record<string, StageData>
    startedAt: string
    completedAt: string | null
    triggeredBy: string
}

interface Ticket {
    id: string
    title: string
    description: string
    type: 'bug' | 'feature'
    priority: string
    status: string
    createdAt: string
    createdBy: string
    agentResults: Record<string, unknown>
}

interface AgentConfig {
    agents: Record<string, { enabled: boolean; autoRun: boolean }>
    gates: Record<string, boolean>
    goldenTestsRequired: boolean
    lastGoldenTestResult?: GoldenTestResult
    lastGoldenTestAt?: string
}

interface GoldenTestResult {
    total: number
    passed: number
    failed: number
    skipped: number
    suites: { name: string; tests: { name: string; status: string; duration: number }[] }[]
}

interface DashboardStats {
    totalRuns: number
    successfulRuns: number
    failedRuns: number
    pendingRuns: number
    totalTickets: number
    openTickets: number
    goldenTestsLastRun: GoldenTestResult | null
}

// ── Agent Definitions ─────────────────────────────────

const AGENTS = [
    { key: 'triage', icon: '🔍', name: 'Bug Triage', desc: 'Classifies bugs by severity, identifies affected module and root cause', command: 'npm run agent:triage' },
    { key: 'prioritize', icon: '📊', name: 'Feature Prioritize', desc: 'Scores features by impact/effort rubric, ranks and recommends', command: 'npm run agent:prioritize' },
    { key: 'dev', icon: '⚡', name: 'Development', desc: 'Writes production-ready code following all PartyPal conventions', command: 'npm run agent:dev' },
    { key: 'review', icon: '🛡️', name: 'Code Review', desc: 'Reviews diffs for security, convention violations, and logic errors', command: 'npm run agent:review' },
    { key: 'test', icon: '🧪', name: 'Testing', desc: 'Runs golden tests and full suite, generates coverage reports', command: 'npm run agent:test' },
    { key: 'deploy', icon: '🚀', name: 'Sandbox Deploy', desc: 'Deploys Vercel preview and runs smoke tests on endpoints', command: 'npm run agent:sandbox' },
    { key: 'shiproom', icon: '📋', name: 'Shiproom', desc: 'Synthesizes all reports into a ship/hold/reject recommendation', command: 'npm run agent:shiproom' },
]

const PIPELINE_STAGES = [
    { key: 'triage', icon: '🔍', label: 'Triage', hasGate: true },
    { key: 'dev', icon: '⚡', label: 'Develop' },
    { key: 'review', icon: '🛡️', label: 'Review', hasGate: true },
    { key: 'test', icon: '🧪', label: 'Test' },
    { key: 'deploy', icon: '🚀', label: 'Deploy' },
    { key: 'shiproom', icon: '📋', label: 'Ship' },
]

// ── Helpers ───────────────────────────────────────────

function timeAgo(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

// ── Golden Test Definitions (matches tests/golden/) ───

const GOLDEN_TESTS = [
    { suite: 'Event CRUD', tests: [
        'rejects GET without uid',
        'returns empty events for new user',
        'rejects POST without eventId',
        'rejects DELETE without eventId',
        'blocks DELETE by non-owner',
    ]},
    { suite: 'Auth Guards', tests: [
        'PATCH rejects action from non-owner',
        'PATCH rejects missing action',
        'PATCH returns 404 for nonexistent event',
    ]},
    { suite: 'Poll Lifecycle', tests: [
        'rejects poll creation with fewer than 2 options',
        'rejects vote with missing fields',
        'GET rejects missing id and eventId',
        'returns 404 for nonexistent poll',
        'rejects DELETE with missing poll id',
    ]},
    { suite: 'Rate Limiter', tests: [
        'returns correct tier for small user base',
        'returns correct tier for medium user base',
        'returns correct tier for large user base',
        'returns last tier for very large user base',
        'PLAN_CONFIG has valid thresholds',
    ]},
    { suite: 'Email System', tests: [
        'returns error when RESEND_API_KEY is not configured',
        'exports all sender types',
        'sendBatchEmails is a function',
    ]},
    { suite: 'Error Response Shapes', tests: [
        'events GET error includes "error" field',
        'events POST error includes "error" field',
        'polls GET error includes "error" field',
        'polls POST error includes "error" field',
    ]},
]

const ADMIN_EMAILS = [SITE_EMAILS.admin]

export default function PipelineDashboard() {
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()

    // ── State ──────────────────────────────────
    const [selectedTab, setSelectedTab] = useState<'overview' | 'tickets' | 'agents' | 'tests' | 'runs'>('overview')
    const [loading, setLoading] = useState(true)
    const [runs, setRuns] = useState<PipelineRun[]>([])
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [showCreateTicket, setShowCreateTicket] = useState(false)
    const [newTicket, setNewTicket] = useState<{ title: string; description: string; type: 'bug' | 'feature'; priority: string }>({ title: '', description: '', type: 'bug', priority: 'P2' })
    const [goldenResults, setGoldenResults] = useState<GoldenTestResult | null>(null)
    const [expandedRun, setExpandedRun] = useState<string | null>(null)

    const isAdmin = user && ADMIN_EMAILS.includes(user.email || '')

    // ── Data Fetch ─────────────────────────────
    const fetchData = useCallback(async () => {
        if (!user) return
        try {
            const token = await user.getIdToken()
            const res = await fetch('/api/admin/pipeline?action=dashboard', {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) throw new Error('Failed to load')
            const data = await res.json()
            setRuns(data.runs || [])
            setTickets(data.tickets || [])
            setAgentConfig(data.agentConfig || null)
            setStats(data.stats || null)
            if (data.agentConfig?.lastGoldenTestResult) {
                setGoldenResults(data.agentConfig.lastGoldenTestResult)
            }
        } catch (err) {
            console.error('Pipeline fetch error:', err)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        if (user && isAdmin) fetchData()
    }, [user, isAdmin, fetchData])

    // ── API Helpers ────────────────────────────
    const apiPost = async (body: Record<string, unknown>) => {
        const token = await user!.getIdToken()
        const res = await fetch('/api/admin/pipeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        })
        return res.json()
    }

    const handleCreateTicket = async () => {
        if (!newTicket.title.trim()) return
        await apiPost({ action: 'create_ticket', ...newTicket })
        setNewTicket({ title: '', description: '', type: 'bug', priority: 'P2' })
        setShowCreateTicket(false)
        fetchData()
    }

    const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
        await apiPost({ action: 'update_ticket', ticketId, updates: { status } })
        fetchData()
    }

    const handleDeleteTicket = async (ticketId: string) => {
        const token = await user!.getIdToken()
        await fetch(`/api/admin/pipeline?ticketId=${ticketId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        })
        fetchData()
    }

    const handleCreateRun = async (ticketId?: string) => {
        await apiPost({ action: 'create_run', ticketId, branch: 'main' })
        fetchData()
    }

    const handleToggleAgent = async (agentKey: string, field: 'enabled' | 'autoRun', value: boolean) => {
        const updated = { ...agentConfig }
        if (!updated.agents) (updated as AgentConfig).agents = {}
        if (!(updated as AgentConfig).agents[agentKey]) (updated as AgentConfig).agents[agentKey] = { enabled: true, autoRun: false }
        ;(updated as AgentConfig).agents[agentKey][field] = value
        await apiPost({ action: 'update_config', config: updated })
        setAgentConfig(updated as AgentConfig)
    }

    const handleUpdateStage = async (runId: string, stage: string, status: string) => {
        // Require confirmation for completing or failing stages
        if (status === 'completed') {
            const stageName = PIPELINE_STAGES.find(s => s.key === stage)?.label || stage
            if (!window.confirm(`Mark "${stageName}" as PASSED?\n\nThis confirms the stage was reviewed and completed successfully.`)) return
        }
        if (status === 'failed') {
            const stageName = PIPELINE_STAGES.find(s => s.key === stage)?.label || stage
            if (!window.confirm(`Mark "${stageName}" as FAILED?\n\nThis will block the pipeline from proceeding.`)) return
        }
        const result = await apiPost({ action: 'update_stage', runId, stage, status })
        if (result.error) {
            alert(`Cannot update stage: ${result.error}`)
            return
        }
        fetchData()
    }

    // ── Auth Guard ─────────────────────────────
    if (authLoading) {
        return (
            <main className={styles.pipelinePage}>
                <div className={styles.loading}>
                    <div className={styles.loadingText}>Loading...</div>
                </div>
            </main>
        )
    }

    if (!isAdmin) {
        return (
            <main className={styles.pipelinePage}>
                <div className={styles.accessDenied}>
                    <div className={styles.accessTitle}>Access Denied</div>
                    <div className={styles.accessSub}>Pipeline dashboard is admin-only.</div>
                    <button className={styles.btnPrimary} style={{ marginTop: '1rem', maxWidth: 200 }}
                        onClick={() => router.push(user ? '/' : '/login')}>
                        {user ? 'Back to App' : 'Sign In'}
                    </button>
                </div>
            </main>
        )
    }

    // ── Render ──────────────────────────────────
    return (
        <main className={styles.pipelinePage}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <span className={styles.logo}>Party<span>Pal</span></span>
                    <span className={`${styles.badge} ${styles.badgePipeline}`}>Pipeline</span>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.refreshBtn} onClick={fetchData}>
                        Refresh
                    </button>
                    <a href="/admin" className={styles.backLink}>Analytics</a>
                    <a href="/" className={styles.backLink}>App</a>
                </div>
            </header>

            <div className={styles.content}>
                {/* Tabs */}
                <div className={styles.tabBar}>
                    {([
                        ['overview', '🏠 Overview'],
                        ['tickets', '🎫 Tickets'],
                        ['agents', '🤖 Agents'],
                        ['tests', '🧪 Tests'],
                        ['runs', '🔄 Runs'],
                    ] as const).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setSelectedTab(key)}
                            className={`${styles.tabBtn} ${selectedTab === key ? styles.tabBtnActive : ''}`}
                            style={{ borderBottom: selectedTab === key ? '2.5px solid #4AADA8' : '2.5px solid transparent' }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className={styles.loading}><div className={styles.loadingText}>Loading pipeline data...</div></div>
                ) : (
                    <>
                        {/* ═══ OVERVIEW TAB ═══ */}
                        {selectedTab === 'overview' && (
                            <>
                                {/* KPIs */}
                                <div className={styles.kpiGrid}>
                                    <KPICard icon="🎫" label="Open Tickets" value={stats?.openTickets ?? 0} color="#4AADA8" />
                                    <KPICard icon="🔄" label="Pipeline Runs" value={stats?.totalRuns ?? 0} />
                                    <KPICard icon="✅" label="Shipped" value={stats?.successfulRuns ?? 0} color="#3D8C6E" />
                                    <KPICard icon="❌" label="Failed" value={stats?.failedRuns ?? 0} color="#E8896A" />
                                    <KPICard icon="🧪" label="Golden Tests" value={goldenResults ? `${goldenResults.passed}/${goldenResults.total}` : '—'} color={goldenResults?.failed === 0 ? '#3D8C6E' : '#E8896A'} sub={goldenResults ? (goldenResults.failed === 0 ? 'All passing' : `${goldenResults.failed} failing`) : 'Not run yet'} />
                                    <KPICard icon="🤖" label="Active Agents" value={agentConfig ? Object.values(agentConfig.agents || {}).filter(a => a.enabled).length : 7} sub={`of ${AGENTS.length} total`} />
                                </div>

                                {/* Pipeline Flow Visualization */}
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionEmoji}>🔀</span>
                                    <span className={styles.sectionTitle}>Pipeline Flow</span>
                                    <span className={styles.sectionSub}>Visual orchestration</span>
                                </div>

                                <div className={styles.card}>
                                    <div className={styles.pipelineFlow}>
                                        {PIPELINE_STAGES.map((stage, i) => {
                                            const latestRun = runs[0]
                                            const stageData = latestRun?.stages?.[stage.key]
                                            const status = stageData?.status || 'pending'

                                            return (
                                                <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                                    <div className={styles.stageNode}>
                                                        <div className={`${styles.stageIcon} ${
                                                            status === 'in_progress' ? styles.stageIconActive :
                                                            status === 'completed' ? styles.stageIconDone :
                                                            status === 'failed' ? styles.stageIconFailed :
                                                            styles.stageIconPending
                                                        }`}>
                                                            {status === 'completed' ? '✓' :
                                                             status === 'failed' ? '✗' :
                                                             status === 'in_progress' ? '⟳' :
                                                             stage.icon}
                                                            {stage.hasGate && (
                                                                <div className={styles.gateMarker}>G</div>
                                                            )}
                                                        </div>
                                                        <div className={`${styles.stageName} ${
                                                            status === 'in_progress' ? styles.stageNameActive : ''
                                                        }`}>
                                                            {stage.label}
                                                        </div>
                                                    </div>
                                                    {i < PIPELINE_STAGES.length - 1 && (
                                                        <div className={`${styles.stageConnector} ${
                                                            status === 'completed' ? styles.stageConnectorDone : ''
                                                        }`} />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>
                                            G = Human Gate (requires your approval)
                                        </span>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionEmoji}>⚡</span>
                                    <span className={styles.sectionTitle}>Quick Actions</span>
                                </div>

                                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                                    <button className={styles.btnPrimary} onClick={() => setShowCreateTicket(true)} style={{ flex: 'none', padding: '0.5rem 1rem' }}>
                                        + New Ticket
                                    </button>
                                    <button className={styles.btnSmall} onClick={() => handleCreateRun()}>
                                        Start Pipeline Run
                                    </button>
                                    <button className={styles.btnSmall} onClick={() => setSelectedTab('tests')}>
                                        View Golden Tests
                                    </button>
                                    <button className={styles.btnSmall} onClick={() => setSelectedTab('agents')}>
                                        Configure Agents
                                    </button>
                                    <button className={styles.btnSmall} onClick={async () => {
                                        if (!window.confirm('Import all existing bug reports as pipeline tickets?\n\nThis will skip duplicates and junk entries.')) return
                                        const token = await user!.getIdToken()
                                        const res = await fetch('/api/admin/pipeline/backfill', {
                                            method: 'POST',
                                            headers: { Authorization: `Bearer ${token}` },
                                        })
                                        const result = await res.json()
                                        if (result.success) {
                                            alert(`Imported ${result.created} tickets (${result.skipped} skipped)`)
                                            fetchData()
                                        } else {
                                            alert(`Import failed: ${result.error}`)
                                        }
                                    }}>
                                        Import Bug Reports
                                    </button>
                                </div>

                                {/* Recent Runs */}
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionEmoji}>🔄</span>
                                    <span className={styles.sectionTitle}>Recent Runs</span>
                                    <span className={styles.sectionSub}>{runs.length} total</span>
                                </div>

                                {runs.length === 0 ? (
                                    <div className={styles.emptyState}>No pipeline runs yet. Create a ticket or start a run to begin.</div>
                                ) : (
                                    <div>
                                        {runs.slice(0, 5).map(run => (
                                            <RunRow key={run.id} run={run} onExpand={() => setExpandedRun(expandedRun === run.id ? null : run.id)} expanded={expandedRun === run.id} onUpdateStage={handleUpdateStage} />
                                        ))}
                                    </div>
                                )}

                                {/* Recent Tickets */}
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionEmoji}>🎫</span>
                                    <span className={styles.sectionTitle}>Recent Tickets</span>
                                    <span className={styles.sectionSub}>{tickets.length} total</span>
                                </div>

                                {tickets.length === 0 ? (
                                    <div className={styles.emptyState}>No tickets yet. Create one to start the pipeline.</div>
                                ) : (
                                    <div className={styles.ticketList}>
                                        {tickets.slice(0, 5).map(ticket => (
                                            <TicketRow key={ticket.id} ticket={ticket} onStatusChange={handleUpdateTicketStatus} onDelete={handleDeleteTicket} onCreateRun={handleCreateRun} />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ═══ TICKETS TAB ═══ */}
                        {selectedTab === 'tickets' && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div className={styles.sectionHeader} style={{ margin: 0, border: 'none', paddingBottom: 0 }}>
                                        <span className={styles.sectionEmoji}>🎫</span>
                                        <span className={styles.sectionTitle}>All Tickets</span>
                                        <span className={styles.sectionSub}>{tickets.length} total</span>
                                    </div>
                                    <button className={styles.btnPrimary} onClick={() => setShowCreateTicket(true)} style={{ flex: 'none', padding: '0.5rem 1rem' }}>
                                        + New Ticket
                                    </button>
                                </div>

                                {tickets.length === 0 ? (
                                    <div className={styles.emptyState}>
                                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎫</div>
                                        <div>No tickets yet.</div>
                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', marginTop: '0.3rem' }}>Create a bug report or feature request to start the pipeline.</div>
                                    </div>
                                ) : (
                                    <div className={styles.ticketList}>
                                        {tickets.map(ticket => (
                                            <TicketRow key={ticket.id} ticket={ticket} onStatusChange={handleUpdateTicketStatus} onDelete={handleDeleteTicket} onCreateRun={handleCreateRun} />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ═══ AGENTS TAB ═══ */}
                        {selectedTab === 'agents' && (
                            <>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionEmoji}>🤖</span>
                                    <span className={styles.sectionTitle}>Agent Configuration</span>
                                    <span className={styles.sectionSub}>Toggle agents on/off</span>
                                </div>

                                <div className={styles.agentGrid}>
                                    {AGENTS.map(agent => {
                                        const config = agentConfig?.agents?.[agent.key] || { enabled: true, autoRun: false }
                                        return (
                                            <div key={agent.key} className={styles.agentCard} style={{
                                                opacity: config.enabled ? 1 : 0.5,
                                                borderColor: config.enabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                                            }}>
                                                <div className={styles.agentHeader}>
                                                    <span className={styles.agentIcon}>{agent.icon}</span>
                                                    <span className={styles.agentName}>{agent.name}</span>
                                                </div>
                                                <div className={styles.agentDesc}>{agent.desc}</div>
                                                <div className={styles.agentToggle}>
                                                    <span className={styles.toggleLabel}>Enabled</span>
                                                    <button className={`${styles.toggle} ${config.enabled ? styles.toggleOn : styles.toggleOff}`}
                                                        onClick={() => handleToggleAgent(agent.key, 'enabled', !config.enabled)}>
                                                        <div className={`${styles.toggleDot} ${config.enabled ? styles.toggleDotOn : styles.toggleDotOff}`} />
                                                    </button>
                                                </div>
                                                <div className={styles.agentToggle}>
                                                    <span className={styles.toggleLabel}>Auto-run</span>
                                                    <button className={`${styles.toggle} ${config.autoRun ? styles.toggleOn : styles.toggleOff}`}
                                                        onClick={() => handleToggleAgent(agent.key, 'autoRun', !config.autoRun)}>
                                                        <div className={`${styles.toggleDot} ${config.autoRun ? styles.toggleDotOn : styles.toggleDotOff}`} />
                                                    </button>
                                                </div>
                                                <div style={{ marginTop: '0.6rem', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontFamily: "'Courier New', monospace", fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>
                                                    {agent.command}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Gate Configuration */}
                                <div className={styles.sectionHeader} style={{ marginTop: '2rem' }}>
                                    <span className={styles.sectionEmoji}>🚧</span>
                                    <span className={styles.sectionTitle}>Human Gates</span>
                                    <span className={styles.sectionSub}>Approval checkpoints</span>
                                </div>

                                <div className={styles.card}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        {[
                                            { key: 'afterTriage', label: 'After Triage', desc: 'Review ticket classification before development begins' },
                                            { key: 'afterReview', label: 'After Code Review', desc: 'Review code changes before testing and deployment' },
                                        ].map(gate => (
                                            <div key={gate.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'white' }}>🚧 {gate.label}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.15rem' }}>{gate.desc}</div>
                                                </div>
                                                <button className={`${styles.toggle} ${agentConfig?.gates?.[gate.key] !== false ? styles.toggleOn : styles.toggleOff}`}
                                                    onClick={async () => {
                                                        const newVal = agentConfig?.gates?.[gate.key] === false
                                                        const updated = { ...agentConfig, gates: { ...agentConfig?.gates, [gate.key]: newVal } }
                                                        await apiPost({ action: 'update_config', config: updated })
                                                        setAgentConfig(updated as AgentConfig)
                                                    }}>
                                                    <div className={`${styles.toggleDot} ${agentConfig?.gates?.[gate.key] !== false ? styles.toggleDotOn : styles.toggleDotOff}`} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ═══ TESTS TAB ═══ */}
                        {selectedTab === 'tests' && (
                            <>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionEmoji}>🧪</span>
                                    <span className={styles.sectionTitle}>Golden Test Suite</span>
                                    <span className={styles.sectionSub}>{GOLDEN_TESTS.reduce((sum, s) => sum + s.tests.length, 0)} tests across {GOLDEN_TESTS.length} suites</span>
                                </div>

                                <div className={styles.kpiGrid} style={{ marginBottom: '1.5rem' }}>
                                    <KPICard icon="🧪" label="Total Tests" value={GOLDEN_TESTS.reduce((sum, s) => sum + s.tests.length, 0)} />
                                    <KPICard icon="📦" label="Test Suites" value={GOLDEN_TESTS.length} />
                                    <KPICard icon="✅" label="Last Result" value={goldenResults ? `${goldenResults.passed} passed` : 'Not run'} color="#3D8C6E" />
                                    <KPICard icon="⏱️" label="Last Run" value={agentConfig?.lastGoldenTestAt ? timeAgo(agentConfig.lastGoldenTestAt) : 'Never'} />
                                </div>

                                <div style={{ marginBottom: '1rem' }}>
                                    <button className={styles.btnSmall} onClick={() => {
                                        // Show instructions since tests run locally
                                        alert('Run golden tests locally:\n\nnpm run test:golden\n\nOr run the full suite:\n\nnpm test')
                                    }}>
                                        Run Tests Locally
                                    </button>
                                </div>

                                {GOLDEN_TESTS.map(suite => (
                                    <div key={suite.suite} className={styles.card}>
                                        <div className={styles.cardTitle}>{suite.suite}</div>
                                        <div className={styles.testGrid}>
                                            {suite.tests.map(test => (
                                                <div key={test} className={styles.testRow}>
                                                    <div className={`${styles.testDot} ${styles.testDotPass}`} />
                                                    <span className={styles.testName}>{test}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {/* CLI commands reference */}
                                <div className={styles.sectionHeader} style={{ marginTop: '2rem' }}>
                                    <span className={styles.sectionEmoji}>💻</span>
                                    <span className={styles.sectionTitle}>Test Commands</span>
                                </div>

                                <div className={styles.card}>
                                    {[
                                        { cmd: 'npm test', desc: 'Run all tests' },
                                        { cmd: 'npm run test:golden', desc: 'Run golden tests only (blocking for deploy)' },
                                        { cmd: 'npm run test:watch', desc: 'Watch mode — re-runs on file changes' },
                                        { cmd: 'npm run test:coverage', desc: 'Run with coverage report' },
                                    ].map(item => (
                                        <div key={item.cmd} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <code style={{ fontFamily: "'Courier New', monospace", fontSize: '0.78rem', color: '#4AADA8', background: 'rgba(74,173,168,0.1)', padding: '0.25rem 0.5rem', borderRadius: 6, fontWeight: 700 }}>{item.cmd}</code>
                                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{item.desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* ═══ RUNS TAB ═══ */}
                        {selectedTab === 'runs' && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div className={styles.sectionHeader} style={{ margin: 0, border: 'none', paddingBottom: 0 }}>
                                        <span className={styles.sectionEmoji}>🔄</span>
                                        <span className={styles.sectionTitle}>Pipeline Runs</span>
                                        <span className={styles.sectionSub}>{runs.length} total</span>
                                    </div>
                                    <button className={styles.btnPrimary} onClick={() => handleCreateRun()} style={{ flex: 'none', padding: '0.5rem 1rem' }}>
                                        + New Run
                                    </button>
                                </div>

                                {runs.length === 0 ? (
                                    <div className={styles.emptyState}>
                                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔄</div>
                                        <div>No pipeline runs yet.</div>
                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', marginTop: '0.3rem' }}>Start a run to see the pipeline in action.</div>
                                    </div>
                                ) : (
                                    <div>
                                        {runs.map(run => (
                                            <RunRow key={run.id} run={run} onExpand={() => setExpandedRun(expandedRun === run.id ? null : run.id)} expanded={expandedRun === run.id} onUpdateStage={handleUpdateStage} />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* ═══ CREATE TICKET MODAL ═══ */}
            {showCreateTicket && (
                <div className={styles.modalOverlay} onClick={() => setShowCreateTicket(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalTitle}>Create Ticket</div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Type</label>
                            <select className={styles.formSelect} value={newTicket.type} onChange={e => setNewTicket({ ...newTicket, type: e.target.value as 'bug' | 'feature' })}>
                                <option value="bug">Bug Report</option>
                                <option value="feature">Feature Request</option>
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Title</label>
                            <input className={styles.formInput} placeholder="Brief description..." value={newTicket.title} onChange={e => setNewTicket({ ...newTicket, title: e.target.value })} autoFocus />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Description</label>
                            <textarea className={styles.formTextarea} placeholder="Detailed description, steps to reproduce, expected behavior..." value={newTicket.description} onChange={e => setNewTicket({ ...newTicket, description: e.target.value })} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Priority</label>
                            <select className={styles.formSelect} value={newTicket.priority} onChange={e => setNewTicket({ ...newTicket, priority: e.target.value })}>
                                <option value="P0">P0 — Critical</option>
                                <option value="P1">P1 — High</option>
                                <option value="P2">P2 — Medium</option>
                                <option value="P3">P3 — Low</option>
                            </select>
                        </div>
                        <div className={styles.formActions}>
                            <button className={styles.btnSecondary} onClick={() => setShowCreateTicket(false)}>Cancel</button>
                            <button className={styles.btnPrimary} onClick={handleCreateTicket}>Create Ticket</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

// ── Sub-Components ────────────────────────────────────

function KPICard({ icon, label, value, color, sub }: { icon: string; label: string; value: string | number; color?: string; sub?: string }) {
    return (
        <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>{icon} {label}</div>
            <div className={styles.kpiValue} style={color ? { color } : {}}>{value}</div>
            {sub && <div className={styles.kpiSub}>{sub}</div>}
        </div>
    )
}

function TicketRow({ ticket, onStatusChange, onDelete, onCreateRun }: { ticket: Ticket; onStatusChange: (id: string, status: string) => void; onDelete: (id: string) => void; onCreateRun: (id: string) => void }) {
    return (
        <div className={styles.ticketRow}>
            <span className={`${styles.ticketType} ${ticket.type === 'bug' ? styles.ticketTypeBug : styles.ticketTypeFeature}`}>
                {ticket.type === 'bug' ? '🐛 Bug' : '✨ Feature'}
            </span>
            <span className={styles.ticketTitle}>{ticket.title}</span>
            <span className={`${styles.ticketPriority} ${styles[`priority${ticket.priority}` as keyof typeof styles] || ''}`}>
                {ticket.priority}
            </span>
            <span className={`${styles.ticketStatus} ${
                ticket.status === 'open' ? styles.statusOpen :
                ticket.status === 'in_progress' ? styles.statusInProgress :
                ticket.status === 'done' ? styles.statusDone :
                ticket.status === 'shipped' ? styles.statusShipped :
                ''
            }`}>
                {ticket.status}
            </span>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
                {ticket.status === 'open' && (
                    <>
                        <button className={styles.btnSmall} onClick={() => onStatusChange(ticket.id, 'in_progress')} title="Start working">▶</button>
                        <button className={styles.btnSmall} onClick={() => onCreateRun(ticket.id)} title="Start pipeline run">🔄</button>
                    </>
                )}
                {ticket.status === 'in_progress' && (
                    <button className={styles.btnSmall} onClick={() => onStatusChange(ticket.id, 'done')} title="Mark done">✓</button>
                )}
                <button className={styles.btnSmall} onClick={() => onDelete(ticket.id)} title="Delete" style={{ color: '#E8896A' }}>✗</button>
            </div>
        </div>
    )
}

function RunRow({ run, onExpand, expanded, onUpdateStage }: { run: PipelineRun; onExpand: () => void; expanded: boolean; onUpdateStage: (runId: string, stage: string, status: string) => void }) {
    const stageStatuses = PIPELINE_STAGES.map(s => {
        const data = run.stages?.[s.key]
        return data?.status || 'pending'
    })

    const statusColor = (s: string) =>
        s === 'completed' ? '#3D8C6E' :
        s === 'failed' ? '#E8896A' :
        s === 'in_progress' ? '#4AADA8' :
        '#586069'

    return (
        <div>
            <div className={styles.runRow} onClick={onExpand} style={{ cursor: 'pointer' }}>
                <div className={`${styles.runDot} ${
                    run.status === 'shipped' ? styles.runDotSuccess :
                    run.status === 'failed' ? styles.runDotFailed :
                    run.status === 'in_progress' ? styles.runDotActive :
                    styles.runDotPending
                }`} />
                <div className={styles.runInfo}>
                    <div className={styles.runTitle}>
                        Run #{run.id.slice(-6)} — {run.branch}
                    </div>
                    <div className={styles.runMeta}>
                        {run.triggeredBy} · {timeAgo(run.startedAt)}
                    </div>
                </div>
                <div className={styles.runStages}>
                    {stageStatuses.map((s, i) => (
                        <div key={i} className={styles.runStageDot} style={{ background: statusColor(s) }} title={`${PIPELINE_STAGES[i].label}: ${s}`} />
                    ))}
                </div>
                <span className={`${styles.ticketStatus} ${
                    run.status === 'shipped' ? styles.statusShipped :
                    run.status === 'failed' ? styles.statusFailed :
                    run.status === 'in_progress' ? styles.statusInProgress :
                    styles.statusOpen
                }`}>
                    {run.status}
                </span>
            </div>
            {expanded && (
                <div className={styles.card} style={{ marginTop: '0.3rem', marginBottom: '0.8rem' }}>
                    <div className={styles.cardTitle}>Stage Details</div>
                    {PIPELINE_STAGES.map(stage => {
                        const data = run.stages?.[stage.key]
                        const status = data?.status || 'pending'
                        return (
                            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <span style={{ fontSize: '1rem' }}>{stage.icon}</span>
                                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'white', minWidth: 80 }}>{stage.label}</span>
                                <span className={`${styles.ticketStatus} ${
                                    status === 'completed' ? styles.statusDone :
                                    status === 'failed' ? styles.statusFailed :
                                    status === 'in_progress' ? styles.statusInProgress :
                                    styles.statusOpen
                                }`}>{status}</span>
                                {data?.startedAt && <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)' }}>{timeAgo(data.startedAt)}</span>}
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem' }}>
                                    {status === 'pending' && (
                                        <button className={styles.btnSmall} onClick={(e) => { e.stopPropagation(); onUpdateStage(run.id, stage.key, 'in_progress') }}>Start</button>
                                    )}
                                    {status === 'in_progress' && (
                                        <>
                                            <button className={styles.btnSmall} onClick={(e) => { e.stopPropagation(); onUpdateStage(run.id, stage.key, 'completed') }} style={{ color: '#3D8C6E' }}>Pass</button>
                                            <button className={styles.btnSmall} onClick={(e) => { e.stopPropagation(); onUpdateStage(run.id, stage.key, 'failed') }} style={{ color: '#E8896A' }}>Fail</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
