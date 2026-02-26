import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import ToastContainer from '@/components/Toast'

export const metadata: Metadata = {
  title: 'PartyPal — AI Party Planning',
  description: 'Plan the perfect party with AI. Venues, vendors, guests, budget tracking, and more — all in one place.',
  openGraph: {
    title: 'PartyPal — AI-Powered Party Planning',
    description: 'From venue to entertainment, plan unforgettable celebrations with AI.',
    siteName: 'PartyPal',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Nav />
        <ToastContainer />
        {children}
      </body>
    </html>
  )
}
