// ═══════════════════════════════════════════════════════
//  PartyPal Email Templates
//  Professional HTML email templates for all scenarios
// ═══════════════════════════════════════════════════════

const BRAND = {
    navy: '#1a2535',
    darkNavy: '#2D4059',
    teal: '#4AADA8',
    green: '#3D8C6E',
    coral: '#E8896A',
    yellow: '#F7C948',
    purple: '#7B5EA7',
    lightBg: '#f7f8fa',
    border: '#e2e6ea',
    textDark: '#2D4059',
    textMuted: '#6b7c93',
    textLight: '#9aabbb',
}

// ── Base Layout ───────────────────────────────────────
function baseLayout(content: string, footerExtra?: string): string {
    return `
<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; background:#f0f2f5; font-family:'Segoe UI',Roboto,Arial,sans-serif; }
  a { color: ${BRAND.teal}; }
  .btn { display:inline-block; padding:14px 32px; border-radius:12px; text-decoration:none; font-weight:800; font-size:15px; text-align:center; }
  .btn-primary { background:linear-gradient(135deg,${BRAND.teal},${BRAND.green}); color:#fff !important; }
  .btn-yellow { background:${BRAND.yellow}; color:${BRAND.navy} !important; }
  .btn-coral { background:${BRAND.coral}; color:#fff !important; }
</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
${content}
</table>
<!-- Footer -->
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:20px 32px;text-align:center;">
    <p style="color:${BRAND.textLight};font-size:12px;margin:0 0 6px;font-weight:600;">
        🎈 Sent via <strong style="color:${BRAND.yellow};">PartyPal</strong> — Your AI Party Planner
    </p>
    ${footerExtra || ''}
    <p style="color:${BRAND.textLight};font-size:11px;margin:8px 0 0;">
        <a href="https://partypal.social" style="color:${BRAND.textLight};text-decoration:underline;">partypal.social</a>
    </p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

// ── Header Block ──────────────────────────────────────
function headerBlock(emoji: string, title: string, subtitle?: string, bgColor?: string): string {
    return `
<tr><td style="background:${bgColor || `linear-gradient(135deg,${BRAND.navy},${BRAND.darkNavy})`};padding:32px;text-align:center;">
    <div style="font-size:32px;margin-bottom:8px;">${emoji}</div>
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 6px;font-family:'Segoe UI',Roboto,Arial,sans-serif;">${title}</h1>
    ${subtitle ? `<p style="color:rgba(255,255,255,0.65);font-size:14px;margin:0;font-weight:600;">${subtitle}</p>` : ''}
</td></tr>`
}

// ── Body Wrapper ──────────────────────────────────────
function bodyWrap(content: string): string {
    return `<tr><td style="padding:28px 32px;">${content}</td></tr>`
}

// ── Info Box ──────────────────────────────────────────
function infoBox(title: string, items: string[], color?: string): string {
    const c = color || BRAND.teal
    return `
<div style="background:${c}0F;border:1.5px solid ${c}26;border-radius:14px;padding:18px 22px;margin:18px 0;">
    <h3 style="font-size:12px;font-weight:800;color:${c};margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">${title}</h3>
    ${items.map(item => `<p style="margin:0 0 6px;font-size:14px;color:${BRAND.textDark};font-weight:600;">${item}</p>`).join('')}
</div>`
}

// ── Divider ───────────────────────────────────────────
function divider(): string {
    return `<div style="height:1px;background:${BRAND.border};margin:20px 0;"></div>`
}


// ═══════════════════════════════════════════════════════
//  1. INVITATION EMAIL
//  Sent when host shares event invites
// ═══════════════════════════════════════════════════════
export function invitationEmail(params: {
    guestName: string
    hostName: string
    eventName: string
    eventDate: string
    eventTime?: string
    eventLocation: string
    eventTheme?: string
    inviteMessage?: string
    rsvpLink: string
    coverPhoto?: string
}): string {
    const { guestName, hostName, eventName, eventDate, eventTime, eventLocation, eventTheme, inviteMessage, rsvpLink, coverPhoto } = params

    const headerBg = coverPhoto
        ? `background:url('${coverPhoto}') center/cover;position:relative;`
        : `background:linear-gradient(135deg,${BRAND.navy},${BRAND.darkNavy});`

    const headerContent = `
<tr><td style="${headerBg}padding:40px 32px;text-align:center;">
    ${coverPhoto ? `<div style="position:absolute;inset:0;background:rgba(26,37,53,0.65);border-radius:20px 20px 0 0;"></div>` : ''}
    <div style="position:relative;z-index:1;">
        <div style="font-size:36px;margin-bottom:6px;">🎉</div>
        <h1 style="color:#fff;font-size:24px;font-weight:800;margin:0 0 4px;">${eventName}</h1>
        <p style="color:rgba(255,255,255,0.75);font-size:14px;margin:0;font-weight:600;">You're Invited!</p>
    </div>
</td></tr>`

    return baseLayout(`
${headerContent}
${bodyWrap(`
    <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${guestName}</strong> 👋
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        <strong>${hostName}</strong> has invited you to <strong>${eventName}</strong>! We'd love to see you there.
    </p>
    ${inviteMessage ? `
    <div style="background:${BRAND.lightBg};border-left:4px solid ${BRAND.yellow};border-radius:0 12px 12px 0;padding:16px 20px;margin:0 0 20px;">
        <p style="color:${BRAND.textDark};font-size:14px;line-height:1.6;margin:0;font-style:italic;">${inviteMessage.replace(/\n/g, '<br>')}</p>
    </div>` : ''}
    ${infoBox('📌 Event Details', [
        `📅 ${eventDate}${eventTime ? ` at ${eventTime}` : ''}`,
        `📍 ${eventLocation}`,
        ...(eventTheme ? [`🎨 Theme: ${eventTheme}`] : []),
    ])}
    <div style="text-align:center;margin:28px 0 8px;">
        <a href="${rsvpLink}" class="btn btn-yellow" style="display:inline-block;padding:16px 48px;border-radius:14px;text-decoration:none;font-weight:800;font-size:16px;background:${BRAND.yellow};color:${BRAND.navy};">
            RSVP Now →
        </a>
    </div>
    <p style="text-align:center;color:${BRAND.textLight};font-size:12px;margin:8px 0 0;font-weight:600;">
        Tap the button above to let us know if you can make it
    </p>
`)}`,
        `<p style="color:${BRAND.textLight};font-size:11px;margin:4px 0 0;">If you didn't expect this invite, you can safely ignore it.</p>`
    )
}


