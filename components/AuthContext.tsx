'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
    User,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
} from 'firebase/auth'
import { auth } from '@/lib/firebase-client'
import { setStorageUid } from '@/lib/userStorage'
import { trackSignUp, trackLogin } from '@/lib/analytics'

interface AuthContextType {
    user: User | null
    loading: boolean
    signInWithGoogle: () => Promise<void>
    signInWithApple: () => Promise<void>
    signInWithEmail: (email: string, password: string) => Promise<void>
    signUpWithEmail: (email: string, password: string, name: string) => Promise<void>
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => { },
    signInWithApple: async () => { },
    signInWithEmail: async () => { },
    signUpWithEmail: async () => { },
    logout: async () => { },
})

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user)
            setStorageUid(user?.uid || null)
            setLoading(false)
            // Sync user profile to Firestore (fire-and-forget)
            if (user && !user.isAnonymous) {
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
        const provider = new GoogleAuthProvider()
        const result = await signInWithPopup(auth, provider)
        // Track: is this a new user (sign up) or returning (login)?
        if (result.user.metadata.creationTime === result.user.metadata.lastSignInTime) {
            trackSignUp('google')
        } else {
            trackLogin('google')
        }
    }

    const signInWithApple = async () => {
        const provider = new OAuthProvider('apple.com')
        provider.addScope('email')
        provider.addScope('name')
        await signInWithPopup(auth, provider)
    }

    const signInWithEmail = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password)
        trackLogin('email')
    }

    const signUpWithEmail = async (email: string, password: string, name: string) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(cred.user, { displayName: name })
        trackSignUp('email')
    }

    const logout = async () => {
        await signOut(auth)
    }

    return (
        <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
