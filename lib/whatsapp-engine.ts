// ═══════════════════════════════════════════════════════
//  Emcee — WhatsApp Conversation Engine
//  Classifies user intents via Gemini, manages multi-step
//  flows, and routes to action handlers.
// ═══════════════════════════════════════════════════════

import { GoogleGenerativeAI } from '@google/generative-ai'
import { sendTextMessage, sendButtons, sendList, downloadMedia, type IncomingMessage } from '@/lib/whatsapp'
import {
    getSession, updateSession, resetState, touchSession,
    type WhatsAppSession, type ConversationState
} from '@/lib/whatsapp-session'
import {
    handleCreateEvent, handleListEvents, handleSelectEvent,
    handleRenameEvent, formatEventType,
    handleAddGuests, handleCheckRsvps, handleSendInvites,
    handleCreatePoll, handleGeneratePlan, handleFindVendors,
    handleShowChecklist, handleShowBudget,
    handleExploreCakes, handleExploreInvitations, handleExploreMoodboard,
    handleRefineTheme, handleHelp
} from '@/lib/whatsapp-actions'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const EMCEE_NAME = 'Emcee'
const EMCEE_TRIGGERS = ['emcee', '@emcee', 'hey emcee', 'hi emcee']

// ── Intent Types ──────────────────────────────────────

export type Intent =
    | 'create_event'
    | 'list_events'
    | 'select_event'
    | 'rename_event'
    | 'add_guests'
    | 'check_rsvps'
    | 'send_invites'
    | 'create_poll'
    | 'generate_plan'
    | 'find_vendors'
    | 'show_checklist'
    | 'show_budget'
    | 'explore_cakes'
    | 'explore_invitations'
    | 'explore_moodboard'
    | 'explore_decor'
    | 'refine_theme'
    | 'cancel'
    | 'help'
    | 'greeting'
    | 'unknown'

interface ClassifiedIntent {
    intent: Intent
    entities: Record<string, string>  // Extracted entities (e.g., event type, guest names)
    confidence: number
}

// ── Main Message Handler ──────────────────────────────

export async function handleIncomingMessage(msg: IncomingMessage): Promise<void> {
    const { from, text, type, buttonId, listId, isGroup } = msg

    console.log(`[Emcee] Message from ${from}: type=${type}, text=${text?.slice(0, 50)}`)

    // In group chats, only respond if mentioned
    if (isGroup && text) {
        const lowerText = text.toLowerCase()
        const isMentioned = EMCEE_TRIGGERS.some(t => lowerText.includes(t))
        if (!isMentioned) return
    }

    // Get or create session — with graceful fallback
    let session: WhatsAppSession
    try {
        session = await getSession(from)
        touchSession(from).catch(() => {})  // fire-and-forget
    } catch (err) {
        console.error('[Emcee] Session error, using default:', err)
        session = {
            phoneNumber: from,
            state: 'idle',
            lastActivity: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            messageCount: 0,
        }
    }

    try {
        // Handle button/list replies as contextual responses
        if (type === 'button' && buttonId) {
            await handleButtonReply(from, session, buttonId, text || '')
            return
        }
        if (type === 'list' && listId) {
            await handleListReply(from, session, listId, text || '')
            return
        }

        // Voice messages — transcribe and process as text
        if (type === 'audio' && msg.mediaId) {
            await handleVoiceMessage(from, session, msg.mediaId, msg.mimeType || 'audio/ogg')
            return
        }

        // Non-text, non-audio messages (images, stickers, etc.)
        if (!text) {
            await sendTextMessage(from, `🎤 Hey! I'm ${EMCEE_NAME}, your party planning assistant. Send me a text or voice message — I understand both!`)
            return
        }

        // Check if user is in a multi-step flow
        if (session.state !== 'idle') {
            await handleMultiStepFlow(from, session, text)
            return
        }

        // Classify intent
        const classified = await classifyIntent(text, session)

        // Route to handler
        await routeIntent(from, session, classified, text)
    } catch (err) {
        console.error('[Emcee] Handler error:', err)
        await sendTextMessage(from, `🎤 I hit a snag processing that. Try again?`).catch(() => {})
    }
}

