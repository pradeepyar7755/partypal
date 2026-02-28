'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

const AI_MEMORY_KEY = 'partypal_ai_memory'

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()


  useEffect(() => {
    setMobileOpen(false)
    setShowDropdown(false)
  }, [pathname])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Admin email whitelist — must match lib/admin-auth.ts
  const isAdmin = user?.email === 'admin@partypal.social'

  const links = [
    ...(isAdmin ? [{ href: '/admin', label: 'Analytics' }] : []),
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'My Events' },
    { href: '/vendors', label: 'Vendors' },
    { href: '/guests', label: 'Guests' },
    { href: '/contact', label: 'Contact' },
  ]

  const getInitials = () => {
    if (!user) return '?'
    if (user.displayName) return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    if (user.email) return user.email[0].toUpperCase()
    return 'G'
  }

  const isGuest = user?.isAnonymous

  return (
    <>
      <nav>
        <Link href="/" className="nav-logo">🎊 Party<span>Pal</span></Link>
        <button className={`hamburger ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
        <ul className={mobileOpen ? 'mobile-open' : ''}>
          {links.map(l => (
            <li key={l.href}>
              <Link
                href={l.href}
                style={
                  l.href === '/admin'
                    ? { color: pathname === '/admin' ? '#F7C948' : 'rgba(247,201,72,0.7)', fontWeight: 800 }
                    : pathname === l.href ? { color: 'white' } : {}
                }
              >
                {l.href === '/admin' ? '📊 ' : ''}{l.label}
              </Link>
            </li>
          ))}
          <li>
            {loading ? (
              <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'inline-block' }} />
            ) : user ? (
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: isGuest ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #4AADA8, #3D8C6E)',
                    border: isGuest ? '1.5px solid rgba(255,255,255,0.2)' : '2px solid rgba(255,255,255,0.3)',
                    color: '#fff', fontWeight: 900, fontSize: '0.75rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    getInitials()
                  )}
                </button>
                {showDropdown && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 220,
                    background: '#1a2535', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 14, padding: '0.8rem', zIndex: 1000,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}>
                    <div style={{ padding: '0.4rem 0.6rem', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.88rem', marginBottom: '0.1rem' }}>
                        {isGuest ? 'Guest User' : user.displayName || 'User'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                        {isGuest ? 'Not signed in' : user.email || ''}
                      </div>
                    </div>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0.3rem 0' }} />
                    {isGuest && (
                      <Link
                        href="/login"
                        style={{
                          display: 'block', padding: '0.5rem 0.6rem', borderRadius: 8,
                          color: '#4AADA8', fontWeight: 800, fontSize: '0.82rem',
                          textDecoration: 'none', transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,173,168,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        🔗 Sign up / Log in
                      </Link>
                    )}
                    <Link
                      href="/privacy"
                      style={{
                        display: 'block', padding: '0.5rem 0.6rem', borderRadius: 8,
                        color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: '0.78rem',
                        textDecoration: 'none', transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      🔒 Privacy Policy
                    </Link>
                    <button
                      onClick={async () => { await logout(); setShowDropdown(false) }}
                      style={{
                        display: 'block', width: '100%', padding: '0.5rem 0.6rem', borderRadius: 8,
                        border: 'none', background: 'transparent', color: '#E8896A',
                        fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer',
                        textAlign: 'left', transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,137,106,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      🚪 Sign Out
                    </button>
                    {!isGuest && (
                      <>
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0.3rem 0' }} />
                        <button
                          onClick={() => { setShowDropdown(false); setShowDeleteModal(true); setDeleteConfirmEmail(''); setDeleteError('') }}
                          style={{
                            display: 'block', width: '100%', padding: '0.4rem 0.6rem', borderRadius: 8,
                            border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.3)',
                            fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer',
                            textAlign: 'left', transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,50,50,0.1)'; e.currentTarget.style.color = '#E8896A' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}
                        >
                          🗑️ Delete Account
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="nav-cta">Sign In</Link>
            )}
          </li>
        </ul>
      </nav>

      {/* ── Delete Account Confirmation Modal ── */}
      {showDeleteModal && user && !user.isAnonymous && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1a2535', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '2rem', maxWidth: 440, width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '0.8rem' }}>⚠️</div>
            <h3 style={{ fontFamily: "'Fredoka One', cursive", fontSize: '1.3rem', color: 'white', textAlign: 'center', marginBottom: '0.5rem' }}>
              Delete Your Account?
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              This will <strong style={{ color: '#E8896A' }}>permanently delete</strong> your profile, all events, guest lists, and plans.
              Anonymized analytics will be preserved. This action cannot be undone.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.4rem' }}>
                Type your email to confirm
              </label>
              <input
                type="email"
                value={deleteConfirmEmail}
                onChange={e => setDeleteConfirmEmail(e.target.value)}
                placeholder={user.email || ''}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
                  padding: '0.7rem 1rem', color: 'white',
                  fontFamily: "'Nunito', sans-serif", fontSize: '0.92rem', fontWeight: 600,
                  outline: 'none',
                }}
              />
            </div>

            {deleteError && (
              <div style={{ color: '#E8896A', fontSize: '0.82rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.8rem' }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
                  color: 'rgba(255,255,255,0.7)', fontFamily: "'Nunito', sans-serif",
                  fontSize: '0.88rem', fontWeight: 800, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                disabled={deleteConfirmEmail !== user.email || deleting}
                onClick={async () => {
                  if (deleteConfirmEmail !== user.email) return
                  setDeleting(true)
                  setDeleteError('')
                  try {
                    const token = await user.getIdToken()
                    const res = await fetch('/api/account/delete', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ confirmEmail: deleteConfirmEmail }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Deletion failed')
                    // Clear local AI memory
                    try { localStorage.removeItem(AI_MEMORY_KEY) } catch { }
                    // Sign out and redirect
                    await logout()
                    setShowDeleteModal(false)
                    window.location.href = '/'
                  } catch (err) {
                    setDeleteError(err instanceof Error ? err.message : 'Deletion failed')
                    setDeleting(false)
                  }
                }}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: 12,
                  border: 'none',
                  background: deleteConfirmEmail === user.email ? '#c0392b' : 'rgba(192,57,43,0.3)',
                  color: 'white', fontFamily: "'Nunito', sans-serif",
                  fontSize: '0.88rem', fontWeight: 800,
                  cursor: deleteConfirmEmail === user.email ? 'pointer' : 'not-allowed',
                  opacity: deleting ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {deleting ? '⏳ Deleting...' : '🗑️ Delete Forever'}
              </button>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', fontWeight: 600, textAlign: 'center', marginTop: '1rem' }}>
              Read our <a href="/privacy#account-deletion" style={{ color: '#4AADA8', textDecoration: 'none' }}>Privacy Policy</a> for details on what happens to your data.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