// ═══════════════════════════════════════════════════════
//  2. RSVP CONFIRMATION EMAIL
//  Sent to guest after they RSVP
// ═══════════════════════════════════════════════════════
export function rsvpConfirmationEmail(params: {
    guestName: string
    eventName: string
    eventDate: string
    eventTime?: string
    eventLocation: string
    response: 'going' | 'maybe' | 'declined'
    additionalGuests?: number
    rsvpLink: string
}): string {
    const { guestName, eventName, eventDate, eventTime, eventLocation, response, additionalGuests, rsvpLink } = params

    const statusMap = {
        going: { emoji: '🎉', title: 'You\'re Going!', color: BRAND.green, text: 'We can\'t wait to see you there!' },
        maybe: { emoji: '🤔', title: 'Tentatively Going', color: BRAND.yellow, text: 'We hope you can make it! Update your RSVP anytime.' },
        declined: { emoji: '😢', title: 'We\'ll Miss You', color: BRAND.coral, text: 'We understand. If plans change, you can always update your RSVP.' },
    }
    const status = statusMap[response]

    return baseLayout(`
${headerBlock(status.emoji, status.title, eventName, `linear-gradient(135deg,${status.color},${status.color}dd)`)}
${bodyWrap(`
    <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${guestName}</strong>,
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        ${status.text}
    </p>
    <!-- RSVP Summary -->
    <div style="background:${BRAND.lightBg};border-radius:14px;padding:18px 22px;margin:0 0 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td style="padding:6px 0;font-size:13px;font-weight:800;color:${BRAND.textLight};text-transform:uppercase;letter-spacing:0.5px;">Your RSVP</td>
                <td style="padding:6px 0;font-size:14px;font-weight:800;color:${status.color};text-align:right;text-transform:capitalize;">${response}</td>
            </tr>
            ${additionalGuests ? `<tr>
                <td style="padding:6px 0;font-size:13px;font-weight:800;color:${BRAND.textLight};">Additional Guests</td>
                <td style="padding:6px 0;font-size:14px;font-weight:800;color:${BRAND.textDark};text-align:right;">+${additionalGuests}</td>
            </tr>` : ''}
        </table>
    </div>
    ${infoBox('📌 Event Details', [
        `📅 ${eventDate}${eventTime ? ` at ${eventTime}` : ''}`,
        `📍 ${eventLocation}`,
    ])}
    <div style="text-align:center;margin:24px 0 8px;">
        <a href="${rsvpLink}" class="btn btn-primary" style="display:inline-block;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px;background:linear-gradient(135deg,${BRAND.teal},${BRAND.green});color:#fff;">
            Update RSVP →
        </a>
    </div>
`)}`)
}


