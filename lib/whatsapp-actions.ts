// ═══════════════════════════════════════════════════════
//  Emcee — WhatsApp Action Handlers
//  Each handler bridges a classified intent to the
//  appropriate PartyPal API and formats the response
//  for WhatsApp chat.
// ═══════════════════════════════════════════════════════

import { sendTextMessage, sendButtons, sendList } from '@/lib/whatsapp'
import { getDb } from '@/lib/firebase'
import {
    updateSession, resetState, setActiveEvent,
    type WhatsAppSession
} from '@/lib/whatsapp-session'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://partypal.social'

// ── Event type → Emoji mapping (must match web wizard) ──

const EVENT_EMOJI_MAP: Record<string, string> = {
    'birthday': '🎂',
    'engagement': '💍',
    'graduation': '🎓',
    'baby shower': '👶',
    'housewarming': '🏠',
    'holiday': '🎄',
    'christmas': '🎄',
    'corporate': '💼',
    'poker': '🃏',
    'game night': '🎮',
    'family reunion': '👨‍👩‍👧‍👦',
    'reunion': '👨‍👩‍👧‍👦',
    'anniversary': '💞',
    'wedding': '💒',
    'bbq': '🍖',
    'barbecue': '🍖',
    'get together': '🍻',
    'cocktail': '🍸',
    'dinner': '🍽️',
    'brunch': '🥂',
    'halloween': '🎃',
    'new year': '🥳',
    'super bowl': '🏈',
    'watch party': '📺',
    'pool party': '🏊',
    'block party': '🏘️',
    'party': '🎉',
}

function getEventEmoji(eventType: string): string {
    const lower = eventType.toLowerCase()
    // Check if it already starts with an emoji (character outside ASCII)
    if (lower.length > 0 && lower.charCodeAt(0) > 255) return ''
    // Find matching emoji
    for (const [key, emoji] of Object.entries(EVENT_EMOJI_MAP)) {
        if (lower.includes(key)) return emoji
    }
    return '🎉' // default party emoji
}

/** Ensure eventType has emoji prefix for dashboard compatibility */
function formatEventType(eventType: string): string {
    if (!eventType) return '🎉 Party'
    // Already has emoji prefix? Return as-is
    if (eventType.charCodeAt(0) > 255) return eventType
    const emoji = getEventEmoji(eventType)
    return `${emoji} ${eventType}`
}

/** Parse a natural language date into YYYY-MM-DD for dashboard compatibility */
function parseNaturalDate(input: string): string {
    if (!input) return ''

    // Already in ISO format?
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input

    // Try MM/DD/YYYY or MM-DD-YYYY
    const slashMatch = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (slashMatch) {
        return `${slashMatch[3]}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`
    }

    // Month name patterns: "April 4", "Apr 4, 2026", "4 April", "April 4th"
    const months: Record<string, number> = {
        january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
        april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
        august: 8, aug: 8, september: 9, sep: 9, sept: 9,
        october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
    }

    const cleaned = input.toLowerCase().replace(/(st|nd|rd|th)/g, '').replace(/,/g, '').trim()
    const parts = cleaned.split(/\s+/)

    let month = 0, day = 0, year = new Date().getFullYear()

    for (const part of parts) {
        if (months[part]) {
            month = months[part]
        } else if (/^\d{1,2}$/.test(part) && !day) {
            day = parseInt(part)
        } else if (/^\d{4}$/.test(part)) {
            year = parseInt(part)
        }
    }

    // Handle relative dates
    if (!month && !day) {
        const lower = input.toLowerCase()
        const today = new Date()
        const dayOfWeek = today.getDay()

        if (lower.includes('tomorrow')) {
            const d = new Date(today)
            d.setDate(d.getDate() + 1)
            return d.toISOString().split('T')[0]
        }
        if (lower.includes('today')) {
            return today.toISOString().split('T')[0]
        }

        const dayNames: Record<string, number> = {
            sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
            wednesday: 3, wed: 3, thursday: 4, thu: 4, thurs: 4,
            friday: 5, fri: 5, saturday: 6, sat: 6,
        }

        for (const [name, targetDay] of Object.entries(dayNames)) {
            if (lower.includes(name)) {
                let daysAhead = (targetDay - dayOfWeek + 7) % 7
                if (daysAhead === 0) daysAhead = 7 // "next" always means upcoming
                if (lower.includes('next')) daysAhead += (daysAhead <= 0 ? 7 : 0)
                const d = new Date(today)
                d.setDate(d.getDate() + daysAhead)
                return d.toISOString().split('T')[0]
            }
        }

        // Couldn't parse — return original (will show raw text but not crash)
        return input
    }

    if (month && day) {
        // If the date is in the past for this year, assume next year
        const candidate = new Date(year, month - 1, day)
        if (candidate < new Date() && year === new Date().getFullYear()) {
            year += 1
        }
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }

    return input // fallback: return as-is
}

