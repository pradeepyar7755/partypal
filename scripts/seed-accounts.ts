// ═══════════════════════════════════════════════════════
//  Seed Test Accounts for PartyPal
//  Creates 1 admin + 4 guest accounts via Firebase Admin
//  Run: npx tsx scripts/seed-accounts.ts
// ═══════════════════════════════════════════════════════

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { SITE_EMAILS } from '../lib/constants'

// Initialize Firebase Admin
if (!getApps().length) {
    const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (serviceAccount) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        initializeApp({ credential: cert(require(serviceAccount)) })
    } else {
        initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'party-pal-488618' })
    }
}

const auth = getAuth()
const db = getFirestore()

// ── Test Accounts ─────────────────────────────────────
const TEST_ACCOUNTS = [
    {
        email: SITE_EMAILS.admin,
        password: 'PartyPal2026!',
        displayName: 'Pradeep (Admin)',
        role: 'admin',
        photoURL: null,
    },
    {
        email: 'sarah@test.partypal.social',
        password: 'TestGuest123!',
        displayName: 'Sarah Anderson',
        role: 'guest',
        photoURL: null,
    },
    {
        email: 'marcus@test.partypal.social',
        password: 'TestGuest123!',
        displayName: 'Marcus Johnson',
        role: 'guest',
        photoURL: null,
    },
    {
        email: 'lauren@test.partypal.social',
        password: 'TestGuest123!',
        displayName: 'Lauren Park',
        role: 'guest',
        photoURL: null,
    },
    {
        email: 'david@test.partypal.social',
        password: 'TestGuest123!',
        displayName: 'David Kim',
        role: 'guest',
        photoURL: null,
    },
]

async function seedAccounts() {
    console.log('\n🎈 PartyPal Account Seeder\n')
    console.log('═'.repeat(50))

    for (const account of TEST_ACCOUNTS) {
        try {
            // Check if user already exists
            try {
                const existing = await auth.getUserByEmail(account.email)
                console.log(`✅ ${account.displayName} (${account.email}) — already exists (uid: ${existing.uid})`)
                // Update the Firestore profile
                await db.collection('users').doc(existing.uid).set({
                    email: account.email,
                    displayName: account.displayName,
                    role: account.role,
                    createdAt: new Date().toISOString(),
                    testAccount: true,
                }, { merge: true })
                continue
            } catch {
                // User doesn't exist, create it
            }

            // Create the user
            const userRecord = await auth.createUser({
                email: account.email,
                password: account.password,
                displayName: account.displayName,
                emailVerified: true, // Skip email verification for test accounts
            })

            // Set custom claims for admin
            if (account.role === 'admin') {
                await auth.setCustomUserClaims(userRecord.uid, { admin: true })
            }

            // Create Firestore profile
            await db.collection('users').doc(userRecord.uid).set({
                email: account.email,
                displayName: account.displayName,
                role: account.role,
                createdAt: new Date().toISOString(),
                testAccount: true,
            })

            console.log(`✅ Created: ${account.displayName} (${account.email}) — uid: ${userRecord.uid}`)

        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error(`❌ Failed: ${account.displayName} (${account.email}) — ${msg}`)
        }
    }

    console.log('\n' + '═'.repeat(50))
    console.log('\n📋 LOGIN CREDENTIALS:\n')
    console.log('┌─────────────────────────────────────────────────────────────────┐')
    console.log('│  ADMIN ACCOUNT                                                  │')
    console.log(`│  Email:    ${SITE_EMAILS.admin.padEnd(52)} │`)
    console.log('│  Password: PartyPal2026!                                        │')
    console.log('│  Role:     Admin (full access)                                  │')
    console.log('├─────────────────────────────────────────────────────────────────┤')
    console.log('│  GUEST ACCOUNTS (all use password: TestGuest123!)               │')
    console.log('│                                                                 │')
    console.log('│  1. sarah@test.partypal.social    — Sarah Anderson              │')
    console.log('│  2. marcus@test.partypal.social   — Marcus Johnson              │')
    console.log('│  3. lauren@test.partypal.social   — Lauren Park                 │')
    console.log('│  4. david@test.partypal.social    — David Kim                   │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    console.log('')
}

seedAccounts()
    .then(() => process.exit(0))
    .catch((err) => { console.error('Fatal error:', err); process.exit(1) })
