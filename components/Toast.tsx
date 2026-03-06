'use client'
import { useState, useEffect, useCallback } from 'react'

interface ToastItem {
    id: number
    message: string
    type: 'success' | 'info' | 'error'
    exiting: boolean
    action?: { label: string; onClick: () => void }
}

let toastIdCounter = 0
let addToastGlobal: ((message: string, type?: 'success' | 'info' | 'error', action?: { label: string; onClick: () => void }) => void) | null = null

export function showToast(message: string, type: 'success' | 'info' | 'error' = 'success', action?: { label: string; onClick: () => void }) {
    if (addToastGlobal) addToastGlobal(message, type, action)
}

export default function ToastContainer() {
    const [toasts, setToasts] = useState<ToastItem[]>([])

    const addToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success', action?: { label: string; onClick: () => void }) => {
        const id = ++toastIdCounter
        setToasts(prev => [...prev, { id, message, type, exiting: false, action }])
        const duration = action ? 5000 : 3000
        setTimeout(() => {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300)
        }, duration)
    }, [])

    useEffect(() => {
        addToastGlobal = addToast
        return () => { addToastGlobal = null }
    }, [addToast])

    const dismissToast = (id: number) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300)
    }

    if (toasts.length === 0) return null

    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast ${t.type} ${t.exiting ? 'exit' : ''}`}>
                    {t.type === 'success' && '✓'}
                    {t.type === 'error' && '✗'}
                    {t.type === 'info' && 'ℹ'}
                    {t.message}
                    {t.action && (
                        <button
                            onClick={(e) => { e.stopPropagation(); t.action!.onClick(); dismissToast(t.id) }}
                            style={{
                                marginLeft: '12px',
                                background: 'rgba(255,255,255,0.2)',
                                border: '1px solid rgba(255,255,255,0.3)',
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '2px 10px',
                                cursor: 'pointer',
                                fontSize: '0.85em',
                                fontWeight: 600,
                            }}
                        >
                            {t.action.label}
                        </button>
                    )}
                </div>
            ))}
        </div>
    )
}