// ── Helper: require linked account ────────────────────

async function requireAccount(from: string, session: WhatsAppSession): Promise<boolean> {
    if (!session.uid) {
        await sendButtons(from,
            `🔗 You need to link your PartyPal account first to do that.\n\nLink now?`,
            [
                { id: 'link_yes', title: 'Link account' },
                { id: 'link_skip', title: 'Skip' },
            ]
        )
        return false
    }
    return true
}

// ── Helper: require active event ──────────────────────

async function requireEvent(from: string, session: WhatsAppSession): Promise<boolean> {
    if (!session.activeEventId) {
        await sendTextMessage(from,
            `📌 No event selected. Say *"show my events"* to pick one, or *"create a party"* to start fresh!`
        )
        return false
    }
    return true
}

// ═══════════════════════════════════════════════════════
//  EVENT ACTIONS
// ═══════════════════════════════════════════════════════

export async function handleCreateEvent(
    from: string,
    session: WhatsAppSession,
    entities: Record<string, string>,
    finalize?: boolean
): Promise<void> {
    // If finalizing — create the event from collected slots
    if (finalize && session.eventSlots) {
        const slots = session.eventSlots
        if (!(await requireAccount(from, session))) return

        try {
            const { v4: uuidv4 } = await import('uuid')
            const eventId = uuidv4()

            const res = await fetch(`${APP_URL}/api/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    uid: session.uid,
                    eventType: formatEventType(slots.eventType || ''),
                    date: parseNaturalDate(slots.date || ''),
                    guests: slots.guests,
                    location: slots.location,
                    theme: slots.theme || undefined,
                    budget: slots.budget || undefined,
                }),
            })

            const data = await res.json()
            if (data.success) {
                await setActiveEvent(from, eventId, slots.eventType || 'New Event')
                await resetState(from)
                await sendTextMessage(from,
                    `🎉 *Event created!*\n\n` +
                    `📋 *${slots.eventType}*\n` +
                    `📅 ${slots.date || 'TBD'}\n` +
                    `👥 ${slots.guests || '?'} guests\n` +
                    `📍 ${slots.location || 'TBD'}\n` +
                    (slots.theme ? `🎨 ${slots.theme}\n` : '') +
                    (slots.budget ? `💰 ${slots.budget}\n` : '') +
                    `\n🔗 Join code: *${data.joinCode}*\n` +
                    `Share link: ${APP_URL}/join/${data.joinCode}\n\n` +
                    `What's next?\n` +
                    `📝 Generate a plan\n` +
                    `👥 Add guests\n` +
                    `🎂 Explore cake ideas`
                )
            } else {
                await sendTextMessage(from, `❌ Failed to create event: ${data.error}`)
            }
        } catch (err) {
            console.error('[Emcee] Event creation error:', err)
            await sendTextMessage(from, '❌ Something went wrong. Try again?')
        }
        return
    }

    // Start multi-step event creation — pre-fill any entities extracted from the message
    const slots: Record<string, string> = {}
    if (entities.eventType) slots.eventType = entities.eventType
    if (entities.date) slots.date = entities.date
    if (entities.guests) slots.guests = entities.guests
    if (entities.location) slots.location = entities.location
    if (entities.theme) slots.theme = entities.theme
    if (entities.budget) slots.budget = entities.budget

    await updateSession(from, {
        state: 'creating_event',
        eventSlots: slots,
    })

    // Ask for the next missing field
    if (!slots.eventType) {
        await sendTextMessage(from, `🎉 Let's plan a party!\n\nWhat type of event? (e.g., Birthday, Wedding, BBQ, Game Night, Baby Shower)`)
    } else if (!slots.date) {
        await sendTextMessage(from, `🎉 Let's plan a *${slots.eventType}*!\n\n📅 When is it? (e.g., "April 15" or "next Saturday")`)
    } else if (!slots.guests) {
        await sendTextMessage(from, `🎉 *${slots.eventType}* on *${slots.date}* — nice!\n\n👥 How many guests are you expecting?`)
    } else if (!slots.location) {
        await sendTextMessage(from, `🎉 *${slots.eventType}* on *${slots.date}* for *${slots.guests} guests*\n\n📍 Where will it be? (address, venue name, or city)`)
    } else {
        // All required fields filled — offer to create or add extras
        await sendButtons(from,
            `🎉 Here's what I have:\n\n` +
            `📋 *${slots.eventType}*\n📅 ${slots.date}\n👥 ${slots.guests} guests\n📍 ${slots.location}\n` +
            (slots.theme ? `🎨 ${slots.theme}\n` : '') +
            (slots.budget ? `💰 ${slots.budget}\n` : '') +
            `\nCreate the event?`,
            [
                { id: 'event_create_now', title: 'Create now ✨' },
                { id: 'event_add_theme', title: 'Add theme' },
                { id: 'event_add_budget', title: 'Add budget' },
            ]
        )
    }
}

