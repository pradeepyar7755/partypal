'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './guests.module.css'
import { showToast } from '@/components/Toast'

interface AdditionalGuest {
  id: string; name: string; dietary: string; relationship: string
}

interface Guest {
  id: string; name: string; email: string; status: 'going' | 'maybe' | 'declined' | 'pending'
  dietary: string; additionalGuests: AdditionalGuest[]; avatar: string; color: string
}

const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Nut Allergy', 'Kosher', 'Halal', 'Dairy-Free', 'Shellfish Allergy']
const RELATIONSHIP_OPTIONS = ['Partner', 'Spouse', 'Child', 'Family', 'Friend', 'Other']

const DEFAULT_GUESTS: Guest[] = [
  { id: '1', name: 'Sarah Anderson', email: 'sarah@email.com', status: 'going', dietary: 'None', additionalGuests: [{ id: 'a1', name: 'Mike Anderson', dietary: 'None', relationship: 'Spouse' }], avatar: 'SA', color: '#E8896A' },
  { id: '2', name: 'Marcus Johnson', email: 'marcus@email.com', status: 'going', dietary: 'Vegetarian', additionalGuests: [], avatar: 'MJ', color: '#4AADA8' },
  { id: '3', name: 'Lauren Park', email: 'lauren@email.com', status: 'maybe', dietary: 'Gluten-Free', additionalGuests: [{ id: 'a2', name: 'Chris Park', dietary: 'None', relationship: 'Spouse' }, { id: 'a3', name: 'Lily Park', dietary: 'Dairy-Free', relationship: 'Child' }], avatar: 'LP', color: '#F7C948' },
  { id: '4', name: 'David Kim', email: 'david@email.com', status: 'going', dietary: 'None', additionalGuests: [], avatar: 'DK', color: '#3D8C6E' },
  { id: '5', name: 'Tanya Robinson', email: 'tanya@email.com', status: 'pending', dietary: 'Vegan', additionalGuests: [], avatar: 'TR', color: '#7B5EA7' },
  { id: '6', name: 'Nathan Williams', email: 'nathan@email.com', status: 'declined', dietary: 'None', additionalGuests: [], avatar: 'NW', color: '#E8896A' },
]

const STATUS_COLORS: Record<string, string> = { going: '#3D8C6E', maybe: '#c4880a', declined: '#E8896A', pending: '#9aabbb' }
const STATUS_BG: Record<string, string> = { going: 'rgba(61,140,110,0.1)', maybe: 'rgba(247,201,72,0.15)', declined: 'rgba(232,137,106,0.1)', pending: 'rgba(150,150,170,0.1)' }

