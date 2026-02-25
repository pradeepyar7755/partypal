'use client'
import Link from 'next/link'

export default function Nav() {
  return (
    <nav>
      <Link href="/" className="nav-logo">Party<span>Pal</span></Link>
      <ul>
        <li><Link href="/vendors">Browse</Link></li>
        <li><Link href="/results">My Events</Link></li>
        <li><Link href="/vendors">Vendors</Link></li>
        <li><Link href="/#wizard" className="nav-cta">Plan a Party</Link></li>
      </ul>
    </nav>
  )
}