// ═══════════════════════════════════════════════════════
//  3. HOST RSVP NOTIFICATION
//  Sent to host when a guest RSVPs
// ═══════════════════════════════════════════════════════
export function hostRsvpNotificationEmail(params: {
    hostName: string
    guestName: string
    eventName: string
    response: 'going' | 'maybe' | 'declined'
    additionalGuests?: number
    dietary?: string
    totalGoing: number
    totalGuests: number
    dashboardLink: string
}): string {
    const { hostName, guestName, eventName, response, additionalGuests, dietary, totalGoing, totalGuests, dashboardLink } = params

    const statusEmoji = { going: '✅', maybe: '🤔', declined: '❌' }
    const statusLabel = { going: 'Going', maybe: 'Maybe', declined: 'Declined' }
    const statusColor = { going: BRAND.green, maybe: BRAND.yellow, declined: BRAND.coral }

    return baseLayout(`
${headerBlock('📬', 'New RSVP Response', eventName)}
${bodyWrap(`
    <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${hostName}</strong>,
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        <strong>${guestName}</strong> has responded to your event invitation.
    </p>
    <!-- Response Card -->
    <div style="border:2px solid ${statusColor[response]}33;border-radius:14px;padding:20px 22px;margin:0 0 20px;text-align:center;">
        <div style="font-size:28px;margin-bottom:6px;">${statusEmoji[response]}</div>
        <div style="font-size:18px;font-weight:800;color:${statusColor[response]};">${guestName} is ${statusLabel[response]}</div>
        ${additionalGuests ? `<div style="font-size:13px;color:${BRAND.textLight};font-weight:700;margin-top:4px;">+${additionalGuests} additional guest${additionalGuests !== 1 ? 's' : ''}</div>` : ''}
        ${dietary && dietary !== 'None' ? `<div style="font-size:12px;color:${BRAND.textLight};font-weight:700;margin-top:4px;">🍽️ Dietary: ${dietary}</div>` : ''}
    </div>
    <!-- Running Tally -->
    <div style="background:${BRAND.lightBg};border-radius:14px;padding:16px 22px;margin:0 0 20px;">
        <div style="font-size:12px;font-weight:800;color:${BRAND.textLight};margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Current RSVP Status</div>
        <div style="display:flex;justify-content:space-between;">
            <div style="text-align:center;">
                <div style="font-size:24px;font-weight:800;color:${BRAND.green};">${totalGoing}</div>
                <div style="font-size:11px;font-weight:800;color:${BRAND.textLight};text-transform:uppercase;">Going</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:24px;font-weight:800;color:${BRAND.textDark};">${totalGuests}</div>
                <div style="font-size:11px;font-weight:800;color:${BRAND.textLight};text-transform:uppercase;">Total Invited</div>
            </div>
        </div>
    </div>
    <div style="text-align:center;margin:20px 0 8px;">
        <a href="${dashboardLink}" class="btn btn-primary" style="display:inline-block;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px;background:linear-gradient(135deg,${BRAND.teal},${BRAND.green});color:#fff;">
            View Dashboard →
        </a>
    </div>
`)}`)
}


