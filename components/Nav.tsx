'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()

  // Hide nav on standalone invite pages
  if (pathname?.startsWith('/join')) return null

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
    ...(isAdmin ? [{ href: '/admin', label: 'Analytics' }, { href: '/docs', label: 'Docs' }] : []),
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
    <nav>
      <Link href="/" className="nav-logo"><img src="/logo.png" alt="PartyPal" className="nav-logo-img" /> Party<span>Pal</span></Link>
      <button className={`hamburger ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
        <span /><span /><span />
      </button>
      <ul className={mobileOpen ? 'mobile-open' : ''}>
        {links.map(l => (
          <li key={l.href}>
            <Link
              href={l.href}
              style={
                l.href === '/admin' || l.href === '/docs'
                  ? { color: pathname === l.href ? '#F7C948' : 'rgba(247,201,72,0.7)', fontWeight: 800 }
                  : pathname === l.href ? { color: 'white' } : {}
              }
            >
              {l.href === '/admin' ? '📊 ' : l.href === '/docs' ? '📄 ' : ''}{l.label}
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
                    href="/settings"
                    style={{
                      display: 'block', padding: '0.5rem 0.6rem', borderRadius: 8,
                      color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '0.78rem',
                      textDecoration: 'none', transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    ⚙️ Settings
                  </Link>
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
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="nav-cta">Sign In</Link>
          )}
        </li>
      </ul>
    </nav>
  )
}