// ── Intent Classification via Gemini ──────────────────

async function classifyIntent(text: string, session: WhatsAppSession): Promise<ClassifiedIntent> {
    // Quick pattern matching for common commands (skip AI)
    const lower = text.toLowerCase().trim()

    // Strip Emcee prefix if present
    const cleanText = lower.replace(/^(@?emcee[,:]?\s*)/i, '').trim()

    // Fast-path pattern matching
    if (/^(hi|hey|hello|sup|yo|what'?s up)/i.test(cleanText)) {
        return { intent: 'greeting', entities: {}, confidence: 1 }
    }
    if (/^(help|commands|what can you do|menu)/i.test(cleanText)) {
        return { intent: 'help', entities: {}, confidence: 1 }
    }
    if (/^(cancel|stop|nevermind|never mind|nvm|back|quit|exit)/i.test(cleanText)) {
        return { intent: 'cancel', entities: {}, confidence: 1 }
    }
    if (/^(show|list|my)\s*(events?|parties)/i.test(cleanText)) {
        return { intent: 'list_events', entities: {}, confidence: 0.95 }
    }
    if (/^rename\s*(event|party|it)?/i.test(cleanText) || /^(call|name)\s*(it|this|the event|the party|my event|my party)/i.test(cleanText)) {
        const namePart = cleanText.replace(/^(rename|call|name)\s*(event|party|it|this|the event|the party|my event|my party)?\s*(to|as)?\s*/i, '').trim()
        return { intent: 'rename_event', entities: namePart ? { eventName: namePart } : {}, confidence: 0.95 }
    }
    if (/^(show|view|check)\s*(rsvp|who'?s coming|guest status)/i.test(cleanText)) {
        return { intent: 'check_rsvps', entities: {}, confidence: 0.95 }
    }
    if (/^(show|view|my)\s*(checklist|to.?do|tasks?)/i.test(cleanText)) {
        return { intent: 'show_checklist', entities: {}, confidence: 0.95 }
    }
    if (/^(show|view|what'?s|my)\s*(budget|spending)/i.test(cleanText)) {
        return { intent: 'show_budget', entities: {}, confidence: 0.95 }
    }
    if (/cake\s*(idea|concept|design|inspiration)/i.test(cleanText) || /^show\s*me\s*cake/i.test(cleanText)) {
        return { intent: 'explore_cakes', entities: {}, confidence: 0.95 }
    }
    if (/invitation\s*(card|design|idea|concept)/i.test(cleanText) || /^design\s*invit/i.test(cleanText)) {
        return { intent: 'explore_invitations', entities: {}, confidence: 0.95 }
    }
    if (/mood\s*board|moodboard/i.test(cleanText)) {
        return { intent: 'explore_moodboard', entities: {}, confidence: 0.95 }
    }
    if (/^(decor|decoration)\s*(idea|inspiration)/i.test(cleanText) || /^show\s*(me\s*)?decor/i.test(cleanText)) {
        return { intent: 'explore_decor', entities: {}, confidence: 0.95 }
    }

    // Use Gemini for complex/ambiguous messages
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as object,
        })

        const contextInfo = session.activeEventName
            ? `The user currently has "${session.activeEventName}" selected as their active event.`
            : 'The user has no event selected yet.'

        const prompt = `You are an intent classifier for a WhatsApp party planning bot called Emcee.
${contextInfo}

Classify the user's message into exactly one intent. Extract any relevant entities.

INTENTS:
- create_event: User wants to create/plan a new party or event. Extract: eventType, date, location, guests (count), theme, budget — any that are mentioned.
- list_events: User wants to see their events/parties.
- select_event: User wants to switch to or work with a specific event. Extract eventName if mentioned.
- rename_event: User wants to rename/change the name of their event. Extract eventName (the new name) if mentioned.
- add_guests: User wants to add guests. Extract guestNames (comma-separated) if mentioned.
- check_rsvps: User wants to check RSVP status or see who's coming.
- send_invites: User wants to send invitations or RSVP links.
- create_poll: User wants to create a poll or vote. Extract question if mentioned.
- generate_plan: User wants an AI-generated party plan, timeline, or suggestions.
- find_vendors: User wants to find vendors (caterers, DJs, etc). Extract vendorType and location if mentioned.
- show_checklist: User wants to see their to-do list or checklist.
- show_budget: User wants to see budget info.
- explore_cakes: User wants cake ideas/designs/inspiration.
- explore_invitations: User wants invitation card ideas/designs.
- explore_moodboard: User wants a mood board, color palette, or theme inspiration.
- explore_decor: User wants decoration ideas.
- refine_theme: User wants to modify/refine previously generated theme results. Extract instruction.
- help: User wants help or a list of commands.
- greeting: User is just saying hello.
- unknown: Can't determine intent.

EXAMPLES:
"Create a birthday party for April 4" => {"intent":"create_event","entities":{"eventType":"Birthday Party","date":"April 4"},"confidence":0.95}
"Plan a BBQ next Saturday at Central Park for 30 people" => {"intent":"create_event","entities":{"eventType":"BBQ","date":"next Saturday","location":"Central Park","guests":"30"},"confidence":0.95}
"Find DJs near Atlanta" => {"intent":"find_vendors","entities":{"vendorType":"DJs","location":"Atlanta"},"confidence":0.95}

User message: "${text}"

Return ONLY valid JSON, no markdown:
{"intent":"intent_name","entities":{"key":"value"},"confidence":0.9}`

        const result = await model.generateContent(prompt)
        const responseText = result.response.text()
        const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        return JSON.parse(cleaned) as ClassifiedIntent
    } catch (err) {
        console.error('[Emcee NLU] Classification error:', err)
        return { intent: 'unknown', entities: {}, confidence: 0 }
    }
}

