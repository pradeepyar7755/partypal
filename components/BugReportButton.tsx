'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import styles from './BugReportButton.module.css'

const CATEGORIES = [
    { value: '', label: 'Select a category...' },
    { value: 'bug', label: '🐛  Bug Report' },
    { value: 'tab', label: '🗂️  Tab / Navigation Issue' },
    { value: 'feature', label: '⚙️  Feature Not Working' },
    { value: 'experience', label: '✨  User Experience Issue' },
    { value: 'suggestion', label: '💡  Suggestion / Idea' },
    { value: 'other', label: '📝  Other' },
]

export default function BugReportButton() {
    const pathname = usePathname()
    // Hide on standalone invite pages
    if (pathname?.startsWith('/join')) return null

    const [open, setOpen] = useState(false)
    const [form, setForm] = useState({ category: '', description: '' })
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const { user } = useAuth()

    const handleSubmit = async () => {
        if (!form.category || !form.description.trim()) return
        setSubmitting(true)
        try {
            const res = await fetch('/api/bugs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: form.category,
                    description: form.description.trim(),
                    page: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
                    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                    uid: user?.uid || '',
                    email: user?.email || '',
                    name: user?.displayName || '',
                }),
            })
            if (!res.ok) throw new Error('Failed to submit')
            setSubmitted(true)
            setTimeout(() => {
                setSubmitted(false)
                setOpen(false)
                setForm({ category: '', description: '' })
            }, 3000)
        } catch (err) {
            console.error('Bug report submission error:', err)
            alert('Failed to submit bug report. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className={styles.fab}>
            {open && (
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.panelTitle}>🐛 Report a Bug</div>
                        <button className={styles.panelClose} onClick={() => setOpen(false)}>✕</button>
                    </div>
                    {submitted ? (
                        <div className={styles.success}>
                            <span className={styles.successIcon}>🎉</span>
                            <h4>Thanks!</h4>
                            <p>Your report has been submitted. We&apos;ll look into it.</p>
                        </div>
                    ) : (
                        <div className={styles.panelBody}>
                            <div className={styles.pagePill}>
                                📍 {typeof window !== 'undefined' ? window.location.pathname : '/'}
                            </div>
                            <div className={styles.formGroup}>
                                <label>Category *</label>
                                <select
                                    value={form.category}
                                    onChange={e => setForm({ ...form, category: e.target.value })}
                                >
                                    {CATEGORIES.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>What happened? *</label>
                                <textarea
                                    placeholder="Describe the issue or suggestion..."
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                />
                            </div>
                            <button
                                className={styles.submitBtn}
                                onClick={handleSubmit}
                                disabled={!form.category || !form.description.trim() || submitting}
                            >
                                {submitting ? (
                                    <>
                                        <span className={styles.spinner} />
                                        Submitting...
                                    </>
                                ) : '🚀 Submit Report'}
                            </button>
                        </div>
                    )}
                </div>
            )}
            <button
                className={`${styles.fabBtn} ${open ? styles.fabBtnOpen : ''}`}
                onClick={() => setOpen(!open)}
                aria-label="Report a bug"
                title="Report a bug"
            >
                {open ? '✕' : '🐛'}
            </button>
        </div>
    )
}
