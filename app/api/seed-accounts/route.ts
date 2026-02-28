import { NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// Lazy-load firebase-admin/auth
async function getAdminAuth() {
    const { getAuth } = await import('firebase-admin/auth')
    return getAuth()
}

const TEST_ACCOUNTS = [
    {
        email: 'admin@partypal.social',
        password: 'PartyPal2026!',
        displayName: 'Pradeep (Admin)',
        role: 'admin',
    },
    {
        email: 'sarah@test.partypal.social',
        password: 'TestGuest123!',
        displayName: 'Sarah Anderson',
        role: 'guest',
    },
    {
        email: 'marcus@test.partypal.social',
        password: 'TestGuest123!',
        displayName: 'Marcus Johnson',
        role: 'guest',
    },
    {
        email: 'lauren@test.partypal.social',
        password: 'TestGuest123!',
        displayName: 'Lauren Park',
        role: 'guest',
    },
    {
        email: 'david@test.partypal.social',
        password: 'TestGuest123!',
        displayName: 'David Kim',
        role: 'guest',
    },
]

export async function POST() {
    try {
        // Ensure Firebase is initialized
        getDb()
        const auth = await getAdminAuth()
        const db = getDb()

        const results: { email: string; status: string; uid?: string; error?: string }[] = []

        for (const account of TEST_ACCOUNTS) {
            try {
                // Check if user already exists
                let uid: string
                try {
                    const existing = await auth.getUserByEmail(account.email)
                    uid = existing.uid
                    results.push({ email: account.email, status: 'exists', uid })
                } catch {
                    // Create new user
                    const userRecord = await auth.createUser({
                        email: account.email,
                        password: account.password,
                        displayName: account.displayName,
                        emailVerified: true,
                    })
                    uid = userRecord.uid
                    results.push({ email: account.email, status: 'created', uid })
                }

                // Set admin claim
                if (account.role === 'admin') {
                    await auth.setCustomUserClaims(uid, { admin: true })
                }

                // Create/update Firestore profile
                await db.collection('users').doc(uid).set({
                    email: account.email,
                    displayName: account.displayName,
                    role: account.role,
                    createdAt: new Date().toISOString(),
                    testAccount: true,
                }, { merge: true })

            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error)
                results.push({ email: account.email, status: 'error', error: msg })
            }
        }

        return NextResponse.json({
            success: true,
            accounts: results,
            credentials: {
                admin: { email: 'admin@partypal.social', password: 'PartyPal2026!' },
                guests: TEST_ACCOUNTS.filter(a => a.role === 'guest').map(a => ({
                    email: a.email, password: a.password, name: a.displayName,
                })),
            },
        })

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
