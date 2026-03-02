import { NextRequest, NextResponse } from 'next/server'

/**
 * Apple Server-to-Server Notification Endpoint
 * 
 * Apple sends JWT-encoded events here when:
 * - A user revokes consent (consent-revoked)
 * - A user deletes their Apple ID (account-delete)
 * - A user stops using your app (email-disabled / email-enabled)
 * 
 * See: https://developer.apple.com/documentation/sign_in_with_apple/processing_changes_for_sign_in_with_apple_accounts
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.formData()
        const payload = body.get('payload') as string

        if (!payload) {
            return NextResponse.json({ error: 'Missing payload' }, { status: 400 })
        }

        // The payload is a JWT. Decode the claims (middle segment) to read the event.
        const [, claimsB64] = payload.split('.')
        const claims = JSON.parse(Buffer.from(claimsB64, 'base64url').toString())

        const eventType = claims.events?.type || 'unknown'
        const userSub = claims.events?.sub || claims.sub || 'unknown'

        console.log(`[Apple Notification] type=${eventType} sub=${userSub}`, JSON.stringify(claims))

        // Future: handle account-delete / consent-revoked by disabling the user in Firebase

        return NextResponse.json({ received: true })
    } catch (err) {
        console.error('[Apple Notification] Error processing:', err)
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
}
