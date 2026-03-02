'use client'
import { useEffect, useRef } from 'react'

interface AdUnitProps {
    slot: string
    format?: 'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal'
    style?: React.CSSProperties
    className?: string
    label?: string
}

/**
 * Google AdSense ad unit component.
 * In development (or when no NEXT_PUBLIC_ADSENSE_CLIENT is set), renders a styled mock placeholder.
 * In production with a valid client ID, renders a real AdSense <ins> tag.
 */
export default function AdUnit({ slot, format = 'auto', style, className, label }: AdUnitProps) {
    const adRef = useRef<HTMLDivElement>(null)
    const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT

    useEffect(() => {
        if (client && typeof window !== 'undefined') {
            try {
                ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
            } catch { /* ad already pushed */ }
        }
    }, [client])

    // Mock placeholder when no AdSense client is configured
    if (!client) {
        return (
            <div className={className} style={style}>
                <div style={{
                    background: 'linear-gradient(135deg, rgba(74,173,168,0.06) 0%, rgba(123,94,167,0.06) 100%)',
                    border: '1.5px dashed rgba(74,173,168,0.3)',
                    borderRadius: 12,
                    padding: '1.2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    minHeight: format === 'vertical' ? 400 : format === 'rectangle' ? 250 : 100,
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* "Ad" badge */}
                    <span style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        background: 'rgba(74,173,168,0.12)',
                        color: '#4AADA8',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 4,
                    }}>
                        Sponsored
                    </span>

                    {/* Mock ad content */}
                    <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                        <div style={{
                            fontSize: '1.8rem',
                            marginBottom: '0.3rem',
                            opacity: 0.7,
                        }}>
                            📣
                        </div>
                        <div style={{
                            fontFamily: "'Fredoka One', cursive",
                            fontSize: '0.95rem',
                            color: 'var(--navy, #1A2535)',
                            opacity: 0.6,
                            marginBottom: '0.2rem',
                        }}>
                            {label || 'Ad Space'}
                        </div>
                        <div style={{
                            fontSize: '0.72rem',
                            color: '#9aabbb',
                            fontWeight: 600,
                            lineHeight: 1.5,
                        }}>
                            Google AdSense will display<br />relevant ads here
                        </div>
                        {format === 'vertical' && (
                            <div style={{
                                marginTop: '1rem',
                                width: 120,
                                height: 120,
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, rgba(74,173,168,0.08), rgba(247,201,72,0.08))',
                                margin: '1rem auto 0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.68rem',
                                color: '#9aabbb',
                                fontWeight: 700,
                            }}>
                                160 × 600
                            </div>
                        )}
                    </div>

                    {/* Mock CTA */}
                    <div style={{
                        background: 'rgba(74,173,168,0.08)',
                        borderRadius: 8,
                        padding: '0.4rem 1.2rem',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: '#4AADA8',
                        letterSpacing: '0.5px',
                    }}>
                        Learn More →
                    </div>
                </div>
            </div>
        )
    }

    // Real AdSense unit
    return (
        <div ref={adRef} className={className} style={style}>
            <ins
                className="adsbygoogle"
                style={{ display: 'block', ...style }}
                data-ad-client={client}
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive="true"
            />
        </div>
    )
}