// ── Route Intent to Action Handler ────────────────────

async function routeIntent(from: string, session: WhatsAppSession, classified: ClassifiedIntent, rawText: string): Promise<void> {
    const { intent, entities } = classified

    switch (intent) {
        case 'greeting':
            await handleGreeting(from, session)
            break
        case 'help':
            await handleHelp(from, session)
            break
        case 'cancel':
            await resetState(from)
            await sendTextMessage(from, '✅ No problem! Back to home base. What would you like to do?')
            break
        case 'create_event':
            await handleCreateEvent(from, session, entities)
            break
        case 'list_events':
            await handleListEvents(from, session)
            break
        case 'select_event':
            await handleSelectEvent(from, session, entities)
            break
        case 'rename_event':
            await handleRenameEvent(from, session, entities, rawText)
            break
        case 'add_guests':
            await handleAddGuests(from, session, entities, rawText)
            break
        case 'check_rsvps':
            await handleCheckRsvps(from, session)
            break
        case 'send_invites':
            await handleSendInvites(from, session)
            break
        case 'create_poll':
            await handleCreatePoll(from, session, entities)
            break
        case 'generate_plan':
            await handleGeneratePlan(from, session)
            break
        case 'find_vendors':
            await handleFindVendors(from, session, entities)
            break
        case 'show_checklist':
            await handleShowChecklist(from, session)
            break
        case 'show_budget':
            await handleShowBudget(from, session)
            break
        case 'explore_cakes':
            await handleExploreCakes(from, session)
            break
        case 'explore_invitations':
            await handleExploreInvitations(from, session)
            break
        case 'explore_moodboard':
        case 'explore_decor':
            await handleExploreMoodboard(from, session)
            break
        case 'refine_theme':
            await handleRefineTheme(from, session, entities.instruction || rawText)
            break
        default:
            await sendTextMessage(from,
                `🤔 I'm not sure how to help with that yet. Here's what I can do:\n\n` +
                `🎉 *Create a party* — "Plan a birthday party"\n` +
                `📋 *My events* — "Show my events"\n` +
                `🎂 *Theme ideas* — "Show me cake ideas"\n` +
                `📊 *Polls* — "Create a poll"\n` +
                `📝 *Checklist* — "Show my checklist"\n\n` +
                `For anything else, you can do more on the app or web! 👇`
            )
            await sendButtons(from,
                `Open PartyPal for the full experience:`,
                [
                    { id: 'open_app', title: '📱 Open App' },
                    { id: 'open_web', title: '🌐 Open in Browser' },
                    { id: 'get_help', title: '❓ Help' },
                ]
            )
    }
}

