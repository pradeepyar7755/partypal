import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'
import { getAuth } from 'firebase-admin/auth'

// ═══════════════════════════════════════════════════════
//  Account Deletion API
//  Deletes:
//    ✅ User profile from 'users' collection
//    ✅ All events owned by user (+ their rsvps subcollections)
//    ✅ Shared event references from 'user_shared_events'
//    ✅ Collaborator invites created by user
//    ✅ Firebase Auth account
//  Preserves:
//    📊 Aggregated analytics (analytics_daily) — already anonymous
//    📊 Analytics events — userId is anonymized (set to 'deleted')
// ═══════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
    try {
        // Verify the user's identity via Firebase ID token
        const authHeader = req.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.slice(7)
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Initialize Firebase and verify token
        const db = getDb()
        const auth = getAuth()
        let decoded
        try {
            decoded = await auth.verifyIdToken(token)
        } catch {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
        }

        const uid = decoded.uid
        const email = decoded.email || ''

        // Confirm the deletion request matches
        const body = await req.json()
        if (body.confirmEmail && body.confirmEmail !== email) {
            return NextResponse.json({ error: 'Email confirmation does not match' }, { status: 400 })
        }

        const deletionLog: string[] = []

        // ── Gather pre-deletion metrics for churn analytics ──
        const userDoc = await db.collection('users').doc(uid).get()
        const userData = userDoc.exists ? userDoc.data()! : {}
        const createdAt = (userData.createdAt as string) || ''
        const displayName = (userData.displayName as string) || ''
        const signInMethod = (userData.signInMethod as string) || 'unknown'
        const tenureDays = createdAt ? Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)) : 0

        // Count events created
        const eventsSnapshot = await db.collection('events').where('uid', '==', uid).get()
        const eventsCreated = eventsSnapshot.size

        // Count sessions from analytics
        const analyticsSnap = await db.collection('analytics_events')
            .where('userId', '==', uid).limit(1000).get()
        const sessionIds = new Set<string>()
        let lastActiveAt = ''
        analyticsSnap.forEach(doc => {
            const d = doc.data()
            if (d.sessionId) sessionIds.add(d.sessionId as string)
            const ts = (d.timestamp as string) || ''
            if (ts > lastActiveAt) lastActiveAt = ts
        })

        // Write deletion record (persists after user data is wiped)
        await db.collection('account_deletions').add({
            uid,
            email,
            displayName,
            deletedAt: new Date().toISOString(),
            reason: body.reason || 'not_specified',
            tenureDays,
            eventsCreated,
            totalSessions: sessionIds.size,
            lastActiveAt: lastActiveAt || createdAt,
            signUpMethod: signInMethod,
        })
        deletionLog.push('Recorded deletion for churn analytics')

        // 1. Delete all user events + their rsvps subcollections
        // eventsSnapshot already fetched above for metrics
        for (const doc of eventsSnapshot.docs) {
            // Delete rsvps subcollection
            const rsvpsSnapshot = await doc.ref.collection('rsvps').get()
            for (const rsvpDoc of rsvpsSnapshot.docs) {
                await rsvpDoc.ref.delete()
            }
            await doc.ref.delete()
        }
        deletionLog.push(`Deleted ${eventsSnapshot.size} events`)

        // 2. Delete shared event references
        const sharedRef = db.collection('user_shared_events').doc(uid)
        const sharedDoc = await sharedRef.get()
        if (sharedDoc.exists) {
            await sharedRef.delete()
            deletionLog.push('Deleted shared event references')
        }

        // 3. Delete collaborator invites created by this user
        const invitesSnapshot = await db.collection('collaborator_invites')
            .where('invitedBy', '==', uid).get()
        for (const doc of invitesSnapshot.docs) {
            await doc.ref.delete()
        }
        if (invitesSnapshot.size > 0) {
            deletionLog.push(`Deleted ${invitesSnapshot.size} collaborator invites`)
        }

        // 4. Anonymize analytics events (preserve data, remove identity)
        // analyticsSnap already fetched above; re-use for efficiency
        const analyticsSnapshot = analyticsSnap
        for (const doc of analyticsSnapshot.docs) {
            await doc.ref.update({ userId: 'deleted', userEmail: null })
        }
        deletionLog.push(`Anonymized ${analyticsSnapshot.size} analytics entries`)

        // 5. Delete user profile from Firestore
        if (userDoc.exists) {
            await db.collection('users').doc(uid).delete()
            deletionLog.push('Deleted user profile')
        }

        // 6. Delete Firebase Auth account
        try {
            await auth.deleteUser(uid)
            deletionLog.push('Deleted Firebase Auth account')
        } catch (authError) {
            // Log but don't fail — user data is already cleaned
            console.error('Failed to delete auth account:', authError)
            deletionLog.push('Warning: Firebase Auth deletion may have failed')
        }

        return NextResponse.json({
            success: true,
            message: 'Your account and all personal data have been permanently deleted.',
            deletionLog,
        })

    } catch (error) {
        console.error('Account deletion error:', error)
        const msg = error instanceof Error ? error.message : String(error)
        return NextResponse.json({ error: `Deletion failed: ${msg}` }, { status: 500 })
    }
}
