import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import ToastContainer from '@/components/Toast'
import { AuthProvider } from '@/components/AuthContext'
import AnalyticsProvider from '@/components/AnalyticsProvider'
import NativeInit from '@/components/NativeInit'
import BugReportButton from '@/components/BugReportButton'

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
        {/* Mobile app icons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/app-icon.png" />
        {/* Google AdSense — Auto Ads enabled on all pages */}
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && (
          <>
            <script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
              crossOrigin="anonymous"
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  (adsbygoogle = window.adsbygoogle || []).push({
                    google_ad_client: "${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}",
                    enable_page_level_ads: true
                  });
                `,
              }}
            />
          </>
        )}
      </head>
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
      </body>
    </html>
  )
}