export async function handleListEvents(from: string, session: WhatsAppSession): Promise<void> {
    if (!(await requireAccount(from, session))) return

    try {
        const db = getDb()
        const snapshot = await db.collection('events')
            .where('uid', '==', session.uid)
            .get()

        const events: { id: string; type: string; date: string }[] = []
        snapshot.forEach(doc => {
            const d = doc.data()
            if (!d.trashedAt) {
                events.push({
                    id: doc.id,
                    type: String(d.eventType || 'Untitled'),
                    date: String(d.date || 'No date'),
                })
            }
        })

        if (events.length === 0) {
            await sendTextMessage(from,
                `📋 You don't have any events yet.\n\n🎉 Say "create a party" to get started!`
            )
            return
        }

        // Use interactive list for event selection
        await sendList(from,
            `📋 You have *${events.length}* event${events.length > 1 ? 's' : ''}:`,
            'View Events',
            [{
                title: 'Your Events',
                rows: events.slice(0, 10).map(e => ({
                    id: `event_${e.id}`,
                    title: e.type,
                    description: `📅 ${e.date}`,
                })),
            }],
            undefined,
            'Tap an event to select it'
        )
    } catch (err) {
        console.error('[Emcee] List events error:', err)
        await sendTextMessage(from, '❌ Couldn\'t fetch your events. Try again?')
    }
}

export async function handleSelectEvent(
    from: string,
    session: WhatsAppSession,
    entities: Record<string, string>
): Promise<void> {
    if (!(await requireAccount(from, session))) return

    const eventName = entities.eventName || ''
    if (!eventName) {
        await handleListEvents(from, session)
        return
    }

    // Search for event by name
    try {
        const db = getDb()
        const snapshot = await db.collection('events')
            .where('uid', '==', session.uid)
            .get()

        let matchId = ''
        let matchName = ''
        snapshot.forEach(doc => {
            const d = doc.data()
            if (!d.trashedAt && String(d.eventType || '').toLowerCase().includes(eventName.toLowerCase())) {
                matchId = doc.id
                matchName = String(d.eventType)
            }
        })

        if (matchId) {
            await setActiveEvent(from, matchId, matchName)
            await sendTextMessage(from, `✅ Switched to *${matchName}*! What would you like to do?`)
        } else {
            await sendTextMessage(from, `Couldn't find an event matching "${eventName}". Say *"show my events"* to see your list.`)
        }
    } catch (err) {
        console.error('[Emcee] Select event error:', err)
        await sendTextMessage(from, '❌ Something went wrong. Try again?')
    }
}

// ═══════════════════════════════════════════════════════
//  GUEST ACTIONS
// ═══════════════════════════════════════════════════════

export async function handleAddGuests(
    from: string,
    session: WhatsAppSession,
    entities: Record<string, string>,
    rawText: string
): Promise<void> {
    if (!(await requireAccount(from, session))) return
    if (!(await requireEvent(from, session))) return

    // Parse guest names from entities or raw text
    const guestNamesStr = entities.guestNames || rawText.replace(/^(add|invite)\s*(guests?)?:?\s*/i, '')
    const names = guestNamesStr.split(/[,\n]+/).map(n => n.trim()).filter(n => n.length > 0)

    if (names.length === 0) {
        await sendTextMessage(from, '👥 Who would you like to add? Send names separated by commas:\n\nExample: *John, Sarah, Mike*')
        return
    }

    try {
        const db = getDb()
        const eventRef = db.collection('events').doc(session.activeEventId!)
        const doc = await eventRef.get()

        if (!doc.exists) {
            await sendTextMessage(from, '❌ Event not found. Try selecting a different event.')
            return
        }

        const existing = (doc.data()?.guestContacts || []) as { name: string }[]
        const newGuests = names.map(name => ({ name, status: 'pending' }))
        const allGuests = [...existing, ...newGuests]

        await eventRef.set({ guestContacts: allGuests }, { merge: true })

        await sendTextMessage(from,
            `✅ Added *${names.length}* guest${names.length > 1 ? 's' : ''}:\n` +
            names.map(n => `  • ${n}`).join('\n') +
            `\n\nTotal guests: *${allGuests.length}*`
        )
    } catch (err) {
        console.error('[Emcee] Add guests error:', err)
        await sendTextMessage(from, '❌ Couldn\'t add guests. Try again?')
    }
}

