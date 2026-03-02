'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { updateProfile } from 'firebase/auth'
import styles from './settings.module.css'

const AI_MEMORY_KEY = 'partypal_ai_memory'
const PREFS_KEY = 'partypal_user_prefs'

interface UserPrefs {
    defaultEventType: string
    defaultLocation: string
    defaultCurrency: string
    emailNotifications: boolean
    pollNotifications: boolean
    rsvpNotifications: boolean
    darkMode: boolean
    showTips: boolean
}

const DEFAULT_PREFS: UserPrefs = {
    defaultEventType: '',
    defaultLocation: '',
    defaultCurrency: 'USD',
    emailNotifications: true,
    pollNotifications: true,
    rsvpNotifications: true,
    darkMode: false,
    showTips: true,
}

export default function SettingsPage() {
    const router = useRouter()
    const { user, loading: authLoading, logout } = useAuth()

    // Profile fields
    const [displayName, setDisplayName] = useState('')
    const [initName, setInitName] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState('')

    // Preferences
    const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS)
    const [initPrefs, setInitPrefs] = useState<UserPrefs>(DEFAULT_PREFS)

    // Delete account
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState('')

    // Load profile data
    useEffect(() => {
        if (user && !user.isAnonymous) {
            const name = user.displayName || ''
            setDisplayName(name)
            setInitName(name)
        }
    }, [user])

    // Load prefs from localStorage, then try cloud
    useEffect(() => {
        try {
            const stored = localStorage.getItem(PREFS_KEY)
            if (stored) {
                const parsed = { ...DEFAULT_PREFS, ...JSON.parse(stored) }
                setPrefs(parsed)
                setInitPrefs(parsed)
            }
        } catch { /* noop */ }
        // Pull from cloud if logged in
        if (user && !user.isAnonymous) {
            fetch(`/api/user-data?uid=${user.uid}`)
                .then(r => r.json())
                .then(({ data }) => {
                    if (data?.settings) {
                        const cloudPrefs = { ...DEFAULT_PREFS, ...data.settings }
                        setPrefs(cloudPrefs)
                        setInitPrefs(cloudPrefs)
                        localStorage.setItem(PREFS_KEY, JSON.stringify(cloudPrefs))
                    }
                })
                .catch(() => { })
        }
    }, [user])

    // Derived state
    const isGuest = user?.isAnonymous
    const profileChanged = displayName.trim() !== initName
    const prefsChanged = JSON.stringify(prefs) !== JSON.stringify(initPrefs)
    const hasChanges = profileChanged || prefsChanged

    const getInitials = () => {
        if (!user) return '?'
        if (user.displayName) return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        if (user.email) return user.email[0].toUpperCase()
        return 'U'
    }

    const getSignInMethod = () => {
        if (!user) return null
        const providers = user.providerData
        if (providers.length === 0) return 'anonymous'
        const p = providers[0].providerId
        if (p === 'google.com') return 'Google'
        if (p === 'apple.com') return 'Apple'
        if (p === 'password') return 'Email & Password'
        return p
    }

    const getMemberSince = () => {
        if (!user?.metadata.creationTime) return 'Unknown'
        return new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
        })
    }

    // Save profile
    const handleSave = async () => {
        if (!user || !hasChanges) return
        setSaving(true)
        setSaveMsg('')
        try {
            if (profileChanged && displayName.trim()) {
                await updateProfile(user, { displayName: displayName.trim() })
                setInitName(displayName.trim())
            }
            if (prefsChanged) {
                localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
                setInitPrefs({ ...prefs })
                // Sync to cloud
                if (!user.isAnonymous) {
                    fetch('/api/user-data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uid: user.uid, settings: prefs }),
                    }).catch(() => { })
                }
            }
            setSaveMsg('Settings saved!')
            setTimeout(() => setSaveMsg(''), 3000)
        } catch {
            setSaveMsg('Failed to save — please try again')
        }
        setSaving(false)
    }

    // Clear AI memory
    const clearAIMemory = () => {
        try {
            localStorage.removeItem(AI_MEMORY_KEY)
            localStorage.removeItem('partyplan')
            // Also clear from cloud
            if (user && !user.isAnonymous) {
                fetch('/api/user-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid: user.uid, aiMemory: null }),
                }).catch(() => { })
            }
            setSaveMsg('AI memory & plan cache cleared!')
            setTimeout(() => setSaveMsg(''), 3000)
        } catch { /* noop */ }
    }

    // Export data
    const exportData = () => {
        const data: Record<string, unknown> = {}
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith('partypal')) {
                try { data[key] = JSON.parse(localStorage.getItem(key) || '') } catch {
                    data[key!] = localStorage.getItem(key)
                }
            }
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `partypal-export-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
        setSaveMsg('Data exported!')
        setTimeout(() => setSaveMsg(''), 3000)
    }

    // Delete account
    const handleDelete = async () => {
        if (!user || deleteConfirmEmail !== user.email) return
        setDeleting(true)
        setDeleteError('')
        try {
            const token = await user.getIdToken()
            const res = await fetch('/api/account/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ confirmEmail: deleteConfirmEmail }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Deletion failed')
            try { localStorage.removeItem(AI_MEMORY_KEY) } catch { /* noop */ }
            await logout()
            window.location.href = '/'
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : 'Deletion failed')
            setDeleting(false)
        }
    }

    // Update pref helper
    const setPref = <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
        setPrefs(p => ({ ...p, [key]: value }))
    }

    // Auth guard
    if (authLoading) {
        return (
            <main className={styles.settingsPage}>
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
                    <div className="spinner" style={{ width: 40, height: 40 }} />
                </div>
            </main>
        )
    }

    if (!user) {
        router.push('/login?redirect=/settings')
        return null
    }

    return (
        <main className={styles.settingsPage}>
            <div className={styles.settingsContainer}>

                {/* Header */}
                <Link href="/dashboard" className={styles.backLink}>← Back to Dashboard</Link>
                <div className={styles.settingsHeader}>
                    <h1>⚙️ Settings</h1>
                    <p>Manage your profile, preferences, and account</p>
                </div>

                {/* Global success/error message */}
                {saveMsg && (
                    <div className={styles.successMsg}>
                        {saveMsg.includes('Failed') ? '❌' : '✅'} {saveMsg}
                    </div>
                )}

                {/* ═══ PROFILE ═══ */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                        <span className={styles.sectionEmoji}>👤</span> Profile
                    </div>

                    {/* Avatar row */}
                    <div className={styles.avatarSection}>
                        <div className={styles.avatar}>
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="" />
                            ) : (
                                getInitials()
                            )}
                        </div>
                        <div className={styles.avatarInfo}>
                            <h3>{isGuest ? 'Guest User' : (user.displayName || 'User')}</h3>
                            <p>{isGuest ? 'Sign up to save your settings' : user.email}</p>
                        </div>
                    </div>

                    {!isGuest && (
                        <>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Display Name</label>
                                <input
                                    type="text"
                                    className={styles.fieldInput}
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    placeholder="Your name"
                                />
                            </div>

                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Email</label>
                                <input
                                    type="email"
                                    className={styles.fieldInput}
                                    value={user.email || ''}
                                    disabled
                                />
                                <div className={styles.fieldHint}>Email cannot be changed</div>
                            </div>

                            <div className={styles.fieldRow}>
                                <div className={styles.fieldCol}>
                                    <label className={styles.fieldLabel}>Sign-in Method</label>
                                    <input type="text" className={styles.fieldInput} value={getSignInMethod() || ''} disabled />
                                </div>
                                <div className={styles.fieldCol}>
                                    <label className={styles.fieldLabel}>Member Since</label>
                                    <input type="text" className={styles.fieldInput} value={getMemberSince()} disabled />
                                </div>
                            </div>
                        </>
                    )}

                    {isGuest && (
                        <div style={{ padding: '0 1.5rem 1.2rem' }}>
                            <Link
                                href="/login"
                                style={{
                                    display: 'inline-block', padding: '0.65rem 1.5rem', borderRadius: 12,
                                    background: 'linear-gradient(135deg, var(--teal), var(--green))',
                                    color: 'white', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none',
                                    fontFamily: "'Fredoka One', cursive",
                                }}
                            >
                                🔗 Sign Up to Save Profile
                            </Link>
                        </div>
                    )}
                </div>

                {/* ═══ PARTY PLANNING DEFAULTS ═══ */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                        <span className={styles.sectionEmoji}>🎉</span> Party Planning Defaults
                    </div>

                    <div className={styles.fieldRow}>
                        <div className={styles.fieldCol}>
                            <label className={styles.fieldLabel}>Default Event Type</label>
                            <select
                                className={styles.fieldInput}
                                value={prefs.defaultEventType}
                                onChange={e => setPref('defaultEventType', e.target.value)}
                            >
                                <option value="">None (ask each time)</option>
                                <option value="birthday">🎂 Birthday Party</option>
                                <option value="wedding">💒 Wedding</option>
                                <option value="corporate">🏢 Corporate Event</option>
                                <option value="holiday">🎄 Holiday Party</option>
                                <option value="graduation">🎓 Graduation</option>
                                <option value="babyshower">🍼 Baby Shower</option>
                                <option value="housewarming">🏠 Housewarming</option>
                                <option value="other">🎊 Other</option>
                            </select>
                        </div>
                        <div className={styles.fieldCol}>
                            <label className={styles.fieldLabel}>Default Currency</label>
                            <select
                                className={styles.fieldInput}
                                value={prefs.defaultCurrency}
                                onChange={e => setPref('defaultCurrency', e.target.value)}
                            >
                                <option value="USD">$ USD</option>
                                <option value="EUR">€ EUR</option>
                                <option value="GBP">£ GBP</option>
                                <option value="CAD">$ CAD</option>
                                <option value="AUD">$ AUD</option>
                                <option value="INR">₹ INR</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.fieldLabel}>Default City / Location</label>
                        <input
                            type="text"
                            className={styles.fieldInput}
                            value={prefs.defaultLocation}
                            onChange={e => setPref('defaultLocation', e.target.value)}
                            placeholder="e.g. Atlanta, GA"
                        />
                        <div className={styles.fieldHint}>Pre-fills "Location" when creating new events</div>
                    </div>
                </div>

                {/* ═══ NOTIFICATIONS ═══ */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                        <span className={styles.sectionEmoji}>🔔</span> Notifications
                    </div>

                    <div className={styles.toggle} onClick={() => setPref('emailNotifications', !prefs.emailNotifications)}>
                        <div className={styles.toggleInfo}>
                            <div className={styles.toggleLabel}>Email Notifications</div>
                            <div className={styles.toggleHint}>Get notified about event updates and reminders</div>
                        </div>
                        <label className={styles.switch}>
                            <input type="checkbox" checked={prefs.emailNotifications} readOnly />
                            <span className={styles.switchTrack} />
                        </label>
                    </div>

                    <div className={styles.toggle} onClick={() => setPref('pollNotifications', !prefs.pollNotifications)}>
                        <div className={styles.toggleInfo}>
                            <div className={styles.toggleLabel}>Poll Activity</div>
                            <div className={styles.toggleHint}>Get notified when someone votes on your polls</div>
                        </div>
                        <label className={styles.switch}>
                            <input type="checkbox" checked={prefs.pollNotifications} readOnly />
                            <span className={styles.switchTrack} />
                        </label>
                    </div>

                    <div className={styles.toggle} onClick={() => setPref('rsvpNotifications', !prefs.rsvpNotifications)}>
                        <div className={styles.toggleInfo}>
                            <div className={styles.toggleLabel}>RSVP Updates</div>
                            <div className={styles.toggleHint}>Get notified when guests accept or decline invitations</div>
                        </div>
                        <label className={styles.switch}>
                            <input type="checkbox" checked={prefs.rsvpNotifications} readOnly />
                            <span className={styles.switchTrack} />
                        </label>
                    </div>
                </div>

                {/* ═══ APPEARANCE ═══ */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                        <span className={styles.sectionEmoji}>🎨</span> Appearance
                    </div>

                    <div className={styles.toggle} onClick={() => setPref('showTips', !prefs.showTips)}>
                        <div className={styles.toggleInfo}>
                            <div className={styles.toggleLabel}>Show Planning Tips</div>
                            <div className={styles.toggleHint}>Display helpful tips and suggestions in the dashboard</div>
                        </div>
                        <label className={styles.switch}>
                            <input type="checkbox" checked={prefs.showTips} readOnly />
                            <span className={styles.switchTrack} />
                        </label>
                    </div>
                </div>

                {/* ═══ LINKED ACCOUNTS ═══ */}
                {!isGuest && (
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>
                            <span className={styles.sectionEmoji}>🔗</span> Linked Accounts
                        </div>

                        <div className={styles.linkedAccount}>
                            <div className={styles.linkedIcon} style={{ background: 'rgba(66,133,244,0.1)' }}>
                                🔵
                            </div>
                            <div className={styles.linkedInfo}>
                                <div className={styles.linkedName}>Google</div>
                                <div className={styles.linkedStatus} style={{ color: getSignInMethod() === 'Google' ? 'var(--teal)' : '#9aabbb' }}>
                                    {getSignInMethod() === 'Google' ? '✓ Connected' : 'Not connected'}
                                </div>
                            </div>
                        </div>

                        <div className={styles.linkedAccount}>
                            <div className={styles.linkedIcon} style={{ background: 'rgba(0,0,0,0.06)' }}>
                                🍎
                            </div>
                            <div className={styles.linkedInfo}>
                                <div className={styles.linkedName}>Apple</div>
                                <div className={styles.linkedStatus} style={{ color: getSignInMethod() === 'Apple' ? 'var(--teal)' : '#9aabbb' }}>
                                    {getSignInMethod() === 'Apple' ? '✓ Connected' : 'Not connected'}
                                </div>
                            </div>
                        </div>

                        <div className={styles.linkedAccount}>
                            <div className={styles.linkedIcon} style={{ background: 'rgba(74,173,168,0.08)' }}>
                                ✉️
                            </div>
                            <div className={styles.linkedInfo}>
                                <div className={styles.linkedName}>Email & Password</div>
                                <div className={styles.linkedStatus} style={{ color: getSignInMethod() === 'Email & Password' ? 'var(--teal)' : '#9aabbb' }}>
                                    {getSignInMethod() === 'Email & Password' ? '✓ Active' : 'Not connected'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ DATA & PRIVACY ═══ */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                        <span className={styles.sectionEmoji}>🛡️</span> Data & Privacy
                    </div>

                    <button className={styles.actionBtn} onClick={exportData}>
                        <span className={styles.actionBtnIcon}>📦</span>
                        <div>
                            <div className={styles.actionBtnLabel}>Export My Data</div>
                            <div className={styles.actionBtnHint}>Download all your PartyPal data as JSON</div>
                        </div>
                    </button>

                    <button className={styles.actionBtn} onClick={clearAIMemory}>
                        <span className={styles.actionBtnIcon}>🧹</span>
                        <div>
                            <div className={styles.actionBtnLabel}>Clear AI Memory</div>
                            <div className={styles.actionBtnHint}>Reset AI planning context and cached data</div>
                        </div>
                    </button>

                    <Link href="/privacy" className={styles.actionBtn} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <span className={styles.actionBtnIcon}>🔒</span>
                        <div>
                            <div className={styles.actionBtnLabel}>Privacy Policy</div>
                            <div className={styles.actionBtnHint}>Learn how we handle your data</div>
                        </div>
                    </Link>
                </div>

                {/* ═══ SAVE ═══ */}
                {hasChanges && (
                    <div className={styles.saveBar}>
                        <button
                            className={styles.cancelBtn}
                            onClick={() => {
                                setDisplayName(initName)
                                setPrefs({ ...initPrefs })
                            }}
                        >
                            Cancel
                        </button>
                        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                            {saving ? '⏳ Saving...' : '💾 Save Changes'}
                        </button>
                    </div>
                )}

                {/* ═══ DANGER ZONE ═══ */}
                {!isGuest && (
                    <div className={styles.dangerSection}>
                        <div className={styles.dangerTitle}>
                            <span>⚠️</span> Danger Zone
                        </div>
                        <div className={styles.dangerHint}>
                            These actions are irreversible. Proceed with caution.
                        </div>

                        <button className={styles.dangerBtn} onClick={() => { setShowDeleteModal(true); setDeleteConfirmEmail(''); setDeleteError('') }}>
                            <span className={styles.actionBtnIcon}>🗑️</span>
                            <div>
                                <div className={styles.actionBtnLabel} style={{ color: '#c0392b' }}>Delete Account</div>
                                <div className={styles.actionBtnHint}>Permanently delete your account and all associated data</div>
                            </div>
                        </button>
                    </div>
                )}

                {/* Footer */}
                <div style={{ textAlign: 'center', padding: '2rem 0 1rem', color: '#bbb', fontSize: '0.72rem', fontWeight: 600 }}>
                    🎊 PartyPal v1.0 · partypal.social
                </div>
            </div>

            {/* ═══ DELETE ACCOUNT MODAL ═══ */}
            {showDeleteModal && user && !user.isAnonymous && (
                <div className={styles.deleteOverlay} onClick={() => setShowDeleteModal(false)}>
                    <div className={styles.deleteModal} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '0.8rem' }}>⚠️</div>
                        <h3 style={{
                            fontFamily: "'Fredoka One', cursive", fontSize: '1.3rem', color: 'var(--navy)',
                            textAlign: 'center', marginBottom: '0.5rem',
                        }}>
                            Delete Your Account?
                        </h3>
                        <p style={{
                            color: '#9aabbb', fontSize: '0.85rem', fontWeight: 600,
                            textAlign: 'center', lineHeight: 1.6, marginBottom: '1.5rem',
                        }}>
                            This will <strong style={{ color: '#c0392b' }}>permanently delete</strong> your profile, all events, guest lists,
                            and plans. Anonymized analytics will be preserved. This action cannot be undone.
                        </p>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{
                                display: 'block', fontSize: '0.75rem', fontWeight: 800,
                                color: '#9aabbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.4rem',
                            }}>
                                Type your email to confirm
                            </label>
                            <input
                                type="email"
                                value={deleteConfirmEmail}
                                onChange={e => setDeleteConfirmEmail(e.target.value)}
                                placeholder={user.email || ''}
                                className={styles.fieldInput}
                            />
                        </div>

                        {deleteError && (
                            <div style={{ color: '#c0392b', fontSize: '0.82rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.8rem' }}>
                                {deleteError}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className={styles.cancelBtn}
                                style={{ flex: 1, padding: '0.75rem' }}
                            >
                                Cancel
                            </button>
                            <button
                                disabled={deleteConfirmEmail !== user.email || deleting}
                                onClick={handleDelete}
                                style={{
                                    flex: 1, padding: '0.75rem', borderRadius: 12,
                                    border: 'none',
                                    background: deleteConfirmEmail === user.email ? '#c0392b' : 'rgba(192,57,43,0.3)',
                                    color: 'white', fontFamily: "'Nunito', sans-serif",
                                    fontSize: '0.88rem', fontWeight: 800,
                                    cursor: deleteConfirmEmail === user.email ? 'pointer' : 'not-allowed',
                                    opacity: deleting ? 0.6 : 1,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {deleting ? '⏳ Deleting...' : '🗑️ Delete Forever'}
                            </button>
                        </div>

                        <p style={{ color: '#bbb', fontSize: '0.72rem', fontWeight: 600, textAlign: 'center', marginTop: '1rem' }}>
                            Read our <a href="/privacy#account-deletion" style={{ color: 'var(--teal)', textDecoration: 'none' }}>Privacy Policy</a> for details.
                        </p>
                    </div>
                </div>
            )}
        </main>
    )
}
