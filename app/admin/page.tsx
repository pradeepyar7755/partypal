'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import styles from './admin.module.css'
import { SITE_EMAILS } from '@/lib/constants'

// ═══════════════════════════════════════════════════════
//  PartyPal Admin Analytics Dashboard
//  Executive-level metrics, conversion funnels, error
//  tracking, growth accounting, and live activity feeds.
// ═══════════════════════════════════════════════════════

// Admin email whitelist
const ADMIN_EMAILS = [SITE_EMAILS.admin]

interface DashboardData {
    period: string
    kpis: {
        totalPageViews: number
        totalSessions: number
        totalUsers: number
        totalRegisteredUsers: number
        totalSignUps: number
        totalPlansGenerated: number
        totalVendorSearches: number
        totalRSVPs: number
        totalErrors: number
        totalEvents: number
    }
    conversionRates: {
        visitorToSignUp: string
        signUpToPlan: string
        planToVendor: string
    }
    pageViewsByDay: { date: string; views: number }[]
    signUpsByDay: { date: string; count: number }[]
    pagePopularity: Record<string, number>
    recentErrors: { message: string; source: string; page: string; timestamp: string; userId?: string }[]
    recentActivity: { event: string; page: string; timestamp: string; userId?: string; properties?: Record<string, unknown> }[]
    eventInsights: {
        totalEventsCreated: number
        eventTypes: Record<string, number>
        avgGuests: number
        locations: Record<string, number>
        themes: Record<string, number>
    }
    churn: {
        totalDeleted: number
        deletedInPeriod: number
        deletionsByDay: Record<string, number>
        reasons: Record<string, number>
        avgTenureDays: number
        avgEventsCreated: number
        avgSessions: number
        churnRate: number
        netGrowth: number
        retentionRate: number
        recentDeletions: {
            displayName: string; email: string; tenureDays: number
            reason: string; deletedAt: string; eventsCreated: number; totalSessions: number
        }[]
    }
}

const EVENT_COLORS: Record<string, string> = {
    page_view: '#4AADA8',
    sign_up: '#3D8C6E',
    login: '#7B5EA7',
    plan_generated: '#F7C948',
    plan_refined: '#C4A882',
    vendor_search: '#E8896A',
    vendor_shortlisted: '#e05a33',
    invite_sent: '#4AADA8',
    rsvp_submitted: '#3D8C6E',
    notification_sent: '#7B5EA7',
    feature_used: '#9aabbb',
    error: '#E8896A',
    page_exit: '#555',
}

const EVENT_LABELS: Record<string, string> = {
    page_view: '👁️ Page View',
    sign_up: '🚀 Sign Up',
    login: '🔓 Login',
    plan_generated: '🤖 Plan Generated',
    plan_refined: '✨ Plan Refined',
    vendor_search: '🔍 Vendor Search',
    vendor_shortlisted: '❤️ Vendor Shortlisted',
    invite_sent: '💌 Invite Sent',
    rsvp_submitted: '✅ RSVP Submitted',
    notification_sent: '📧 Notification Sent',
    feature_used: '⚡ Feature Used',
    error: '❌ Error',
    page_exit: '👋 Page Exit',
}

const DONUT_COLORS = ['#F7C948', '#4AADA8', '#E8896A', '#3D8C6E', '#7B5EA7', '#C4A882', '#2D4059', '#9aabbb']

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return n.toString()
}

