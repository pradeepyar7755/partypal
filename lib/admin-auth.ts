import { getAuth } from 'firebase-admin/auth'

// Admin email whitelist — only these accounts can access /admin
const ADMIN_EMAILS = ['admin@partypal.social']

/**
 * Verify that a request comes from an authenticated admin user.
 * Accepts the Firebase ID token from the Authorization header.
 * Returns the decoded token if valid admin, null otherwise.
 */
export async function verifyAdmin(authHeader: string | null): Promise<{ uid: string; email: string } | null> {
    if (!authHeader?.startsWith('Bearer ')) return null

    const token = authHeader.slice(7)
    if (!token) return null

    try {
        // Ensure Firebase Admin is initialized by triggering getDb
        const { getDb } = await import('@/lib/firebase')
        getDb()

        const decoded = await getAuth().verifyIdToken(token)
        const email = decoded.email || ''

        if (!ADMIN_EMAILS.includes(email)) return null

        return { uid: decoded.uid, email }
    } catch {
        return null
    }
}

export { ADMIN_EMAILS }