export async function handleCheckRsvps(from: string, session: WhatsAppSession): Promise<void> {
    if (!(await requireAccount(from, session))) return
    if (!(await requireEvent(from, session))) return

    try {
        const db = getDb()
        const rsvpSnap = await db.collection('events')
            .doc(session.activeEventId!)
            .collection('rsvps')
            .get()

        if (rsvpSnap.empty) {
            await sendTextMessage(from,
                `📋 No RSVPs yet for *${session.activeEventName}*.\n\n` +
                `💌 Say *"send invites"* to send RSVP links to your guests!`
            )
            return
        }

        const going: string[] = []
        const notGoing: string[] = []
        const maybe: string[] = []
        const pending: string[] = []

        rsvpSnap.forEach(doc => {
            const d = doc.data()
            const name = String(d.name || 'Guest')
            const status = String(d.status || 'pending')

            if (status === 'going' || status === 'accepted') going.push(name)
            else if (status === 'not_going' || status === 'declined') notGoing.push(name)
            else if (status === 'maybe') maybe.push(name)
            else pending.push(name)
        })

        let msg = `📋 *RSVP Status — ${session.activeEventName}*\n\n`
        if (going.length) msg += `✅ *Going (${going.length}):*\n${going.map(n => `  ${n}`).join('\n')}\n\n`
        if (maybe.length) msg += `🤔 *Maybe (${maybe.length}):*\n${maybe.map(n => `  ${n}`).join('\n')}\n\n`
        if (notGoing.length) msg += `❌ *Not Going (${notGoing.length}):*\n${notGoing.map(n => `  ${n}`).join('\n')}\n\n`
        if (pending.length) msg += `⏳ *Pending (${pending.length}):*\n${pending.map(n => `  ${n}`).join('\n')}\n\n`
        msg += `Total responses: ${rsvpSnap.size}`

        await sendTextMessage(from, msg)
    } catch (err) {
        console.error('[Emcee] RSVP check error:', err)
        await sendTextMessage(from, '❌ Couldn\'t fetch RSVPs. Try again?')
    }
}

export async function handleSendInvites(from: string, session: WhatsAppSession): Promise<void> {
    if (!(await requireAccount(from, session))) return
    if (!(await requireEvent(from, session))) return

    try {
        const db = getDb()
        const doc = await db.collection('events').doc(session.activeEventId!).get()

        if (!doc.exists) {
            await sendTextMessage(from, '❌ Event not found.')
            return
        }

        const data = doc.data()!
        const joinCode = data.joinCode
        const joinUrl = `${APP_URL}/join/${joinCode}`

        await sendTextMessage(from,
            `💌 *Invite link for ${session.activeEventName}:*\n\n` +
            `${joinUrl}\n\n` +
            `Share this link with your guests — they can RSVP directly from it!\n\n` +
            `💡 *Tip:* Forward this message to your group chat, or share individually.`
        )
    } catch (err) {
        console.error('[Emcee] Send invites error:', err)
        await sendTextMessage(from, '❌ Couldn\'t generate invite link. Try again?')
    }
}

// ═══════════════════════════════════════════════════════
//  POLL ACTIONS
// ═══════════════════════════════════════════════════════

export async function handleCreatePoll(
    from: string,
    session: WhatsAppSession,
    entities: Record<string, string>
): Promise<void> {
    const question = entities.question || ''

    await updateSession(from, {
        state: 'creating_poll',
        pollSlots: question ? { question } : {},
    })

    if (question) {
        await sendTextMessage(from,
            `📊 Poll question: *${question}*\n\n` +
            `Now send me the options, one per line:\n\n` +
            `Example:\nOption 1\nOption 2\nOption 3`
        )
    } else {
        await sendTextMessage(from, '📊 What\'s your poll question?\n\nExample: *"When should we have the party?"*')
    }
}

// ═══════════════════════════════════════════════════════
//  PLAN & CHECKLIST ACTIONS
// ═══════════════════════════════════════════════════════