function timeAgo(timestamp: string): string {
    const now = Date.now()
    const then = new Date(timestamp).getTime()
    const diff = Math.floor((now - then) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
}

export default function AdminDashboard() {
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [days, setDays] = useState(30)
    const [error, setError] = useState('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [usageData, setUsageData] = useState<any>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [pollStats, setPollStats] = useState<{
        totalPolls: number; totalVotes: number; activePolls: number; eventsWithPolls: number
        uniqueVoters: number; avgOptions: string; avgVotesPerPoll: string
        topPolls: { question: string; votes: number; options: number; eventType: string | null; createdAt: string }[]
        categories: Record<string, number>
        pollsByDay: Record<string, number>
        eventTypes: Record<string, number>
        voteDist: Record<string, number>
        multiSelectPolls: number; multiSelectRate: string
    } | null>(null)

    // Bug reports state
    const [bugReports, setBugReports] = useState<{ id: string; category: string; description: string; page: string; status: string; createdAt: string; email: string; name: string; uid: string }[]>([])
    const [showBugReports, setShowBugReports] = useState(false)

    // User drill-down state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [userList, setUserList] = useState<any[]>([])
    const [usersLoading, setUsersLoading] = useState(false)
    const [userSearch, setUserSearch] = useState('')
    const [userSort, setUserSort] = useState<'lastActive' | 'sessions' | 'pageViews' | 'name' | 'created'>('lastActive')
    const [expandedUser, setExpandedUser] = useState<string | null>(null)
    const [showUsersSection, setShowUsersSection] = useState(false)

    const isAdmin = user && ADMIN_EMAILS.includes(user.email || '')

    const fetchData = useCallback(async () => {
        if (!user) return
        setLoading(true)
        setError('')
        try {
            const token = await user.getIdToken()
            const res = await fetch(`/api/analytics?q=dashboard&days=${days}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) {
                if (res.status === 401) throw new Error('Unauthorized — your session may have expired')
                throw new Error('Failed to load analytics')
            }
            const json = await res.json()
            setData(json)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load analytics')
        }
        setLoading(false)
    }, [days, user])

    useEffect(() => {
        if (!authLoading && isAdmin) fetchData()
    }, [authLoading, isAdmin, fetchData])

    // Fetch usage/rate limit data
    useEffect(() => {
        if (!authLoading && isAdmin && user) {
            (async () => {
                try {
                    const token = await user.getIdToken()
                    const res = await fetch('/api/admin/usage', { headers: { Authorization: `Bearer ${token}` } })
                    if (res.ok) setUsageData(await res.json())
                } catch { /* silent */ }
            })()
        }
    }, [authLoading, isAdmin, user])

    // Fetch poll stats
    useEffect(() => {
        if (!authLoading && isAdmin) {
            (async () => {
                try {
                    const res = await fetch('/api/polls?stats=true')
                    if (res.ok) setPollStats(await res.json())
                } catch { /* silent */ }
            })()
        }
    }, [authLoading, isAdmin])

    // Fetch bug reports
    useEffect(() => {
        if (!authLoading && isAdmin) {
            (async () => {
                try {
                    const res = await fetch('/api/bugs')
                    if (res.ok) {
                        const data = await res.json()
                        setBugReports(data.bugs || [])
                    }
                } catch { /* silent */ }
            })()
        }
    }, [authLoading, isAdmin])

    const markBugStatus = async (id: string, newStatus: string) => {
        try {
            const res = await fetch('/api/bugs', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus }),
            })
            if (res.ok) {
                setBugReports(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b))
            }
        } catch { /* silent */ }
    }

    // Fetch users drill-down data
    useEffect(() => {
        if (!authLoading && isAdmin && user && showUsersSection) {
            (async () => {
                setUsersLoading(true)
                try {
                    const token = await user.getIdToken()
                    const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
                    if (res.ok) {
                        const data = await res.json()
                        setUserList(data.users || [])
                    }
                } catch { /* silent */ }
                setUsersLoading(false)
            })()
        }
    }, [authLoading, isAdmin, user, showUsersSection])

    // Not logged in or not admin
    if (authLoading) {
        return (
            <main className={styles.adminPage}>
                <div className={styles.loading}>
                    <div className="spinner" style={{ width: 40, height: 40 }} />
                    <div className={styles.loadingText}>Loading...</div>
                </div>
            </main>
        )
    }

    if (!user || !isAdmin) {
        return (
            <main className={styles.adminPage}>
                <div className={styles.accessDenied}>
                    <div style={{ fontSize: '3rem' }}>🔒</div>
                    <div className={styles.accessTitle}>Admin Access Required</div>
                    <div className={styles.accessSub}>
                        {user ? `${user.email} is not an admin account` : 'Please sign in with an admin account'}
                    </div>
                    <button className="btn-primary" onClick={() => router.push(user ? '/' : '/login')} style={{ marginTop: '1rem' }}>
                        {user ? '← Back to Home' : '🔓 Sign In'}
                    </button>
                </div>
            </main>
        )
    }

    const k = data?.kpis
    const maxPageView = data ? Math.max(...data.pageViewsByDay.map(d => d.views), 1) : 1

    // Page names mapping
    const pageNames: Record<string, string> = {
        'root': 'Home',
        '_dashboard': 'Dashboard',
        '_vendors': 'Vendors',
        '_guests': 'Guests',
        '_login': 'Login',
        '_results': 'Results',
        '_rsvp': 'RSVP',
        '_budget': 'Budget',
        '_contact': 'Contact',
        '_admin': 'Admin',
        '_collaborate': 'Collaborate',
    }

    // Sort pages by popularity
    const sortedPages = data
        ? Object.entries(data.pagePopularity)
            .map(([page, views]) => ({ page: pageNames[page] || page, views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 8)
        : []

    const totalPagePopViews = sortedPages.reduce((s, p) => s + p.views, 0) || 1

    // Event type donut data
    const eventTypeEntries = data
        ? Object.entries(data.eventInsights.eventTypes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
        : []
    const totalEventTypes = eventTypeEntries.reduce((s, [, c]) => s + c, 0) || 1

    // Build donut gradient
    let donutGradient = 'conic-gradient('
    let cumPercent = 0
    eventTypeEntries.forEach(([, count], i) => {
        const pct = (count / totalEventTypes) * 100
        donutGradient += `${DONUT_COLORS[i]} ${cumPercent}% ${cumPercent + pct}%`
        cumPercent += pct
        if (i < eventTypeEntries.length - 1) donutGradient += ', '
    })
    if (eventTypeEntries.length === 0) donutGradient += '#333 0% 100%'
    donutGradient += ')'

    return (
        <main className={styles.adminPage}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.logo}><img src="/logo.png" alt="PartyPal" style={{ height: 30, borderRadius: 6, marginRight: '0.4rem' }} />Party<span>Pal</span></div>
                    <span className={styles.adminBadge}>Admin</span>
                </div>
                <div className={styles.headerRight}>
                    <select
                        className={styles.periodSelect}
                        value={days}
                        onChange={e => setDays(parseInt(e.target.value))}
                    >
                        <option value={7}>Last 7 Days</option>
                        <option value={14}>Last 14 Days</option>
                        <option value={30}>Last 30 Days</option>
                        <option value={90}>Last 90 Days</option>
                    </select>
                    <button className={styles.refreshBtn} onClick={fetchData} disabled={loading}>
                        {loading ? '⏳' : '🔄'} Refresh
                    </button>
                    <a href="/" className={styles.backLink}>← Back to App</a>
                </div>
            </header>

            <div className={styles.content}>
                {loading && !data ? (
                    <div className={styles.loading}>
                        <div className="spinner" style={{ width: 40, height: 40 }} />
                        <div className={styles.loadingText}>Loading executive dashboard...</div>
                    </div>
                ) : error ? (
                    <div className={styles.loading}>
                        <div style={{ fontSize: '2rem' }}>⚠️</div>
                        <div className={styles.loadingText}>{error}</div>
                        <button className={styles.refreshBtn} onClick={fetchData}>Try Again</button>
                    </div>
                ) : data ? (
                    <>
                        {/* ══ EXEC SUMMARY KPIs ══ */}
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionEmoji}>📊</span>
                            <span className={styles.sectionTitle}>Executive Summary</span>
                            <span className={styles.sectionSub}>{data.period}</span>
                        </div>
                        <div className={styles.kpiGrid}>
                            <KPICard label="Page Views" value={formatNumber(k!.totalPageViews)} icon="👁️" />
                            <KPICard label="Sessions" value={formatNumber(k!.totalSessions)} icon="🔗" />
                            <KPICard label="Registered Users" value={formatNumber(k!.totalRegisteredUsers)} icon="👤" />
                            <KPICard label="Sign Ups" value={formatNumber(k!.totalSignUps)} icon="🚀" />
                            <KPICard label="Plans Generated" value={formatNumber(k!.totalPlansGenerated)} icon="🤖" />
                            <KPICard label="Vendor Searches" value={formatNumber(k!.totalVendorSearches)} icon="🔍" />
                            <KPICard label="RSVPs" value={formatNumber(k!.totalRSVPs)} icon="✅" />
                            <KPICard label="Errors" value={formatNumber(k!.totalErrors)} icon="🐛" color={k!.totalErrors > 0 ? '#E8896A' : undefined} />
                            {usageData && (
                                <>
                                    <KPICard label="Gemini AI Calls" value={formatNumber(usageData.apiMetrics?.totals?.gemini || 0)} icon="🧠" color="#7B5EA7" subtitle={`Est. ${usageData.apiMetrics?.estMonthlyCost || '$0'}/mo`} />
                                    <KPICard label="Places API Calls" value={formatNumber(usageData.apiMetrics?.totals?.maps || 0)} icon="🗺️" color="#4AADA8" subtitle={`Today: ${usageData.apiMetrics?.todayCost || '$0'}`} />
                                </>
                            )}
                        </div>

                        {/* ══ API USAGE TREND ══ */}
                        {usageData?.apiMetrics?.days && usageData.apiMetrics.days.length > 0 && (() => {
                            const apiDays = usageData.apiMetrics.days as { date: string; services: Record<string, number>; totalCalls: number }[]
                            const maxApiCalls = Math.max(...apiDays.map((d: { totalCalls: number }) => d.totalCalls), 1)
                            return (
                                <>
                                    <div className={styles.sectionHeader}>
                                        <span className={styles.sectionEmoji}>⚡</span>
                                        <span className={styles.sectionTitle}>API Usage Trend</span>
                                        <span className={styles.sectionSub}>Last 7 days</span>
                                    </div>
                                    <div className={styles.chartCard}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                            <div className={styles.chartTitle}>Daily API Calls (Gemini AI vs Google Places)</div>
                                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', fontWeight: 700 }}>
                                                <span style={{ color: '#7B5EA7' }}>● Gemini AI</span>
                                                <span style={{ color: '#4AADA8' }}>● Places API</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'end', gap: '6px', height: 160, padding: '0 0.5rem' }}>
                                            {apiDays.map((d: { date: string; services: Record<string, number>; totalCalls: number }, i: number) => {
                                                const gemini = d.services?.gemini || 0
                                                const maps = d.services?.maps || 0
                                                const total = gemini + maps
                                                const heightPct = total > 0 ? Math.max(8, (total / maxApiCalls) * 100) : 4
                                                const geminiPct = total > 0 ? (gemini / total) * 100 : 50
                                                return (
                                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--navy)' }}>{total}</span>
                                                        <div style={{
                                                            width: '100%', height: `${heightPct}%`, borderRadius: 6, overflow: 'hidden',
                                                            display: 'flex', flexDirection: 'column', minHeight: 4,
                                                        }}>
                                                            <div style={{ height: `${geminiPct}%`, background: '#7B5EA7', minHeight: gemini > 0 ? 3 : 0 }} />
                                                            <div style={{ height: `${100 - geminiPct}%`, background: '#4AADA8', minHeight: maps > 0 ? 3 : 0 }} />
                                                        </div>
                                                        <span style={{ fontSize: '0.6rem', color: '#9aabbb', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                            {new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        {/* Cost summary row */}
                                        <div style={{
                                            display: 'flex', justifyContent: 'space-around', marginTop: '1rem',
                                            padding: '0.6rem 0', borderTop: '1px solid var(--border)',
                                        }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' }}>Today&apos;s Cost</div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy)', fontFamily: "'Fredoka One', cursive" }}>{usageData.apiMetrics.todayCost}</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' }}>7-Day Total</div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy)', fontFamily: "'Fredoka One', cursive" }}>{usageData.apiMetrics.weekCost}</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' }}>Est. Monthly</div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: usageData.apiMetrics.estMonthlyCost > '$10' ? '#E8896A' : '#3D8C6E', fontFamily: "'Fredoka One', cursive" }}>{usageData.apiMetrics.estMonthlyCost}</div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )
                        })()}

                        {/* ══ USERS DRILL-DOWN ══ */}
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionEmoji}>👥</span>
                            <span className={styles.sectionTitle}>Registered Users</span>
                            <button
                                onClick={() => setShowUsersSection(!showUsersSection)}
                                style={{
                                    marginLeft: 'auto', padding: '0.4rem 1rem', borderRadius: 8,
                                    border: '1.5px solid var(--border)', background: showUsersSection ? 'rgba(74,173,168,0.1)' : 'white',
                                    color: showUsersSection ? 'var(--teal)' : 'var(--navy)',
                                    fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                                    fontFamily: "'Nunito', sans-serif",
                                }}
                            >
                                {showUsersSection ? '▲ Collapse' : '▼ Show Users'}
                            </button>
                        </div>

                        {showUsersSection && (
                            <div className={styles.chartCard}>
                                {usersLoading ? (
                                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                                        <div className="spinner" style={{ width: 30, height: 30, margin: '0 auto' }} />
                                        <div style={{ color: '#9aabbb', fontSize: '0.82rem', fontWeight: 600, marginTop: '0.8rem' }}>Loading user data...</div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Search & Sort Controls */}
                                        <div style={{ display: 'flex', gap: '0.6rem', padding: '0.8rem 1rem', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                                            <input
                                                type="text"
                                                placeholder="🔍 Search by name or email..."
                                                value={userSearch}
                                                onChange={e => setUserSearch(e.target.value)}
                                                style={{
                                                    flex: 1, minWidth: 200, padding: '0.5rem 0.8rem', borderRadius: 8,
                                                    border: '1.5px solid var(--border)', fontSize: '0.82rem',
                                                    fontFamily: "'Nunito', sans-serif", fontWeight: 600,
                                                    outline: 'none', background: 'var(--light-bg)',
                                                }}
                                            />
                                            <select
                                                value={userSort}
                                                onChange={e => setUserSort(e.target.value as typeof userSort)}
                                                style={{
                                                    padding: '0.5rem 0.8rem', borderRadius: 8,
                                                    border: '1.5px solid var(--border)', fontSize: '0.78rem',
                                                    fontFamily: "'Nunito', sans-serif", fontWeight: 700,
                                                    background: 'white', cursor: 'pointer',
                                                }}
                                            >
                                                <option value="lastActive">Sort: Last Active</option>
                                                <option value="sessions">Sort: Most Sessions</option>
                                                <option value="pageViews">Sort: Most Page Views</option>
                                                <option value="name">Sort: Name A-Z</option>
                                                <option value="created">Sort: Newest First</option>
                                            </select>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9aabbb' }}>
                                                {userList.length} user{userList.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        {/* User Table */}
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontFamily: "'Nunito', sans-serif" }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid var(--border)', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 800, color: '#9aabbb', letterSpacing: '0.5px' }}>
                                                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>User</th>
                                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Location</th>
                                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Sessions</th>
                                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Pages</th>
                                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Avg Time</th>
                                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Events</th>
                                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Days Active</th>
                                                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Last Active</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {userList
                                                        .filter(u => {
                                                            if (!userSearch) return true
                                                            const q = userSearch.toLowerCase()
                                                            return (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
                                                        })
                                                        .sort((a, b) => {
                                                            switch (userSort) {
                                                                case 'sessions': return b.totalSessions - a.totalSessions
                                                                case 'pageViews': return b.totalPageViews - a.totalPageViews
                                                                case 'name': return (a.displayName || '').localeCompare(b.displayName || '')
                                                                case 'created': return (b.createdAt || '').localeCompare(a.createdAt || '')
                                                                default: return (b.lastActive || '').localeCompare(a.lastActive || '')
                                                            }
                                                        })
                                                        .map(u => (
                                                            <tr
                                                                key={u.uid}
                                                                onClick={() => setExpandedUser(expandedUser === u.uid ? null : u.uid)}
                                                                style={{
                                                                    borderBottom: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer',
                                                                    background: expandedUser === u.uid ? 'rgba(74,173,168,0.04)' : 'transparent',
                                                                    transition: 'background 0.15s',
                                                                }}
                                                                onMouseEnter={e => { if (expandedUser !== u.uid) e.currentTarget.style.background = 'rgba(0,0,0,0.015)' }}
                                                                onMouseLeave={e => { if (expandedUser !== u.uid) e.currentTarget.style.background = 'transparent' }}
                                                            >
                                                                <td style={{ padding: '0.7rem 0.8rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                                        <div style={{
                                                                            width: 32, height: 32, borderRadius: '50%',
                                                                            background: u.role === 'admin' ? 'linear-gradient(135deg, #F7C948, #E8896A)' : 'linear-gradient(135deg, #4AADA8, #3D8C6E)',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            color: 'white', fontSize: '0.72rem', fontWeight: 800,
                                                                        }}>
                                                                            {(u.displayName || u.email || '?')[0].toUpperCase()}
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.82rem' }}>
                                                                                {u.displayName || 'No Name'}
                                                                                {u.role === 'admin' && <span style={{ marginLeft: '0.4rem', fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: 4, background: 'rgba(247,201,72,0.15)', color: '#C4A020' }}>ADMIN</span>}
                                                                                {u.testAccount && <span style={{ marginLeft: '0.3rem', fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: 4, background: 'rgba(155,171,187,0.15)', color: '#9aabbb' }}>TEST</span>}
                                                                            </div>
                                                                            <div style={{ fontSize: '0.7rem', color: '#9aabbb', fontWeight: 600 }}>{u.email}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '0.7rem 0.5rem', color: '#6b7f94', fontWeight: 600 }}>
                                                                    {u.location ? `📍 ${u.location}` : <span style={{ color: '#ccc' }}>—</span>}
                                                                </td>
                                                                <td style={{ padding: '0.7rem 0.5rem', textAlign: 'center', fontWeight: 700, color: 'var(--navy)' }}>{u.totalSessions}</td>
                                                                <td style={{ padding: '0.7rem 0.5rem', textAlign: 'center', fontWeight: 700, color: 'var(--navy)' }}>{u.totalPageViews}</td>
                                                                <td style={{ padding: '0.7rem 0.5rem', textAlign: 'center', fontWeight: 700, color: u.avgTimePerSession > 60 ? '#3D8C6E' : 'var(--navy)' }}>
                                                                    {u.avgTimePerSession > 0 ? `${Math.floor(u.avgTimePerSession / 60)}m ${u.avgTimePerSession % 60}s` : '—'}
                                                                </td>
                                                                <td style={{ padding: '0.7rem 0.5rem', textAlign: 'center', fontWeight: 700, color: 'var(--navy)' }}>{u.eventsCreated}</td>
                                                                <td style={{ padding: '0.7rem 0.5rem', textAlign: 'center', fontWeight: 700, color: u.activeDays > 3 ? '#3D8C6E' : 'var(--navy)' }}>{u.activeDays}</td>
                                                                <td style={{ padding: '0.7rem 0.8rem', textAlign: 'right', fontSize: '0.72rem', color: '#9aabbb', fontWeight: 600 }}>
                                                                    {u.lastActive ? timeAgo(u.lastActive) : '—'}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    }
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Expanded User Detail */}
                                        {expandedUser && userList.find(u => u.uid === expandedUser) && (() => {
                                            const u = userList.find(u => u.uid === expandedUser)!
                                            return (
                                                <div style={{
                                                    padding: '1.2rem', borderTop: '2px solid var(--teal)',
                                                    background: 'rgba(74,173,168,0.02)',
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                        <h4 style={{ fontFamily: "'Fredoka One', cursive", fontSize: '1rem', color: 'var(--navy)', margin: 0 }}>
                                                            {u.displayName || u.email} — Details
                                                        </h4>
                                                        <button onClick={() => setExpandedUser(null)} style={{
                                                            background: 'transparent', border: 'none', color: '#9aabbb', cursor: 'pointer',
                                                            fontSize: '0.82rem', fontWeight: 700,
                                                        }}>✕ Close</button>
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.2rem' }}>
                                                        <div style={{ background: 'white', borderRadius: 10, padding: '0.8rem', border: '1px solid var(--border)' }}>
                                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Sign-Up Method</div>
                                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--navy)' }}>{u.signUpMethod || 'unknown'}</div>
                                                        </div>
                                                        <div style={{ background: 'white', borderRadius: 10, padding: '0.8rem', border: '1px solid var(--border)' }}>
                                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Total Time on Site</div>
                                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--navy)' }}>
                                                                {u.totalTimeOnSite > 3600 ? `${Math.floor(u.totalTimeOnSite / 3600)}h ${Math.floor((u.totalTimeOnSite % 3600) / 60)}m`
                                                                    : u.totalTimeOnSite > 60 ? `${Math.floor(u.totalTimeOnSite / 60)}m ${u.totalTimeOnSite % 60}s`
                                                                        : u.totalTimeOnSite > 0 ? `${u.totalTimeOnSite}s` : '—'}
                                                            </div>
                                                        </div>
                                                        <div style={{ background: 'white', borderRadius: 10, padding: '0.8rem', border: '1px solid var(--border)' }}>
                                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Joined</div>
                                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--navy)' }}>
                                                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Top Pages */}
                                                    {u.topPages && u.topPages.length > 0 && (
                                                        <div style={{ marginBottom: '1.2rem' }}>
                                                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Top Pages Visited</div>
                                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                                {u.topPages.map((p: { page: string; views: number }, i: number) => (
                                                                    <span key={i} style={{
                                                                        padding: '0.25rem 0.6rem', borderRadius: 6,
                                                                        background: 'rgba(74,173,168,0.08)', color: 'var(--teal)',
                                                                        fontSize: '0.72rem', fontWeight: 700,
                                                                    }}>
                                                                        {p.page.replace(/^_/, '/').replace('root', '/')} ({p.views})
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Daily Activity Heatmap */}
                                                    {u.dailyActivity && Object.keys(u.dailyActivity).length > 0 && (
                                                        <div style={{ marginBottom: '1.2rem' }}>
                                                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Daily Activity (Last 30 Days)</div>
                                                            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                                                {Array.from({ length: 30 }, (_, i) => {
                                                                    const d = new Date()
                                                                    d.setDate(d.getDate() - (29 - i))
                                                                    const key = d.toISOString().split('T')[0]
                                                                    const count = u.dailyActivity[key] || 0
                                                                    const intensity = count === 0 ? 0 : count < 5 ? 0.2 : count < 15 ? 0.4 : count < 30 ? 0.6 : 0.9
                                                                    return (
                                                                        <div key={i} title={`${key}: ${count} events`} style={{
                                                                            width: 16, height: 16, borderRadius: 3,
                                                                            background: count === 0 ? 'rgba(0,0,0,0.04)' : `rgba(74,173,168,${intensity})`,
                                                                            cursor: 'default',
                                                                        }} />
                                                                    )
                                                                })}
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#ccc', fontWeight: 600, marginTop: '0.2rem' }}>
                                                                <span>30 days ago</span>
                                                                <span>Today</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Recent Activity Feed */}
                                                    {u.recentEvents && u.recentEvents.length > 0 && (
                                                        <div>
                                                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Recent Activity</div>
                                                            <div style={{ maxHeight: 200, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                                                                {u.recentEvents.slice(0, 10).map((evt: { event: string; page: string; timestamp: string }, i: number) => (
                                                                    <div key={i} style={{
                                                                        display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.8rem',
                                                                        borderBottom: i < 9 ? '1px solid rgba(0,0,0,0.03)' : 'none',
                                                                        fontSize: '0.72rem', fontWeight: 600,
                                                                    }}>
                                                                        <span style={{ color: EVENT_COLORS[evt.event] || '#9aabbb' }}>
                                                                            {EVENT_LABELS[evt.event] || evt.event}
                                                                        </span>
                                                                        <span style={{ color: '#bbb' }}>{evt.page}</span>
                                                                        <span style={{ color: '#ccc', fontSize: '0.65rem' }}>{timeAgo(evt.timestamp)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })()}
                                    </>
                                )}
                            </div>
                        )}

                        {/* ══ TRAFFIC ══ */}
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionEmoji}>📈</span>
                            <span className={styles.sectionTitle}>Traffic & Growth</span>
                        </div>
                        <div className={styles.chartCard}>
                            <div className={styles.chartTitle}>Daily Page Views</div>
                            <div className={styles.barChart}>
                                {data.pageViewsByDay.map((d, i) => (
                                    <div
                                        key={i}
                                        className={styles.bar}
                                        style={{ height: `${Math.max(4, (d.views / maxPageView) * 100)}%` }}
                                    >
                                        <span className={styles.barTooltip}>{d.views} views</span>
                                        {i % Math.ceil(data.pageViewsByDay.length / 8) === 0 && (
                                            <span className={styles.barLabel}>
                                                {new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ══ CONVERSION FUNNEL ══ */}
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionEmoji}>🔄</span>
                            <span className={styles.sectionTitle}>Conversion Funnel</span>
                        </div>
                        <div className={styles.twoCol}>
                            <div className={styles.funnelCard}>
                                <div className={styles.chartTitle}>User Journey</div>
                                <FunnelStep label="Page Views" value={k!.totalPageViews} max={k!.totalPageViews} color="#4AADA8" />
                                <FunnelStep label="Sign Ups" value={k!.totalSignUps} max={k!.totalPageViews} color="#3D8C6E" rate={data.conversionRates.visitorToSignUp + '%'} />
                                <FunnelStep label="Plans Made" value={k!.totalPlansGenerated} max={k!.totalPageViews} color="#F7C948" rate={data.conversionRates.signUpToPlan + '%'} />
                                <FunnelStep label="Vendor Search" value={k!.totalVendorSearches} max={k!.totalPageViews} color="#E8896A" rate={data.conversionRates.planToVendor + '%'} />
                                <FunnelStep label="RSVPs" value={k!.totalRSVPs} max={k!.totalPageViews} color="#7B5EA7" />
                            </div>
                            <div className={styles.funnelCard}>
                                <div className={styles.chartTitle}>Conversion Rates</div>
                                <div style={{ padding: '0.5rem 0' }}>
                                    <RateCard label="Visitor → Sign Up" rate={data.conversionRates.visitorToSignUp} target="5.0" />
                                    <RateCard label="Sign Up → Plan" rate={data.conversionRates.signUpToPlan} target="60.0" />
                                    <RateCard label="Plan → Vendor Search" rate={data.conversionRates.planToVendor} target="40.0" />
                                </div>
                            </div>
                        </div>

                        {/* ══ PAGE POPULARITY ══ */}
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionEmoji}>🗺️</span>
                            <span className={styles.sectionTitle}>Usage Patterns</span>
                        </div>
                        <div className={styles.twoCol}>
                            <div className={styles.chartCard}>
                                <div className={styles.chartTitle}>Top Pages</div>
                                {sortedPages.map((p, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.4rem 0' }}>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'white', minWidth: 80 }}>{p.page}</span>
                                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ width: `${(p.views / totalPagePopViews) * 100}%`, height: '100%', background: DONUT_COLORS[i % DONUT_COLORS.length], borderRadius: 3 }} />
                                        </div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', minWidth: 40, textAlign: 'right' }}>{p.views}</span>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.chartCard}>
                                <div className={styles.chartTitle}>Daily Sign-Ups</div>
                                <div className={styles.barChart}>
                                    {data.signUpsByDay.map((d, i) => {
                                        const maxSU = Math.max(...data.signUpsByDay.map(x => x.count), 1)
                                        return (
                                            <div
                                                key={i}
                                                className={styles.bar}
                                                style={{
                                                    height: `${Math.max(4, (d.count / maxSU) * 100)}%`,
                                                    background: 'linear-gradient(180deg, #3D8C6E, rgba(61,140,110,0.3))',
                                                }}
                                            >
                                                <span className={styles.barTooltip}>{d.count} sign-ups</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* ══ EVENT INSIGHTS ══ */}
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionEmoji}>🎉</span>
                            <span className={styles.sectionTitle}>Event Insights</span>
                            <span className={styles.sectionSub}>{data.eventInsights.totalEventsCreated} events created</span>
                        </div>
                        <div className={styles.twoCol}>
                            <div className={styles.chartCard}>
                                <div className={styles.chartTitle}>Event Type Distribution</div>
                                {eventTypeEntries.length > 0 ? (
                                    <div className={styles.donutWrap}>
                                        <div className={styles.donutChart} style={{ background: donutGradient }}>
                                            <div className={styles.donutCenter}>{data.eventInsights.totalEventsCreated}</div>
                                        </div>
                                        <div className={styles.donutLegend}>
                                            {eventTypeEntries.map(([type, count], i) => (
                                                <div key={type} className={styles.legendItem}>
                                                    <div className={styles.legendDot} style={{ background: DONUT_COLORS[i] }} />
                                                    {type} ({count})
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', padding: '2rem', textAlign: 'center' }}>No events yet</div>
                                )}
                            </div>
                            <div className={styles.chartCard}>
                                <div className={styles.chartTitle}>Event Metrics</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '0.5rem' }}>
                                    <MetricBox label="Total Events" value={data.eventInsights.totalEventsCreated} emoji="📅" />
                                    <MetricBox label="Avg Guests" value={data.eventInsights.avgGuests} emoji="👥" />
                                    <MetricBox label="Unique Locations" value={Object.keys(data.eventInsights.locations).length} emoji="📍" />
                                    <MetricBox label="Unique Themes" value={Object.keys(data.eventInsights.themes).length} emoji="🎨" />
                                </div>
                                {Object.keys(data.eventInsights.themes).length > 0 && (
                                    <div style={{ marginTop: '0.8rem' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.5rem' }}>
                                            Popular Themes
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {Object.entries(data.eventInsights.themes).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([theme, count]) => (
                                                <span key={theme} className={styles.statPill}>🎨 {theme} ({count})</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ══ ERRORS & BUGS ══ */}
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionEmoji}>🐛</span>
                            <span className={styles.sectionTitle}>Errors & Bugs</span>
                            <span className={styles.sectionSub} style={{ color: k!.totalErrors > 0 ? '#E8896A' : undefined }}>
                                {k!.totalErrors} errors in period
                            </span>
                        </div>
                        {data.recentErrors.length > 0 ? (
                            <div className={styles.errorCard}>
                                {data.recentErrors.slice(0, 10).map((err, i) => (
                                    <div key={i} className={styles.errorItem}>
                                        <div className={styles.errorMsg}>{err.message}</div>
                                        <div className={styles.errorMeta}>
                                            📄 {err.page} · {err.source} · {timeAgo(err.timestamp)}
                                            {err.userId && ` · 👤 ${err.userId.slice(0, 8)}...`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.chartCard} style={{ textAlign: 'center', padding: '2rem' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                                <div style={{ color: '#3D8C6E', fontWeight: 800 }}>No errors detected! 🎉</div>
                                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginTop: '0.3rem' }}>Everything is running smoothly</div>
                            </div>
                        )}

                        {/* ══ USER BUG REPORTS ══ */}
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionEmoji}>📋</span>
                            <span className={styles.sectionTitle}>User Bug Reports</span>
                            <span className={styles.sectionSub} style={{ color: bugReports.filter(b => b.status === 'new').length > 0 ? '#E8896A' : undefined }}>
                                {bugReports.filter(b => b.status === 'new').length} new · {bugReports.length} total
                            </span>
                            <button
                                onClick={() => setShowBugReports(!showBugReports)}
                                style={{
                                    marginLeft: 'auto', padding: '0.4rem 1rem', borderRadius: 8,
                                    border: '1.5px solid var(--border)', background: showBugReports ? 'rgba(232,137,106,0.1)' : 'white',
                                    color: showBugReports ? '#E8896A' : 'var(--navy)',
                                    fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                                    fontFamily: "'Nunito', sans-serif",
                                }}
                            >
                                {showBugReports ? '▲ Collapse' : '▼ Show Reports'}
                            </button>
                        </div>
                        {showBugReports && (
                            <div className={styles.chartCard}>
                                {bugReports.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                                        <div style={{ color: '#3D8C6E', fontWeight: 800 }}>No bug reports!</div>
                                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginTop: '0.3rem' }}>Users haven&apos;t reported any issues</div>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontFamily: "'Nunito', sans-serif" }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid var(--border)', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 800, color: '#9aabbb', letterSpacing: '0.5px' }}>
                                                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Status</th>
                                                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Category</th>
                                                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Description</th>
                                                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Page</th>
                                                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Reporter</th>
                                                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>When</th>
                                                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bugReports.map(bug => (
                                                    <tr key={bug.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                                        <td style={{ padding: '0.7rem 0.8rem' }}>
                                                            <span style={{
                                                                padding: '0.2rem 0.5rem', borderRadius: 50, fontSize: '0.68rem', fontWeight: 800,
                                                                background: bug.status === 'new' ? 'rgba(232,137,106,0.15)' : bug.status === 'reviewed' ? 'rgba(247,201,72,0.15)' : 'rgba(61,140,110,0.15)',
                                                                color: bug.status === 'new' ? '#E8896A' : bug.status === 'reviewed' ? '#C4A020' : '#3D8C6E',
                                                            }}>
                                                                {bug.status === 'new' ? '🔴 New' : bug.status === 'reviewed' ? '🟡 Reviewed' : '🟢 Fixed'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.7rem 0.5rem', fontWeight: 700, color: 'var(--navy)' }}>
                                                            {bug.category === 'bug' ? '🐛' : bug.category === 'feature' ? '⚙️' : bug.category === 'experience' ? '✨' : bug.category === 'tab' ? '🗂️' : bug.category === 'suggestion' ? '💡' : '📝'} {bug.category}
                                                        </td>
                                                        <td style={{ padding: '0.7rem 0.5rem', color: 'var(--navy)', fontWeight: 600, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {bug.description}
                                                        </td>
                                                        <td style={{ padding: '0.7rem 0.5rem', color: '#6b7f94', fontWeight: 600, fontSize: '0.75rem' }}>{bug.page}</td>
                                                        <td style={{ padding: '0.7rem 0.5rem', color: '#6b7f94', fontWeight: 600, fontSize: '0.75rem' }}>
                                                            {bug.name || bug.email || 'Anonymous'}
                                                        </td>
                                                        <td style={{ padding: '0.7rem 0.5rem', textAlign: 'right', fontSize: '0.72rem', color: '#9aabbb', fontWeight: 600 }}>
                                                            {timeAgo(bug.createdAt)}
                                                        </td>
                                                        <td style={{ padding: '0.7rem 0.8rem', textAlign: 'center' }}>
                                                            {bug.status === 'new' && (
                                                                <button onClick={() => markBugStatus(bug.id, 'reviewed')} style={{
                                                                    background: 'rgba(247,201,72,0.12)', border: '1px solid rgba(247,201,72,0.3)',
                                                                    color: '#C4A020', padding: '0.25rem 0.6rem', borderRadius: 6,
                                                                    fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', fontFamily: "'Nunito', sans-serif",
                                                                }}>Mark Reviewed</button>
                                                            )}
                                                            {bug.status === 'reviewed' && (
                                                                <button onClick={() => markBugStatus(bug.id, 'fixed')} style={{
                                                                    background: 'rgba(61,140,110,0.12)', border: '1px solid rgba(61,140,110,0.3)',
                                                                    color: '#3D8C6E', padding: '0.25rem 0.6rem', borderRadius: 6,
                                                                    fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', fontFamily: "'Nunito', sans-serif",
                                                                }}>Mark Fixed</button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ══ HEALTH & ALERTS ══ */}
                        {(() => {
                            const c = data.churn
                            const alerts: { emoji: string; title: string; description: string; color: string; severity: 'warning' | 'caution' | 'info' }[] = []

                            // Churn spike: any deletions is notable at early stage
                            if (c.deletedInPeriod > 0) {
                                alerts.push({
                                    emoji: '👋', title: `${c.deletedInPeriod} user${c.deletedInPeriod > 1 ? 's' : ''} churned`,
                                    description: `${c.churnRate}% churn rate in the last ${data.period}. Avg tenure: ${c.avgTenureDays} days.`,
                                    color: c.churnRate > 5 ? '#E8896A' : '#F7C948', severity: c.churnRate > 5 ? 'caution' : 'warning',
                                })
                            }
                            // Error rate
                            const errorRate = k!.totalEvents > 0 ? (k!.totalErrors / k!.totalEvents) * 100 : 0
                            if (errorRate > 1) {
                                alerts.push({
                                    emoji: '🐛', title: `Error rate at ${errorRate.toFixed(1)}%`,
                                    description: `${k!.totalErrors} errors across ${k!.totalEvents} events. Check the Errors section below.`,
                                    color: '#E8896A', severity: 'caution',
                                })
                            }
                            // API cost alert
                            if (usageData?.apiMetrics?.estMonthlyCost) {
                                const cost = parseFloat(usageData.apiMetrics.estMonthlyCost.replace('$', ''))
                                if (cost > 10) {
                                    alerts.push({
                                        emoji: '💰', title: `Monthly API cost est. ${usageData.apiMetrics.estMonthlyCost}`,
                                        description: 'Consider enabling caching or reducing per-user API limits.',
                                        color: cost > 25 ? '#E8896A' : '#F7C948', severity: cost > 25 ? 'caution' : 'warning',
                                    })
                                }
                            }
                            // Low engagement
                            if (k!.totalSessions > 0 && k!.totalRegisteredUsers > 3 && (k!.totalSessions / k!.totalRegisteredUsers) < 2) {
                                alerts.push({
                                    emoji: '📉', title: 'Low session engagement',
                                    description: `Only ${(k!.totalSessions / k!.totalRegisteredUsers).toFixed(1)} sessions per registered user. Consider re-engagement campaigns.`,
                                    color: '#F7C948', severity: 'warning',
                                })
                            }
                            // Positive signal
                            if (alerts.length === 0) {
                                alerts.push({
                                    emoji: '✅', title: 'All systems healthy',
                                    description: 'No churn, errors within limits, API costs normal, engagement solid.',
                                    color: '#3D8C6E', severity: 'info',
                                })
                            }

                            return (
                                <>
                                    <div className={styles.sectionHeader}>
                                        <span className={styles.sectionEmoji}>🚨</span>
                                        <span className={styles.sectionTitle}>Health & Alerts</span>
                                        <span className={styles.sectionSub}>{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.8rem' }}>
                                        {alerts.map((alert, i) => (
                                            <div key={i} style={{
                                                padding: '1rem 1.2rem', borderRadius: 14,
                                                background: `linear-gradient(135deg, ${alert.color}12, ${alert.color}06)`,
                                                border: `1.5px solid ${alert.color}30`,
                                                boxShadow: `0 0 20px ${alert.color}08`,
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                                    <span style={{ fontSize: '1.2rem' }}>{alert.emoji}</span>
                                                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--navy)' }}>{alert.title}</span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7f94', lineHeight: 1.4 }}>
                                                    {alert.description}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )
                        })()}

                        {/* ══ GROWTH ACCOUNTING ══ */}
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionEmoji}>🌱</span>
                            <span className={styles.sectionTitle}>Growth Accounting</span>
                        </div>
                        <div className={styles.kpiGrid}>
                            <KPICard
                                label="Net Growth"
                                value={data.churn.netGrowth >= 0 ? `+${data.churn.netGrowth}` : `${data.churn.netGrowth}`}
                                icon="📈"
                                color={data.churn.netGrowth >= 0 ? '#3D8C6E' : '#E8896A'}
                                subtitle={`${k!.totalSignUps} signups − ${data.churn.deletedInPeriod} deletions`}
                            />
                            <KPICard
                                label="Retention Rate"
                                value={`${data.churn.retentionRate}%`}
                                icon="💪"
                                color={data.churn.retentionRate >= 95 ? '#3D8C6E' : data.churn.retentionRate >= 85 ? '#F7C948' : '#E8896A'}
                            />
                            <KPICard
                                label="Events / Session"
                                value={k!.totalSessions > 0 ? (k!.totalEvents / k!.totalSessions).toFixed(1) : '0'}
                                icon="⚡"
                            />
                            <KPICard
                                label="Plans / User"
                                value={k!.totalRegisteredUsers > 0 ? (k!.totalPlansGenerated / k!.totalRegisteredUsers).toFixed(1) : '0'}
                                icon="📋"
                            />
                            <KPICard
                                label="Error Rate"
                                value={k!.totalEvents > 0 ? ((k!.totalErrors / k!.totalEvents) * 100).toFixed(2) + '%' : '0%'}
                                icon="🛡️"
                                color={k!.totalErrors > 0 ? '#E8896A' : '#3D8C6E'}
                            />
                            <KPICard
                                label="Activation Rate"
                                value={data.conversionRates.signUpToPlan + '%'}
                                icon="🎯"
                                subtitle="Sign Up → Plan"
                            />
                        </div>

                        {/* ══ USER LIFECYCLE & CHURN ══ */}
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionEmoji}>👋</span>
                            <span className={styles.sectionTitle}>User Lifecycle & Churn</span>
                            <span className={styles.sectionSub}>{data.churn.totalDeleted} total deleted</span>
                        </div>
                        <div className={styles.kpiGrid}>
                            <KPICard label="Deleted (Period)" value={data.churn.deletedInPeriod} icon="🚪" color="#E8896A" />
                            <KPICard label="Churn Rate" value={`${data.churn.churnRate}%`} icon="📉" color={data.churn.churnRate > 5 ? '#E8896A' : data.churn.churnRate > 0 ? '#F7C948' : '#3D8C6E'} />
                            <KPICard label="Avg Tenure" value={`${data.churn.avgTenureDays}d`} icon="📅" subtitle="before deletion" />
                            <KPICard label="Avg Events" value={data.churn.avgEventsCreated} icon="🎉" subtitle="before deletion" />
                        </div>

                        {data.churn.totalDeleted > 0 && (
                            <>
                                {/* Deletion reason breakdown + timeline */}
                                <div className={styles.twoCol}>
                                    {/* Reason Breakdown */}
                                    <div className={styles.chartCard}>
                                        <div className={styles.chartTitle}>Deletion Reasons</div>
                                        <div style={{ padding: '0.3rem 0' }}>
                                            {(() => {
                                                const REASON_LABELS: Record<string, { label: string; emoji: string }> = {
                                                    'not_specified': { label: 'Not specified', emoji: '❓' },
                                                    'not_useful': { label: 'Not useful for me', emoji: '🤷' },
                                                    'privacy': { label: 'Privacy concerns', emoji: '🔒' },
                                                    'another_tool': { label: 'Using another tool', emoji: '🔄' },
                                                    'too_complicated': { label: 'Too complicated', emoji: '😵' },
                                                    'just_testing': { label: 'Just testing', emoji: '🧪' },
                                                    'other': { label: 'Other', emoji: '💬' },
                                                }
                                                const entries = Object.entries(data.churn.reasons).sort((a, b) => b[1] - a[1])
                                                const maxCount = Math.max(...entries.map(([, c]) => c), 1)
                                                return entries.map(([reason, count], i) => {
                                                    const meta = REASON_LABELS[reason] || { label: reason, emoji: '📊' }
                                                    return (
                                                        <div key={reason} style={{ marginBottom: '0.6rem' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'white', marginBottom: '0.2rem' }}>
                                                                <span>{meta.emoji} {meta.label}</span>
                                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{count}</span>
                                                            </div>
                                                            <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }}>
                                                                <div style={{
                                                                    height: '100%', borderRadius: 4,
                                                                    width: `${(count / maxCount) * 100}%`,
                                                                    background: DONUT_COLORS[i % DONUT_COLORS.length],
                                                                    transition: 'width 0.6s ease',
                                                                }} />
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            })()}
                                        </div>
                                    </div>

                                    {/* Deletion Timeline */}
                                    <div className={styles.chartCard}>
                                        <div className={styles.chartTitle}>Deletion Timeline</div>
                                        {(() => {
                                            const days14: string[] = []
                                            for (let i = 13; i >= 0; i--) {
                                                const d = new Date()
                                                d.setDate(d.getDate() - i)
                                                days14.push(d.toISOString().split('T')[0])
                                            }
                                            const maxDay = Math.max(...days14.map(d => data.churn.deletionsByDay[d] || 0), 1)
                                            return (
                                                <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 100, padding: '0.5rem 0' }}>
                                                    {days14.map((day, j) => {
                                                        const count = data.churn.deletionsByDay[day] || 0
                                                        const h = maxDay > 0 ? Math.max(count > 0 ? 8 : 2, (count / maxDay) * 100) : 2
                                                        return (
                                                            <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                                {count > 0 && <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#E8896A' }}>{count}</span>}
                                                                <div style={{
                                                                    width: '100%', maxWidth: 24, borderRadius: 3,
                                                                    height: `${h}%`, minHeight: 2,
                                                                    background: count > 0 ? '#E8896A' : 'rgba(255,255,255,0.05)',
                                                                    transition: 'height 0.5s ease',
                                                                }} />
                                                                {j % 3 === 0 && (
                                                                    <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                                                                        {new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )
                                        })()}
                                    </div>
                                </div>

                                {/* Churned User Profiles */}
                                {data.churn.recentDeletions.length > 0 && (
                                    <div className={styles.feedCard} style={{ marginTop: '0.8rem' }}>
                                        <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                            <div style={{ fontWeight: 800, color: 'white', fontSize: '0.88rem' }}>🚪 Churned User Profiles</div>
                                            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', marginTop: 2 }}>Users who deleted their accounts</div>
                                        </div>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: "'Nunito', sans-serif" }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textTransform: 'uppercase', fontSize: '0.62rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.5px' }}>
                                                        <th style={{ padding: '0.5rem 0.8rem', textAlign: 'left' }}>User</th>
                                                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Tenure</th>
                                                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Events</th>
                                                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Sessions</th>
                                                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Reason</th>
                                                        <th style={{ padding: '0.5rem 0.8rem', textAlign: 'right' }}>Deleted</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {data.churn.recentDeletions.map((u, i) => (
                                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                            <td style={{ padding: '0.6rem 0.8rem' }}>
                                                                <div style={{ fontWeight: 700, color: 'white', fontSize: '0.8rem' }}>
                                                                    {u.displayName || 'Unknown'}
                                                                </div>
                                                                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{u.email}</div>
                                                            </td>
                                                            <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700, color: u.tenureDays < 7 ? '#E8896A' : 'rgba(255,255,255,0.7)' }}>
                                                                {u.tenureDays}d
                                                            </td>
                                                            <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
                                                                {u.eventsCreated}
                                                            </td>
                                                            <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
                                                                {u.totalSessions}
                                                            </td>
                                                            <td style={{ padding: '0.6rem 0.5rem' }}>
                                                                <span style={{
                                                                    padding: '0.15rem 0.5rem', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
                                                                    background: u.reason === 'not_specified' ? 'rgba(155,171,187,0.1)' : 'rgba(232,137,106,0.1)',
                                                                    color: u.reason === 'not_specified' ? 'rgba(255,255,255,0.4)' : '#E8896A',
                                                                }}>
                                                                    {u.reason === 'not_specified' ? 'No reason' : u.reason.replace(/_/g, ' ')}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                                                                {u.deletedAt ? timeAgo(u.deletedAt) : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ══ ACTIVITY FEED ══ */}
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionEmoji}>🔴</span>
                            <span className={styles.sectionTitle}>Live Activity Feed</span>
                            <span className={styles.sectionSub}>Last {data.recentActivity.length} events</span>
                        </div>
                        <div className={styles.feedCard}>
                            {data.recentActivity.length > 0 ? data.recentActivity.map((activity, i) => (
                                <div key={i} className={styles.feedItem}>
                                    <div
                                        className={styles.feedDot}
                                        style={{ background: EVENT_COLORS[activity.event] || '#555' }}
                                    />
                                    <div className={styles.feedContent}>
                                        <div className={styles.feedEvent}>
                                            {EVENT_LABELS[activity.event] || activity.event}
                                            {activity.page && <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 6 }}>on {activity.page}</span>}
                                        </div>
                                        <div className={styles.feedTime}>
                                            {timeAgo(activity.timestamp)}
                                            {activity.userId && ` · ${activity.userId.slice(0, 8)}...`}
                                            {activity.properties && Object.keys(activity.properties).length > 0 && (
                                                <span style={{ marginLeft: 6, color: 'rgba(255,255,255,0.2)' }}>
                                                    {Object.entries(activity.properties)
                                                        .filter(([k]) => !['error'].includes(k))
                                                        .slice(0, 2)
                                                        .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`)
                                                        .join(' · ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '2rem', fontSize: '0.85rem' }}>
                                    No activity recorded yet. Events will appear here as users interact with PartyPal.
                                </div>
                            )}
                        </div>

                        {/* ══ AI USAGE & RATE LIMITS ══ */}
                        {usageData && (
                            <>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionEmoji}>⚡</span>
                                    <span className={styles.sectionTitle}>AI Usage & Rate Limits</span>
                                    <span className={styles.sectionSub}>Gemini 2.5 Flash</span>
                                </div>

                                {/* Today’s usage KPIs */}
                                <div className={styles.kpiGrid}>
                                    <KPICard
                                        label="Today's AI Calls"
                                        value={usageData.today.totalCalls}
                                        icon="🤖"
                                        color={usageData.today.budgetUsedPercent > 80 ? '#E8896A' : '#4AADA8'}
                                        subtitle={`${usageData.today.budgetRemaining} remaining`}
                                    />
                                    <KPICard
                                        label="Current Tier"
                                        value={usageData.tier.label}
                                        icon="🎯"
                                        color="#F7C948"
                                        subtitle={`${usageData.tier.dailyLimitPerUser} calls/user/day`}
                                    />
                                    <KPICard
                                        label="Budget Used"
                                        value={`${usageData.today.budgetUsedPercent}%`}
                                        icon="📊"
                                        color={usageData.today.budgetUsedPercent > 60 ? '#E8896A' : '#3D8C6E'}
                                        subtitle={`of ${usageData.config.dailyRequestBudget} daily RPD`}
                                    />
                                    <KPICard
                                        label="Active Today"
                                        value={usageData.today.activeUsers}
                                        icon="👥"
                                        subtitle={`of ${usageData.registeredUsers} registered`}
                                    />
                                </div>

                                {/* 7-Day Usage Chart */}
                                <div className={styles.chartCard}>
                                    <div className={styles.chartHeader}>AI Calls — Last 7 Days</div>
                                    <div className={styles.barChart}>
                                        {usageData.last7Days.map((d: { date: string; calls: number }, i: number) => {
                                            const maxCalls = Math.max(...usageData.last7Days.map((x: { calls: number }) => x.calls), 1)
                                            return (
                                                <div key={i} className={styles.barCol}>
                                                    <div className={styles.barValue}>{d.calls}</div>
                                                    <div
                                                        className={styles.bar}
                                                        style={{
                                                            height: `${Math.max(4, (d.calls / maxCalls) * 100)}%`,
                                                            background: d.calls > usageData.config.dailyRequestBudget * 0.8
                                                                ? '#E8896A'
                                                                : 'linear-gradient(to top, #4AADA8, #3D8C6E)',
                                                        }}
                                                    />
                                                    <div className={styles.barLabel}>
                                                        {new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Tier Progression Table */}
                                <div className={styles.feedCard}>
                                    <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div style={{ fontWeight: 800, color: 'white', fontSize: '0.88rem' }}>🚦 Scaling Thresholds</div>
                                        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', marginTop: 2 }}>Per-user limits decrease as user base grows</div>
                                    </div>
                                    {usageData.config.thresholds.map((t: { maxUsers: number; dailyLimitPerUser: number; label: string; action: string }, i: number) => {
                                        const isActive = usageData.tier.label === t.label
                                        const isPast = usageData.registeredUsers > t.maxUsers
                                        return (
                                            <div key={i} className={styles.feedItem} style={{
                                                opacity: isPast ? 0.4 : 1,
                                                background: isActive ? 'rgba(74,173,168,0.08)' : 'transparent',
                                                borderLeft: isActive ? '3px solid #4AADA8' : '3px solid transparent',
                                            }}>
                                                <div className={styles.feedDot} style={{ background: isActive ? '#4AADA8' : isPast ? '#555' : '#F7C948' }} />
                                                <div className={styles.feedContent}>
                                                    <div className={styles.feedEvent}>
                                                        {isActive && '✅ '}
                                                        <strong>≤{t.maxUsers} users</strong>
                                                        <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                                                            {t.dailyLimitPerUser} calls/user/day · {t.label}
                                                        </span>
                                                    </div>
                                                    <div className={styles.feedTime}>
                                                        {t.action}
                                                        {isActive && (
                                                            <span style={{ marginLeft: 8, color: '#4AADA8', fontWeight: 700 }}>
                                                                Headroom: {usageData.tier.headroom} calls/day
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Top API Consumers */}
                                {usageData.topUsers.length > 0 && (
                                    <div className={styles.feedCard}>
                                        <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                            <div style={{ fontWeight: 800, color: 'white', fontSize: '0.88rem' }}>🔥 Top API Consumers Today</div>
                                        </div>
                                        {usageData.topUsers.map((u: { uid: string; count: number }, i: number) => (
                                            <div key={i} className={styles.feedItem}>
                                                <div className={styles.feedDot} style={{ background: DONUT_COLORS[i] || '#555' }} />
                                                <div className={styles.feedContent}>
                                                    <div className={styles.feedEvent}>
                                                        {u.uid.slice(0, 12)}...
                                                        <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                                                            {u.count} calls ({Math.round(u.count / usageData.tier.dailyLimitPerUser * 100)}% of limit)
                                                        </span>
                                                    </div>
                                                    <div style={{
                                                        height: 4, borderRadius: 2, marginTop: 4,
                                                        background: 'rgba(255,255,255,0.06)',
                                                        width: '100%', maxWidth: 200,
                                                    }}>
                                                        <div style={{
                                                            height: '100%', borderRadius: 2,
                                                            width: `${Math.min(100, u.count / usageData.tier.dailyLimitPerUser * 100)}%`,
                                                            background: u.count / usageData.tier.dailyLimitPerUser > 0.8 ? '#E8896A' : '#4AADA8',
                                                        }} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ══ API USAGE METRICS ══ */}
                        {usageData?.apiMetrics && (() => {
                            const am = usageData.apiMetrics
                            const EP_META: Record<string, { label: string; emoji: string; color: string; service: string }> = {
                                plan: { label: 'Party Plan', emoji: '🤖', color: '#F7C948', service: 'Gemini' },
                                moodboard: { label: 'Moodboard', emoji: '🎨', color: '#7B5EA7', service: 'Gemini' },
                                guests: { label: 'Guest AI', emoji: '💌', color: '#3D8C6E', service: 'Gemini' },
                                vendors: { label: 'Vendor Search', emoji: '🔍', color: '#E8896A', service: 'Maps' },
                                location: { label: 'Location', emoji: '📍', color: '#4AADA8', service: 'Maps' },
                            }
                            const epEntries = Object.entries(am.endpointTotals as Record<string, number>)
                                .sort((a, b) => b[1] - a[1])
                            const maxEpCalls = Math.max(...epEntries.map(([, c]) => c), 1)

                            return (
                                <>
                                    <div className={styles.sectionHeader} style={{ marginTop: '1.5rem' }}>
                                        <span className={styles.sectionEmoji}>🔌</span>
                                        <span className={styles.sectionTitle}>API Usage Metrics</span>
                                        <span className={styles.sectionSub}>Per-endpoint tracking — Last 7 days</span>
                                    </div>

                                    {/* KPI Row */}
                                    <div className={styles.kpiGrid}>
                                        <KPICard
                                            label="Gemini AI Calls"
                                            value={formatNumber(am.totals.gemini)}
                                            icon="🧠"
                                            color="#F7C948"
                                            subtitle="Last 7 days"
                                        />
                                        <KPICard
                                            label="Maps / Places"
                                            value={formatNumber(am.totals.maps)}
                                            icon="🗺️"
                                            color="#4AADA8"
                                            subtitle="Last 7 days"
                                        />
                                        <KPICard
                                            label="Est. Cost Today"
                                            value={am.todayCost}
                                            icon="💰"
                                            color="#3D8C6E"
                                        />
                                        <KPICard
                                            label="Est. Monthly Cost"
                                            value={am.estMonthlyCost}
                                            icon="📊"
                                            color={parseFloat(am.estMonthlyCost.replace('$', '')) > 10 ? '#E8896A' : '#3D8C6E'}
                                            subtitle="Projected from 7-day avg"
                                        />
                                    </div>

                                    {/* Per-Endpoint Breakdown */}
                                    <div className={styles.twoCol}>
                                        <div className={styles.chartCard}>
                                            <div className={styles.chartTitle}>Calls by Endpoint (7 Days)</div>
                                            <div style={{ padding: '0.3rem 0' }}>
                                                {epEntries.length > 0 ? epEntries.map(([ep, count]) => {
                                                    const meta = EP_META[ep] || { label: ep, emoji: '📡', color: '#9aabbb', service: '?' }
                                                    const pct = (count / maxEpCalls) * 100
                                                    return (
                                                        <div key={ep} style={{ marginBottom: '0.6rem' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'white', marginBottom: '0.2rem' }}>
                                                                <span>{meta.emoji} {meta.label}</span>
                                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                                                                    {count} calls
                                                                    <span style={{ marginLeft: 6, padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.6rem', fontWeight: 800, background: meta.service === 'Gemini' ? 'rgba(247,201,72,0.15)' : 'rgba(74,173,168,0.15)', color: meta.service === 'Gemini' ? '#F7C948' : '#4AADA8' }}>
                                                                        {meta.service}
                                                                    </span>
                                                                </span>
                                                            </div>
                                                            <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }}>
                                                                <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: meta.color, transition: 'width 0.6s ease' }} />
                                                            </div>
                                                        </div>
                                                    )
                                                }) : (
                                                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
                                                        No API calls recorded yet. Use PartyPal features to see data here.
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Cost Breakdown Table */}
                                        <div className={styles.chartCard}>
                                            <div className={styles.chartTitle}>Cost Estimates by Endpoint</div>
                                            <div style={{ padding: '0.3rem 0' }}>
                                                {Object.entries(EP_META).map(([ep, meta]) => {
                                                    const calls = (am.endpointTotals as Record<string, number>)[ep] || 0
                                                    const costPerCall = ep === 'plan' ? 0.01 : ep === 'moodboard' ? 0.005 : ep === 'guests' ? 0.003 : ep === 'vendors' ? 0.01 : 0.003
                                                    const cost = calls * costPerCall
                                                    return (
                                                        <div key={ep} style={{
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            padding: '0.5rem 0.3rem', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                            fontSize: '0.78rem',
                                                        }}>
                                                            <span style={{ fontWeight: 700, color: 'white' }}>
                                                                {meta.emoji} {meta.label}
                                                            </span>
                                                            <span style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem' }}>
                                                                    {calls} × ${costPerCall.toFixed(3)}
                                                                </span>
                                                                <span style={{ fontWeight: 800, color: cost > 0 ? '#F7C948' : 'rgba(255,255,255,0.3)', minWidth: 50, textAlign: 'right' }}>
                                                                    ${cost.toFixed(2)}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                                <div style={{
                                                    display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.3rem',
                                                    fontSize: '0.82rem', fontWeight: 800, color: 'white',
                                                    borderTop: '2px solid rgba(255,255,255,0.08)', marginTop: '0.3rem',
                                                }}>
                                                    <span>Total (7 days)</span>
                                                    <span style={{ color: '#F7C948' }}>{am.weekCost}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 7-Day Trend — Stacked by Service */}
                                    <div className={styles.chartCard} style={{ marginTop: '0.8rem' }}>
                                        <div className={styles.chartTitle}>Daily API Calls — Last 7 Days (Gemini vs Maps)</div>
                                        <div className={styles.barChart}>
                                            {(am.days as { date: string; services: Record<string, number>; totalCalls: number }[]).map((d, i) => {
                                                const maxDay = Math.max(...(am.days as { totalCalls: number }[]).map((x: { totalCalls: number }) => x.totalCalls), 1)
                                                const geminiH = maxDay > 0 ? ((d.services.gemini || 0) / maxDay) * 100 : 0
                                                const mapsH = maxDay > 0 ? ((d.services.maps || 0) / maxDay) * 100 : 0
                                                return (
                                                    <div key={i} className={styles.barCol}>
                                                        <div className={styles.barValue}>{d.totalCalls}</div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'flex-end', width: '100%' }}>
                                                            <div style={{
                                                                height: `${Math.max(geminiH > 0 ? 2 : 0, geminiH)}%`,
                                                                background: '#F7C948',
                                                                borderRadius: '3px 3px 0 0',
                                                                transition: 'height 0.5s ease',
                                                            }} />
                                                            <div style={{
                                                                height: `${Math.max(mapsH > 0 ? 2 : 0, mapsH)}%`,
                                                                background: '#4AADA8',
                                                                borderRadius: '0 0 3px 3px',
                                                                transition: 'height 0.5s ease',
                                                            }} />
                                                        </div>
                                                        <div className={styles.barLabel}>
                                                            {new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' })}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#F7C948', display: 'inline-block' }} /> Gemini AI
                                            </span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#4AADA8', display: 'inline-block' }} /> Google Maps
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )
                        })()}

                        {/* ══ POLL ANALYTICS ══ */}
                        {pollStats && (
                            <>
                                <div className={styles.sectionHeader} style={{ marginTop: '1.5rem' }}>
                                    <span className={styles.sectionEmoji}>🗳️</span>
                                    <span className={styles.sectionTitle}>Polls & Engagement</span>
                                </div>

                                {/* KPI Cards Row */}
                                <div className={styles.kpiGrid}>
                                    <KPICard label="Total Polls" value={pollStats.totalPolls} icon="🗳️" />
                                    <KPICard label="Total Votes" value={pollStats.totalVotes} icon="✋" color="#4AADA8" />
                                    <KPICard label="Unique Voters" value={pollStats.uniqueVoters} icon="👥" color="#3D8C6E" />
                                    <KPICard label="Active Polls" value={pollStats.activePolls} icon="📊" color="#F7C948" />
                                    <KPICard label="Events w/ Polls" value={pollStats.eventsWithPolls} icon="🎉" color="#7B5EA7" />
                                    <KPICard label="Multi-Select Rate" value={pollStats.multiSelectRate} icon="☑️" color="#C4A882" />
                                </div>

                                {pollStats.totalPolls > 0 && (
                                    <>
                                        {/* Engagement Metrics Row */}
                                        <div className={styles.chartCard}>
                                            <div className={styles.chartTitle}>Engagement Overview</div>
                                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '0.5rem 0' }}>
                                                <MetricBox emoji="📈" label="Avg Votes / Poll" value={pollStats.avgVotesPerPoll} />
                                                <MetricBox emoji="🔢" label="Avg Options / Poll" value={pollStats.avgOptions} />
                                                <MetricBox emoji="🟢" label="Active Rate" value={pollStats.totalPolls > 0 ? `${Math.round((pollStats.activePolls / pollStats.totalPolls) * 100)}%` : '0%'} />
                                                <MetricBox emoji="🎯" label="Poll Adoption" value={`${pollStats.eventsWithPolls} events`} />
                                            </div>
                                        </div>

                                        {/* Two-column: Categories + Vote Distribution */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.8rem' }}>
                                            {/* Poll Categories Bar Chart */}
                                            <div className={styles.chartCard}>
                                                <div className={styles.chartTitle}>Poll Categories</div>
                                                <div style={{ padding: '0.3rem 0' }}>
                                                    {Object.entries(pollStats.categories)
                                                        .sort((a, b) => b[1] - a[1])
                                                        .map(([cat, count], i) => {
                                                            const max = Math.max(...Object.values(pollStats.categories))
                                                            const pct = max > 0 ? (count / max) * 100 : 0
                                                            const icons: Record<string, string> = { 'Date/Time': '📅', 'Venue': '📍', 'Food': '🍽️', 'Theme': '🎭', 'Music': '🎵', 'Start Time': '⏰', 'Other': '💬' }
                                                            return (
                                                                <div key={cat} style={{ marginBottom: '0.5rem' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.15rem' }}>
                                                                        <span>{icons[cat] || '📊'} {cat}</span>
                                                                        <span style={{ color: '#9aabbb' }}>{count}</span>
                                                                    </div>
                                                                    <div style={{ height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.04)' }}>
                                                                        <div style={{
                                                                            height: '100%', borderRadius: 4, width: `${pct}%`,
                                                                            background: DONUT_COLORS[i % DONUT_COLORS.length],
                                                                            transition: 'width 0.6s ease',
                                                                        }} />
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                </div>
                                            </div>

                                            {/* Voter Engagement Distribution */}
                                            <div className={styles.chartCard}>
                                                <div className={styles.chartTitle}>Voter Engagement Distribution</div>
                                                <div style={{ padding: '0.3rem 0' }}>
                                                    {Object.entries(pollStats.voteDist).map(([label, count], i) => {
                                                        const total = pollStats.totalPolls
                                                        const pct = total > 0 ? Math.round((count / total) * 100) : 0
                                                        const colors = ['#E8896A', '#F7C948', '#4AADA8', '#3D8C6E']
                                                        return (
                                                            <div key={label} style={{ marginBottom: '0.5rem' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.15rem' }}>
                                                                    <span>{label}</span>
                                                                    <span style={{ color: '#9aabbb' }}>{count} polls ({pct}%)</span>
                                                                </div>
                                                                <div style={{ height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.04)' }}>
                                                                    <div style={{
                                                                        height: '100%', borderRadius: 4, width: `${pct}%`,
                                                                        background: colors[i] || '#9aabbb',
                                                                        transition: 'width 0.6s ease',
                                                                    }} />
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Two-column: Top Polls + Event Types */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem', marginTop: '0.8rem' }}>
                                            {/* Top Polls Leaderboard */}
                                            <div className={styles.chartCard}>
                                                <div className={styles.chartTitle}>🏆 Top Polls (by Votes)</div>
                                                <div style={{ padding: '0.3rem 0' }}>
                                                    {pollStats.topPolls.length > 0 ? pollStats.topPolls.map((p, i) => (
                                                        <div key={i} style={{
                                                            display: 'flex', alignItems: 'center', gap: '0.6rem',
                                                            padding: '0.5rem 0.6rem', borderRadius: 10, marginBottom: '0.35rem',
                                                            background: i === 0 ? 'rgba(247,201,72,0.06)' : 'transparent',
                                                            border: i === 0 ? '1px solid rgba(247,201,72,0.2)' : '1px solid transparent',
                                                        }}>
                                                            <span style={{
                                                                fontSize: '0.9rem', fontWeight: 900, width: 24, textAlign: 'center',
                                                                color: i === 0 ? '#F7C948' : i === 1 ? '#9aabbb' : i === 2 ? '#C4A882' : '#ccc',
                                                            }}>
                                                                {i === 0 ? '👑' : `#${i + 1}`}
                                                            </span>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{
                                                                    fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy)',
                                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                                }}>
                                                                    {p.question}
                                                                </div>
                                                                <div style={{ fontSize: '0.65rem', color: '#9aabbb', fontWeight: 600 }}>
                                                                    {p.options} options
                                                                    {p.eventType && <span> · {p.eventType}</span>}
                                                                </div>
                                                            </div>
                                                            <div style={{
                                                                padding: '0.15rem 0.5rem', borderRadius: 6,
                                                                background: 'rgba(74,173,168,0.08)',
                                                                fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal)',
                                                            }}>
                                                                {p.votes} {p.votes === 1 ? 'vote' : 'votes'}
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <div style={{ fontSize: '0.78rem', color: '#9aabbb', padding: '1rem', textAlign: 'center' }}>
                                                            No polls with votes yet
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Event Types Using Polls */}
                                            <div className={styles.chartCard}>
                                                <div className={styles.chartTitle}>🎉 Event Types</div>
                                                <div style={{ padding: '0.3rem 0' }}>
                                                    {Object.entries(pollStats.eventTypes)
                                                        .sort((a, b) => b[1] - a[1])
                                                        .slice(0, 6)
                                                        .map(([type, count], i) => {
                                                            const max = Math.max(...Object.values(pollStats.eventTypes))
                                                            const pct = max > 0 ? (count / max) * 100 : 0
                                                            return (
                                                                <div key={type} style={{ marginBottom: '0.5rem' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.15rem' }}>
                                                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{type}</span>
                                                                        <span style={{ color: '#9aabbb', flexShrink: 0 }}>{count}</span>
                                                                    </div>
                                                                    <div style={{ height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.04)' }}>
                                                                        <div style={{
                                                                            height: '100%', borderRadius: 4, width: `${pct}%`,
                                                                            background: DONUT_COLORS[i % DONUT_COLORS.length],
                                                                            transition: 'width 0.6s ease',
                                                                        }} />
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Poll Creation Timeline */}
                                        {Object.keys(pollStats.pollsByDay).length > 0 && (
                                            <div className={styles.chartCard} style={{ marginTop: '0.8rem' }}>
                                                <div className={styles.chartTitle}>📈 Poll Creation Timeline</div>
                                                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 80, padding: '0.5rem 0' }}>
                                                    {(() => {
                                                        const days14: string[] = []
                                                        for (let i = 13; i >= 0; i--) {
                                                            const d = new Date()
                                                            d.setDate(d.getDate() - i)
                                                            days14.push(d.toISOString().split('T')[0])
                                                        }
                                                        const maxDay = Math.max(...days14.map(d => pollStats.pollsByDay[d] || 0), 1)
                                                        return days14.map((day, j) => {
                                                            const count = pollStats.pollsByDay[day] || 0
                                                            const h = maxDay > 0 ? Math.max(2, (count / maxDay) * 100) : 2
                                                            return (
                                                                <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                                    <div style={{
                                                                        width: '100%', maxWidth: 24, borderRadius: 3,
                                                                        height: `${h}%`, minHeight: 2,
                                                                        background: count > 0 ? '#4AADA8' : 'rgba(0,0,0,0.05)',
                                                                        transition: 'height 0.5s ease',
                                                                    }} />
                                                                    {j % 2 === 0 && (
                                                                        <span style={{ fontSize: '0.5rem', color: '#9aabbb', fontWeight: 600 }}>
                                                                            {new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )
                                                        })
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </>
                ) : null}
            </div>
        </main>
    )
}

// ── Sub Components ────────────────────────────────────

function KPICard({ label, value, icon, color, subtitle }: { label: string; value: string | number; icon: string; color?: string; subtitle?: string }) {
    return (
        <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>{icon} {label}</div>
            <div className={styles.kpiValue} style={color ? { color } : {}}>{value}</div>
            {subtitle && <div className={styles.kpiTrend + ' ' + styles.kpiTrendNeutral}>{subtitle}</div>}
        </div>
    )
}

function FunnelStep({ label, value, max, color, rate }: { label: string; value: number; max: number; color: string; rate?: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0
    return (
        <div className={styles.funnelStep}>
            <span className={styles.funnelLabel}>{label}</span>
            <div className={styles.funnelBarWrap}>
                <div className={styles.funnelBar} style={{ width: `${Math.max(2, pct)}%`, background: color }} />
            </div>
            <span className={styles.funnelValue}>{formatNumber(value)}</span>
            {rate && <span className={styles.funnelRate}>{rate}</span>}
        </div>
    )
}

function RateCard({ label, rate, target }: { label: string; rate: string; target: string }) {
    const rateNum = parseFloat(rate)
    const targetNum = parseFloat(target)
    const isGood = rateNum >= targetNum
    return (
        <div style={{ padding: '0.8rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
                <span style={{
                    fontSize: '0.9rem', fontWeight: 800,
                    color: isGood ? '#3D8C6E' : rateNum > 0 ? '#F7C948' : 'rgba(255,255,255,0.3)',
                }}>{rate}%</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                    width: `${Math.min(100, (rateNum / targetNum) * 100)}%`,
                    height: '100%',
                    background: isGood ? '#3D8C6E' : '#F7C948',
                    borderRadius: 2,
                    transition: 'width 0.5s',
                }} />
            </div>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', marginTop: '0.2rem' }}>
                Target: {target}%
            </div>
        </div>
    )
}

function MetricBox({ label, value, emoji }: { label: string; value: number | string; emoji: string }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '0.8rem',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>{emoji}</div>
            <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: '1.3rem', color: 'white' }}>{value}</div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        </div>
    )
}
