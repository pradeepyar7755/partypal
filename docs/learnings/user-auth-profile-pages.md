# User Auth, Profile Pages, Privacy & Contact

## Overview

This covers implementing user authentication (Google, Apple, Email/Password), profile/settings pages, password management, account deletion, and legal/informational pages (privacy policy, contact) in a Next.js app with Firebase Auth.

## Authentication Architecture

### Firebase Auth Context Pattern

Wrap the entire app in an `AuthProvider` that manages auth state and exposes it via a `useAuth()` hook.

```typescript
// components/AuthContext.tsx
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { getAuth, onAuthStateChanged, User } from 'firebase/auth'

interface AuthContextType {
    user: User | null
    loading: boolean
    signInWithGoogle: () => Promise<void>
    signInWithApple: () => Promise<void>
    signInWithEmail: (email: string, password: string) => Promise<void>
    signUpWithEmail: (email: string, password: string, name: string) => Promise<void>
    logout: () => Promise<void>
    resetPassword: (email: string) => Promise<void>
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>
    sendVerificationEmail: () => Promise<void>
}

// Default values are no-op async functions, not undefined
const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => {},
    // ... etc
})

export const useAuth = () => useContext(AuthContext)
```

### Three Auth Methods

**Google Sign-In:**
```typescript
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth'

const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    if (isNativeApp()) {
        await signInWithRedirect(auth, provider) // native: redirect
    } else {
        const result = await signInWithPopup(auth, provider) // web: popup
        trackNewOrReturning(result.user)
    }
}
```

**Apple Sign-In:**
```typescript
import { OAuthProvider } from 'firebase/auth'

const signInWithApple = async () => {
    const provider = new OAuthProvider('apple.com')
    provider.addScope('email')
    provider.addScope('name')
    // Same popup vs redirect pattern as Google
}
```

**Email/Password:**
```typescript
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth'

const signUpWithEmail = async (email: string, password: string, name: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(result.user, { displayName: name })
    await sendEmailVerification(result.user) // auto-send verification on signup
}
```

### Native App Detection (Capacitor)

```typescript
function isNativeApp(): boolean {
    return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform()
}
```

Use `signInWithRedirect` for native apps because popup windows don't work inside Capacitor WebViews.

### New vs Returning User Detection

```typescript
// Firebase sets creationTime === lastSignInTime only on first sign-in
if (result.user.metadata.creationTime === result.user.metadata.lastSignInTime) {
    trackSignUp('google')  // new user
} else {
    trackLogin('google')   // returning user
}
```

### Auto-Register Users in Backend

On every auth state change, sync the user profile to your backend (fire-and-forget):

```typescript
onAuthStateChanged(auth, (user) => {
    setUser(user)
    setLoading(false)
    if (user && !user.isAnonymous) {
        fetch('/api/user-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: user.uid,
                email: user.email,
                name: user.displayName,
                photoURL: user.photoURL,
                provider: user.providerData[0]?.providerId,
            }),
        }).catch(() => {}) // fire-and-forget
    }
})
```

## Password Management

### Forgot Password

```typescript
import { sendPasswordResetEmail } from 'firebase/auth'

const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email)
    // Firebase sends the reset email automatically
}
```

### Change Password (Requires Re-Authentication)

```typescript
import { reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth'

const changePassword = async (currentPassword: string, newPassword: string) => {
    const user = auth.currentUser
    if (!user || !user.email) throw new Error('Not logged in')

    // Must re-authenticate before changing password
    const credential = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, credential)
    await updatePassword(user, newPassword)
}
```

**Gotcha:** Re-authentication is mandatory. Firebase will throw `auth/requires-recent-login` if the user's session is too old.

### Email Verification

```typescript
import { sendEmailVerification } from 'firebase/auth'

const sendVerification = async () => {
    if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser)
    }
}
```

## Account Deletion (7-Step Cascade)

When deleting a user account, clean up ALL associated data:

```typescript
// app/api/account/delete/route.ts
export async function POST(req: NextRequest) {
    const { uid, email } = await req.json()
    const db = getDb()

    // 1. Delete user's events
    const events = await db.collection('events').where('uid', '==', uid).get()
    for (const doc of events.docs) await doc.ref.delete()

    // 2. Delete guest entries
    const guests = await db.collection('guests').where('uid', '==', uid).get()
    for (const doc of guests.docs) await doc.ref.delete()

    // 3. Remove from shared events (as collaborator)
    const shared = await db.collection('events').where('collaborators', 'array-contains', uid).get()
    for (const doc of shared.docs) {
        await doc.ref.update({
            collaborators: FieldValue.arrayRemove(uid)
        })
    }

    // 4. Delete collaboration invites
    const invites = await db.collection('collaborator_invites').where('email', '==', email).get()
    for (const doc of invites.docs) await doc.ref.delete()

    // 5. Delete user data document
    await db.collection('users').doc(uid).delete()

    // 6. Delete analytics
    await db.collection('analytics').doc(uid).delete()

    // 7. Delete Firebase Auth account (admin SDK)
    await getAuth().deleteUser(uid)

    // Send confirmation email
    await sendDeletionConfirmation(email)

    return NextResponse.json({ success: true })
}
```

## Settings Page Structure

Organize into clear sections with visual separation:

```
Settings Page
├── Profile Section (name, email, photo - read from Firebase Auth)
├── Security Section
│   ├── Change Password (only for email/password users)
│   ├── Email Verification status + resend button
│   └── Linked accounts (Google, Apple)
├── Preferences Section
│   ├── Notification settings
│   └── Theme/display settings
└── Danger Zone
    └── Delete Account (with confirmation modal)
```

**Key Pattern:** Show/hide sections based on auth provider. Password change only appears for email/password users, not OAuth users.

## Privacy Policy Page

Structure for CCPA/GDPR compliance:

```
Privacy Policy
├── Last Updated date
├── Information We Collect
│   ├── Information you provide (name, email, event details)
│   ├── Information collected automatically (analytics, device info)
│   └── Third-party services (Google, Firebase, etc.)
├── How We Use Your Information
├── How We Share Your Information
├── Data Retention
├── Your Rights (CCPA/GDPR)
│   ├── Access your data
│   ├── Delete your data
│   ├── Opt out of data collection
│   └── Data portability
├── Children's Privacy (COPPA)
├── Security Measures
├── Changes to This Policy
└── Contact Information
```

## Contact Page

```
Contact Page
├── Header with mission statement
├── FAQ Accordion (clickable expand/collapse)
│   ├── Common questions with answers
│   └── Links to relevant sections
├── Email Contact Grid
│   ├── General: info@domain.com
│   ├── Support: support@domain.com
│   ├── Privacy: privacy@domain.com
│   └── Feedback: feedback@domain.com
├── Feedback Form (optional, can use bug report API)
└── Social Media Links
```

**Pattern:** Use a centralized constants file for all email addresses:

```typescript
// lib/constants.ts
export const SITE_EMAILS = {
    admin: 'admin@partypal.social',
    support: 'support@partypal.social',
    privacy: 'privacy@partypal.social',
    info: 'info@partypal.social',
    feedback: 'feedback@partypal.social',
}
```

## Contextual Signup Prompts

Show different messaging based on what triggered the signup prompt:

```typescript
// Different prompts depending on context
const getSignupMessage = (trigger: string) => {
    switch (trigger) {
        case 'rsvp_tracking':
            return 'Sign up to track RSVPs and manage your guest list across devices'
        case 'collaborators':
            return 'Sign up to invite collaborators and plan together'
        case 'save_event':
            return 'Sign up to save your event and access it from any device'
        default:
            return 'Sign up to unlock all features'
    }
}
```

## Reusable Checklist

- [ ] **Set up Firebase Auth** with desired providers (Google, Apple, Email/Password)
- [ ] **Create AuthContext** with `useAuth()` hook wrapping the entire app
- [ ] **Handle native vs web** auth flows (popup vs redirect for Capacitor)
- [ ] **Auto-register users** in your backend on first login (fire-and-forget)
- [ ] **Implement password management** — reset, change (with re-auth), email verification
- [ ] **Build account deletion** as a multi-step cascade cleaning all user data
- [ ] **Send confirmation emails** for account deletion, email verification
- [ ] **Create privacy policy** covering CCPA/GDPR requirements
- [ ] **Create contact page** with FAQ, email grid, feedback form
- [ ] **Centralize email addresses** in a constants file
- [ ] **Contextualize signup prompts** based on the user action that triggered them
- [ ] **Handle Apple auth webhook** for server-to-server notifications (consent revoked, account deleted)