export default function Guests() {
  const router = useRouter()
  const [guests, setGuests] = useState<Guest[]>(DEFAULT_GUESTS)
  const [showAdd, setShowAdd] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [newGuest, setNewGuest] = useState({ name: '', email: '', dietary: 'None', additionalGuests: [] as AdditionalGuest[] })
  const [invite, setInvite] = useState<{ subject?: string; message?: string; smsVersion?: string; shareableLink?: string } | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [planData, setPlanData] = useState<{ eventType?: string; theme?: string; date?: string; location?: string; eventId?: string }>({})
  const [copied, setCopied] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [expandedGuest, setExpandedGuest] = useState<string | null>(null)
  const [inviteTheme, setInviteTheme] = useState('Modern & Fun')
  const [refineInput, setRefineInput] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [isEditingInvite, setIsEditingInvite] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('partyplan')
    if (stored) {
      const p = JSON.parse(stored)
      // Ensure event has an ID
      if (!p.eventId) {
        p.eventId = Math.random().toString(36).substring(2, 10)
        localStorage.setItem('partyplan', JSON.stringify(p))
      }
      setPlanData({ eventType: p.eventType, theme: p.theme, date: p.date, location: p.location, eventId: p.eventId })
    }
  }, [])

  const totalHeadcount = guests.reduce((sum, g) => sum + 1 + g.additionalGuests.length, 0)
  const goingHeadcount = guests.filter(g => g.status === 'going').reduce((sum, g) => sum + 1 + g.additionalGuests.length, 0)

  const stats = {
    total: guests.length,
    headcount: totalHeadcount,
    going: guests.filter(g => g.status === 'going').length,
    goingHeadcount,
    maybe: guests.filter(g => g.status === 'maybe').length,
    declined: guests.filter(g => g.status === 'declined').length,
    pending: guests.filter(g => g.status === 'pending').length,
  }

  const addAdditionalToNew = () => {
    setNewGuest(prev => ({
      ...prev,
      additionalGuests: [...prev.additionalGuests, { id: Date.now().toString(), name: '', dietary: 'None', relationship: 'Partner' }]
    }))
  }

  const updateAdditionalNew = (idx: number, field: string, value: string) => {
    setNewGuest(prev => ({
      ...prev,
      additionalGuests: prev.additionalGuests.map((ag, i) => i === idx ? { ...ag, [field]: value } : ag)
    }))
  }

  const removeAdditionalNew = (idx: number) => {
    setNewGuest(prev => ({
      ...prev,
      additionalGuests: prev.additionalGuests.filter((_, i) => i !== idx)
    }))
  }

  const addGuest = () => {
    if (!newGuest.name || !newGuest.email) return
    const initials = newGuest.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    const colors = ['#E8896A', '#4AADA8', '#F7C948', '#3D8C6E', '#7B5EA7', '#2D4059']
    const validAdditional = newGuest.additionalGuests.filter(ag => ag.name.trim())
    setGuests(prev => [...prev, {
      id: Date.now().toString(), name: newGuest.name, email: newGuest.email,
      status: 'pending', dietary: newGuest.dietary, additionalGuests: validAdditional,
      avatar: initials, color: colors[Math.floor(Math.random() * colors.length)]
    }])
    const count = 1 + validAdditional.length
    setNewGuest({ name: '', email: '', dietary: 'None', additionalGuests: [] })
    setShowAdd(false)
    showToast(`${newGuest.name}${count > 1 ? ` + ${count - 1} guest${count > 2 ? 's' : ''}` : ''} added`, 'success')
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
        status: 'pending' as const, dietary: 'None', additionalGuests: [],
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

  const addAdditionalToExisting = (guestId: string) => {
    setGuests(prev => prev.map(g => g.id === guestId ? {
      ...g,
      additionalGuests: [...g.additionalGuests, { id: Date.now().toString(), name: '', dietary: 'None', relationship: 'Partner' }]
    } : g))
  }

  const updateAdditionalExisting = (guestId: string, addId: string, field: string, value: string) => {
    setGuests(prev => prev.map(g => g.id === guestId ? {
      ...g,
      additionalGuests: g.additionalGuests.map(ag => ag.id === addId ? { ...ag, [field]: value } : ag)
    } : g))
  }

  const removeAdditionalExisting = (guestId: string, addId: string) => {
    setGuests(prev => prev.map(g => g.id === guestId ? {
      ...g,
      additionalGuests: g.additionalGuests.filter(ag => ag.id !== addId)
    } : g))
  }

  const updateGuestDietary = (guestId: string, dietary: string) => {
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, dietary } : g))
  }

  const generateInvite = async () => {
    setLoadingInvite(true)
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_invite', eventDetails: { ...planData, inviteTheme, hostName: 'Your Host' } }),
      })
      const data = await res.json()
      setInvite(data)
      setIsEditingInvite(false)
      // Save invite to Firestore
      if (planData.eventId) {
        fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: planData.eventId, invite: data }) }).catch(() => { })
      }
      showToast('Invite generated!', 'success')
    } catch { showToast('Failed to generate invite', 'error') }
    setLoadingInvite(false)
  }

  const refineInvite = async () => {
    if (!refineInput.trim() || !invite) return
    setIsRefining(true)
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refine_invite', currentSubject: invite.subject, currentMessage: invite.message, instruction: refineInput }),
      })
      const data = await res.json()
      if (data.subject) {
        setInvite(prev => ({ ...prev, subject: data.subject, message: data.message, smsVersion: data.smsVersion || prev?.smsVersion }))
        setRefineInput('')
        setIsEditingInvite(false)
        showToast('Invite refined!', 'success')
      }
    } catch { showToast('Failed to refine invite', 'error') }
    setIsRefining(false)
  }

  const getRSVPLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://partypal.social'
    const eventId = planData.eventId || Math.random().toString(36).substring(2, 10)
    const params = new URLSearchParams({ e: eventId })
    if (planData.eventType) params.set('n', planData.eventType)
    if (planData.date) params.set('d', planData.date)
    if (planData.location) params.set('l', planData.location)
    if (planData.theme) params.set('t', planData.theme)
    return `${origin}/rsvp?${params.toString()}`
  }

  const copyRSVPLink = () => {
    navigator.clipboard.writeText(getRSVPLink())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('RSVP link copied!', 'success')
  }

  const shareWhatsApp = () => {
    const text = invite
      ? `${invite.subject}\n\n${invite.message}\n\nRSVP here: ${getRSVPLink()}`
      : `You're invited! RSVP here: ${getRSVPLink()}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  // Compute dietary counts including additional guests
  const dietaryCounts: Record<string, number> = {}
  guests.forEach(g => {
    dietaryCounts[g.dietary] = (dietaryCounts[g.dietary] || 0) + 1
    g.additionalGuests.forEach(ag => {
      dietaryCounts[ag.dietary] = (dietaryCounts[ag.dietary] || 0) + 1
    })
  })

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
          {[
            { label: 'Invitations', val: stats.total, sub: `${stats.headcount} total people`, color: 'var(--navy)' },
            { label: 'Going ✓', val: stats.going, sub: `${stats.goingHeadcount} people`, color: 'var(--green)' },
            { label: 'Maybe', val: stats.maybe, sub: '', color: '#c4880a' },
            { label: 'Declined', val: stats.declined, sub: '', color: 'var(--coral)' },
            { label: 'Pending', val: stats.pending, sub: '', color: '#9aabbb' },
          ].map(s => (
            <div key={s.label} className={styles.statCard} onClick={() => setFilter(s.label === 'Invitations' ? 'all' : s.label.replace(' ✓', '').toLowerCase())} style={{ cursor: 'pointer', borderColor: filter === s.label.replace(' ✓', '').toLowerCase() ? s.color : undefined }}>
              <div className={styles.statNum} style={{ color: s.color }}>{s.val}</div>
              <div className={styles.statLabel}>{s.label}</div>
              {s.sub && <div className={styles.statSub}>{s.sub}</div>}
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
                  <div>
                    <label className={styles.fieldLabel}>Dietary Restrictions</label>
                    <select value={newGuest.dietary} onChange={e => setNewGuest({ ...newGuest, dietary: e.target.value })} className={styles.addInput}>
                      {DIETARY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                {/* Additional Guests Section */}
                <div className={styles.additionalSection}>
                  <div className={styles.additionalHeader}>
                    <span className={styles.additionalTitle}>👥 Additional Guests</span>
                    <button type="button" className={styles.addMemberBtn} onClick={addAdditionalToNew}>+ Add Person</button>
                  </div>
                  {newGuest.additionalGuests.map((ag, idx) => (
                    <div key={ag.id} className={styles.additionalRow}>
                      <input placeholder="Name" value={ag.name} onChange={e => updateAdditionalNew(idx, 'name', e.target.value)} className={styles.addInputSmall} />
                      <select value={ag.relationship} onChange={e => updateAdditionalNew(idx, 'relationship', e.target.value)} className={styles.addInputSmall}>
                        {RELATIONSHIP_OPTIONS.map(r => <option key={r}>{r}</option>)}
                      </select>
                      <select value={ag.dietary} onChange={e => updateAdditionalNew(idx, 'dietary', e.target.value)} className={styles.addInputSmall}>
                        {DIETARY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                      </select>
                      <button className={styles.removeBtn} onClick={() => removeAdditionalNew(idx)} title="Remove">✕</button>
                    </div>
                  ))}
                  {newGuest.additionalGuests.length === 0 && (
                    <p className={styles.additionalHint}>No additional guests. Click &quot;+ Add Person&quot; to bring family or friends.</p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
                  <button className="btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }} onClick={addGuest}>Add Guest{newGuest.additionalGuests.length > 0 ? ` + ${newGuest.additionalGuests.length}` : ''}</button>
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
                <div key={g.id} className={styles.guestEntry}>
                  <div className={styles.guestRow} onClick={() => setExpandedGuest(expandedGuest === g.id ? null : g.id)} style={{ cursor: 'pointer' }}>
                    <div className={styles.guestAvatar} style={{ background: g.color }}>{g.avatar}</div>
                    <div className={styles.guestInfo}>
                      <div className={styles.guestName}>{g.name}</div>
                      <div className={styles.guestEmail}>{g.email}</div>
                    </div>
                    {g.dietary !== 'None' && <span className={styles.dietary}>{g.dietary}</span>}
                    {g.additionalGuests.length > 0 && (
                      <span className={styles.partySize} title={`${g.additionalGuests.map(ag => ag.name || 'Guest').join(', ')}`}>
                        👥 +{g.additionalGuests.length}
                      </span>
                    )}
                    <select
                      value={g.status}
                      onChange={e => { e.stopPropagation(); updateStatus(g.id, e.target.value as Guest['status']) }}
                      onClick={e => e.stopPropagation()}
                      className={styles.statusSelect}
                      style={{ background: STATUS_BG[g.status], color: STATUS_COLORS[g.status] }}
                    >
                      <option value="going">✓ Going</option>
                      <option value="maybe">? Maybe</option>
                      <option value="declined">✗ Declined</option>
                      <option value="pending">⏳ Pending</option>
                    </select>
                    <button className={styles.removeBtn} onClick={(e) => { e.stopPropagation(); removeGuest(g.id) }}>✕</button>
                    <span className={styles.expandIcon}>{expandedGuest === g.id ? '▾' : '▸'}</span>
                  </div>

                  {/* Expanded Details */}
                  {expandedGuest === g.id && (
                    <div className={styles.guestExpanded}>
                      {/* Primary Guest Dietary */}
                      <div className={styles.expandedSection}>
                        <div className={styles.expandedLabel}>🍽️ {g.name}&apos;s Dietary Restrictions</div>
                        <select
                          value={g.dietary}
                          onChange={e => updateGuestDietary(g.id, e.target.value)}
                          className={styles.addInputSmall}
                          style={{ maxWidth: '200px' }}
                        >
                          {DIETARY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                        </select>
                      </div>

                      {/* Additional Guests */}
                      <div className={styles.expandedSection}>
                        <div className={styles.expandedLabelRow}>
                          <span className={styles.expandedLabel}>👥 Additional Guests ({g.additionalGuests.length})</span>
                          <button className={styles.addMemberBtn} onClick={() => addAdditionalToExisting(g.id)}>+ Add Person</button>
                        </div>
                        {g.additionalGuests.map(ag => (
                          <div key={ag.id} className={styles.additionalRow}>
                            <input
                              placeholder="Name"
                              value={ag.name}
                              onChange={e => updateAdditionalExisting(g.id, ag.id, 'name', e.target.value)}
                              className={styles.addInputSmall}
                            />
                            <select
                              value={ag.relationship}
                              onChange={e => updateAdditionalExisting(g.id, ag.id, 'relationship', e.target.value)}
                              className={styles.addInputSmall}
                            >
                              {RELATIONSHIP_OPTIONS.map(r => <option key={r}>{r}</option>)}
                            </select>
                            <select
                              value={ag.dietary}
                              onChange={e => updateAdditionalExisting(g.id, ag.id, 'dietary', e.target.value)}
                              className={styles.addInputSmall}
                            >
                              {DIETARY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                            </select>
                            <button className={styles.removeBtn} onClick={() => removeAdditionalExisting(g.id, ag.id)}>✕</button>
                          </div>
                        ))}
                        {g.additionalGuests.length === 0 && (
                          <p className={styles.additionalHint}>No additional guests yet.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className={styles.guestSidebar}>
            {/* Headcount Summary */}
            <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.3rem' }}>👥</div>
              <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1rem', color: 'var(--navy)', marginBottom: '0.5rem' }}>Total Headcount</h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
                <div>
                  <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.8rem', color: 'var(--navy)' }}>{totalHeadcount}</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' }}>Total</div>
                </div>
                <div>
                  <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.8rem', color: 'var(--green)' }}>{goingHeadcount}</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' }}>Confirmed</div>
                </div>
              </div>
            </div>

            {/* Dietary */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1rem', color: 'var(--navy)', marginBottom: '1rem' }}>🥗 Dietary Needs</h3>
              <p style={{ fontSize: '0.72rem', color: '#9aabbb', fontWeight: 600, marginBottom: '0.8rem' }}>Includes all guests & their party members</p>
              {Object.entries(dietaryCounts).sort((a, b) => b[1] - a[1]).map(([diet, count]) => (
                <div key={diet} className={styles.dietRow}>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>{diet}</span>
                  <div className={styles.dietBar}>
                    <div className={styles.dietFill} style={{ width: `${(count / totalHeadcount) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--navy)', minWidth: 20, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>

            {/* RSVP Link Card */}
            <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✉️</div>
              <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1rem', color: 'var(--navy)', marginBottom: '0.5rem' }}>Invitation Theme</h3>
              <select value={inviteTheme} onChange={e => setInviteTheme(e.target.value)} className={styles.addInput} style={{ width: '100%', marginBottom: '0.8rem', textAlign: 'center' }}>
                <option>Modern & Fun</option>
                <option>Elegant & Formal</option>
                <option>Tropical Paradise</option>
                <option>Rustic & Cozy</option>
                <option>Vintage & Retro</option>
                <option>Minimalist & Clean</option>
                <option>Whimsical & Playful</option>
                <option>Glamorous & Luxe</option>
              </select>
              <button className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem', width: '100%' }} onClick={generateInvite} disabled={loadingInvite}>
                {loadingInvite ? '⏳ Generating...' : '✨ Generate Invite'}
              </button>
            </div>

            {/* Generated Invite */}
            {invite && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1rem', color: 'var(--navy)' }}>✉️ Your Invitation</h3>
                  <button onClick={() => setIsEditingInvite(!isEditingInvite)} style={{ background: 'none', border: '1px solid var(--teal)', borderRadius: 6, padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal)', cursor: 'pointer' }}>
                    {isEditingInvite ? '✕ Cancel' : '✏️ Edit'}
                  </button>
                </div>
                {isEditingInvite ? (
                  <>
                    <input value={invite.subject || ''} onChange={e => setInvite(prev => prev ? { ...prev, subject: e.target.value } : prev)} className={styles.addInput} style={{ width: '100%', marginBottom: '0.5rem', fontWeight: 700 }} placeholder="Subject line" />
                    <textarea value={invite.message || ''} onChange={e => setInvite(prev => prev ? { ...prev, message: e.target.value } : prev)} className={styles.addInput} style={{ width: '100%', minHeight: 120, marginBottom: '0.5rem', resize: 'vertical', lineHeight: 1.5 }} />
                  </>
                ) : (
                  <>
                    <div className={styles.inviteSubject}>{invite.subject}</div>
                    <p className={styles.inviteMessage}>{invite.message}</p>
                  </>
                )}
                {invite.smsVersion && (
                  <div className={styles.smsBox}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal)', marginBottom: '0.3rem' }}>SMS VERSION</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--navy)', fontWeight: 600 }}>{invite.smsVersion}</p>
                  </div>
                )}

                {/* AI Refinement Chat */}
                <div style={{ marginTop: '0.8rem', borderTop: '1px solid #eee', paddingTop: '0.8rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.4rem' }}>🤖 Refine with AI</div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      value={refineInput}
                      onChange={e => setRefineInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') refineInvite() }}
                      placeholder="e.g. Make it more formal, Add dress code..."
                      className={styles.addInput}
                      style={{ flex: 1, fontSize: '0.8rem' }}
                    />
                    <button onClick={refineInvite} disabled={isRefining || !refineInput.trim()} style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', opacity: isRefining || !refineInput.trim() ? 0.5 : 1 }}>
                      {isRefining ? '...' : '✨ Refine'}
                    </button>
                  </div>
                </div>

                {/* Share actions */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
                  <button className={styles.copyBtn} style={{ flex: 1 }} onClick={copyRSVPLink}>{copied ? '✓ Copied!' : '🔗 Copy RSVP Link'}</button>
                  <button onClick={shareWhatsApp} style={{ flex: 1, background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                    💬 WhatsApp
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