// ── Multi-Step Flow Handler ───────────────────────────

async function handleMultiStepFlow(from: string, session: WhatsAppSession, text: string): Promise<void> {
    const lower = text.toLowerCase().trim()

    // Allow cancellation from any state
    if (/^(cancel|stop|nevermind|back|quit|exit|nvm)/i.test(lower)) {
        await resetState(from)
        await sendTextMessage(from, '✅ Cancelled. What would you like to do instead?')
        return
    }

    switch (session.state) {
        case 'creating_event':
            await handleEventCreationStep(from, session, text)
            break
        case 'renaming_event':
            await handleRenameStep(from, session, text)
            break
        case 'creating_poll':
            await handlePollCreationStep(from, session, text)
            break
        case 'refining_theme':
            await handleRefineTheme(from, session, text)
            break
        case 'exploring_theme':
            // Check if user is refining or selecting
            if (/^(refine|change|make|modify|adjust):?\s*/i.test(lower)) {
                await handleRefineTheme(from, session, text.replace(/^(refine|change|make|modify|adjust):?\s*/i, ''))
            } else if (/^\d+$/.test(lower)) {
                // User selected a number — could be selecting a concept
                await sendTextMessage(from, `Great choice! You can refine this by saying "refine: [your feedback]" or type *cancel* to go back.`)
            } else {
                await handleRefineTheme(from, session, text)
            }
            break
        case 'awaiting_link':
            await handleAccountLinkStep(from, session, text)
            break
        default:
            await resetState(from)
            await sendTextMessage(from, `Let's start fresh. What would you like to do?`)
    }
}

// ── Event Creation Steps ──────────────────────────────

async function handleEventCreationStep(from: string, session: WhatsAppSession, text: string): Promise<void> {
    const slots = session.eventSlots || {}

    if (!slots.eventType) {
        slots.eventType = text
        await updateSession(from, { eventSlots: slots })
        await sendTextMessage(from, `🎉 *${text}* — great choice!\n\n📅 When is the party? (e.g., "March 25" or "next Saturday")`)
        return
    }

    if (!slots.date) {
        slots.date = text
        await updateSession(from, { eventSlots: slots })
        await sendTextMessage(from, `📅 Got it — *${text}*\n\n👥 How many guests are you expecting?`)
        return
    }

    if (!slots.guests) {
        slots.guests = text
        await updateSession(from, { eventSlots: slots })
        await sendTextMessage(from, `👥 *${text} guests*\n\n📍 Where will it be? (address, venue name, or city)`)
        return
    }

    if (!slots.location) {
        slots.location = text
        await updateSession(from, { eventSlots: slots })
        await sendButtons(from,
            `📍 *${text}*\n\nWant to add a theme or budget? Or should I create the event now?`,
            [
                { id: 'event_create_now', title: 'Create now ✨' },
                { id: 'event_add_theme', title: 'Add theme' },
                { id: 'event_add_budget', title: 'Add budget' },
            ]
        )
        return
    }

    if (!slots.theme) {
        slots.theme = text
        await updateSession(from, { eventSlots: slots })
        await sendButtons(from,
            `🎨 Theme: *${text}*\n\nAdd a budget or create the event?`,
            [
                { id: 'event_create_now', title: 'Create now ✨' },
                { id: 'event_add_budget', title: 'Add budget' },
            ]
        )
        return
    }

    if (!slots.budget) {
        slots.budget = text
        await updateSession(from, { eventSlots: slots })
        await handleCreateEvent(from, session, {}, true)
        return
    }
}

// ── Poll Creation Steps ───────────────────────────────

