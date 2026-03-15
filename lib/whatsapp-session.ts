// ═══════════════════════════════════════════════════════
//  WhatsApp Session Management
//  Maps WhatsApp phone numbers to PartyPal users.
//  Tracks conversation state in Firestore.
// ═══════════════════════════════════════════════════════

import { getDb } from '@/lib/firebase'

const SESSION_COLLECTION = 'whatsapp_sessions'
const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

export type ConversationState =
    | 'idle'
    | 'awaiting_link'           // Waiting for user to link their PartyPal account
    | 'creating_event'          // Multi-step event creation
    | 'selecting_event'         // Choosing which event to work with
    | 'managing_guests'         // Adding/viewing guests
    | 'creating_poll'           // Multi-step poll creation
    | 'exploring_theme'         // Browsing theme/cake/invite ideas
    | 'refining_theme'          // Refining theme results

export interface EventSlots {
    eventType?: string
    date?: string
    guests?: string
    location?: string
    theme?: string
    budget?: string
    time?: string
}

export interface PollSlots {
    question?: string
    options?: string[]
}

export interface ThemeSlots {
    category?: 'cake' | 'invitation' | 'moodboard' | 'decor'
    lastResults?: unknown  // Store last generated results for refinement
}

export interface WhatsAppSession {
    phoneNumber: string
    uid?: string                 // Linked PartyPal user ID
    displayName?: string         // User's WhatsApp display name
    state: ConversationState
    activeEventId?: string       // Currently selected event
    activeEventName?: string     // For display in responses
    eventSlots?: EventSlots      // Partial data during event creation
    pollSlots?: PollSlots        // Partial data during poll creation
    themeSlots?: ThemeSlots      // Theme exploration state
    lastActivity: string         // ISO timestamp
    createdAt: string
    messageCount: number
}

// ── Get or Create Session ─────────────────────────────

export async function getSession(phoneNumber: string): Promise<WhatsAppSession> {
    const db = getDb()
    const ref = db.collection(SESSION_COLLECTION).doc(phoneNumber)
    const doc = await ref.get()

    if (doc.exists) {
        const session = doc.data() as WhatsAppSession

        // Check TTL — reset to idle if stale
        const lastActive = new Date(session.lastActivity).getTime()
        if (Date.now() - lastActive > SESSION_TTL_MS && session.state !== 'idle') {
            session.state = 'idle'
            session.eventSlots = undefined
            session.pollSlots = undefined
            session.themeSlots = undefined
        }

        return session
    }

    // New session
    const newSession: WhatsAppSession = {
        phoneNumber,
        state: 'idle',
        lastActivity: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        messageCount: 0,
    }

    await ref.set(newSession)
    return newSession
}

// ── Update Session ────────────────────────────────────

export async function updateSession(phoneNumber: string, updates: Partial<WhatsAppSession>): Promise<void> {
    const db = getDb()
    await db.collection(SESSION_COLLECTION).doc(phoneNumber).set(
        {
            ...updates,
            lastActivity: new Date().toISOString(),
        },
        { merge: true }
    )
}

// ── Increment Message Count ───────────────────────────

export async function touchSession(phoneNumber: string): Promise<void> {
    const db = getDb()
    const ref = db.collection(SESSION_COLLECTION).doc(phoneNumber)
    const doc = await ref.get()
    const current = doc.exists ? (doc.data() as WhatsAppSession).messageCount || 0 : 0
    await ref.set(
        {
            messageCount: current + 1,
            lastActivity: new Date().toISOString(),
        },
        { merge: true }
    )
}

// ── Link WhatsApp to PartyPal Account ─────────────────

export async function linkAccount(phoneNumber: string, uid: string, displayName?: string): Promise<void> {
    await updateSession(phoneNumber, {
        uid,
        displayName,
        state: 'idle',
    })
}

// ── Reset Session State ───────────────────────────────

export async function resetState(phoneNumber: string): Promise<void> {
    await updateSession(phoneNumber, {
        state: 'idle',
        eventSlots: undefined as unknown as EventSlots,
        pollSlots: undefined as unknown as PollSlots,
        themeSlots: undefined as unknown as ThemeSlots,
    })
}

// ── Set Active Event ──────────────────────────────────

export async function setActiveEvent(phoneNumber: string, eventId: string, eventName: string): Promise<void> {
    await updateSession(phoneNumber, {
        activeEventId: eventId,
        activeEventName: eventName,
        state: 'idle',
    })
}

// ── Lookup User by UID ────────────────────────────────
// Find if a PartyPal user already has a linked WhatsApp session

export async function findSessionByUid(uid: string): Promise<WhatsAppSession | null> {
    const db = getDb()
    const snapshot = await db.collection(SESSION_COLLECTION)
        .where('uid', '==', uid)
        .limit(1)
        .get()

    if (snapshot.empty) return null
    return snapshot.docs[0].data() as WhatsAppSession
}
