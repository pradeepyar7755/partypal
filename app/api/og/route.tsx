import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const title = searchParams.get('title') || 'You\'re Invited!'
    const emoji = searchParams.get('emoji') || '🎉'
    const date = searchParams.get('date') || ''
    const time = searchParams.get('time') || ''
    const location = searchParams.get('location') || ''
    const host = searchParams.get('host') || ''
    const image = searchParams.get('image') || ''

    // Format date nicely
    let formattedDate = date
    if (date) {
        try {
            formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
            })
        } catch {
            formattedDate = date
        }
    }

    // Build detail line
    const details: string[] = []
    if (formattedDate) details.push(`📅 ${formattedDate}`)
    if (time) details.push(`⏰ ${time}`)
    if (location) details.push(`📍 ${location}`)
    if (host) details.push(`🎉 Hosted by ${host}`)

    if (image) {
        // Photo-forward layout: cover photo with overlay
        return new ImageResponse(
            (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        position: 'relative',
                    }}
                >
                    {/* Background image */}
                    <img
                        src={image}
                        alt=""
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                    {/* Dark gradient overlay */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '55%',
                            display: 'flex',
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.85))',
                        }}
                    />
                    {/* Content at bottom */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: '40px 50px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                        }}
                    >
                        <div
                            style={{
                                fontSize: 48,
                                fontWeight: 800,
                                color: '#ffffff',
                                textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                                lineHeight: 1.1,
                            }}
                        >
                            {title}
                        </div>
                        <div
                            style={{
                                fontSize: 24,
                                fontWeight: 600,
                                color: 'rgba(255,255,255,0.9)',
                                display: 'flex',
                                gap: '20px',
                                flexWrap: 'wrap',
                            }}
                        >
                            {details.map((d, i) => (
                                <span key={i}>{d}</span>
                            ))}
                        </div>
                    </div>
                    {/* Subtle branding */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 20,
                            right: 25,
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'rgba(255,255,255,0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <img src="https://partypal.social/logo.png" alt="" width="24" height="24" style={{ borderRadius: 4 }} /> PartyPal
                    </div>
                </div>
            ),
            { width: 1200, height: 630 }
        )
    }

    // Fallback: branded gradient card (no cover photo)
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: '#1a2535',
                    padding: '60px',
                    position: 'relative',
                }}
            >
                {/* Decorative accents */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '450px',
                        height: '450px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(74,173,168,0.15) 0%, transparent 60%)',
                        display: 'flex',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: -100,
                        left: -50,
                        width: '450px',
                        height: '450px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(247,201,72,0.1) 0%, transparent 60%)',
                        display: 'flex',
                    }}
                />

                {/* Emoji / Icon group */}
                <div style={{ fontSize: 72, marginBottom: '24px', display: 'flex', filter: 'drop-shadow(0px 8px 16px rgba(0,0,0,0.3))' }}>{emoji}</div>

                {/* Title */}
                <div
                    style={{
                        fontSize: 64,
                        fontWeight: 800,
                        color: '#ffffff',
                        textAlign: 'center',
                        lineHeight: 1.15,
                        marginBottom: '32px',
                        maxWidth: '900px',
                        textShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    }}
                >
                    {title}
                </div>

                {/* Details */}
                <div
                    style={{
                        display: 'flex',
                        gap: '24px',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        fontSize: 24,
                        fontWeight: 500,
                        color: '#a0aec0',
                    }}
                >
                    {details.map((d, i) => (
                        <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
                            {d}
                        </span>
                    ))}
                </div>

                {/* Tap to RSVP pill */}
                <div
                    style={{
                        marginTop: '45px',
                        padding: '16px 48px',
                        borderRadius: '50px',
                        background: 'linear-gradient(135deg, #4AADA8, #3D8C6E)',
                        color: '#fff',
                        fontSize: 26,
                        fontWeight: 800,
                        display: 'flex',
                        boxShadow: '0 8px 24px rgba(74,173,168,0.4)',
                    }}
                >
                    Tap to RSVP →
                </div>

                {/* Branding */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 30,
                        right: 40,
                        fontSize: 20,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                    }}
                >
                    <img src="https://partypal.social/logo.png" alt="" width="28" height="28" style={{ borderRadius: 6, opacity: 0.9 }} /> PartyPal
                </div>
            </div>
        ),
        { width: 1200, height: 630 }
    )
}
