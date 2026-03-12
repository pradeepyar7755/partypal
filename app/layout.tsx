import type { Metadata, Viewport } from 'next'
import { Nunito, Fredoka } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import Nav from '@/components/Nav'
import ToastContainer from '@/components/Toast'
import { AuthProvider } from '@/components/AuthContext'
import AnalyticsProvider from '@/components/AnalyticsProvider'
import NativeInit from '@/components/NativeInit'
import BugReportButton from '@/components/BugReportButton'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-nunito',
})

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
  variable: '--font-fredoka',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a1a',
}

export const metadata: Metadata = {
  title: 'PartyPal — AI Party Planner',
  description: 'Plan the perfect party with AI. Venues, vendors, guests, budget tracking, and more — all in one place.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/app-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PartyPal',
  },
  openGraph: {
    title: 'PartyPal — AI Party Planner',
    description: 'From venue to entertainment, plan memorable celebrations with AI.',
    siteName: 'PartyPal',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PartyPal — AI Party Planner',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PartyPal — AI Party Planner',
    description: 'From venue to entertainment, plan memorable celebrations with AI.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${fredoka.variable}`}>
      <body>
        <AuthProvider>
          <AnalyticsProvider>
            <NativeInit />
            <Nav />
            <ToastContainer />
            {children}
            <BugReportButton />
          </AnalyticsProvider>
        </AuthProvider>
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && (
          <Script
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
            strategy="lazyOnload"
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  )
}