// ═══════════════════════════════════════════════════════
//  4. EVENT UPDATE NOTIFICATION
//  Sent when host changes event details
// ═══════════════════════════════════════════════════════
export function eventUpdateEmail(params: {
    guestName: string
    hostName: string
    eventName: string
    changes: { field: string; oldValue: string; newValue: string }[]
    eventDate: string
    eventLocation: string
    eventTheme?: string
}): string {
    const { guestName, hostName, eventName, changes, eventDate, eventLocation, eventTheme } = params

    const changeRows = changes.map(c => `
<tr>
    <td style="padding:12px 16px;font-weight:700;color:${BRAND.textDark};font-size:14px;border-bottom:1px solid ${BRAND.lightBg};width:100px;">${c.field}</td>
    <td style="padding:12px 16px;color:${BRAND.textLight};font-size:13px;border-bottom:1px solid ${BRAND.lightBg};text-decoration:line-through;">${c.oldValue}</td>
    <td style="padding:12px 16px;font-weight:700;color:${BRAND.teal};font-size:14px;border-bottom:1px solid ${BRAND.lightBg};">${c.newValue}</td>
</tr>`).join('')

    return baseLayout(`
${headerBlock('📋', 'Event Update', eventName)}
${bodyWrap(`
    <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${guestName}</strong> 👋
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 22px;">
        <strong>${hostName}</strong> has updated some details for <strong>${eventName}</strong>. Here's what changed:
    </p>
    <!-- Changes Table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid ${BRAND.border};border-radius:12px;overflow:hidden;margin-bottom:22px;">
        <tr style="background:${BRAND.lightBg};">
            <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:800;color:${BRAND.textLight};text-transform:uppercase;letter-spacing:0.5px;">Detail</th>
            <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:800;color:${BRAND.textLight};text-transform:uppercase;letter-spacing:0.5px;">Before</th>
            <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:800;color:${BRAND.textLight};text-transform:uppercase;letter-spacing:0.5px;">Updated</th>
        </tr>
        ${changeRows}
    </table>
    ${infoBox('📌 Current Event Details', [
        `📅 ${eventDate}`,
        `📍 ${eventLocation}`,
        ...(eventTheme ? [`🎨 Theme: ${eventTheme}`] : []),
    ])}
    <p style="color:${BRAND.textMuted};font-size:13px;line-height:1.5;margin:16px 0 0;">
        If you have any questions, reach out to your host. We look forward to seeing you! 🎉
    </p>
`)}`)
}


// ═══════════════════════════════════════════════════════
//  5. EVENT REMINDER EMAIL
//  Sent X days before the event
// ═══════════════════════════════════════════════════════
export function eventReminderEmail(params: {
    guestName: string
    eventName: string
    eventDate: string
    eventTime?: string
    eventLocation: string
    eventTheme?: string
    daysUntil: number
    rsvpStatus?: string
    rsvpLink: string
}): string {
    const { guestName, eventName, eventDate, eventTime, eventLocation, eventTheme, daysUntil, rsvpStatus, rsvpLink } = params

    const urgency = daysUntil <= 1 ? '🔥' : daysUntil <= 3 ? '⏰' : '📅'
    const timeText = daysUntil === 0 ? "Today's the day!" : daysUntil === 1 ? "Tomorrow!" : `${daysUntil} days away`

    return baseLayout(`
${headerBlock(urgency, timeText, eventName, `linear-gradient(135deg,${BRAND.coral},${BRAND.yellow})`)}
${bodyWrap(`
    <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${guestName}</strong>,
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        Just a friendly reminder that <strong>${eventName}</strong> is <strong>${timeText.toLowerCase()}</strong>!
        ${rsvpStatus === 'pending' ? "We'd love to hear if you can make it." : rsvpStatus === 'going' ? 'We can\'t wait to see you!' : ''}
    </p>
    ${infoBox('📌 Event Details', [
        `📅 ${eventDate}${eventTime ? ` at ${eventTime}` : ''}`,
        `📍 ${eventLocation}`,
        ...(eventTheme ? [`🎨 Theme: ${eventTheme}`] : []),
    ])}
    ${rsvpStatus === 'pending' ? `
    <div style="text-align:center;margin:24px 0 8px;">
        <a href="${rsvpLink}" class="btn btn-yellow" style="display:inline-block;padding:14px 40px;border-radius:12px;text-decoration:none;font-weight:800;font-size:15px;background:${BRAND.yellow};color:${BRAND.navy};">
            RSVP Now →
        </a>
    </div>` : `
    <div style="text-align:center;margin:24px 0 8px;">
        <a href="${rsvpLink}" class="btn btn-primary" style="display:inline-block;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px;background:linear-gradient(135deg,${BRAND.teal},${BRAND.green});color:#fff;">
            View Event →
        </a>
    </div>`}
`)}`)
}