export async function handleGeneratePlan(from: string, session: WhatsAppSession): Promise<void> {
    if (!(await requireAccount(from, session))) return
    if (!(await requireEvent(from, session))) return

    await sendTextMessage(from, '🧠 Generating your plan... this may take a moment ✨')

    try {
        const db = getDb()
        const doc = await db.collection('events').doc(session.activeEventId!).get()
        if (!doc.exists) {
            await sendTextMessage(from, '❌ Event not found.')
            return
        }

        const event = doc.data()!

        const res = await fetch(`${APP_URL}/api/plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventType: event.eventType,
                date: event.date,
                guests: event.guests,
                location: event.location,
                theme: event.theme,
                budget: event.budget,
            }),
        })

        const data = await res.json()
        if (data.plan) {
            const plan = data.plan
            let msg = `📋 *Party Plan — ${event.eventType}*\n\n`

            if (plan.summary) msg += `${plan.summary}\n\n`

            // Timeline
            if (plan.timeline && plan.timeline.length > 0) {
                msg += `*📅 Timeline:*\n`
                for (const t of plan.timeline.slice(0, 5)) {
                    const icon = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢'
                    msg += `${icon} *${t.weeks}* — ${t.task}\n`
                }
                msg += '\n'
            }

            // Checklist preview
            if (plan.checklist && plan.checklist.length > 0) {
                msg += `*✅ Checklist (${plan.checklist.length} items):*\n`
                for (const c of plan.checklist.slice(0, 6)) {
                    msg += `⬜ ${c.item}\n`
                }
                if (plan.checklist.length > 6) msg += `  ...and ${plan.checklist.length - 6} more\n`
                msg += '\n'
            }

            // Budget
            if (plan.budget?.total) {
                msg += `*💰 Budget: ${plan.budget.total}*`
                if (plan.budget.budgetEstimated) msg += ` (AI estimated)`
                msg += '\n'
            }

            // Tips
            if (plan.tips && plan.tips.length > 0) {
                msg += `\n💡 *Tips:*\n`
                for (const tip of plan.tips.slice(0, 3)) {
                    msg += `• ${tip}\n`
                }
            }

            msg += `\n🔗 Full plan: ${APP_URL}/dashboard`

            // Save plan to event
            await db.collection('events').doc(session.activeEventId!).set({ plan: data.plan }, { merge: true })

            await sendTextMessage(from, msg)
        } else {
            await sendTextMessage(from, `❌ Couldn't generate plan: ${data.error || 'Unknown error'}`)
        }
    } catch (err) {
        console.error('[Emcee] Plan generation error:', err)
        await sendTextMessage(from, '❌ Something went wrong generating the plan. Try again?')
    }
}

export async function handleShowChecklist(from: string, session: WhatsAppSession): Promise<void> {
    if (!(await requireAccount(from, session))) return
    if (!(await requireEvent(from, session))) return

    try {
        const db = getDb()
        const doc = await db.collection('events').doc(session.activeEventId!).get()
        if (!doc.exists) {
            await sendTextMessage(from, '❌ Event not found.')
            return
        }

        const event = doc.data()!
        const checklist = event.plan?.checklist as { item: string; done: boolean; category: string }[] | undefined

        if (!checklist || checklist.length === 0) {
            await sendTextMessage(from,
                `📝 No checklist yet for *${session.activeEventName}*.\n\n` +
                `Say *"generate a plan"* to create one!`
            )
            return
        }

        const done = checklist.filter(c => c.done)
        const todo = checklist.filter(c => !c.done)

        let msg = `📝 *Checklist — ${session.activeEventName}*\n` +
            `Progress: ${done.length}/${checklist.length} complete\n\n`

        if (todo.length > 0) {
            msg += `*To Do:*\n`
            for (const c of todo) {
                msg += `⬜ ${c.item}\n`
            }
            msg += '\n'
        }

        if (done.length > 0) {
            msg += `*Done:*\n`
            for (const c of done) {
                msg += `✅ ${c.item}\n`
            }
        }

        msg += `\n🔗 Manage checklist: ${APP_URL}/dashboard`
        await sendTextMessage(from, msg)
    } catch (err) {
        console.error('[Emcee] Checklist error:', err)
        await sendTextMessage(from, '❌ Couldn\'t fetch checklist. Try again?')
    }
}

export async function handleShowBudget(from: string, session: WhatsAppSession): Promise<void> {
    if (!(await requireAccount(from, session))) return
    if (!(await requireEvent(from, session))) return

    try {
        const db = getDb()
        const doc = await db.collection('events').doc(session.activeEventId!).get()
        if (!doc.exists) {
            await sendTextMessage(from, '❌ Event not found.')
            return
        }

        const event = doc.data()!
        const budget = event.plan?.budget

        if (!budget) {
            await sendTextMessage(from,
                `💰 No budget set for *${session.activeEventName}*.\n\n` +
                `Say *"generate a plan"* to get an AI-estimated budget!`
            )
            return
        }

        let msg = `💰 *Budget — ${session.activeEventName}*\n\n`
        msg += `Total: *${budget.total}*`
        if (budget.budgetEstimated) msg += ` (AI estimated)`
        msg += '\n\n'

        if (budget.breakdown && budget.breakdown.length > 0) {
            msg += `*Breakdown:*\n`
            for (const b of budget.breakdown) {
                msg += `  ${b.category}: $${b.amount} (${b.percentage}%)\n`
            }
        }

        msg += `\n🔗 Full budget: ${APP_URL}/budget`
        await sendTextMessage(from, msg)
    } catch (err) {
        console.error('[Emcee] Budget error:', err)
        await sendTextMessage(from, '❌ Couldn\'t fetch budget. Try again?')
    }
}

