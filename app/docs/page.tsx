'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import styles from './docs.module.css'
import { SITE_EMAILS } from '@/lib/constants'

// Admin email whitelist — must match lib/admin-auth.ts
const ADMIN_EMAILS = [SITE_EMAILS.admin]

const TAB_EMOJIS: Record<string, string> = {
    '0-product-specs': '📋',
    '1-implementation-plan': '🏗️',
    '2-functional-design': '🎨',
    '3-technical-design': '⚙️',
    '4-agentic-workflow': '🤖',
    '5-claude-skill': '🧠',
    '6-resource-usage': '💰',
    '7-subscription-model': '💳',
}

interface DocItem {
    id: string
    title: string
    filename: string
    content: string
}

export default function DocsPage() {
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()
    const [docs, setDocs] = useState<DocItem[]>([])
    const [activeDoc, setActiveDoc] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const isAdmin = user && ADMIN_EMAILS.includes(user.email || '')

    // Configure marked for GFM tables
    useEffect(() => {
        marked.setOptions({
            gfm: true,
            breaks: true,
        })
    }, [])

    // Fetch docs
    useEffect(() => {
        if (!authLoading && isAdmin) {
            (async () => {
                try {
                    const res = await fetch('/api/docs')
                    if (!res.ok) throw new Error('Failed to load docs')
                    const data = await res.json()
                    setDocs(data.docs || [])
                    if (data.docs?.length > 0) {
                        setActiveDoc(data.docs[0].id)
                    }
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to load docs')
                }
                setLoading(false)
            })()
        }
    }, [authLoading, isAdmin])

    // Auth loading
    if (authLoading) {
        return (
            <main className={styles.docsPage}>
                <div className={styles.loading}>
                    <div className="spinner" style={{ width: 40, height: 40 }} />
                    <div className={styles.loadingText}>Loading...</div>
                </div>
            </main>
        )
    }

    // Not admin
    if (!user || !isAdmin) {
        return (
            <main className={styles.docsPage}>
                <div className={styles.accessDenied}>
                    <div style={{ fontSize: '3rem' }}>🔒</div>
                    <div className={styles.accessTitle}>Admin Access Required</div>
                    <div className={styles.accessSub}>
                        {user ? `${user.email} is not an admin account` : 'Please sign in with an admin account'}
                    </div>
                    <button className="btn-primary" onClick={() => router.push(user ? '/' : '/login')} style={{ marginTop: '1rem' }}>
                        {user ? '← Back to Home' : '🔓 Sign In'}
                    </button>
                </div>
            </main>
        )
    }

    const currentDoc = docs.find(d => d.id === activeDoc)
    const rawHTML = currentDoc ? marked.parse(currentDoc.content) : ''
    const sanitizedHTML = DOMPurify.sanitize(typeof rawHTML === 'string' ? rawHTML : '')

    return (
        <main className={styles.docsPage}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.logo}><img src="/logo.png" alt="PartyPal" style={{ height: 30, borderRadius: 6, marginRight: '0.4rem' }} />Party<span>Pal</span></div>
                    <span className={styles.docsBadge}>Docs</span>
                </div>
                <div className={styles.headerRight}>
                    <a href="/admin" className={styles.backLink}>📊 Analytics</a>
                    <a href="/" className={styles.backLink}>← Back to App</a>
                </div>
            </header>

            {loading ? (
                <div className={styles.loading}>
                    <div className="spinner" style={{ width: 40, height: 40 }} />
                    <div className={styles.loadingText}>Loading documentation...</div>
                </div>
            ) : error ? (
                <div className={styles.loading}>
                    <div style={{ fontSize: '2rem' }}>⚠️</div>
                    <div className={styles.loadingText}>{error}</div>
                </div>
            ) : (
                <div className={styles.layout}>
                    {/* Sidebar Tabs */}
                    <aside className={styles.sidebar}>
                        <div className={styles.sidebarTitle}>Documentation</div>
                        <div className={styles.tabList}>
                            {docs.map((doc, i) => (
                                <button
                                    key={doc.id}
                                    className={activeDoc === doc.id ? styles.tabActive : styles.tab}
                                    onClick={() => setActiveDoc(doc.id)}
                                >
                                    <span className={styles.tabNumber}>
                                        {TAB_EMOJIS[doc.id] || i}
                                    </span>
                                    {doc.title}
                                </button>
                            ))}
                        </div>
                    </aside>

                    {/* Content Area */}
                    <div className={styles.content}>
                        {currentDoc && (
                            <article
                                className={styles.markdown}
                                dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
                            />
                        )}
                    </div>
                </div>
            )}
        </main>
    )
}
