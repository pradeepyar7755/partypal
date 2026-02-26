'use client'
import { useState, useEffect, useCallback } from 'react'

interface ToastItem {
    id: number
    message: string
    type: 'success' | 'info' | 'error'
    exiting: boolean
}

let toastIdCounter = 0
let addToastGlobal: ((message: string, type?: 'success' | 'info' | 'error') => void) | null = null

export function showToast(message: string, type: 'success' | 'info' | 'error' = 'success') {
    if (addToastGlobal) addToastGlobal(message, type)
}

export default function ToastContainer() {
    const [toasts, setToasts] = useState<ToastItem[]>([])

    const addToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
        const id = ++toastIdCounter
        setToasts(prev => [...prev, { id, message, type, exiting: false }])
        setTimeout(() => {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300)
        }, 3000)
    }, [])

    useEffect(() => {
        addToastGlobal = addToast
        return () => { addToastGlobal = null }
    }, [addToast])

    if (toasts.length === 0) return null

    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast ${t.type} ${t.exiting ? 'exit' : ''}`}>
                    {t.type === 'success' && '✓'}
                    {t.type === 'error' && '✗'}
                    {t.type === 'info' && 'ℹ'}
                    {t.message}
                </div>
            ))}
        </div>
    )
}
