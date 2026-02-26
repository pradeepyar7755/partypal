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

interface LocationSearchProps {
    value: string
    onChange: (location: string, details?: LocationResult) => void
    placeholder?: string
    className?: string
}

function getTypeInfo(types: string[]): { type: string; icon: string } {
    if (types.some(t => ['restaurant', 'bar', 'cafe', 'food', 'meal_delivery', 'meal_takeaway', 'night_club'].includes(t)))
        return { type: 'restaurant', icon: '🍽️' }
    if (types.some(t => ['lodging'].includes(t)))
        return { type: 'hotel', icon: '🏨' }
    if (types.some(t => ['stadium', 'gym', 'bowling_alley', 'amusement_park'].includes(t)))
        return { type: 'venue', icon: '🏟️' }
    if (types.some(t => ['park', 'campground'].includes(t)))
        return { type: 'park', icon: '🌳' }
    if (types.some(t => ['church', 'place_of_worship', 'synagogue', 'mosque', 'hindu_temple'].includes(t)))
        return { type: 'venue', icon: '⛪' }
    if (types.some(t => ['art_gallery', 'museum'].includes(t)))
        return { type: 'venue', icon: '🎨' }
    if (types.some(t => ['establishment', 'point_of_interest'].includes(t)))
        return { type: 'venue', icon: '📍' }
    if (types.some(t => ['street_address', 'premise', 'subpremise', 'route'].includes(t)))
        return { type: 'address', icon: '🏠' }
    if (types.some(t => ['locality', 'sublocality'].includes(t)))
        return { type: 'city', icon: '🏙️' }
    if (types.some(t => ['postal_code'].includes(t)))
        return { type: 'zip code', icon: '📮' }
    if (types.some(t => ['administrative_area_level_1', 'administrative_area_level_2'].includes(t)))
        return { type: 'region', icon: '🌎' }
    if (types.some(t => ['neighborhood'].includes(t)))
        return { type: 'neighborhood', icon: '🏘️' }
    return { type: 'place', icon: '📍' }
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

// Load Google Maps JS + Places
let loadP: Promise<void> | null = null
function loadGMaps(key: string): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (w.google?.maps?.places?.AutocompleteService) return Promise.resolve()
    if (loadP) return loadP

    loadP = new Promise((resolve, reject) => {
        if (document.querySelector('script[src*="maps.googleapis.com"]')) {
            const i = setInterval(() => { if (w.google?.maps?.places?.AutocompleteService) { clearInterval(i); resolve() } }, 100)
            setTimeout(() => { clearInterval(i); reject(new Error('Timeout')) }, 10000)
            return
        }
        const s = document.createElement('script')
        s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
        s.async = true
        s.onload = () => {
            const i = setInterval(() => { if (w.google?.maps?.places?.AutocompleteService) { clearInterval(i); resolve() } }, 50)
            setTimeout(() => { clearInterval(i); reject(new Error('Timeout')) }, 10000)
        }
        s.onerror = () => reject(new Error('Script load failed'))
        document.head.appendChild(s)
    })
    return loadP
}

export default function LocationSearch({ value, onChange, placeholder = 'Search a city, venue, or address...', className }: LocationSearchProps) {
    const [query, setQuery] = useState(value)
    const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<LocationResult | null>(null)
    const [focusedIndex, setFocusedIndex] = useState(-1)
    const [ready, setReady] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const acService = useRef<google.maps.places.AutocompleteService | null>(null)
    const geocoder = useRef<google.maps.Geocoder | null>(null)
    const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Sync external value
    useEffect(() => {
        if (value !== query && !isOpen) setQuery(value)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])

    // Initialize
    useEffect(() => {
        fetch('/api/location')
            .then(r => r.json())
            .then(d => {
                if (!d.apiKey) return
                loadGMaps(d.apiKey).then(() => {
                    acService.current = new google.maps.places.AutocompleteService()
                    geocoder.current = new google.maps.Geocoder()
                    token.current = new google.maps.places.AutocompleteSessionToken()
                    setReady(true)
                }).catch(e => console.error('Maps init error:', e))
            })
            .catch(console.error)
    }, [])

    // Click outside to close
    useEffect(() => {
        const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])

    const search = useCallback((input: string) => {
        if (!ready || !acService.current || input.length < 2) { setPredictions([]); return }
        setLoading(true)
        acService.current.getPlacePredictions(
            { input, sessionToken: token.current!, componentRestrictions: { country: 'us' } },
            (results, status) => {
                setLoading(false)
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                    setPredictions(results)
                    setIsOpen(true)
                } else { setPredictions([]) }
            }
        )
    }, [ready])

    const handleInput = (val: string) => {
        setQuery(val); setSelected(null); setFocusedIndex(-1)
        if (!val) { setPredictions([]); setIsOpen(false); onChange(''); return }
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => search(val), 180)
    }

    const handleSelect = (p: google.maps.places.AutocompletePrediction) => {
        setQuery(p.description); setIsOpen(false); setFocusedIndex(-1)
        const { type, icon } = getTypeInfo(p.types)

        // Use Geocoder (Maps JS API) to get lat/lng — always works
        if (geocoder.current) {
            geocoder.current.geocode({ placeId: p.place_id }, (results, status) => {
                token.current = new google.maps.places.AutocompleteSessionToken()
                if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
                    const r = results[0]
                    let city = '', state = '', country = ''
                    r.address_components.forEach(c => {
                        if (c.types.includes('locality')) city = c.long_name
                        if (c.types.includes('sublocality_level_1') && !city) city = c.long_name
                        if (c.types.includes('administrative_area_level_1')) state = c.short_name
                        if (c.types.includes('country')) country = c.long_name
                    })
                    const result: LocationResult = {
                        placeId: p.place_id,
                        name: p.structured_formatting.main_text,
                        address: r.formatted_address,
                        city, state, country,
                        lat: r.geometry.location.lat(),
                        lng: r.geometry.location.lng(),
                        type, icon,
                    }
                    setSelected(result)
                    onChange(p.description, result)
                } else { onChange(p.description) }
            })
        } else { onChange(p.description) }
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
        <div ref={containerRef} style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
                <input
                    ref={inputRef} type="text" placeholder={placeholder} value={query}
                    onChange={e => handleInput(e.target.value)}
                    onFocus={() => { if (predictions.length > 0 && !selected) setIsOpen(true) }}
                    onKeyDown={handleKey} className={className} autoComplete="off"
                    style={{ paddingRight: query ? '2.5rem' : '1rem' }}
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
                    <span style={{ fontSize: '0.6rem', color: '#b0bfcc', fontWeight: 600, flexShrink: 0 }}>
                        {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
                    </span>
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
                        const { type, icon } = getTypeInfo(p.types)
                        const badge = getBadgeColors(type)
                        return (
                            <div key={p.place_id} onClick={() => handleSelect(p)} onMouseEnter={() => setFocusedIndex(idx)}
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
                                }}>{icon}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#2D4059', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {p.structured_formatting.main_text}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#9aabbb', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {p.structured_formatting.secondary_text}
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase',
                                    letterSpacing: '0.3px', padding: '0.15rem 0.45rem', borderRadius: 50,
                                    flexShrink: 0, background: badge.bg, color: badge.color
                                }}>{type}</div>
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
