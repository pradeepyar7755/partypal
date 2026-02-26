'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './guests.module.css'
import { showToast } from '@/components/Toast'

interface Guest {
  id: string; name: string; email: string; status: 'going' | 'maybe' | 'declined' | 'pending'
  dietary: string; plusOne: boolean; avatar: string; color: string
}

const DEFAULT_GUESTS: Guest[] = [
  { id: '1', name: 'Sarah Anderson', email: 'sarah@email.com', status: 'going', dietary: 'None', plusOne: true, avatar: 'SA', color: '#E8896A' },
  { id: '2', name: 'Marcus Johnson', email: 'marcus@email.com', status: 'going', dietary: 'Vegetarian', plusOne: false, avatar: 'MJ', color: '#4AADA8' },
  { id: '3', name: 'Lauren Park', email: 'lauren@email.com', status: 'maybe', dietary: 'Gluten-Free', plusOne: true, avatar: 'LP', color: '#F7C948' },
  { id: '4', name: 'David Kim', email: 'david@email.com', status: 'going', dietary: 'None', plusOne: false, avatar: 'DK', color: '#3D8C6E' },
  { id: '5', name: 'Tanya Robinson', email: 'tanya@email.com', status: 'pending', dietary: 'Vegan', plusOne: false, avatar: 'TR', color: '#7B5EA7' },
  { id: '6', name: 'Nathan Williams', email: 'nathan@email.com', status: 'declined', dietary: 'None', plusOne: false, avatar: 'NW', color: '#E8896A' },
]

const STATUS_COLORS: Record<string, string> = { going: '#3D8C6E', maybe: '#c4880a', declined: '#E8896A', pending: '#9aabbb' }
const STATUS_BG: Record<string, string> = { going: 'rgba(61,140,110,0.1)', maybe: 'rgba(247,201,72,0.15)', declined: 'rgba(232,137,106,0.1)', pending: 'rgba(150,150,170,0.1)' }