// ═══════════════════════════════════════════════════════
//  VENDOR ACTIONS
// ═══════════════════════════════════════════════════════

export async function handleFindVendors(
    from: string,
    session: WhatsAppSession,
    entities: Record<string, string>
): Promise<void> {
    const vendorType = entities.vendorType || 'caterers'
    const location = entities.location || ''

    // Get location from active event if not specified
    let searchLocation = location
    if (!searchLocation && session.activeEventId && session.uid) {
        try {
            const db = getDb()
            const doc = await db.collection('events').doc(session.activeEventId).get()
            if (doc.exists) {
                searchLocation = String(doc.data()?.location || '')
            }
        } catch {
            // Fall through
        }
    }

    if (!searchLocation) {
        await sendTextMessage(from, `📍 Where should I search? Tell me a city or address.\n\nExample: *"Find DJs near Atlanta"*`)
        return
    }

    await sendTextMessage(from, `🔍 Searching for *${vendorType}* near *${searchLocation}*...`)

    try {
        const params = new URLSearchParams({
            query: `${vendorType} near ${searchLocation}`,
            type: vendorType,
        })
        if (session.activeEventId) params.set('eventId', session.activeEventId)

        const res = await fetch(`${APP_URL}/api/vendors?${params}`)
        const data = await res.json()

        if (data.results && data.results.length > 0) {
            let msg = `🏪 *${vendorType}* near ${searchLocation}:\n\n`

            for (const v of data.results.slice(0, 5)) {
                msg += `*${v.name}*\n`
                if (v.rating) msg += `⭐ ${v.rating} (${v.user_ratings_total || '?'} reviews)\n`
                if (v.formatted_address) msg += `📍 ${v.formatted_address}\n`
                if (v.price_level) msg += `💲 ${'$'.repeat(v.price_level)}\n`
                msg += '\n'
            }

            msg += `🔗 Browse all: ${APP_URL}/vendors`
            await sendTextMessage(from, msg)
        } else {
            await sendTextMessage(from, `😕 No ${vendorType} found near ${searchLocation}. Try a different search?`)
        }
    } catch (err) {
        console.error('[Emcee] Vendor search error:', err)
        await sendTextMessage(from, '❌ Couldn\'t search vendors. Try again?')
    }
}

// ═══════════════════════════════════════════════════════
//  THEME & INSPIRATION ACTIONS
// ═══════════════════════════════════════════════════════

export async function handleExploreCakes(from: string, session: WhatsAppSession): Promise<void> {
    // Get event context if available
    let theme = 'Celebration'
    let eventType = 'Party'
    let guests = '20-30'
    let budget = 'Flexible'

    if (session.activeEventId) {
        try {
            const db = getDb()
            const doc = await db.collection('events').doc(session.activeEventId).get()
            if (doc.exists) {
                const d = doc.data()!
                theme = String(d.theme || theme)
                eventType = String(d.eventType || eventType)
                guests = String(d.guests || guests)
                budget = String(d.budget || budget)
            }
        } catch { /* use defaults */ }
    }

    await sendTextMessage(from, '🎂 Generating cake ideas... one moment! ✨')

    try {
        const res = await fetch(`${APP_URL}/api/theme/cake`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme, eventType, guests, budget }),
        })

        const data = await res.json()
        if (data.concepts && data.concepts.length > 0) {
            let msg = `🎂 *Cake Concepts for your ${eventType}:*\n\n`

            for (const [i, cake] of data.concepts.entries()) {
                msg += `*${i + 1}. ${cake.emoji || '🎂'} ${cake.name}*\n`
                msg += `   ${cake.style}\n`
                msg += `   🍰 Flavors: ${(cake.flavors || []).join(', ')}\n`
                msg += `   👥 Serves: ${cake.servings}\n`
                msg += `   💰 Est: ${cake.estimatedPrice}\n\n`
            }

            msg += `💡 _Reply "refine: [your feedback]" to adjust these (e.g., "refine: make them more rustic")_`

            // Store results for refinement
            await updateSession(from, {
                state: 'exploring_theme',
                themeSlots: { category: 'cake', lastResults: data.concepts },
            })

            await sendTextMessage(from, msg)
        } else {
            await sendTextMessage(from, `❌ Couldn't generate cake ideas. ${data.error || 'Try again?'}`)
        }
    } catch (err) {
        console.error('[Emcee] Cake explore error:', err)
        await sendTextMessage(from, '❌ Something went wrong. Try again?')
    }
}

