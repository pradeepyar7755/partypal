# Workspace & Collaboration Setup

## Overview

Implementing multi-user collaboration where users can invite others to co-plan an event. This covers the invite flow, shared event model, task assignment, and email-based onboarding.

## Architecture

```
Invite Flow:
Host creates invite → Token saved to Firestore → Email sent via Resend
→ Collaborator clicks link → Accepts invite → Added to event's collaborators array
→ Event appears in collaborator's "Shared Events" with "Shared" label
```

## Step 1: Generate and Save Invite

```typescript
// app/api/collaborate/invite/route.ts
export async function POST(req: NextRequest) {
    const { eventId, collaboratorEmail, collaboratorName, role, inviterName, eventName } = await req.json()

    // Generate unique token (timestamp + random)
    const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

    // Save invite to Firestore
    const db = getDb()
    await db.collection('collaborator_invites').doc(token).set({
        eventId,
        email: collaboratorEmail,
        name: collaboratorName || '',
        role: role || 'Viewer',       // 'Viewer' or 'Editor'
        inviterName: inviterName || 'Someone',
        eventName: eventName || 'a party',
        status: 'pending',
        createdAt: new Date().toISOString(),
    })

    // Build invite link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'
    const inviteLink = `${appUrl}/collaborate?token=${token}`

    // Send email (optional — graceful if no API key)
    let emailSent = false
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
        try {
            const { Resend } = await import('resend')
            const resend = new Resend(resendKey)
            await resend.emails.send({
                from: 'AppName <onboarding@resend.dev>',
                to: collaboratorEmail,
                subject: `${inviterName} invited you to help plan ${eventName}!`,
                html: buildInviteEmailHTML(inviterName, eventName, role, inviteLink),
            })
            emailSent = true
        } catch (emailErr) {
            console.error('Email send error:', emailErr)
        }
    }

    return NextResponse.json({
        success: true,
        token,
        inviteLink,
        emailSent,
        message: emailSent
            ? `Invitation sent to ${collaboratorEmail}!`
            : `Invite link created! Share manually: ${inviteLink}`,
    })
}
```

**Key Pattern: Always return the invite link** even if email fails. The host can copy and share it manually.

## Step 2: Accept Invite

```typescript
// app/api/collaborate/accept/route.ts
export async function POST(req: NextRequest) {
    const { token, uid, email, name } = await req.json()
    const db = getDb()

    // Look up invite
    const inviteDoc = await db.collection('collaborator_invites').doc(token).get()
    if (!inviteDoc.exists) {
        return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
    }

    const invite = inviteDoc.data()!
    if (invite.status !== 'pending') {
        return NextResponse.json({ error: 'Invite already used' }, { status: 400 })
    }

    // Add user to event's collaborators array
    const eventRef = db.collection('events').doc(invite.eventId)
    await eventRef.update({
        collaborators: FieldValue.arrayUnion({
            uid,
            email,
            name: name || invite.name,
            role: invite.role,
            joinedAt: new Date().toISOString(),
        })
    })

    // Mark invite as accepted
    await inviteDoc.ref.update({ status: 'accepted', acceptedAt: new Date().toISOString() })

    return NextResponse.json({ success: true, eventId: invite.eventId })
}
```

## Step 3: Shared Event Display

Events where the user is a collaborator (not the owner) show with a "Shared" label:

```typescript
// Fetch shared events (where user is in collaborators array)
const sharedSnapshot = await db.collection('events')
    .where('collaborators', 'array-contains', { uid: currentUid /* ... */ })
    .get()

// In the UI
{event.uid !== currentUid && (
    <span className={styles.sharedBadge}>Shared</span>
)}
```

**Gotcha:** Firestore's `array-contains` on objects requires the exact object structure to match. If you only want to query by `uid`, store collaborator UIDs in a separate flat array field:

```typescript
// Better: flat array for querying
collaboratorUids: ['uid1', 'uid2']

// Detailed data in a separate field
collaboratorDetails: [{ uid: 'uid1', name: 'Alice', role: 'Editor' }]
```

## Step 4: Task Assignment

Assign checklist items to specific collaborators:

```typescript
interface ChecklistItem {
    item: string
    category: string
    done: boolean
    assignedTo?: string      // collaborator uid
    assignedName?: string    // display name
}

// Assign a task
const assignTask = (taskIndex: number, collaborator: { uid: string, name: string }) => {
    const updated = [...checklist]
    updated[taskIndex].assignedTo = collaborator.uid
    updated[taskIndex].assignedName = collaborator.name
    setChecklist(updated)
}
```

## Step 5: Resign from Shared Event

Allow collaborators to remove themselves:

```typescript
const resignFromEvent = async (eventId: string, uid: string) => {
    await fetch(`/api/collaborate/resign`, {
        method: 'POST',
        body: JSON.stringify({ eventId, uid }),
    })
    // Remove from local state
    setSharedEvents(prev => prev.filter(e => e.eventId !== eventId))
}
```

## Email Template Pattern

Brand your invite emails with inline styles (email clients don't support CSS classes):

```typescript
function buildInviteEmailHTML(inviterName: string, eventName: string, role: string, link: string) {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #1A2535; border-radius: 16px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #F7C948, #E8896A); padding: 2rem; text-align: center;">
                <h1 style="color: #1A2535;">You're Invited!</h1>
            </div>
            <div style="padding: 2rem; color: #e0e6ed;">
                <p><strong>${inviterName}</strong> invited you to collaborate on <strong>${eventName}</strong> as a <strong>${role}</strong>.</p>
                <div style="text-align: center; margin: 2rem 0;">
                    <a href="${link}" style="display: inline-block; padding: 0.9rem 2.5rem; background: linear-gradient(135deg, #4AADA8, #3D8C6E); color: white; text-decoration: none; border-radius: 12px; font-weight: 800;">
                        Accept Invitation
                    </a>
                </div>
                <p style="font-size: 0.78rem; color: #6b7c93;">Or copy: <a href="${link}" style="color: #4AADA8;">${link}</a></p>
            </div>
        </div>
    `
}
```

**Key Rules for Email HTML:**
- All styles must be inline (no `<style>` blocks, no CSS classes)
- Use `<table>` layouts for complex designs (some clients don't support flexbox)
- Keep width ≤ 600px for mobile compatibility
- Include a plain text fallback link (not just the button)

## Role-Based Permissions

```typescript
type CollaboratorRole = 'Viewer' | 'Editor'

// Check permissions before allowing edits
const canEdit = (role: CollaboratorRole) => role === 'Editor'

// In UI
{canEdit(userRole) ? (
    <EditableField value={eventName} onChange={updateName} />
) : (
    <span>{eventName}</span>
)}
```

## Reusable Checklist

- [ ] **Design the invite flow** — token generation, Firestore storage, email sending, acceptance
- [ ] **Generate unique tokens** — `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)`
- [ ] **Store invites in a dedicated collection** — with status tracking (pending/accepted/expired)
- [ ] **Send email invites** with graceful fallback (return link if email fails)
- [ ] **Use `FieldValue.arrayUnion`** to add collaborators atomically
- [ ] **Use a flat UID array** for Firestore queries alongside detailed collaborator objects
- [ ] **Show "Shared" badge** on events where user is collaborator, not owner
- [ ] **Implement role-based permissions** — Viewer vs Editor
- [ ] **Add task assignment** to checklist items
- [ ] **Allow resign/leave** from shared events
- [ ] **Build branded email templates** with inline styles
- [ ] **Always return the invite link** even if email sending fails
