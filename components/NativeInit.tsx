'use client'

import { useEffect } from 'react'

/**
 * NativeInit — initializes Capacitor native plugins when running inside the mobile app.
 * This is a client component that runs once on mount.
 * On web, it does nothing (all calls are guarded by isNativePlatform()).
 */
export default function NativeInit() {
    useEffect(() => {
        // Dynamically import to avoid SSR issues
        import('@/lib/capacitor-init').then(({ initNativeApp }) => {
            initNativeApp()
        }).catch(() => {
            // Silently fail on web — Capacitor not available
        })
    }, [])

    return null
}