export async function handleExploreInvitations(from: string, session: WhatsAppSession): Promise<void> {
    let theme = 'Modern Elegant'
    let eventType = 'Party'
    let eventName = ''
    let date = ''
    let location = ''
    let hostName = ''

    if (session.activeEventId) {
        try {
            const db = getDb()
            const doc = await db.collection('events').doc(session.activeEventId).get()
            if (doc.exists) {
                const d = doc.data()!
                theme = String(d.theme || theme)
                eventType = String(d.eventType || eventType)
                eventName = String(d.eventType || '')
                date = String(d.date || '')
                location = String(d.location || '')
                hostName = String(d.hostName || '')
            }
        } catch { /* use defaults */ }
    }

    await sendTextMessage(from, '💌 Designing invitation cards... hold on! ✨')

    try {
        const res = await fetch(`${APP_URL}/api/theme/invitation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme, eventType, eventName, date, location, hostName }),
        })

        const data = await res.json()
        if (data.designs && data.designs.length > 0) {
            let msg = `💌 *Invitation Card Designs:*\n\n`

            for (const [i, design] of data.designs.entries()) {
                msg += `*${i + 1}. ${design.motifEmoji || '✉️'} ${design.name}*\n`
                msg += `   Style: ${design.fontFamily} • ${design.decorativeMotif}\n`
                msg += `   _"${design.headerText}"_\n`
                msg += `   ${design.bodyText.slice(0, 80)}...\n\n`
            }

            msg += `💡 _Reply "refine: [your feedback]" to adjust, or view full designs in the app._\n`
            msg += `🔗 ${APP_URL}/dashboard`

            await updateSession(from, {
                state: 'exploring_theme',
                themeSlots: { category: 'invitation', lastResults: data.designs },
            })

            await sendTextMessage(from, msg)
        } else {
            await sendTextMessage(from, `❌ Couldn't generate invitation designs. ${data.error || 'Try again?'}`)
        }
    } catch (err) {
        console.error('[Emcee] Invitation explore error:', err)
        await sendTextMessage(from, '❌ Something went wrong. Try again?')
    }
}

export async function handleExploreMoodboard(from: string, session: WhatsAppSession): Promise<void> {
    let theme = 'Modern Elegant'
    let eventType = 'Party'
    let budget = 'Flexible'

    if (session.activeEventId) {
        try {
            const db = getDb()
            const doc = await db.collection('events').doc(session.activeEventId).get()
            if (doc.exists) {
                const d = doc.data()!
                theme = String(d.theme || theme)
                eventType = String(d.eventType || eventType)
                budget = String(d.budget || budget)
            }
        } catch { /* use defaults */ }
    }

    await sendTextMessage(from, '🎨 Creating your mood board... one moment! ✨')

    try {
        const res = await fetch(`${APP_URL}/api/moodboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme, eventType, budget }),
        })

        const data = await res.json()
        if (data.title) {
            let msg = `🎨 *${data.title}*\n\n`
            msg += `✨ _${data.vibe}_\n\n`

            // Color palette
            if (data.palette && data.palette.length > 0) {
                msg += `*🎨 Color Palette:*\n`
                for (const color of data.palette) {
                    msg += `  🟡 *${color.name}* — ${color.usage}\n`
                }
                msg += '\n'
            }

            // Decor tiles
            if (data.tiles && data.tiles.length > 0) {
                msg += `*✨ Decor Ideas:*\n`
                for (const tile of data.tiles) {
                    msg += `  ${tile.emoji} *${tile.title}* — ${tile.description}\n`
                }
                msg += '\n'
            }

            // Extras
            if (data.tablescape) msg += `🍽️ *Tablescape:* ${data.tablescape}\n\n`
            if (data.lighting) msg += `💡 *Lighting:* ${data.lighting}\n\n`
            if (data.partyFavor) msg += `🎁 *Party Favor:* ${data.partyFavor}\n\n`
            if (data.hashtag) msg += `#️⃣ ${data.hashtag}\n\n`

            msg += `💡 _Reply "refine: [your feedback]" to adjust the mood board._`

            await updateSession(from, {
                state: 'exploring_theme',
                themeSlots: { category: 'moodboard', lastResults: data },
            })

            await sendTextMessage(from, msg)
        } else {
            await sendTextMessage(from, `❌ Couldn't generate mood board. Try again?`)
        }
    } catch (err) {
        console.error('[Emcee] Moodboard error:', err)
        await sendTextMessage(from, '❌ Something went wrong. Try again?')
    }
}