// ═══════════════════════════════════════════════════════
//  6. WELCOME EMAIL
//  Sent when user signs up
// ═══════════════════════════════════════════════════════
export function welcomeEmail(params: {
    userName: string
    dashboardLink: string
}): string {
    const { userName, dashboardLink } = params

    return baseLayout(`
${headerBlock('🎈', `Welcome to PartyPal!`, 'Your AI-powered party planning starts here')}
${bodyWrap(`
    <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${userName}</strong> 👋
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        Welcome aboard! PartyPal is your AI-powered party planning assistant that helps you plan unforgettable events.
    </p>
    <!-- Feature Cards -->
    <div style="margin:0 0 20px;">
        ${[
            { emoji: '✨', title: 'AI-Powered Planning', desc: 'Generate personalized party plans, timelines, and checklists in seconds' },
            { emoji: '🏪', title: 'Vendor Marketplace', desc: 'Browse and shortlist the best venues, caterers, DJs, and more near you' },
            { emoji: '📧', title: 'Smart Invitations', desc: 'Create beautiful invites with AI, track RSVPs, and manage your guest list' },
            { emoji: '💰', title: 'Budget Manager', desc: 'Set budgets, track spending, and get smart allocation tips' },
        ].map(f => `
        <div style="display:flex;gap:14px;padding:14px;background:${BRAND.lightBg};border-radius:12px;margin-bottom:8px;">
            <div style="font-size:24px;flex-shrink:0;">${f.emoji}</div>
            <div>
                <div style="font-size:14px;font-weight:800;color:${BRAND.textDark};margin-bottom:2px;">${f.title}</div>
                <div style="font-size:13px;color:${BRAND.textMuted};line-height:1.4;">${f.desc}</div>
            </div>
        </div>`).join('')}
    </div>
    <div style="text-align:center;margin:28px 0 8px;">
        <a href="${dashboardLink}" class="btn btn-yellow" style="display:inline-block;padding:16px 48px;border-radius:14px;text-decoration:none;font-weight:800;font-size:16px;background:${BRAND.yellow};color:${BRAND.navy};">
            Start Planning 🎉
        </a>
    </div>
`)}`)
}


// ═══════════════════════════════════════════════════════
//  7. THANK YOU / POST-EVENT EMAIL
//  Sent after the event date
// ═══════════════════════════════════════════════════════
export function postEventEmail(params: {
    guestName: string
    hostName: string
    eventName: string
    eventDate: string
    feedbackLink?: string
}): string {
    const { guestName, hostName, eventName, eventDate, feedbackLink } = params

    return baseLayout(`
${headerBlock('🥳', 'Thanks for Celebrating!', eventName, `linear-gradient(135deg,${BRAND.purple},${BRAND.teal})`)}
${bodyWrap(`
    <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${guestName}</strong>,
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        Thank you so much for being part of <strong>${eventName}</strong> on ${eventDate}! <strong>${hostName}</strong> truly appreciated you being there. 🙏
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        We hope you had an amazing time! If you'd like to share your experience or leave a note for the host, tap the button below.
    </p>
    ${feedbackLink ? `
    <div style="text-align:center;margin:24px 0 8px;">
        <a href="${feedbackLink}" class="btn btn-primary" style="display:inline-block;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px;background:linear-gradient(135deg,${BRAND.teal},${BRAND.green});color:#fff;">
            Share Your Experience →
        </a>
    </div>` : ''}
    <p style="text-align:center;color:${BRAND.textMuted};font-size:14px;margin:24px 0 0;">
        Planning your own event? 🎈
    </p>
    <div style="text-align:center;margin:8px 0;">
        <a href="https://partypal.social" style="color:${BRAND.teal};font-weight:800;font-size:14px;text-decoration:underline;">Start planning with PartyPal →</a>
    </div>
`)}`)
}


// ═══════════════════════════════════════════════════════
//  8. COLLABORATOR INVITE EMAIL
//  Sent when host invites a collaborator to help plan
// ═══════════════════════════════════════════════════════
export function collaboratorInviteEmail(params: {
    collaboratorName: string
    hostName: string
    eventName: string
    role: string
    acceptLink: string
}): string {
    const { collaboratorName, hostName, eventName, role, acceptLink } = params

    return baseLayout(`
${headerBlock('🤝', 'You\'re Invited to Co-Plan!', eventName)}
${bodyWrap(`
    <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${collaboratorName}</strong>,
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        <strong>${hostName}</strong> wants your help planning <strong>${eventName}</strong>! You've been invited as a <strong>${role}</strong>.
    </p>
    ${infoBox('👤 Your Role', [
        `Role: ${role}`,
        role === 'Editor' ? '✏️ You can edit event details, vendors, and timeline' : '👁️ You can view all event details and progress',
    ])}
    <div style="text-align:center;margin:28px 0 8px;">
        <a href="${acceptLink}" class="btn btn-yellow" style="display:inline-block;padding:16px 44px;border-radius:14px;text-decoration:none;font-weight:800;font-size:15px;background:${BRAND.yellow};color:${BRAND.navy};">
            Accept Invite →
        </a>
    </div>
`)}`)
}