export default function Guests() {
  const router = useRouter()
  const [guests, setGuests] = useState<Guest[]>(DEFAULT_GUESTS)
  const [showAdd, setShowAdd] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [newGuest, setNewGuest] = useState({ name: '', email: '', dietary: 'None', plusOne: false })
  const [invite, setInvite] = useState<{ subject?: string; message?: string; smsVersion?: string; shareableLink?: string } | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [planData, setPlanData] = useState<{ eventType?: string; theme?: string; date?: string; location?: string }>({})
  const [copied, setCopied] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const stored = localStorage.getItem('partyplan')
    if (stored) { const p = JSON.parse(stored); setPlanData({ eventType: p.eventType, theme: p.theme, date: p.date, location: p.location }) }
  }, [])

  const stats = {
    total: guests.length,
    going: guests.filter(g => g.status === 'going').length,
    maybe: guests.filter(g => g.status === 'maybe').length,
    declined: guests.filter(g => g.status === 'declined').length,
    pending: guests.filter(g => g.status === 'pending').length,
  }

  const addGuest = () => {
    if (!newGuest.name || !newGuest.email) return
    const initials = newGuest.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    const colors = ['#E8896A', '#4AADA8', '#F7C948', '#3D8C6E', '#7B5EA7', '#2D4059']
    setGuests(prev => [...prev, {
      id: Date.now().toString(), name: newGuest.name, email: newGuest.email,
      status: 'pending', dietary: newGuest.dietary, plusOne: newGuest.plusOne,
      avatar: initials, color: colors[Math.floor(Math.random() * colors.length)]
    }])
    setNewGuest({ name: '', email: '', dietary: 'None', plusOne: false })
    setShowAdd(false)
    showToast(`${newGuest.name} added to guest list`, 'success')
  }

  const bulkImport = () => {
    const lines = bulkText.split('\n').filter(l => l.trim())
    const colors = ['#E8896A', '#4AADA8', '#F7C948', '#3D8C6E', '#7B5EA7', '#2D4059']
    const newGuests: Guest[] = lines.map((line, i) => {
      const parts = line.split(/[,\t]/).map(s => s.trim())
      const name = parts[0] || 'Guest'
      const email = parts[1] || ''
      const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      return {
        id: (Date.now() + i).toString(), name, email,
        status: 'pending' as const, dietary: 'None', plusOne: false,
        avatar: initials, color: colors[i % colors.length]
      }
    })
    setGuests(prev => [...prev, ...newGuests])
    setBulkText('')
    setShowBulk(false)
    showToast(`${newGuests.length} guests imported!`, 'success')
  }

  const updateStatus = (id: string, status: Guest['status']) => {
    setGuests(prev => prev.map(g => g.id === id ? { ...g, status } : g))
    showToast(`RSVP status updated`, 'info')
  }

  const removeGuest = (id: string) => {
    const guest = guests.find(g => g.id === id)
    setGuests(prev => prev.filter(g => g.id !== id))
    showToast(`${guest?.name || 'Guest'} removed`, 'info')
  }

  const generateInvite = async () => {
    setLoadingInvite(true)
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_invite', eventDetails: { ...planData, hostName: 'Your Host' } }),
      })
      const data = await res.json()
      setInvite(data)
      showToast('Invite generated!', 'success')
    } catch { showToast('Failed to generate invite', 'error') }
    setLoadingInvite(false)
  }

  const copyRSVPLink = () => {
    const link = `${window.location.origin}/rsvp?event=${encodeURIComponent(planData.eventType || 'Party')}&date=${planData.date || ''}&location=${encodeURIComponent(planData.location || '')}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('RSVP link copied!', 'success')
  }

  const dietaryCounts: Record<string, number> = {}
  guests.forEach(g => { dietaryCounts[g.dietary] = (dietaryCounts[g.dietary] || 0) + 1 })

  const filteredGuests = guests.filter(g => {
    if (filter !== 'all' && g.status !== filter) return false
    if (search && !g.name.toLowerCase().includes(search.toLowerCase()) && !g.email.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <main className="page-enter">
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button className="back-btn" onClick={() => router.back()}>← Back</button>
          <div className={styles.breadcrumb}>
            <a href="/">Home</a> › {planData.eventType && <><a href="/results">{planData.eventType}</a> › </>}<span>Guests</span>
          </div>
          <h1 className={styles.headerTitle}>Guest Management 💌</h1>
          <p className={styles.headerSub}>{planData.eventType ? `${planData.eventType} · ` : ''}{planData.location || 'Your Venue'}{planData.date ? ` · ${new Date(planData.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : ''}</p>
        </div>
      </header>

      <div className={styles.content}>
        {/* Stats */}
        <div className={styles.statsRow}>
          {[{ label: 'Invited', val: stats.total, color: 'var(--navy)' }, { label: 'Going ✓', val: stats.going, color: 'var(--green)' }, { label: 'Maybe', val: stats.maybe, color: '#c4880a' }, { label: 'Declined', val: stats.declined, color: 'var(--coral)' }, { label: 'Pending', val: stats.pending, color: '#9aabbb' }].map(s => (
            <div key={s.label} className={styles.statCard} onClick={() => setFilter(s.label === 'Invited' ? 'all' : s.label.replace(' ✓', '').toLowerCase())} style={{ cursor: 'pointer', borderColor: filter === s.label.replace(' ✓', '').toLowerCase() ? s.color : undefined }}>
              <div className={styles.statNum} style={{ color: s.color }}>{s.val}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className={styles.mainLayout}>
          <div className={styles.guestCol}>
            {/* Actions */}
            <div className={styles.actionsRow}>
              <button className="btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }} onClick={() => setShowAdd(!showAdd)}>+ Add Guest</button>
              <button className={styles.inviteBtn} onClick={() => setShowBulk(!showBulk)}>📋 Bulk Import</button>
              <button className={styles.inviteBtn} onClick={generateInvite} disabled={loadingInvite}>
                {loadingInvite ? '⏳ Generating...' : '✉️ Generate Invite'}
              </button>
              <button className={styles.inviteBtn} onClick={copyRSVPLink}>
                {copied ? '✓ Copied!' : '🔗 RSVP Link'}
              </button>
            </div>

            {/* Search */}
            <div style={{ marginBottom: '1rem' }}>
              <input
                className={styles.addInput}
                style={{ width: '100%', borderRadius: '50px', padding: '0.6rem 1.2rem' }}
                placeholder="🔍 Search guests..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Add Guest Form */}
            {showAdd && (
              <div className={`card ${styles.addForm}`}>
                <h4 style={{ fontFamily: "'Fredoka One',cursive", marginBottom: '1rem', color: 'var(--navy)' }}>Add New Guest</h4>
                <div className={styles.addRow}>
                  <input placeholder="Full Name *" value={newGuest.name} onChange={e => setNewGuest({ ...newGuest, name: e.target.value })} className={styles.addInput} />
                  <input placeholder="Email *" value={newGuest.email} onChange={e => setNewGuest({ ...newGuest, email: e.target.value })} className={styles.addInput} />
                </div>
                <div className={styles.addRow}>
                  <select value={newGuest.dietary} onChange={e => setNewGuest({ ...newGuest, dietary: e.target.value })} className={styles.addInput}>
                    <option>None</option><option>Vegetarian</option><option>Vegan</option><option>Gluten-Free</option><option>Nut Allergy</option><option>Kosher</option><option>Halal</option>
                  </select>
                  <label className={styles.plusOneLabel}>
                    <input type="checkbox" checked={newGuest.plusOne} onChange={e => setNewGuest({ ...newGuest, plusOne: e.target.checked })} />
                    Bringing a +1
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }} onClick={addGuest}>Add Guest</button>
                  <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aabbb', fontWeight: 700 }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Bulk Import */}
            {showBulk && (
              <div className={`card ${styles.addForm}`}>
                <h4 style={{ fontFamily: "'Fredoka One',cursive", marginBottom: '0.5rem', color: 'var(--navy)' }}>Bulk Import Guests</h4>
                <p style={{ fontSize: '0.8rem', color: '#9aabbb', fontWeight: 600, marginBottom: '0.8rem' }}>Paste names and emails, one per line. Use comma or tab to separate: <br /><strong>Name, Email</strong></p>
                <textarea
                  className={styles.addInput}
                  style={{ minHeight: '120px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
                  placeholder={"John Doe, john@email.com\nJane Smith, jane@email.com\nBob Wilson, bob@email.com"}
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }} onClick={bulkImport} disabled={!bulkText.trim()}>Import {bulkText.split('\n').filter(l => l.trim()).length} Guests</button>
                  <button onClick={() => setShowBulk(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aabbb', fontWeight: 700 }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Guest Table */}
            <div className={styles.guestTable}>
              {filteredGuests.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9aabbb', fontWeight: 700 }}>
                  {search || filter !== 'all' ? 'No guests match your filters' : 'No guests yet — add some above!'}
                </div>
              ) : filteredGuests.map(g => (
                <div key={g.id} className={styles.guestRow}>
                  <div className={styles.guestAvatar} style={{ background: g.color }}>{g.avatar}</div>
                  <div className={styles.guestInfo}>
                    <div className={styles.guestName}>{g.name}</div>
                    <div className={styles.guestEmail}>{g.email}</div>
                  </div>
                  {g.dietary !== 'None' && <span className={styles.dietary}>{g.dietary}</span>}
                  {g.plusOne && <span className={styles.plusOne}>+1</span>}
                  <select
                    value={g.status}
                    onChange={e => updateStatus(g.id, e.target.value as Guest['status'])}
                    className={styles.statusSelect}
                    style={{ background: STATUS_BG[g.status], color: STATUS_COLORS[g.status] }}
                  >
                    <option value="going">✓ Going</option>
                    <option value="maybe">? Maybe</option>
                    <option value="declined">✗ Declined</option>
                    <option value="pending">⏳ Pending</option>
                  </select>
                  <button className={styles.removeBtn} onClick={() => removeGuest(g.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className={styles.guestSidebar}>
            {/* Dietary */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1rem', color: 'var(--navy)', marginBottom: '1rem' }}>🥗 Dietary Needs</h3>
              {Object.entries(dietaryCounts).map(([diet, count]) => (
                <div key={diet} className={styles.dietRow}>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>{diet}</span>
                  <div className={styles.dietBar}>
                    <div className={styles.dietFill} style={{ width: `${(count / guests.length) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--navy)', minWidth: 20, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>

            {/* RSVP Link Card */}
            <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔗</div>
              <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1rem', color: 'var(--navy)', marginBottom: '0.3rem' }}>Shareable RSVP</h3>
              <p style={{ fontSize: '0.78rem', color: '#9aabbb', fontWeight: 600, marginBottom: '0.8rem' }}>Send this link to guests so they can RSVP themselves</p>
              <button className={styles.copyBtn} onClick={copyRSVPLink}>{copied ? '✓ Copied!' : '📋 Copy RSVP Link'}</button>
            </div>

            {/* Invite */}
            {invite && (
              <div className="card">
                <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1rem', color: 'var(--navy)', marginBottom: '1rem' }}>✉️ Your Invitation</h3>
                <div className={styles.inviteSubject}>{invite.subject}</div>
                <p className={styles.inviteMessage}>{invite.message}</p>
                {invite.smsVersion && (
                  <div className={styles.smsBox}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal)', marginBottom: '0.3rem' }}>SMS VERSION</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--navy)', fontWeight: 600 }}>{invite.smsVersion}</p>
                  </div>
                )}
                <button className={styles.copyBtn} onClick={copyRSVPLink}>{copied ? '✓ Copied!' : '🔗 Copy RSVP Link'}</button>
              </div>
            )}

            {!invite && (
              <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>✉️</div>
                <p style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: '0.5rem' }}>Ready to send invites?</p>
                <p style={{ fontSize: '0.82rem', color: '#9aabbb', fontWeight: 600, marginBottom: '1rem' }}>AI will write a personalized invitation for your party.</p>
                <button className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem' }} onClick={generateInvite} disabled={loadingInvite}>
                  {loadingInvite ? 'Generating...' : '✨ Generate Invite'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
