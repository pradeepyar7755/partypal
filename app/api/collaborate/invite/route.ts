import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

export async function POST(req: NextRequest) {
    try {
        const { eventId, collaboratorEmail, collaboratorName, role, inviterName, eventName } = await req.json()

        if (!eventId || !collaboratorEmail) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Generate a unique invite token
        const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

        // Save invite to Firestore
        const db = getDb()
        await db.collection('collaborator_invites').doc(token).set({
            eventId,
            email: collaboratorEmail,
            name: collaboratorName || '',
            role: role || 'Viewer',
            inviterName: inviterName || 'Someone',
            eventName: eventName || 'a party',
            status: 'pending',
            createdAt: new Date().toISOString(),
        })

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://partypal.social'
        const inviteLink = `${appUrl}/collaborate?token=${token}`

        // Try sending email via Resend if API key is configured
        const resendKey = process.env.RESEND_API_KEY
        let emailSent = false

        if (resendKey) {
            try {
                const { Resend } = await import('resend')
                const resend = new Resend(resendKey)

                await resend.emails.send({
                    from: 'PartyPal <onboarding@resend.dev>',
                    to: collaboratorEmail,
                    subject: `🎉 ${inviterName || 'Someone'} invited you to help plan ${eventName || 'a party'}!`,
                    html: `
                        <div style="font-family: 'Nunito', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #1A2535; border-radius: 16px; overflow: hidden;">
                            <div style="background: linear-gradient(135deg, #F7C948, #E8896A); padding: 2rem; text-align: center;">
                                <h1 style="font-size: 1.8rem; color: #1A2535; margin: 0;">🎉 You're Invited!</h1>
                            </div>
                            <div style="padding: 2rem; color: #e0e6ed;">
                                <p style="font-size: 1rem; line-height: 1.6;">
                                    <strong>${inviterName || 'Someone'}</strong> has invited you to collaborate on 
                                    <strong>${eventName || 'a party'}</strong> as a <strong>${role || 'Viewer'}</strong>.
                                </p>
                                <p style="font-size: 0.9rem; color: #9aabbb; line-height: 1.5;">
                                    You'll be able to ${role === 'Editor' ? 'view, edit, and contribute to' : 'view'} the event planning details, including the timeline, budget, guest list, and more.
                                </p>
                                <div style="text-align: center; margin: 2rem 0;">
                                    <a href="${inviteLink}" style="display: inline-block; padding: 0.9rem 2.5rem; background: linear-gradient(135deg, #4AADA8, #3D8C6E); color: white; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 1rem;">
                                        Accept Invitation
                                    </a>
                                </div>
                                <p style="font-size: 0.78rem; color: #6b7c93; text-align: center;">
                                    Or copy this link: <br/><a href="${inviteLink}" style="color: #4AADA8;">${inviteLink}</a>
                                </p>
                            </div>
                            <div style="padding: 1rem 2rem; background: rgba(255,255,255,0.03); text-align: center; color: #6b7c93; font-size: 0.72rem;">
                                Sent by PartyPal · Plan memorable events with AI ✨
                            </div>
                        </div>
                    `,
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
                : `Invite link created! Share this link manually: ${inviteLink}`,
        })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Collaborate invite error:', msg)
        return NextResponse.json({ error: 'Failed to create invitation', details: msg }, { status: 500 })
    }
}