// ═══════════════════════════════════════════════════════
//  9. SUPPORT CONFIRMATION EMAIL
//  Auto-reply when user contacts support
// ═══════════════════════════════════════════════════════
export function supportConfirmationEmail(params: {
    userName: string
    ticketSubject: string
    ticketId: string
}): string {
    const { userName, ticketSubject, ticketId } = params

    return baseLayout(`
${headerBlock('💬', 'We Got Your Message', 'Our team will get back to you shortly')}
${bodyWrap(`
    <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${userName}</strong>,
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        Thanks for reaching out! We've received your message and our team is on it.
    </p>
    <div style="background:${BRAND.lightBg};border-radius:14px;padding:16px 22px;margin:0 0 20px;">
        <div style="font-size:12px;font-weight:800;color:${BRAND.textLight};margin-bottom:8px;">YOUR REQUEST</div>
        <div style="font-size:14px;font-weight:700;color:${BRAND.textDark};margin-bottom:4px;">${ticketSubject}</div>
        <div style="font-size:12px;color:${BRAND.textLight};font-weight:600;">Reference: #${ticketId}</div>
    </div>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0;">
        We typically respond within <strong>24 hours</strong>. In the meantime, you can reply to this email with any additional details.
    </p>
`)}`)
}


// ═══════════════════════════════════════════════════════
//  10. MARKETING / NEWSLETTER EMAIL
//  Feature updates and tips
// ═══════════════════════════════════════════════════════
export function marketingEmail(params: {
    userName: string
    subject: string
    headline: string
    bodyText: string
    ctaText: string
    ctaLink: string
    features?: { emoji: string; title: string; desc: string }[]
}): string {
    const { userName, headline, bodyText, ctaText, ctaLink, features } = params

    return baseLayout(`
${headerBlock('🎈', headline, 'New from PartyPal', `linear-gradient(135deg,${BRAND.teal},${BRAND.purple})`)}
${bodyWrap(`
    <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${userName}</strong>,
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        ${bodyText.replace(/\n/g, '<br>')}
    </p>
    ${features ? features.map(f => `
    <div style="display:flex;gap:14px;padding:14px;background:${BRAND.lightBg};border-radius:12px;margin-bottom:8px;">
        <div style="font-size:24px;flex-shrink:0;">${f.emoji}</div>
        <div>
            <div style="font-size:14px;font-weight:800;color:${BRAND.textDark};margin-bottom:2px;">${f.title}</div>
            <div style="font-size:13px;color:${BRAND.textMuted};line-height:1.4;">${f.desc}</div>
        </div>
    </div>`).join('') : ''}
    <div style="text-align:center;margin:28px 0 8px;">
        <a href="${ctaLink}" class="btn btn-yellow" style="display:inline-block;padding:16px 44px;border-radius:14px;text-decoration:none;font-weight:800;font-size:15px;background:${BRAND.yellow};color:${BRAND.navy};">
            ${ctaText}
        </a>
    </div>
`)}`,
        `<p style="color:${BRAND.textLight};font-size:11px;margin:4px 0 0;"><a href="https://partypal.social/unsubscribe" style="color:${BRAND.textLight};text-decoration:underline;">Unsubscribe</a> from marketing emails</p>`
    )
}


