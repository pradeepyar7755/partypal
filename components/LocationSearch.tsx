'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

interface LocationResult {
    id: string
    name: string           // Business/venue name or formatted address
    address: string        // Full formatted address
    city: string
    state: string
    country: string
    lat: number
    lng: number
    type: string           // 'venue', 'address', 'city', 'poi'
    icon: string           // Emoji based on type
}

interface LocationSearchProps {
    value: string
    onChange: (location: string, details?: LocationResult) => void
    placeholder?: string
    className?: string
}

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return debounced
}

export default function LocationSearch({ value, onChange, placeholder = 'Search for a city, venue, or address...', className }: LocationSearchProps) {
    const [query, setQuery] = useState(value)
    const [results, setResults] = useState<LocationResult[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<LocationResult | null>(null)
    const [focusedIndex, setFocusedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const debouncedQuery = useDebounce(query, 300)

    // Sync external value
    useEffect(() => {
        if (value !== query && !isOpen) {
            setQuery(value)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])

    // Search using our API route
    const searchLocations = useCallback(async (searchQuery: string) => {
        if (searchQuery.length < 2) {
            setResults([])
            return
        }
        setLoading(true)
        try {
            const res = await fetch(`/api/location?q=${encodeURIComponent(searchQuery)}`)
            const data = await res.json()
            if (data.results) {
                setResults(data.results)
                setIsOpen(true)
            }
        } catch (err) {
            console.error('Location search error:', err)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (debouncedQuery && !selected) {
            searchLocations(debouncedQuery)
        }
    }, [debouncedQuery, searchLocations, selected])

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const handleSelect = (result: LocationResult) => {
        const displayValue = result.name !== result.address ? `${result.name}, ${result.city}, ${result.state}` : `${result.city}, ${result.state}`
        setQuery(displayValue)
        setSelected(result)
        setIsOpen(false)
        setFocusedIndex(-1)
        onChange(displayValue, result)
    }

    const handleInputChange = (val: string) => {
        setQuery(val)
        setSelected(null)
        setFocusedIndex(-1)
        if (!val) {
            setResults([])
            setIsOpen(false)
            onChange('')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || results.length === 0) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setFocusedIndex(prev => Math.min(prev + 1, results.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setFocusedIndex(prev => Math.max(prev - 1, 0))
        } else if (e.key === 'Enter' && focusedIndex >= 0) {
            e.preventDefault()
            handleSelect(results[focusedIndex])
        } else if (e.key === 'Escape') {
            setIsOpen(false)
        }
    }

    const handleClear = () => {
        setQuery('')
        setSelected(null)
        setResults([])
        setIsOpen(false)
        onChange('')
        inputRef.current?.focus()
    }

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={query}
                    onChange={e => handleInputChange(e.target.value)}
                    onFocus={() => { if (results.length > 0 && !selected) setIsOpen(true) }}
                    onKeyDown={handleKeyDown}
                    className={className}
                    autoComplete="off"
                    style={{ paddingRight: query ? '2.5rem' : '1rem' }}
                />
                {loading && (
                    <div style={{
                        position: 'absolute', right: query ? '2.2rem' : '0.8rem', top: '50%', transform: 'translateY(-50%)',
                        width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--teal)',
                        borderRadius: '50%', animation: 'spin 0.6s linear infinite'
                    }} />
                )}
                {query && !loading && (
                    <button
                        onClick={handleClear}
                        style={{
                            position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', color: '#b0bfcc',
                            fontSize: '1rem', padding: '0.2rem', lineHeight: 1
                        }}
                        title="Clear"
                    >✕</button>
                )}
            </div>

            {/* Selected Location Details */}
            {selected && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem',
                    padding: '0.4rem 0.7rem', background: 'rgba(74,173,168,0.06)',
                    border: '1px solid rgba(74,173,168,0.15)', borderRadius: 8,
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--teal)',
                    animation: 'fadeIn 0.2s ease'
                }}>
                    <span style={{ fontSize: '0.9rem' }}>{selected.icon}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selected.address}
                    </span>
                    <span style={{
                        fontSize: '0.65rem', fontWeight: 700, background: 'rgba(74,173,168,0.1)',
                        padding: '0.15rem 0.4rem', borderRadius: 50, textTransform: 'uppercase',
                        letterSpacing: '0.3px', flexShrink: 0
                    }}>
                        {selected.type}
                    </span>
                </div>
            )}

            {/* Dropdown Results */}
            {isOpen && results.length > 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    background: 'white', border: '1.5px solid var(--border)', borderRadius: 12,
                    marginTop: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                    maxHeight: 320, overflowY: 'auto', animation: 'dropIn 0.2s ease'
                }}>
                    {results.map((r, idx) => (
                        <div
                            key={r.id}
                            onClick={() => handleSelect(r)}
                            onMouseEnter={() => setFocusedIndex(idx)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.7rem',
                                padding: '0.7rem 1rem', cursor: 'pointer', transition: 'background 0.1s',
                                background: focusedIndex === idx ? 'var(--light-bg)' : 'transparent',
                                borderBottom: idx < results.length - 1 ? '1px solid var(--border)' : 'none'
                            }}
                        >
                            <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.1rem',
                                background: r.type === 'venue' ? 'rgba(232,137,106,0.1)' :
                                    r.type === 'poi' ? 'rgba(247,201,72,0.12)' :
                                        r.type === 'address' ? 'rgba(74,173,168,0.1)' : 'rgba(61,140,110,0.1)'
                            }}>
                                {r.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.name}
                                </div>
                                <div style={{ fontSize: '0.73rem', color: '#9aabbb', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.address}
                                </div>
                            </div>
                            <div style={{
                                fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase',
                                letterSpacing: '0.3px', padding: '0.15rem 0.45rem', borderRadius: 50,
                                flexShrink: 0,
                                background: r.type === 'venue' ? 'rgba(232,137,106,0.1)' :
                                    r.type === 'poi' ? 'rgba(247,201,72,0.12)' :
                                        r.type === 'address' ? 'rgba(74,173,168,0.1)' : 'rgba(61,140,110,0.1)',
                                color: r.type === 'venue' ? 'var(--coral)' :
                                    r.type === 'poi' ? '#c4880a' :
                                        r.type === 'address' ? 'var(--teal)' : 'var(--green)'
                            }}>
                                {r.type}
                            </div>
                        </div>
                    ))}
                    <div style={{
                        padding: '0.45rem 1rem', fontSize: '0.65rem', fontWeight: 700,
                        color: '#b0bfcc', textAlign: 'center', borderTop: '1px solid var(--border)',
                        background: 'var(--light-bg)'
                    }}>
                        📍 Powered by OpenStreetMap
                    </div>
                </div>
            )}

            {/* No results */}
            {isOpen && results.length === 0 && !loading && query.length >= 2 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    background: 'white', border: '1.5px solid var(--border)', borderRadius: 12,
                    marginTop: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                    padding: '1.2rem', textAlign: 'center'
                }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>🔍</div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--navy)' }}>No results found</div>
                    <div style={{ fontSize: '0.75rem', color: '#9aabbb', fontWeight: 600 }}>Try a different city, address, or venue name</div>
                </div>
            )}

            <style jsx>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
        </div>
    )
}
