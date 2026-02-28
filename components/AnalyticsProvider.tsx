'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trackPageView, initErrorTracking, setAnalyticsUserId } from '@/lib/analytics'
import { useAuth } from '@/components/AuthContext'

/**
 * Analytics Provider — drop into layout to auto-track:
 * - Page views (on every route change)
 * - Global errors (unhandled + promise rejections)
 * - User identity (links Firebase uid to analytics)
 */
export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { user } = useAuth()
    const initialized = useRef(false)

    // Initialize error tracking once
    useEffect(() => {
        if (initialized.current) return
        initialized.current = true
        initErrorTracking()
    }, [])

    // Track page views on route change
    useEffect(() => {
        trackPageView()
    }, [pathname])

    // Link user identity
    useEffect(() => {
        setAnalyticsUserId(user?.uid || null)
    }, [user?.uid])

    return <>{children}</>
}
