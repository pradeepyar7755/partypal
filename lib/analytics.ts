// ═══════════════════════════════════════════════════════
//  PartyPal Analytics Tracker
//  Client-side event tracking for page views, feature
//  usage, conversions, errors, and user behavior.
// ═══════════════════════════════════════════════════════

const BATCH_SIZE = 10
const FLUSH_INTERVAL = 30_000 // 30 seconds
let eventQueue: AnalyticsEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let sessionId: string | null = null
let pageEntryTime: number = 0

export interface AnalyticsEvent {
    event: string
    properties?: Record<string, unknown>
    timestamp: string
    sessionId: string
    page: string
    userId?: string
    userAgent?: string
}

// ── Session Management ────────────────────────────────
function getSessionId(): string {
    if (sessionId) return sessionId
    if (typeof window === 'undefined') return 'server'
    const stored = sessionStorage.getItem('pp_session')
    if (stored) { sessionId = stored; return stored }
    sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    sessionStorage.setItem('pp_session', sessionId)
    return sessionId
}

function getUserId(): string | undefined {
    if (typeof window === 'undefined') return undefined
    return localStorage.getItem('pp_uid') || undefined
}

// ── Core Track Function ───────────────────────────────
export function track(event: string, properties?: Record<string, unknown>) {
    if (typeof window === 'undefined') return

    const evt: AnalyticsEvent = {
        event,
        properties,
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
        page: window.location.pathname,
        userId: getUserId(),
    }

    eventQueue.push(evt)

    // Auto-flush when batch is full
    if (eventQueue.length >= BATCH_SIZE) {
        flush()
    } else if (!flushTimer) {
        flushTimer = setTimeout(flush, FLUSH_INTERVAL)
    }
}

// ── Flush Queue to Server ─────────────────────────────
async function flush() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
    if (eventQueue.length === 0) return

    const batch = [...eventQueue]
    eventQueue = []

    try {
        await fetch('/api/analytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: batch }),
        })
    } catch {
        // Re-queue failed events (limit to prevent memory issues)
        eventQueue = [...batch.slice(-20), ...eventQueue]
    }
}

// ── Auto Page View Tracking ───────────────────────────
export function trackPageView() {
    if (typeof window === 'undefined') return
    pageEntryTime = Date.now()
    track('page_view', {
        referrer: document.referrer,
        title: document.title,
        url: window.location.href,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        locale: navigator.language || '',
    })
}

export function trackPageExit() {
    if (typeof window === 'undefined' || !pageEntryTime) return
    const timeOnPage = Math.round((Date.now() - pageEntryTime) / 1000)
    track('page_exit', { timeOnPage, page: window.location.pathname })
}

// ── Conversion Events ─────────────────────────────────
export function trackSignUp(method: string) {
    track('sign_up', { method })
}

export function trackLogin(method: string) {
    track('login', { method })
}

export function trackPlanGenerated(eventType: string, guests: string, budget: string) {
    track('plan_generated', { eventType, guests, budget })
}

export function trackPlanRefined(instruction: string) {
    track('plan_refined', { instruction: instruction.slice(0, 100) })
}

export function trackVendorSearch(category: string, location: string) {
    track('vendor_search', { category, location })
}

export function trackVendorShortlisted(vendorName: string, category: string) {
    track('vendor_shortlisted', { vendorName, category })
}

export function trackInviteSent(guestCount: number) {
    track('invite_sent', { guestCount })
}

export function trackRSVP(response: string, eventId: string) {
    track('rsvp_submitted', { response, eventId })
}

export function trackEventCreated(eventType: string, guests: number, budget: string) {
    track('event_created', { eventType, guests, budget })
}

export function trackNotificationSent(guestCount: number) {
    track('notification_sent', { guestCount })
}

export function trackFeatureUsed(feature: string, details?: Record<string, unknown>) {
    track('feature_used', { feature, ...details })
}

// ── Error Tracking ────────────────────────────────────
export function trackError(error: string, context?: Record<string, unknown>) {
    track('error', { error: error.slice(0, 500), ...context })
}

export function initErrorTracking() {
    if (typeof window === 'undefined') return

    // Unhandled errors
    window.addEventListener('error', (e) => {
        trackError(e.message || 'Unknown error', {
            source: 'window.onerror',
            filename: e.filename,
            line: e.lineno,
            col: e.colno,
        })
    })

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (e) => {
        trackError(String(e.reason) || 'Unhandled promise rejection', {
            source: 'unhandledrejection',
        })
    })

    // Track on page unload
    window.addEventListener('beforeunload', () => {
        trackPageExit()
        flush()
    })

    // Track visibility changes (tab switches)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            trackPageExit()
            flush()
        }
    })
}

// ── User ID Management ────────────────────────────────
export function setAnalyticsUserId(uid: string | null) {
    if (typeof window === 'undefined') return
    if (uid) {
        localStorage.setItem('pp_uid', uid)
    } else {
        localStorage.removeItem('pp_uid')
    }
}

// ── Flush on demand (for admin) ───────────────────────
export { flush as flushAnalytics }
