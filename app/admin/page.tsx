'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import styles from './admin.module.css'

// ═══════════════════════════════════════════════════════
//  PartyPal Admin Analytics Dashboard
//  Executive-level metrics, conversion funnels, error
//  tracking, growth accounting, and live activity feeds.
// ═══════════════════════════════════════════════════════

// Admin email whitelist
const ADMIN_EMAILS = ['admin@partypal.social']

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
    const [pollStats, setPollStats] = useState<{ totalPolls: number; totalVotes: number; activePolls: number; eventsWithPolls: number } | null>(null)

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
                    <div className={styles.logo}>🎊 Party<span>Pal</span></div>
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
                        </div>

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

                        {/* ══ GROWTH ACCOUNTING ══ */}
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionEmoji}>🌱</span>
                            <span className={styles.sectionTitle}>Growth Accounting</span>
                        </div>
                        <div className={styles.kpiGrid}>
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

                        {/* ══ POLL STATS ══ */}
                        {pollStats && (
                            <>
                                <div className={styles.sectionHeader} style={{ marginTop: '1.5rem' }}>
                                    <span className={styles.sectionEmoji}>🗳️</span>
                                    <span className={styles.sectionTitle}>Polls & Engagement</span>
                                </div>
                                <div className={styles.kpiGrid}>
                                    <KPICard label="Total Polls" value={pollStats.totalPolls} icon="🗳️" />
                                    <KPICard label="Total Votes" value={pollStats.totalVotes} icon="✋" color="#4AADA8" />
                                    <KPICard label="Active Polls" value={pollStats.activePolls} icon="📊" color="#F7C948" />
                                    <KPICard label="Events w/ Polls" value={pollStats.eventsWithPolls} icon="🎉" color="#7B5EA7" />
                                </div>
                                {pollStats.totalPolls > 0 && (
                                    <div className={styles.chartCard}>
                                        <div className={styles.chartTitle}>Poll Engagement</div>
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '0.5rem 0' }}>
                                            <MetricBox
                                                emoji="📈"
                                                label="Avg Votes/Poll"
                                                value={pollStats.totalPolls > 0 ? (pollStats.totalVotes / pollStats.totalPolls).toFixed(1) : '0'}
                                            />
                                            <MetricBox
                                                emoji="🎯"
                                                label="Poll Adoption"
                                                value={`${pollStats.eventsWithPolls} events`}
                                            />
                                            <MetricBox
                                                emoji="🟢"
                                                label="Active Rate"
                                                value={pollStats.totalPolls > 0 ? `${Math.round((pollStats.activePolls / pollStats.totalPolls) * 100)}%` : '0%'}
                                            />
                                        </div>
                                    </div>
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
