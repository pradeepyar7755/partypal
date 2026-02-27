'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

function CollaborateContent() {
    const params = useSearchParams()
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()
    const [invite, setInvite] = useState<{ eventId: string; eventName: string; inviterName: string; role: string; status: string; email: string } | null>(null)
    const [error, setError] = useState('')
    const [accepting, setAccepting] = useState(false)
    const [accepted, setAccepted] = useState(false)
    const token = params.get('token')

    useEffect(() => {
        if (!token) { setError('Invalid invite link'); return }
        fetch(`/api/collaborate/accept?token=${token}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) setError(data.error)
                else setInvite(data)
            })
            .catch(() => setError('Failed to load invitation'))
    }, [token])

    const handleAccept = async () => {
        if (!user || !token) return
        setAccepting(true)
        try {
            const res = await fetch('/api/collaborate/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, uid: user.uid, email: user.email, displayName: user.displayName }),
            })
            const data = await res.json()
            if (data.success || data.eventId) {
                setAccepted(true)
                // Redirect to dashboard after a moment
                setTimeout(() => router.push('/dashboard'), 2000)
            } else {
                setError(data.error || 'Failed to accept')
            }
        } catch { setError('Failed to accept invitation') }
        setAccepting(false)
    }

    if (error) {
        return (
            <main className="page-enter" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: 450 }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😔</div>
                    <h2 style={{ fontFamily: "'Fredoka One',cursive", color: 'var(--navy)', marginBottom: '0.5rem' }}>Invite Not Found</h2>
                    <p style={{ color: '#9aabbb', fontWeight: 600, marginBottom: '1.5rem' }}>{error}</p>
                    <button onClick={() => router.push('/')} style={{ padding: '0.7rem 2rem', borderRadius: 10, background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' }}>Go to PartyPal</button>
                </div>
            </main>
        )
    }

    if (!invite) {
        return (
            <main className="page-enter" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 40, height: 40 }} />
            </main>
        )
    }

    if (accepted) {
        return (
            <main className="page-enter" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: 450 }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                    <h2 style={{ fontFamily: "'Fredoka One',cursive", color: 'var(--navy)', marginBottom: '0.5rem' }}>You&apos;re In!</h2>
                    <p style={{ color: '#9aabbb', fontWeight: 600 }}>Welcome to <strong>{invite.eventName}</strong>. Redirecting to dashboard...</p>
                </div>
            </main>
        )
    }

    // Show login/signup prompt if not authenticated
    if (!authLoading && !user) {
        return (
            <main className="page-enter" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: 500 }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>🎉</div>
                    <h2 style={{ fontFamily: "'Fredoka One',cursive", color: 'var(--navy)', marginBottom: '0.3rem', fontSize: '1.3rem' }}>You&apos;re Invited to Collaborate!</h2>
                    <div style={{ background: 'var(--light-bg)', borderRadius: 12, padding: '1.2rem', margin: '1rem 0', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 700, color: '#9aabbb', fontSize: '0.82rem' }}>Event</span>
                            <span style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '0.82rem' }}>{invite.eventName}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 700, color: '#9aabbb', fontSize: '0.82rem' }}>Invited by</span>
                            <span style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '0.82rem' }}>{invite.inviterName}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 700, color: '#9aabbb', fontSize: '0.82rem' }}>Your Role</span>
                            <span style={{ fontWeight: 800, color: 'var(--teal)', fontSize: '0.82rem' }}>{invite.role}</span>
                        </div>
                    </div>
                    <p style={{ color: '#9aabbb', fontWeight: 600, fontSize: '0.88rem', marginBottom: '1.5rem' }}>Log in or sign up to accept this invitation and start collaborating.</p>
                    <button onClick={() => router.push(`/login?redirect=/collaborate?token=${token}`)} style={{ width: '100%', padding: '0.8rem', borderRadius: 10, background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Log In to Accept</button>
                    <button onClick={() => router.push(`/login?redirect=/collaborate?token=${token}`)} style={{ width: '100%', padding: '0.8rem', borderRadius: 10, background: 'transparent', color: 'var(--teal)', border: '1.5px solid var(--teal)', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' }}>Sign Up (New User)</button>
                </div>
            </main>
        )
    }

    return (
        <main className="page-enter" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: 500 }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>🎉</div>
                <h2 style={{ fontFamily: "'Fredoka One',cursive", color: 'var(--navy)', marginBottom: '0.3rem', fontSize: '1.3rem' }}>Collaboration Invite</h2>
                <div style={{ background: 'var(--light-bg)', borderRadius: 12, padding: '1.2rem', margin: '1rem 0', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: '#9aabbb', fontSize: '0.82rem' }}>Event</span>
                        <span style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '0.82rem' }}>{invite.eventName}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: '#9aabbb', fontSize: '0.82rem' }}>Invited by</span>
                        <span style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '0.82rem' }}>{invite.inviterName}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: '#9aabbb', fontSize: '0.82rem' }}>Your Role</span>
                        <span style={{ fontWeight: 800, color: 'var(--teal)', fontSize: '0.82rem' }}>{invite.role}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, color: '#9aabbb', fontSize: '0.82rem' }}>Logged in as</span>
                        <span style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '0.82rem' }}>{user?.displayName || user?.email}</span>
                    </div>
                </div>
                {invite.status === 'accepted' ? (
                    <>
                        <p style={{ color: 'var(--teal)', fontWeight: 800, marginBottom: '1rem' }}>✅ Already accepted!</p>
                        <button onClick={() => router.push('/dashboard')} style={{ width: '100%', padding: '0.8rem', borderRadius: 10, background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' }}>Go to Dashboard</button>
                    </>
                ) : (
                    <button disabled={accepting} onClick={handleAccept} style={{ width: '100%', padding: '0.8rem', borderRadius: 10, background: 'linear-gradient(135deg, var(--yellow), #E8896A)', color: 'var(--dark-navy)', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem', opacity: accepting ? 0.6 : 1 }}>
                        {accepting ? '⏳ Accepting...' : '🎉 Accept & Join Event'}
                    </button>
                )}
            </div>
        </main>
    )
}

export default function CollaboratePage() {
    return (
        <Suspense fallback={<main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" style={{ width: 40, height: 40 }} /></main>}>
            <CollaborateContent />
        </Suspense>
    )
}
