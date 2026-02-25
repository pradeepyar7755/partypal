import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PartyPal — AI Party Planning',
  description: 'Plan the perfect party with AI. Venues, vendors, guests, and more.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <a href="/" className="nav-logo">🎊 Party<span>Pal</span></a>
          <ul>
            <li><a href="/vendors">Browse</a></li>
            <li><a href="/results">My Events</a></li>
            <li><a href="/vendors">Vendors</a></li>
            <li><a href="/#wizard" className="nav-cta">Plan a Party</a></li>
          </ul>
        </nav>
        {children}
      </body>
    </html>
  )
}