async function handlePollCreationStep(from: string, session: WhatsAppSession, text: string): Promise<void> {
    const slots = session.pollSlots || {}

    if (!slots.question) {
        slots.question = text
        await updateSession(from, { pollSlots: slots })
        await sendTextMessage(from,
            `📊 Poll question: *${text}*\n\n` +
            `Now send me the options, one per line. For example:\n` +
            `Saturday 3pm\nSunday 5pm\nNext Friday 7pm\n\n` +
            `When you're done, I'll create the poll!`
        )
        return
    }

    if (!slots.options || slots.options.length === 0) {
        // Parse options from multi-line text
        const options = text.split('\n').map(o => o.trim()).filter(o => o.length > 0)
        if (options.length < 2) {
            await sendTextMessage(from, `I need at least 2 options. Send them one per line:`)
            return
        }

        slots.options = options
        await updateSession(from, { pollSlots: slots })

        // Confirm and create
        const optionsList = options.map((o, i) => `  ${i + 1}. ${o}`).join('\n')
        await sendButtons(from,
            `📊 *${slots.question}*\n\n${optionsList}\n\nLook good?`,
            [
                { id: 'poll_create_confirm', title: 'Create poll ✅' },
                { id: 'poll_redo_options', title: 'Redo options' },
            ]
        )
        return
    }
}

// ── Account Link Step ─────────────────────────────────

async function handleAccountLinkStep(from: string, session: WhatsAppSession, text: string): Promise<void> {
    // In the MVP, we'll use email-based lookup
    const email = text.trim().toLowerCase()
    if (!email.includes('@')) {
        await sendTextMessage(from, `That doesn't look like an email. Please enter the email you used to sign up for PartyPal:`)
        return
    }

    // Look up user by email in Firestore
    try {
        const { getDb } = await import('@/lib/firebase')
        const db = getDb()
        const snapshot = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get()

        if (snapshot.empty) {
            await sendTextMessage(from,
                `😕 I couldn't find a PartyPal account with that email.\n\n` +
                `Make sure you're using the same email you signed up with at partypal.social. Or type *cancel* to skip linking.`
            )
            return
        }

        const userData = snapshot.docs[0].data()
        const uid = snapshot.docs[0].id
        const { linkAccount } = await import('@/lib/whatsapp-session')
        await linkAccount(from, uid, userData.displayName || undefined)

        await sendTextMessage(from,
            `✅ Account linked! Welcome, *${userData.displayName || 'friend'}*! 🎉\n\n` +
            `Your PartyPal events are now accessible here. What would you like to do?\n\n` +
            `🎉 Plan a new party\n📋 Show my events\n📝 Help`
        )
    } catch (err) {
        console.error('[Emcee] Link error:', err)
        await sendTextMessage(from, `Something went wrong. Try again or type *cancel* to skip.`)
    }
}

// ── Button Reply Handler ──────────────────────────────