export async function handleRefineTheme(from: string, session: WhatsAppSession, instruction: string): Promise<void> {
    const themeSlots = session.themeSlots
    if (!themeSlots?.category || !themeSlots?.lastResults) {
        await sendTextMessage(from,
            `🤔 Nothing to refine. Try one of these first:\n` +
            `🎂 "Show me cake ideas"\n💌 "Design invitations"\n🎨 "Create a moodboard"`
        )
        return
    }

    await sendTextMessage(from, '✨ Refining based on your feedback...')

    try {
        const category = themeSlots.category
        let endpoint = ''
        let body: Record<string, unknown> = {}

        if (category === 'cake') {
            endpoint = '/api/theme/cake'
            body = { action: 'refine', currentConcepts: themeSlots.lastResults, instruction }
        } else if (category === 'invitation') {
            endpoint = '/api/theme/invitation'
            body = { action: 'refine', currentDesigns: themeSlots.lastResults, instruction }
        } else if (category === 'moodboard') {
            endpoint = '/api/moodboard'
            body = { action: 'refine', currentBoard: themeSlots.lastResults, instruction }
        }

        const res = await fetch(`${APP_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        const data = await res.json()

        // Re-route to the appropriate display handler with updated data
        if (category === 'cake' && data.concepts) {
            await updateSession(from, {
                themeSlots: { category: 'cake', lastResults: data.concepts },
            })
            let msg = `🎂 *Refined Cake Concepts:*\n\n`
            for (const [i, cake] of data.concepts.entries()) {
                msg += `*${i + 1}. ${cake.emoji || '🎂'} ${cake.name}*\n`
                msg += `   ${cake.style}\n`
                msg += `   🍰 ${(cake.flavors || []).join(', ')}\n`
                msg += `   💰 ${cake.estimatedPrice}\n\n`
            }
            msg += `💡 _Keep refining or type "cancel" to go back._`
            await sendTextMessage(from, msg)
        } else if (category === 'invitation' && data.designs) {
            await updateSession(from, {
                themeSlots: { category: 'invitation', lastResults: data.designs },
            })
            let msg = `💌 *Refined Invitation Designs:*\n\n`
            for (const [i, d] of data.designs.entries()) {
                msg += `*${i + 1}. ${d.motifEmoji || '✉️'} ${d.name}*\n`
                msg += `   _"${d.headerText}"_\n\n`
            }
            msg += `💡 _Keep refining or type "cancel" to go back._`
            await sendTextMessage(from, msg)
        } else if (category === 'moodboard' && data.title) {
            await updateSession(from, {
                themeSlots: { category: 'moodboard', lastResults: data },
            })
            let msg = `🎨 *${data.title}* (refined)\n\n✨ _${data.vibe}_\n\n`
            if (data.tiles) {
                for (const tile of data.tiles) {
                    msg += `${tile.emoji} *${tile.title}* — ${tile.description}\n`
                }
            }
            msg += `\n💡 _Keep refining or type "cancel" to go back._`
            await sendTextMessage(from, msg)
        } else {
            await sendTextMessage(from, '❌ Refinement didn\'t produce results. Try a different instruction?')
        }
    } catch (err) {
        console.error('[Emcee] Refine error:', err)
        await sendTextMessage(from, '❌ Something went wrong with the refinement. Try again?')
    }
}

// ═══════════════════════════════════════════════════════
//  HELP
// ═══════════════════════════════════════════════════════

export async function handleHelp(from: string, _session: WhatsAppSession): Promise<void> {
    await sendTextMessage(from,
        `🎤 *Emcee — Command Guide*\n\n` +
        `*🎉 Events*\n` +
        `• "Create a birthday party"\n` +
        `• "Show my events"\n` +
        `• "Switch to [event name]"\n\n` +
        `*👥 Guests & RSVPs*\n` +
        `• "Add guests: John, Sarah, Mike"\n` +
        `• "Who's coming?" / "Check RSVPs"\n` +
        `• "Send invites"\n\n` +
        `*📊 Polls*\n` +
        `• "Create a poll"\n\n` +
        `*📋 Planning*\n` +
        `• "Generate a plan"\n` +
        `• "Show my checklist"\n` +
        `• "What's my budget?"\n\n` +
        `*🎨 Theme & Inspiration*\n` +
        `• "Show me cake ideas"\n` +
        `• "Design invitations"\n` +
        `• "Create a moodboard"\n` +
        `• "Show decor ideas"\n\n` +
        `*🏪 Vendors*\n` +
        `• "Find caterers near Atlanta"\n\n` +
        `*💡 Tips:*\n` +
        `• Say *cancel* anytime to stop a flow\n` +
        `• In groups, start with *Emcee* or *@Emcee*\n` +
        `• Refine any theme result: "refine: make it rustic"`
    )
}
