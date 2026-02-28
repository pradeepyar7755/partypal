import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import ToastContainer from '@/components/Toast'
import { AuthProvider } from '@/components/AuthContext'
import AnalyticsProvider from '@/components/AnalyticsProvider'
import NativeInit from '@/components/NativeInit'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a1a',
}

export const metadata: Metadata = {
  title: 'PartyPal — AI Party Planning',
  description: 'Plan the perfect party with AI. Venues, vendors, guests, budget tracking, and more — all in one place.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PartyPal',
  },
  openGraph: {
    title: 'PartyPal — AI-Powered Party Planning',
    description: 'From venue to entertainment, plan memorable celebrations with AI.',
    siteName: 'PartyPal',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
        {/* Mobile app icons */}
        <link rel="apple-touch-icon" href="/app-icon.png" />
        <link rel="icon" type="image/png" href="/app-icon.png" />
      </head>
      <body>
        <AuthProvider>
          <AnalyticsProvider>
            <NativeInit />
            <Nav />
            <ToastContainer />
            {children}
          </AnalyticsProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