async function handleButtonReply(from: string, session: WhatsAppSession, buttonId: string, _text: string): Promise<void> {
    switch (buttonId) {
        case 'event_create_now':
            await handleCreateEvent(from, session, {}, true)
            break
        case 'event_add_theme':
            await sendTextMessage(from, '🎨 What theme do you have in mind? (e.g., "Tropical", "Rustic", "Neon Glow")')
            break
        case 'event_add_budget':
            await sendTextMessage(from, '💰 What\'s your budget? (e.g., "$500" or "$2,000")')
            break
        case 'poll_create_confirm':
            await finalizePollCreation(from, session)
            break
        case 'poll_redo_options':
            if (session.pollSlots) {
                await updateSession(from, { pollSlots: { question: session.pollSlots.question } })
            }
            await sendTextMessage(from, 'No problem! Send me the new options, one per line:')
            break
        case 'link_yes':
            await updateSession(from, { state: 'awaiting_link' })
            await sendTextMessage(from, '📧 Enter the email you used to sign up for PartyPal:')
            break
        case 'link_skip':
            await updateSession(from, { state: 'idle' })
            await sendTextMessage(from,
                `No problem! You can link anytime by saying "link my account".\n\n` +
                `For now, what would you like to do?\n🎉 Plan a party\n📝 Help`
            )
            break
        case 'rename_event_yes':
            await updateSession(from, { state: 'renaming_event' })
            await sendTextMessage(from,
                `✏️ What would you like to call your event?\n\n` +
                `Type a name like:\n_"Sarah's 30th Birthday Bash"_\n_"Summer BBQ 2026"_`
            )
            break
        case 'rename_event_skip':
            await resetState(from)
            await sendTextMessage(from,
                `👍 No problem! You can rename it later by saying *"rename event"*.\n\n` +
                `What's next?\n📝 Generate a plan\n👥 Add guests\n🎂 Explore cake ideas`
            )
            break
        case 'open_app':
            await sendTextMessage(from,
                `📱 *Open PartyPal on your phone:*\n\n` +
                `If you have the app installed, tap here:\n` +
                `https://partypal.social/app\n\n` +
                `Don't have it yet? Download it:\n` +
                `🍎 iOS: https://apps.apple.com/us/app/partypal-ai-party-planner/id6759846460\n` +
                `🤖 Android: Coming soon!`
            )
            break
        case 'open_web':
            await sendTextMessage(from,
                `🌐 *Open PartyPal in your browser:*\n\n` +
                `https://partypal.social/dashboard\n\n` +
                `You can manage events, view plans, customize themes, and more from the full web experience!`
            )
            break
        case 'get_help':
            await handleHelp(from, session)
            break
        default:
            await sendTextMessage(from, `Got your selection. What would you like to do next?`)
    }
}

// ── List Reply Handler ────────────────────────────────

async function handleListReply(from: string, session: WhatsAppSession, listId: string, text: string): Promise<void> {
    // List IDs are formatted as "event_{eventId}" or "action_{actionName}"
    if (listId.startsWith('event_')) {
        const eventId = listId.replace('event_', '')
        const { setActiveEvent } = await import('@/lib/whatsapp-session')
        await setActiveEvent(from, eventId, text)
        await sendTextMessage(from,
            `✅ Switched to *${text}*\n\n` +
            `What would you like to do with this event?\n` +
            `👥 Check RSVPs\n📋 View checklist\n💰 Budget\n🎂 Cake ideas\n💌 Design invitations\n📊 Create poll`
        )
    }
}

// ── Rename Step Handler ───────────────────────────────

async function handleRenameStep(from: string, session: WhatsAppSession, text: string): Promise<void> {
    const newName = text.trim()
    if (!newName) {
        await sendTextMessage(from, '✏️ Please type a name for your event:')
        return
    }
    // Use doRename from whatsapp-actions via direct API call
    const formattedName = formatEventType(newName)
    try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://partypal.social'}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventId: session.activeEventId,
                eventType: formattedName,
            }),
        })
        const { setActiveEvent } = await import('@/lib/whatsapp-session')
        await setActiveEvent(from, session.activeEventId!, formattedName)
        await resetState(from)
        await sendTextMessage(from,
            `✅ Event renamed to *${formattedName}*\n\n` +
            `This will show up on invites and your dashboard. What's next?\n` +
            `📝 Generate a plan\n👥 Add guests\n🎂 Explore cake ideas`
        )
    } catch (err) {
        console.error('[Emcee] Rename step error:', err)
        await sendTextMessage(from, '❌ Couldn\'t rename the event. Try again?')
    }
}

// ── Greeting Handler ──────────────────────────────────

async function handleGreeting(from: string, session: WhatsAppSession): Promise<void> {
    if (!session.uid) {
        // New user — send simple text greeting first (more reliable than buttons)
        await sendTextMessage(from,
            `🎤 Hey there! I'm *${EMCEE_NAME}*, your AI party planning assistant from PartyPal!\n\n` +
            `I can help you:\n` +
            `🎉 Create & manage parties\n` +
            `📊 Run polls for your guests\n` +
            `🎂 Generate cake, decor & invite ideas\n` +
            `💌 Send RSVP invitations\n` +
            `📝 Track your party checklist\n\n` +
            `To link your PartyPal account, say *"link account"*\n` +
            `Or just start with *"create a party"* or *"help"*!`
        )
    } else {
        const name = session.displayName ? `, ${session.displayName.split(' ')[0]}` : ''
        const eventNote = session.activeEventName
            ? `\n\n📌 Working on: *${session.activeEventName}*`
            : ''
        await sendTextMessage(from,
            `🎤 Hey${name}! Welcome back to ${EMCEE_NAME}!${eventNote}\n\n` +
            `What can I help with today? 🎉`
        )
    }
}

