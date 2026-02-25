import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PartyPal — AI Party Planning',
  description: 'Plan the perfect party with AI. Venues, vendors, guests, and more.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
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
