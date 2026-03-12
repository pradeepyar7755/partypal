'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
    User,
    onAuthStateChanged,
    signInWithPopup,
    signInWithCredential,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
    sendPasswordResetEmail,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    sendEmailVerification,
} from 'firebase/auth'
import { auth } from '@/lib/firebase-client'
import { setStorageUid } from '@/lib/userStorage'
import { migrateAnonymousData } from '@/lib/migrate-anon-data'
import { trackSignUp, trackLogin } from '@/lib/analytics'

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

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => { },
    signInWithApple: async () => { },
    signInWithEmail: async () => { },
    signUpWithEmail: async () => { },
    logout: async () => { },
    resetPassword: async () => { },
    changePassword: async () => { },
    sendVerificationEmail: async () => { },
})

// Returns true when running inside a Capacitor native app (iOS/Android)
function isNativeApp(): boolean {
    return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform()
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user)
            setStorageUid(user?.uid || null)
            setLoading(false)
            // Migrate anonymous data to user-scoped keys (runs once per UID)
            if (user && !user.isAnonymous) {
                migrateAnonymousData(user.uid)
                // Sync user profile to Firestore (fire-and-forget)
                fetch('/api/user-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uid: user.uid,
                        profile: {
                            email: user.email || '',
                            displayName: user.displayName || '',
                            signInMethod: user.providerData?.[0]?.providerId || 'unknown',
                            lastLoginAt: new Date().toISOString(),
                        },
                    }),
                }).catch(() => { })
            }
        })
        return unsubscribe
    }, [])

    const signInWithGoogle = async () => {
        if (isNativeApp()) {
            // Use native Google Sign-In — shows in-app sheet, no Safari redirect
            const { GoogleAuth } = await import('@southdevs/capacitor-google-auth')
            await GoogleAuth.initialize()
            const googleUser = await GoogleAuth.signIn({ scopes: ['email', 'profile'] })
            const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken)
            const userCred = await signInWithCredential(auth, credential)
            if (userCred.user.metadata.creationTime === userCred.user.metadata.lastSignInTime) {
                trackSignUp('google')
            } else {
                trackLogin('google')
            }
        } else {
            const provider = new GoogleAuthProvider()
            const result = await signInWithPopup(auth, provider)
            if (result.user.metadata.creationTime === result.user.metadata.lastSignInTime) {
                trackSignUp('google')
            } else {
                trackLogin('google')
            }
        }
    }

    const signInWithApple = async () => {
        if (isNativeApp()) {
            // Use native Sign in with Apple — shows in-app sheet, no Safari redirect
            const { SignInWithApple } = await import('@capacitor-community/apple-sign-in')
            const result = await SignInWithApple.authorize({
                clientId: 'social.partypal.app',
                redirectURI: 'https://partypal.social',
                scopes: 'email name',
            })
            const provider = new OAuthProvider('apple.com')
            const credential = provider.credential({
                idToken: result.response.identityToken,
            })
            const userCred = await signInWithCredential(auth, credential)
            if (userCred.user.metadata.creationTime === userCred.user.metadata.lastSignInTime) {
                trackSignUp('apple')
            } else {
                trackLogin('apple')
            }
        } else {
            const provider = new OAuthProvider('apple.com')
            provider.addScope('email')
            provider.addScope('name')
            const result = await signInWithPopup(auth, provider)
            if (result.user.metadata.creationTime === result.user.metadata.lastSignInTime) {
                trackSignUp('apple')
            } else {
                trackLogin('apple')
            }
        }
    }

    const signInWithEmail = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password)
        trackLogin('email')
    }

    const signUpWithEmail = async (email: string, password: string, name: string) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(cred.user, { displayName: name })
        // Auto-send email verification
        await sendEmailVerification(cred.user).catch(() => { })
        trackSignUp('email')
    }

    const logout = async () => {
        await signOut(auth)
    }

    const resetPassword = async (email: string) => {
        await sendPasswordResetEmail(auth, email)
    }

    const changePassword = async (currentPassword: string, newPassword: string) => {
        const currentUser = auth.currentUser
        if (!currentUser || !currentUser.email) throw new Error('No user signed in')
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword)
        await reauthenticateWithCredential(currentUser, credential)
        await updatePassword(currentUser, newPassword)
    }

    const sendVerificationEmailFn = async () => {
        const currentUser = auth.currentUser
        if (!currentUser) throw new Error('No user signed in')
        await sendEmailVerification(currentUser)
    }

    return (
        <AuthContext.Provider value={{
            user, loading,
            signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail,
            logout, resetPassword, changePassword,
            sendVerificationEmail: sendVerificationEmailFn,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
