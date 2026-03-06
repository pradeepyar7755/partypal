'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { userGetJSON, userSetJSON } from '@/lib/userStorage'
import styles from './guests.module.css'
import { showToast } from '@/components/Toast'

interface Contact {
  id: string
  name: string
  email: string
  phone: string
  circles: string[]
  avatar: string
  color: string
}

interface EventGuest {
  id: string; name: string; email: string; status: string
}

const AVATAR_COLORS = ['#4AADA8', '#E8896A', '#7B5EA7', '#F7C948', '#3D8C6E', '#c4880a', '#D35E8D', '#5B8AF5']
const DEFAULT_CIRCLES = ['Family', 'Friends', 'Work', 'School', 'Neighbors']

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2)
}

export default function GuestsPage() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [circles, setCircles] = useState<string[]>(DEFAULT_CIRCLES)
  const [selectedCircle, setSelectedCircle] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showNewCircle, setShowNewCircle] = useState(false)
  const [newCircleName, setNewCircleName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', circles: [] as string[] })
  const [bulkText, setBulkText] = useState('')
  const [activeEvents, setActiveEvents] = useState<{ eventId: string; eventType: string }[]>([])
  const [showEventPicker, setShowEventPicker] = useState(false)
  const router = useRouter()

  // Load contacts and circles from localStorage, then sync RSVP guests from all events
  useEffect(() => {
    const saved = userGetJSON<Contact[]>('partypal_contacts', [])
    const savedCircles = userGetJSON<string[]>('partypal_circles', DEFAULT_CIRCLES)
    setCircles(savedCircles)

    // Load active events (non-past, non-demo)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = userGetJSON<any[]>('partypal_events', [])
    const now = new Date()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active = events.filter((e: any) => {
      if (!e.eventId || e.eventId === 'demo') return false
      const d = e.date ? new Date(e.date + 'T12:00:00') : null
      return !d || d >= now
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).map((e: any) => ({ eventId: e.eventId, eventType: e.eventType || 'Event' }))
    setActiveEvents(active)

    // Sync RSVP guests from all events into contacts (superset merge)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allEvents = events.filter((e: any) => e.eventId && e.eventId !== 'demo')
    let merged = [...saved]
    let changed = false

    for (const ev of allEvents) {
      const eventGuests = userGetJSON<EventGuest[]>(`partypal_eventguests_${ev.eventId}`, [])
      for (const g of eventGuests) {
        if (!g.name?.trim()) continue
        const email = (g.email || '').trim().toLowerCase()
        // Match by email (primary) or name (fallback if no email)
        const existingIdx = email
          ? merged.findIndex(c => c.email.toLowerCase() === email)
          : merged.findIndex(c => c.name.toLowerCase() === g.name.trim().toLowerCase())

        if (existingIdx >= 0) {
          // Update email if contact was missing it
          const existing = merged[existingIdx]
          if (email && !existing.email) {
            merged[existingIdx] = { ...existing, email: g.email.trim() }
            changed = true
          }
        } else {
          // New contact from event guest
          merged.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: g.name.trim(),
            email: (g.email || '').trim(),
            phone: '',
            circles: [],
            avatar: getInitials(g.name),
            color: AVATAR_COLORS[merged.length % AVATAR_COLORS.length],
          })
          changed = true
        }
      }
    }

    if (changed) {
      userSetJSON('partypal_contacts', merged)
    }
    setContacts(merged)
  }, [user])

  // Save contacts
  const saveContacts = (c: Contact[]) => {
    setContacts(c)
    userSetJSON('partypal_contacts', c)
  }

  // Save circles
  const saveCircles = (c: string[]) => {
    setCircles(c)
    userSetJSON('partypal_circles', c)
  }

  // Add a single contact
  const addContact = () => {
    if (!form.name.trim()) return
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      showToast('Please enter a valid email address', 'error')
      return
    }
    const newContact: Contact = {
      id: Date.now().toString(36),
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      circles: form.circles,
      avatar: getInitials(form.name),
      color: AVATAR_COLORS[contacts.length % AVATAR_COLORS.length],
    }
    saveContacts([...contacts, newContact])
    setForm({ name: '', email: '', phone: '', circles: [] })
    setShowAdd(false)
    showToast(`${newContact.name} added`, 'success')
  }

  // Update contact (from edit)
  const updateContact = () => {
    if (!editingId || !form.name.trim()) return
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      showToast('Please enter a valid email address', 'error')
      return
    }
    const updated = contacts.map(c =>
      c.id === editingId ? { ...c, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), circles: form.circles, avatar: getInitials(form.name) } : c
    )
    saveContacts(updated)
    setEditingId(null)
    setForm({ name: '', email: '', phone: '', circles: [] })
    showToast('Contact updated', 'success')
  }

  // Delete contact
  const deleteContact = (id: string) => {
    saveContacts(contacts.filter(c => c.id !== id))
    showToast('Contact removed', 'success')
  }

  // Toggle circle on a contact
  const toggleCircle = (contactId: string, circle: string) => {
    const updated = contacts.map(c => {
      if (c.id !== contactId) return c
      const has = c.circles.includes(circle)
      return { ...c, circles: has ? c.circles.filter(ci => ci !== circle) : [...c.circles, circle] }
    })
    saveContacts(updated)
  }

  // Bulk import
  const bulkImport = () => {
    const lines = bulkText.split('\n').filter(l => l.trim())
    const newContacts: Contact[] = lines.map((line, i) => {
      const parts = line.split(/[,\t]/).map(s => s.trim())
      return {
        id: Date.now().toString(36) + i,
        name: parts[0] || '',
        email: parts[1] || '',
        phone: parts[2] || '',
        circles: selectedCircle ? [selectedCircle] : [],
        avatar: getInitials(parts[0] || ''),
        color: AVATAR_COLORS[(contacts.length + i) % AVATAR_COLORS.length],
      }
    }).filter(c => c.name)
    saveContacts([...contacts, ...newContacts])
    setBulkText('')
    setShowBulk(false)
    showToast(`${newContacts.length} contact${newContacts.length > 1 ? 's' : ''} imported`, 'success')
  }

  // Add new circle
  const addCircle = () => {
    if (!newCircleName.trim() || circles.includes(newCircleName.trim())) return
    saveCircles([...circles, newCircleName.trim()])
    setNewCircleName('')
    setShowNewCircle(false)
    showToast('Circle created', 'success')
  }

  // Delete circle (remove from contacts too)
  const deleteCircle = (circle: string) => {
    saveCircles(circles.filter(c => c !== circle))
    const updated = contacts.map(c => ({ ...c, circles: c.circles.filter(ci => ci !== circle) }))
    saveContacts(updated)
    if (selectedCircle === circle) setSelectedCircle(null)
    showToast('Circle removed', 'success')
  }

  // Toggle circle in form
  const toggleFormCircle = (circle: string) => {
    setForm(f => ({
      ...f,
      circles: f.circles.includes(circle) ? f.circles.filter(c => c !== circle) : [...f.circles, circle]
    }))
  }

  // Start editing
  const startEdit = (c: Contact) => {
    setEditingId(c.id)
    setForm({ name: c.name, email: c.email, phone: c.phone, circles: c.circles })
    setShowAdd(false)
  }

  // Filtered contacts
  const filtered = contacts.filter(c => {
    const matchCircle = !selectedCircle || c.circles.includes(selectedCircle)
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
    return matchCircle && matchSearch
  })

  const circleStats = circles.map(circle => ({
    name: circle,
    count: contacts.filter(c => c.circles.includes(circle)).length,
  }))

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.breadcrumb}>
            <a href="/">🏠 Home</a> › <span>Guests</span>
          </div>
          <button className="back-btn" onClick={() => window.location.href = '/'} style={{ marginTop: 0 }}>← Back to Home</button>
          {activeEvents.length > 0 && (
            activeEvents.length === 1 ? (
              <button className="back-btn" onClick={() => router.push(`/dashboard?event=${activeEvents[0].eventId}&tab=guests`)} style={{ marginTop: 0, background: 'rgba(74,173,168,0.1)', color: 'var(--teal)', border: '1.5px solid rgba(74,173,168,0.25)' }}>← Back to My Events</button>
            ) : (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button className="back-btn" onClick={() => setShowEventPicker(p => !p)} style={{ marginTop: 0, background: 'rgba(74,173,168,0.1)', color: 'var(--teal)', border: '1.5px solid rgba(74,173,168,0.25)' }}>← Back to My Events</button>
                {showEventPicker && (
                  <div style={{ position: 'absolute', top: '110%', left: 0, background: 'white', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1.5px solid var(--border)', padding: '0.5rem', zIndex: 100, minWidth: 200 }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9aabbb', padding: '0.2rem 0.4rem', marginBottom: '0.3rem' }}>Select event:</div>
                    {activeEvents.map(ev => (
                      <button key={ev.eventId} onClick={() => { setShowEventPicker(false); router.push(`/dashboard?event=${ev.eventId}&tab=guests`) }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '0.4rem 0.5rem', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy)', cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(74,173,168,0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >{ev.eventType}</button>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
          <div className={styles.headerTitle}>Guest Management 👥</div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.2rem' }}>Add your friends & family to circles for faster and repeatable access</p>
          <div className={styles.headerSub}>{contacts.length} contact{contacts.length !== 1 ? 's' : ''} · {circles.length} circle{circles.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className={styles.content}>
        {/* Circles Bar */}
        <div className={styles.circlesBar}>
          <button
            className={`${styles.circleChip} ${!selectedCircle ? styles.circleChipActive : ''}`}
            onClick={() => setSelectedCircle(null)}
          >All ({contacts.length})</button>
          {circleStats.map(cs => (
            <button
              key={cs.name}
              className={`${styles.circleChip} ${selectedCircle === cs.name ? styles.circleChipActive : ''}`}
              onClick={() => setSelectedCircle(selectedCircle === cs.name ? null : cs.name)}
            >
              {cs.name} ({cs.count})
              <span className={styles.circleRemove} onClick={e => { e.stopPropagation(); deleteCircle(cs.name) }}>×</span>
            </button>
          ))}
          {showNewCircle ? (
            <div className={styles.newCircleInline}>
              <input
                className={styles.newCircleInput}
                value={newCircleName}
                onChange={e => setNewCircleName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCircle()}
                placeholder="Circle name..."
                autoFocus
              />
              <button className={styles.newCircleSave} onClick={addCircle}>✓</button>
              <button className={styles.newCircleCancel} onClick={() => { setShowNewCircle(false); setNewCircleName('') }}>✕</button>
            </div>
          ) : (
            <button className={styles.addCircleBtn} onClick={() => setShowNewCircle(true)}>+ Circle</button>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actionsRow}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="🔍  Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className={styles.actionBtn} onClick={() => { setShowAdd(!showAdd); setEditingId(null); setForm({ name: '', email: '', phone: '', circles: [] }) }}>
            {showAdd ? '✕ Cancel' : '+ Add Contact'}
          </button>
          <button className={styles.secondaryBtn} onClick={() => setShowBulk(!showBulk)}>
            {showBulk ? '✕ Cancel' : '📋 Bulk Import'}
          </button>
        </div>

        {/* Add / Edit Form */}
        {(showAdd || editingId) && (
          <div className={styles.addForm}>
            <div className={styles.addRow}>
              <div>
                <label className={styles.fieldLabel}>Name *</label>
                <input className={styles.addInput} type="text" placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
              </div>
              <div>
                <label className={styles.fieldLabel}>Email</label>
                <input className={styles.addInput} type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className={styles.addRow}>
              <div>
                <label className={styles.fieldLabel}>Phone</label>
                <input className={styles.addInput} type="tel" placeholder="+1 (555) 000-0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className={styles.fieldLabel}>Circles</label>
                <div className={styles.circleSelect}>
                  {circles.map(c => (
                    <button
                      key={c}
                      className={`${styles.circleOption} ${form.circles.includes(c) ? styles.circleOptionActive : ''}`}
                      onClick={() => toggleFormCircle(c)}
                      type="button"
                    >{c}</button>
                  ))}
                </div>
              </div>
            </div>
            <button className={styles.submitBtn} onClick={editingId ? updateContact : addContact}>
              {editingId ? '✓ Save Changes' : '+ Add Contact'}
            </button>
          </div>
        )}

        {/* Bulk Import */}
        {showBulk && (
          <div className={styles.bulkBox}>
            <p style={{ fontSize: '0.8rem', color: '#9aabbb', fontWeight: 600, margin: '0 0 0.5rem' }}>
              Paste contacts, one per line: <strong>Name, Email, Phone</strong>
            </p>
            <textarea
              className={styles.bulkTextarea}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={"John Doe, john@email.com, 555-1234\nJane Smith, jane@email.com"}
              rows={5}
            />
            <button className={styles.submitBtn} onClick={bulkImport} disabled={!bulkText.trim()}>
              Import {bulkText.split('\n').filter(l => l.trim()).length} Contact{bulkText.split('\n').filter(l => l.trim()).length !== 1 ? 's' : ''}
            </button>
          </div>
        )}

        {/* Contacts List */}
        <div className={styles.guestTable}>
          {filtered.length === 0 ? (
            <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>📇</div>
              <p style={{ color: '#9aabbb', fontWeight: 700, fontSize: '0.9rem' }}>
                {contacts.length === 0 ? 'No contacts yet. Add your first contact or bulk import!' : 'No contacts match your filter.'}
              </p>
            </div>
          ) : (
            filtered.map(contact => (
              <div key={contact.id} className={styles.guestEntry}>
                <div className={styles.guestRow}>
                  <div className={styles.guestAvatar} style={{ background: contact.color }}>{contact.avatar}</div>
                  <div className={styles.guestInfo}>
                    <div className={styles.guestName}>{contact.name}</div>
                    <div className={styles.guestEmail}>
                      {contact.email && <span>{contact.email}</span>}
                      {contact.email && contact.phone && <span style={{ margin: '0 0.4rem', opacity: 0.4 }}>·</span>}
                      {contact.phone && <span>{contact.phone}</span>}
                    </div>
                  </div>
                  <div className={styles.circleTags}>
                    {contact.circles.map(c => (
                      <span key={c} className={styles.circleTag}>{c}</span>
                    ))}
                    {contact.circles.length === 0 && <span className={styles.noCircle}>No circle</span>}
                  </div>
                  <div className={styles.contactActions}>
                    {/* Circle quick-add dropdown */}
                    <div className={styles.circleDropdown}>
                      <button className={styles.circleAddBtn} title="Add to circle">🏷️</button>
                      <div className={styles.circleDropdownContent}>
                        {circles.map(c => (
                          <label key={c} className={styles.circleDropdownItem}>
                            <input
                              type="checkbox"
                              checked={contact.circles.includes(c)}
                              onChange={() => toggleCircle(contact.id, c)}
                            />
                            {c}
                          </label>
                        ))}
                      </div>
                    </div>
                    <button className={styles.editBtn} onClick={() => startEdit(contact)} title="Edit">✏️</button>
                    <button className={styles.removeBtn} onClick={() => deleteContact(contact.id)} title="Remove">🗑️</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