// ═══════════════════════════════════════════════════════
//  11. ACCOUNT DELETION CONFIRMATION EMAIL
//  Sent after a user deletes their account
// ═══════════════════════════════════════════════════════
export function hostMessageEmail(params: {
    guestName: string
    hostName: string
    eventName: string
    message: string
    eventDate?: string
    eventTime?: string
    eventLocation?: string
    rsvpLink?: string
    coverPhoto?: string
}): string {
    const { guestName, hostName, eventName, message, eventDate, eventTime, eventLocation, rsvpLink, coverPhoto } = params

    const headerBg = coverPhoto
        ? `background:url('${coverPhoto}') center/cover;position:relative;`
        : `background:linear-gradient(135deg,${BRAND.navy},${BRAND.darkNavy});`

    const headerContent = `
<tr><td style="${headerBg}padding:36px 32px;text-align:center;">
    ${coverPhoto ? `<div style="position:absolute;inset:0;background:rgba(26,37,53,0.65);border-radius:20px 20px 0 0;"></div>` : ''}
    <div style="position:relative;z-index:1;">
        <div style="font-size:32px;margin-bottom:6px;">💌</div>
        <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 4px;">${eventName}</h1>
        <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:0;font-weight:600;">Message from ${hostName}</p>
    </div>
</td></tr>`

    const eventDetails = eventDate || eventLocation ? infoBox('📌 Event Details', [
        ...(eventDate ? [`📅 ${eventDate}${eventTime ? ` at ${eventTime}` : ''}`] : []),
        ...(eventLocation ? [`📍 ${eventLocation}`] : []),
    ]) : ''

    return baseLayout(`
${headerContent}
${bodyWrap(`
    <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${guestName}</strong> 👋
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        <strong>${hostName}</strong> sent you a message about <strong>${eventName}</strong>:
    </p>
    <div style="background:${BRAND.lightBg};border-left:4px solid ${BRAND.yellow};border-radius:0 12px 12px 0;padding:16px 20px;margin:0 0 20px;">
        <p style="color:${BRAND.textDark};font-size:14px;line-height:1.7;margin:0;">${message.replace(/\n/g, '<br>')}</p>
    </div>
    ${eventDetails}
    ${rsvpLink ? `
    <div style="text-align:center;margin:24px 0 8px;">
        <a href="${rsvpLink}" class="btn btn-primary" style="display:inline-block;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px;background:linear-gradient(135deg,${BRAND.teal},${BRAND.green});color:#fff;">
            View Event →
        </a>
    </div>` : ''}
`)}`,
        `<p style="color:${BRAND.textLight};font-size:11px;margin:4px 0 0;">You received this because you're on the guest list for ${eventName}.</p>`
    )
}


export function accountDeletionEmail(params: {
    userName: string
    deletionDate: string
    eventsDeleted: number
    tenureDays: number
}): string {
    const { userName, deletionDate, eventsDeleted, tenureDays } = params

    const tenureText = tenureDays === 0 ? 'less than a day'
        : tenureDays === 1 ? '1 day'
            : tenureDays < 30 ? `${tenureDays} days`
                : tenureDays < 365 ? `${Math.floor(tenureDays / 30)} month${Math.floor(tenureDays / 30) !== 1 ? 's' : ''}`
                    : `${Math.floor(tenureDays / 365)} year${Math.floor(tenureDays / 365) !== 1 ? 's' : ''}`

    return baseLayout(`
${headerBlock('👋', 'We\'re Sorry to See You Go', 'Your account has been deleted', `linear-gradient(135deg,${BRAND.darkNavy},${BRAND.navy})`)}
${bodyWrap(`
    <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${userName}</strong>,
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        We're truly sorry to see you go. Your PartyPal account has been permanently deleted as of <strong>${deletionDate}</strong>. We appreciate the time you spent with us${tenureDays > 0 ? ` — <strong>${tenureText}</strong> of planning great events together` : ''}.
    </p>
    <!-- What was deleted -->
    ${infoBox('🗑️ What Was Removed', [
        '✅ Your profile and personal information',
        `✅ ${eventsDeleted} event${eventsDeleted !== 1 ? 's' : ''} and associated data`,
        '✅ Guest lists, RSVP records, and collaborator invites',
        '✅ Your login credentials',
    ], BRAND.coral)}
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        All your personal data has been permanently erased from our systems. Anonymized usage analytics may be retained for service improvement, but they can never be traced back to you.
    </p>
    ${divider()}
    <p style="color:${BRAND.textDark};font-size:15px;font-weight:700;line-height:1.6;margin:0 0 8px;">
        Changed your mind? 🎈
    </p>
    <p style="color:${BRAND.textMuted};font-size:14px;line-height:1.7;margin:0 0 20px;">
        We'd love to have you back! You can create a new account anytime and start fresh with our AI-powered party planning tools.
    </p>
    <div style="text-align:center;margin:24px 0 8px;">
        <a href="https://partypal.social" class="btn btn-primary" style="display:inline-block;padding:14px 40px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px;background:linear-gradient(135deg,${BRAND.teal},${BRAND.green});color:#fff;">
            Rejoin PartyPal →
        </a>
    </div>
    <p style="text-align:center;color:${BRAND.textLight};font-size:12px;margin:16px 0 0;font-weight:600;">
        Thank you for being part of the PartyPal community. We wish you all the best! 💛
    </p>
`)}`,
        `<p style="color:${BRAND.textLight};font-size:11px;margin:4px 0 0;">This is a confirmation of your account deletion. No further emails will be sent.</p>`
    )
}


