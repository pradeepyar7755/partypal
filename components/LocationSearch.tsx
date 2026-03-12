'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

interface LocationResult {
    placeId: string
    name: string
    address: string
    city: string
    state: string
    country: string
    lat: number
    lng: number
    type: string
    icon: string
}

interface Prediction {
    placeId: string
    name: string
    secondary: string
    description: string
    type: string
    icon: string
    types?: string[]
    lat?: number
    lng?: number
}

interface LocationSearchProps {
    value: string
    onChange: (location: string, details?: LocationResult) => void
    placeholder?: string
    className?: string
}

function getBadgeColors(type: string): { bg: string; color: string } {
    switch (type) {
        case 'venue': case 'restaurant': case 'hotel': return { bg: 'rgba(232,137,106,0.1)', color: '#E8896A' }
        case 'business': case 'park': return { bg: 'rgba(247,201,72,0.12)', color: '#c4880a' }
        case 'address': case 'zip code': return { bg: 'rgba(74,173,168,0.1)', color: '#4AADA8' }
        case 'city': case 'region': case 'neighborhood': return { bg: 'rgba(61,140,110,0.1)', color: '#3D8C6E' }
        default: return { bg: 'rgba(150,150,170,0.1)', color: '#9aabbb' }
    }
}

export default function LocationSearch({ value, onChange, placeholder = 'Search a city, venue, or address...', className }: LocationSearchProps) {
    const [query, setQuery] = useState(value)
    const [predictions, setPredictions] = useState<Prediction[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<LocationResult | null>(null)
    const [focusedIndex, setFocusedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Sync external value
    useEffect(() => {
        if (value !== query && !isOpen) setQuery(value)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])

    // Click outside to close
    useEffect(() => {
        const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])

    const search = useCallback(async (input: string) => {
        if (input.length < 2) { setPredictions([]); return }
        setLoading(true)
        try {
            const res = await fetch(`/api/location?q=${encodeURIComponent(input)}`)
            const data = await res.json()
            const results: Prediction[] = (data.results || []).map((r: Prediction) => ({
                placeId: r.placeId || '',
                name: r.name || '',
                secondary: r.secondary || '',
                description: r.description || r.name || '',
                type: r.type || 'place',
                icon: r.icon || '📍',
                types: r.types || [],
                lat: r.lat,
                lng: r.lng,
            }))
            // If query looks like a zip code, bump zip/city/region results above street addresses
            const isZipQuery = /^\d{3,5}$/.test(input.trim())
            const sorted = isZipQuery
                ? [...results].sort((a, b) => {
                    const aIsGeo = ['zip code', 'city', 'region', 'neighborhood'].includes(a.type) ? 0 : 1
                    const bIsGeo = ['zip code', 'city', 'region', 'neighborhood'].includes(b.type) ? 0 : 1
                    return aIsGeo - bIsGeo
                })
                : results
            setPredictions(sorted)
            setIsOpen(results.length > 0)
        } catch (e) {
            console.error('Location search error:', e)
            setPredictions([])
        } finally {
            setLoading(false)
        }
    }, [])

    const handleInput = (val: string) => {
        setQuery(val); setSelected(null); setFocusedIndex(-1)
        if (!val) { setPredictions([]); setIsOpen(false); onChange(''); return }
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => search(val), 250)
    }

    const handleSelect = async (p: Prediction) => {
        const displayText = p.description || `${p.name}, ${p.secondary}`
        setQuery(displayText); setIsOpen(false); setFocusedIndex(-1)

        // If we already have lat/lng from the search (Nominatim fallback), use directly
        if (p.lat && p.lng) {
            const result: LocationResult = {
                placeId: p.placeId,
                name: p.name,
                address: displayText,
                city: '', state: '', country: '',
                lat: p.lat, lng: p.lng,
                type: p.type, icon: p.icon,
            }
            setSelected(result)
            onChange(displayText, result)
            return
        }

        // Use server-side geocoding for Google Places results
        try {
            const res = await fetch('/api/location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ placeId: p.placeId }),
            })
            const data = await res.json()
            if (data.lat) {
                const result: LocationResult = {
                    placeId: p.placeId,
                    name: p.name || data.name,
                    address: data.address || displayText,
                    city: data.city || '',
                    state: data.state || '',
                    country: data.country || '',
                    lat: data.lat,
                    lng: data.lng,
                    type: p.type, icon: p.icon,
                }
                setSelected(result)
                onChange(displayText, result)
            } else {
                onChange(displayText)
            }
        } catch {
            onChange(displayText)
        }
    }

    const handleKey = (e: React.KeyboardEvent) => {
        if (!isOpen || !predictions.length) return
        if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(i => Math.min(i + 1, predictions.length - 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(i => Math.max(i - 1, 0)) }
        else if (e.key === 'Enter' && focusedIndex >= 0) { e.preventDefault(); handleSelect(predictions[focusedIndex]) }
        else if (e.key === 'Escape') setIsOpen(false)
    }

    const clear = () => {
        setQuery(''); setSelected(null); setPredictions([]); setIsOpen(false); onChange('')
        inputRef.current?.focus()
    }

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', minWidth: 0 }}>
            <div style={{ position: 'relative' }}>
                <input
                    ref={inputRef} type="text" placeholder={placeholder} value={query}
                    onChange={e => handleInput(e.target.value)}
                    onFocus={() => { if (predictions.length > 0 && !selected) setIsOpen(true) }}
                    onKeyDown={handleKey} className={className} autoComplete="off"
                    style={{ paddingRight: query ? '2.5rem' : '1rem', width: '100%', boxSizing: 'border-box' }}
                />
                {loading && (
                    <div style={{
                        position: 'absolute', right: query ? '2.2rem' : '0.8rem', top: '50%', transform: 'translateY(-50%)',
                        width: 14, height: 14, border: '2px solid #e2e8ef', borderTopColor: '#4AADA8',
                        borderRadius: '50%', animation: 'locSpin 0.6s linear infinite'
                    }} />
                )}
                {query && !loading && (
                    <button onClick={clear} style={{
                        position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#b0bfcc',
                        fontSize: '1rem', padding: '0.2rem', lineHeight: 1
                    }} title="Clear">✕</button>
                )}
            </div>

            {/* Selected details */}
            {selected && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem',
                    padding: '0.4rem 0.7rem', background: 'rgba(74,173,168,0.06)',
                    border: '1px solid rgba(74,173,168,0.15)', borderRadius: 8,
                    fontSize: '0.75rem', fontWeight: 600, color: '#4AADA8',
                    animation: 'locFade 0.2s ease'
                }}>
                    <span style={{ fontSize: '0.9rem' }}>{selected.icon}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selected.name}{selected.city ? ` · ${selected.city}, ${selected.state}` : ''}
                    </span>
                    <span style={{
                        fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.3px',
                        background: getBadgeColors(selected.type).bg, color: getBadgeColors(selected.type).color,
                        padding: '0.15rem 0.4rem', borderRadius: 50, textTransform: 'uppercase', flexShrink: 0
                    }}>{selected.type}</span>
                </div>
            )}

            {/* Dropdown */}
            {isOpen && predictions.length > 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    background: 'white', border: '1.5px solid #e2e8ef', borderRadius: 12,
                    marginTop: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                    maxHeight: 360, overflowY: 'auto', animation: 'locDrop 0.15s ease'
                }}>
                    {predictions.map((p, idx) => {
                        const badge = getBadgeColors(p.type)
                        return (
                            <div key={p.placeId + idx} onClick={() => handleSelect(p)} onMouseEnter={() => setFocusedIndex(idx)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.7rem',
                                    padding: '0.65rem 1rem', cursor: 'pointer', transition: 'background 0.1s',
                                    background: focusedIndex === idx ? '#F7F8FA' : 'transparent',
                                    borderBottom: idx < predictions.length - 1 ? '1px solid #e2e8ef' : 'none'
                                }}>
                                <div style={{
                                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.05rem', background: badge.bg
                                }}>{p.icon}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#2D4059', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {p.name}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#9aabbb', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {p.secondary}
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase',
                                    letterSpacing: '0.3px', padding: '0.15rem 0.45rem', borderRadius: 50,
                                    flexShrink: 0, background: badge.bg, color: badge.color
                                }}>{p.type}</div>
                            </div>
                        )
                    })}
                    <div style={{
                        padding: '0.4rem 1rem', fontSize: '0.6rem', fontWeight: 600,
                        color: '#b0bfcc', textAlign: 'right', borderTop: '1px solid #e2e8ef', background: '#F7F8FA'
                    }}>Powered by Google</div>
                </div>
            )}

            {/* No results */}
            {isOpen && predictions.length === 0 && !loading && query.length >= 2 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    background: 'white', border: '1.5px solid #e2e8ef', borderRadius: 12,
                    marginTop: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                    padding: '1.2rem', textAlign: 'center'
                }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>🔍</div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#2D4059' }}>No results found</div>
                    <div style={{ fontSize: '0.75rem', color: '#9aabbb', fontWeight: 600 }}>Try a different address, city, or venue</div>
                </div>
            )}

            <style jsx>{`
        @keyframes locDrop { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes locFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes locSpin { to { transform: translateY(-50%) rotate(360deg); } }
      `}</style>
        </div>
    )
}
