'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [eventName, setEventName] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const stored = localStorage.getItem('partyplan')
    if (stored) {
      try {
        const p = JSON.parse(stored)
        if (p.eventType) setEventName(p.eventType)
      } catch { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const links = [
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'My Events' },
    { href: '/vendors', label: 'Vendors' },
    { href: '/guests', label: 'Guests' },
  ]

  return (
    <nav>
      <Link href="/" className="nav-logo">🎊 Party<span>Pal</span></Link>
      <button className={`hamburger ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
        <span /><span /><span />
      </button>
      <ul className={mobileOpen ? 'mobile-open' : ''}>
        {links.map(l => (
          <li key={l.href}>
            <Link href={l.href} style={pathname === l.href ? { color: 'white' } : {}}>
              {l.label}
              {l.href === '/dashboard' && eventName && (
                <span style={{ fontSize: '0.65rem', background: 'rgba(247,201,72,0.15)', color: '#F7C948', padding: '0.15rem 0.5rem', borderRadius: 50, marginLeft: '0.4rem', fontWeight: 800 }}>
                  {eventName.replace(/^[^\s]+\s/, '').slice(0, 12)}
                </span>
              )}
            </Link>
          </li>
        ))}
        <li><Link href="/#wizard" className="nav-cta">Plan a Party</Link></li>
      </ul>
    </nav>
  )
}
