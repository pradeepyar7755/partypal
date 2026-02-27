'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import styles from './login.module.css'

export default function LoginPage() {
    const router = useRouter()
    const { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail } = useAuth()
    const [mode, setMode] = useState<'login' | 'signup'>('signup')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSocial = async (fn: () => Promise<void>, provider: string) => {
        setError('')
        setLoading(true)
        try {
            await fn()
            router.push('/')
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Something went wrong'
            if (msg.includes('popup-closed') || msg.includes('cancelled')) {
                setLoading(false)
                return
            }
            if (msg.includes('unauthorized-domain')) {
                setError('This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.')
            } else if (msg.includes('operation-not-allowed')) {
                setError(`${provider} sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.`)
            } else if (msg.includes('network-request-failed')) {
                setError('Network error. Please check your connection.')
            } else if (msg.includes('iframe') || msg.includes('popup')) {
                setError(`${provider} popup was blocked. Please allow popups for this site and try again.`)
            } else {
                setError(`${provider} sign-in failed. Please try again.`)
            }
        } finally {
            setLoading(false)
        }
    }

    const handleEmail = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (!email || !password) { setError('Please fill in all fields'); return }
        if (mode === 'signup' && !name) { setError('Please enter your name'); return }
        if (password.length < 6) { setError('Password must be at least 6 characters'); return }
        setLoading(true)
        try {
            if (mode === 'signup') {
                await signUpWithEmail(email, password, name)
            } else {
                await signInWithEmail(email, password)
            }
            router.push('/')
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : ''
            if (msg.includes('email-already-in-use')) setError('Email already in use. Try logging in.')
            else if (msg.includes('invalid-credential') || msg.includes('wrong-password')) setError('Invalid email or password.')
            else if (msg.includes('user-not-found')) setError('No account found. Try signing up.')
            else setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className={styles.loginPage}>
            <div className={styles.loginCard}>
                <div className={styles.loginLogo}>🎊</div>
                <div className={styles.loginTitle}>Party<span>Pal</span></div>
                <div className={styles.loginSub}>Plan unforgettable parties with AI</div>

                {error && <div className={styles.error}>{error}</div>}

                {/* Social Buttons — always shown */}
                <div className={styles.socialBtns}>
                    <button className={styles.socialBtn} onClick={() => handleSocial(signInWithGoogle, 'Google')} disabled={loading}>
                        <svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                        Continue with Google
                    </button>
                    <button className={styles.socialBtn} onClick={() => handleSocial(signInWithApple, 'Apple')} disabled={loading}>
                        <svg viewBox="0 0 24 24" fill="white"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-1.55 4.21-3.74 4.25z" /></svg>
                        Continue with Apple
                    </button>
                </div>

                <div className={styles.divider}>or continue with email</div>

                {/* Email Sign Up / Log In Tabs */}
                <div className={styles.tabs}>
                    <button className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`} onClick={() => { setMode('signup'); setError('') }}>Sign Up</button>
                    <button className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`} onClick={() => { setMode('login'); setError('') }}>Log In</button>
                </div>

                <form className={styles.emailForm} onSubmit={handleEmail}>
                    {mode === 'signup' && (
                        <input className={styles.emailInput} type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
                    )}
                    <input className={styles.emailInput} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                    <input className={styles.emailInput} type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
                    <button className={styles.submitBtn} type="submit" disabled={loading}>
                        {loading ? '⏳ Please wait...' : mode === 'signup' ? '🚀 Create Account' : '🔓 Log In'}
                    </button>
                </form>
            </div>
        </main>
    )
}