// ═══════════════════════════════════════════════════════
//  PIPELINE NOTIFICATION EMAILS
//  Sent to admin on pipeline events
// ═══════════════════════════════════════════════════════

export type PipelineEmailType =
    | 'ticket_created'
    | 'triage_complete'
    | 'gate_needs_approval'
    | 'dev_started'
    | 'review_ready'
    | 'tests_passed'
    | 'tests_failed'
    | 'deploy_ready'
    | 'ship_decision'
    | 'pipeline_blocked'
    | 'security_alert'

const PIPELINE_COLORS: Record<string, string> = {
    ticket_created: BRAND.teal,
    triage_complete: BRAND.green,
    gate_needs_approval: BRAND.yellow,
    dev_started: BRAND.purple,
    review_ready: BRAND.yellow,
    tests_passed: BRAND.green,
    tests_failed: BRAND.coral,
    deploy_ready: BRAND.teal,
    ship_decision: BRAND.yellow,
    pipeline_blocked: BRAND.coral,
    security_alert: BRAND.coral,
}

const PIPELINE_EMOJIS: Record<string, string> = {
    ticket_created: '🎫',
    triage_complete: '🔍',
    gate_needs_approval: '🚧',
    dev_started: '⚡',
    review_ready: '🛡️',
    tests_passed: '✅',
    tests_failed: '❌',
    deploy_ready: '🚀',
    ship_decision: '📋',
    pipeline_blocked: '🚫',
    security_alert: '🔴',
}

export function pipelineNotificationEmail(params: {
    type: PipelineEmailType
    title: string
    subtitle?: string
    details: string[]
    actionUrl?: string
    actionLabel?: string
    urgency?: 'info' | 'warning' | 'critical'
}): string {
    const { type, title, subtitle, details, actionUrl, actionLabel, urgency } = params
    const color = PIPELINE_COLORS[type] || BRAND.teal
    const emoji = PIPELINE_EMOJIS[type] || '🔀'

    const headerBg = urgency === 'critical'
        ? `linear-gradient(135deg, #8B0000, ${BRAND.coral})`
        : urgency === 'warning'
        ? `linear-gradient(135deg, ${BRAND.darkNavy}, #5a4a00)`
        : `linear-gradient(135deg, ${BRAND.navy}, ${BRAND.darkNavy})`

    const actionButton = actionUrl ? `
    <div style="text-align:center;margin:24px 0 8px;">
        <a href="${actionUrl}" class="btn btn-primary" style="background:linear-gradient(135deg,${color},${BRAND.navy});padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:800;font-size:15px;color:#fff !important;display:inline-block;">
            ${actionLabel || 'View in Dashboard'}
        </a>
    </div>` : ''

    const detailItems = details.map(d => {
        // Support bold prefix via "Label: value" format
        const colonIdx = d.indexOf(':')
        if (colonIdx > 0 && colonIdx < 30) {
            const label = d.slice(0, colonIdx)
            const value = d.slice(colonIdx + 1).trim()
            return `<tr>
                <td style="padding:6px 0;font-size:13px;font-weight:800;color:${BRAND.textMuted};white-space:nowrap;vertical-align:top;padding-right:12px;">${label}</td>
                <td style="padding:6px 0;font-size:14px;font-weight:600;color:${BRAND.textDark};">${value}</td>
            </tr>`
        }
        return `<tr><td colspan="2" style="padding:6px 0;font-size:14px;font-weight:600;color:${BRAND.textDark};">${d}</td></tr>`
    }).join('')

    return baseLayout(`
${headerBlock(emoji, title, subtitle, headerBg)}
${bodyWrap(`
    <div style="background:${color}0F;border:1.5px solid ${color}26;border-radius:14px;padding:18px 22px;margin:0 0 16px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;">
            ${detailItems}
        </table>
    </div>
    ${actionButton}
    <p style="text-align:center;color:${BRAND.textLight};font-size:12px;margin:16px 0 0;font-weight:600;">
        PartyPal Pipeline — Automated DevOps Notification
    </p>
`)}`,
        `<p style="color:${BRAND.textLight};font-size:11px;margin:4px 0 0;">Pipeline notifications are sent to admin accounts only.</p>`
    )
}