// ── Finalize Poll Creation ────────────────────────────

async function finalizePollCreation(from: string, session: WhatsAppSession): Promise<void> {
    const slots = session.pollSlots
    if (!slots?.question || !slots?.options || slots.options.length < 2) {
        await sendTextMessage(from, 'Something went wrong. Let\'s start over — what\'s your poll question?')
        await updateSession(from, { state: 'creating_poll', pollSlots: {} })
        return
    }

    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://partypal.social'}/api/polls`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: slots.question,
                options: slots.options,
                eventId: session.activeEventId || null,
                creatorName: session.displayName || 'Host',
            }),
        })

        const data = await res.json()
        if (data.poll) {
            const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://partypal.social'}/poll/${data.poll.id}`
            await resetState(from)
            await sendTextMessage(from,
                `✅ Poll created!\n\n` +
                `📊 *${slots.question}*\n\n` +
                `Share this link for people to vote:\n${shareUrl}\n\n` +
                `You can share it in your group chat or send it to guests directly!`
            )
        } else {
            await sendTextMessage(from, `❌ Failed to create poll: ${data.error || 'Unknown error'}`)
        }
    } catch (err) {
        console.error('[Emcee] Poll creation error:', err)
        await sendTextMessage(from, '❌ Something went wrong creating the poll. Try again?')
    }
    await resetState(from)
}

// ── Voice Message Handler ─────────────────────────────
// Downloads audio from WhatsApp, transcribes with Gemini,
// shows the user their transcript, then processes as text.

async function handleVoiceMessage(
    from: string,
    session: WhatsAppSession,
    mediaId: string,
    mimeType: string
): Promise<void> {
    console.log(`[Emcee] Voice message from ${from}, mediaId=${mediaId}, mime=${mimeType}`)

    try {
        // Step 1: Download audio
        const media = await downloadMedia(mediaId)
        if (!media) {
            await sendTextMessage(from, `🎤 I received your voice message but couldn't download it. Could you try again or type your message instead?`)
            return
        }

        console.log(`[Emcee] Audio downloaded: ${media.data.length} bytes, type=${media.mimeType}`)

        // Step 2: Transcribe with Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as object })
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: media.mimeType,
                    data: media.data.toString('base64'),
                },
            },
            'Transcribe this audio message exactly as spoken. Return ONLY the transcribed text, nothing else. If it is unclear, do your best to transcribe it. If completely inaudible, reply with "[inaudible]".',
        ])

        const transcript = result.response.text().trim()
        console.log(`[Emcee] Transcript: ${transcript.slice(0, 100)}`)

        if (!transcript || transcript === '[inaudible]') {
            await sendTextMessage(from, `🎤 I couldn't make out your voice message. Could you try again or type your message instead?`)
            return
        }

        // Step 3: Show transcript to user (like Wispr Flow)
        await sendTextMessage(from, `🎤 *I heard:*\n_"${transcript}"_`)

        // Step 4: Process transcript through the normal text pipeline

        // Re-enter the handler as if it were a text message
        if (session.state !== 'idle') {
            await handleMultiStepFlow(from, session, transcript)
        } else {
            const classified = await classifyIntent(transcript, session)
            console.log(`[Emcee] Voice intent: ${classified.intent} (${classified.confidence})`)
            await routeIntent(from, session, classified, transcript)
        }
    } catch (err) {
        console.error('[Emcee] Voice transcription error:', err)
        await sendTextMessage(from, `🎤 Something went wrong processing your voice message. Could you type it instead?`)
    }
}
