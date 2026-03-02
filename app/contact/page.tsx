'use client'
import { useState } from 'react'
import styles from './contact.module.css'

const FAQS = [
    {
        q: 'What is PartyPal?',
        a: 'PartyPal is an AI-powered party planning platform that helps you plan the perfect event — from finding venues and vendors to managing guests and budgets, all in one place.',
    },
    {
        q: 'Is PartyPal free to use?',
        a: 'Yes! You can start planning for free. Our AI planner, guest management, and vendor browsing are all available at no cost. Premium features may be introduced in the future.',
    },
    {
        q: 'How does the AI planning work?',
        a: 'Simply tell us about your event — type, date, guest count, location, theme, and budget. Our AI generates a custom plan with a checklist, timeline, vendor shortlist, and budget breakdown in seconds.',
    },
    {
        q: 'Can I manage multiple events?',
        a: 'Absolutely! You can create and manage as many events as you need. Each event has its own dashboard with budget tracking, guest list, and vendor management.',
    },
    {
        q: 'How do I invite guests and track RSVPs?',
        a: 'Head to the Guests page from your dashboard. You can add guests manually, send digital invitations, and track RSVPs in real time — including dietary preferences and plus-ones.',
    },
    {
        q: 'What cities do you support?',
        a: 'PartyPal works for any location! Our AI will generate plans based on your city, and our vendor marketplace is growing across the US with a focus on major metro areas.',
    },
]

const CATEGORIES = [
    { value: '', label: 'Select a category...' },
    { value: 'tab', label: '🗂️  Tab / Navigation Issue' },
    { value: 'feature', label: '⚙️  Feature Not Working' },
    { value: 'experience', label: '✨  User Experience Issue' },
    { value: 'bug', label: '🐛  Bug Report' },
    { value: 'suggestion', label: '💡  Suggestion / Idea' },
    { value: 'other', label: '📝  Other' },
]

export default function ContactPage() {
    const [activeTab, setActiveTab] = useState<'faq' | 'email' | 'feedback'>('faq')
    const [openFaq, setOpenFaq] = useState<number | null>(null)
    const [copied, setCopied] = useState(false)
    const [feedbackForm, setFeedbackForm] = useState({ category: '', description: '', email: '', name: '' })
    const [submitted, setSubmitted] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')

    const supportEmail = 'support@partypal.social'

    const handleCopy = () => {
        navigator.clipboard.writeText(supportEmail)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleFeedbackSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!feedbackForm.category || !feedbackForm.description.trim()) return
        setSubmitting(true)
        setSubmitError('')
        try {
            const res = await fetch('/api/bugs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: feedbackForm.category,
                    description: feedbackForm.description.trim(),
                    page: '/contact',
                    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                    email: feedbackForm.email || '',
                    name: feedbackForm.name || '',
                }),
            })
            if (!res.ok) throw new Error('Failed to submit')
            setSubmitted(true)
            setTimeout(() => {
                setSubmitted(false)
                setFeedbackForm({ category: '', description: '', email: '', name: '' })
            }, 4000)
        } catch {
            setSubmitError('Failed to submit. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <main className="page-enter">
            <div className={styles.contactPage}>
                <div className={styles.contactInner}>
                    {/* Header */}
                    <div className={styles.contactBadge}>📬 Get in Touch</div>
                    <h1 className={styles.contactTitle}>How Can We <em>Help</em>?</h1>
                    <p className={styles.contactSub}>
                        Have a question, feedback, or something to report? We&apos;re here to help make your party planning experience amazing.
                    </p>

                    {/* Tabs */}
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${activeTab === 'faq' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('faq')}
                        >
                            ❓ FAQs
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'email' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('email')}
                        >
                            ✉️ Email Us
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'feedback' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('feedback')}
                        >
                            📝 Feedback & Report
                        </button>
                    </div>

                    {/* ── FAQs ── */}
                    {activeTab === 'faq' && (
                        <div className={styles.tabContent}>
                            <div className={styles.faqList}>
                                {FAQS.map((faq, i) => (
                                    <div key={i} className={styles.faqItem}>
                                        <button
                                            className={styles.faqQuestion}
                                            onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                        >
                                            {faq.q}
                                            <span className={`${styles.faqChevron} ${openFaq === i ? styles.faqChevronOpen : ''}`}>
                                                ▼
                                            </span>
                                        </button>
                                        <div className={`${styles.faqAnswer} ${openFaq === i ? styles.faqAnswerOpen : ''}`}>
                                            <p>{faq.a}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Email ── */}
                    {activeTab === 'email' && (
                        <div className={styles.tabContent}>
                            <div className={styles.emailSection}>
                                <span className={styles.emailIcon}>✉️</span>
                                <div className={styles.emailLabel}>Reach Us Directly</div>
                                <span className={styles.emailAddress}>{supportEmail}</span>
                                <div className={styles.emailActions}>
                                    <a href={`mailto:${supportEmail}`} className={styles.emailBtn}>
                                        📧 Send Email
                                    </a>
                                    <button onClick={handleCopy} className={`${styles.emailBtn} ${styles.emailBtnSecondary}`}>
                                        📋 Copy Address
                                    </button>
                                </div>
                                {copied && (
                                    <div className={styles.copiedToast}>✅ Copied to clipboard!</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Feedback Form ── */}
                    {activeTab === 'feedback' && (
                        <div className={styles.tabContent}>
                            {submitted ? (
                                <div className={styles.successMessage}>
                                    <span className={styles.successIcon}>🎉</span>
                                    <h3>Thank You!</h3>
                                    <p>Your feedback has been submitted. We&apos;ll review it and work on improving your experience.</p>
                                </div>
                            ) : (
                                <form className={styles.feedbackForm} onSubmit={handleFeedbackSubmit}>
                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup}>
                                            <label>What&apos;s this about? *</label>
                                            <select
                                                value={feedbackForm.category}
                                                onChange={e => setFeedbackForm({ ...feedbackForm, category: e.target.value })}
                                                required
                                            >
                                                {CATEGORIES.map(c => (
                                                    <option key={c.value} value={c.value}>{c.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Your Name (optional)</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Sarah"
                                                value={feedbackForm.name}
                                                onChange={e => setFeedbackForm({ ...feedbackForm, name: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Describe what happened *</label>
                                        <textarea
                                            placeholder="Tell us what's not working, what could be better, or share your idea..."
                                            value={feedbackForm.description}
                                            onChange={e => setFeedbackForm({ ...feedbackForm, description: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Your Email (optional — for follow-up)</label>
                                        <input
                                            type="email"
                                            placeholder="you@example.com"
                                            value={feedbackForm.email}
                                            onChange={e => setFeedbackForm({ ...feedbackForm, email: e.target.value })}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className={styles.submitBtn}
                                        disabled={!feedbackForm.category || !feedbackForm.description.trim() || submitting}
                                    >
                                        {submitting ? '⏳ Submitting...' : '🚀 Submit Feedback'}
                                    </button>
                                    {submitError && (
                                        <div style={{ color: '#E8896A', fontSize: '0.82rem', fontWeight: 700, marginTop: '0.5rem', textAlign: 'center' }}>
                                            {submitError}
                                        </div>
                                    )}
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
