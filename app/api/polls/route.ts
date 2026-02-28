import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// ── CREATE a poll ─────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { question, options, eventId, creatorName, type, allowMultiple, eventContext, contextHint } = body

        if (!question || !options || options.length < 2) {
            return NextResponse.json({ error: 'Need a question and at least 2 options' }, { status: 400 })
        }

        const db = getDb()
        const pollId = Math.random().toString(36).slice(2, 10)

        const pollData = {
            id: pollId,
            question,
            type: type || 'single',       // 'single' or 'multiple'
            allowMultiple: allowMultiple || false,
            options: options.map((opt: string, i: number) => ({
                id: i.toString(),
                text: opt,
                votes: 0,
                voters: [] as string[],
            })),
            eventId: eventId || null,
            creatorName: creatorName || 'Host',
            createdAt: new Date().toISOString(),
            closed: false,
            totalVotes: 0,
            // Event context (optional)
            ...(eventContext ? { eventContext } : {}),
            ...(contextHint ? { contextHint } : {}),
        }

        await db.collection('polls').doc(pollId).set(pollData)

        return NextResponse.json({
            poll: pollData,
            shareUrl: `/poll/${pollId}`,
        })
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

// ── GET a poll (or list polls for an event, or stats) ─
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const pollId = searchParams.get('id')
        const eventId = searchParams.get('eventId')
        const stats = searchParams.get('stats')

        const db = getDb()

        // Admin stats mode
        if (stats === 'true') {
            const snap = await db.collection('polls').get()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allPolls = snap.docs.map(d => d.data()) as any[]
            const totalPolls = allPolls.length
            const totalVotes = allPolls.reduce((sum, p) => sum + (p.totalVotes || 0), 0)
            const activePolls = allPolls.filter(p => !p.closed).length
            const eventsWithPolls = new Set(allPolls.map(p => p.eventId).filter(Boolean)).size

            // Unique voters across all polls
            const allVoters = new Set<string>()
            allPolls.forEach(p => {
                (p.options || []).forEach((o: { voters?: string[] }) => {
                    (o.voters || []).forEach((v: string) => allVoters.add(v))
                })
            })

            // Average options per poll
            const avgOptions = totalPolls > 0
                ? (allPolls.reduce((sum, p) => sum + (p.options?.length || 0), 0) / totalPolls).toFixed(1)
                : '0'

            // Top poll questions (most voted)
            const topPolls = [...allPolls]
                .sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0))
                .slice(0, 5)
                .map(p => ({
                    question: p.question,
                    votes: p.totalVotes || 0,
                    options: p.options?.length || 0,
                    eventType: p.eventContext?.eventType || null,
                    createdAt: p.createdAt,
                }))

            // Poll question categories (based on keywords)
            const categories: Record<string, number> = {}
            allPolls.forEach(p => {
                const q = (p.question || '').toLowerCase()
                if (q.includes('date') || q.includes('when') || q.includes('day')) categories['Date/Time'] = (categories['Date/Time'] || 0) + 1
                else if (q.includes('venue') || q.includes('location') || q.includes('where') || q.includes('place')) categories['Venue'] = (categories['Venue'] || 0) + 1
                else if (q.includes('food') || q.includes('menu') || q.includes('eat') || q.includes('serve')) categories['Food'] = (categories['Food'] || 0) + 1
                else if (q.includes('theme') || q.includes('vibe') || q.includes('style')) categories['Theme'] = (categories['Theme'] || 0) + 1
                else if (q.includes('music') || q.includes('dj') || q.includes('playlist')) categories['Music'] = (categories['Music'] || 0) + 1
                else if (q.includes('time') || q.includes('start') || q.includes('begin')) categories['Start Time'] = (categories['Start Time'] || 0) + 1
                else categories['Other'] = (categories['Other'] || 0) + 1
            })

            // Polls created per day (last 14 days)
            const pollsByDay: Record<string, number> = {}
            const votesByDay: Record<string, number> = {}
            allPolls.forEach(p => {
                if (p.createdAt) {
                    const day = p.createdAt.split('T')[0]
                    pollsByDay[day] = (pollsByDay[day] || 0) + 1
                }
            })

            // Event types using polls
            const eventTypes: Record<string, number> = {}
            allPolls.forEach(p => {
                const et = p.eventContext?.eventType || 'Unknown'
                eventTypes[et] = (eventTypes[et] || 0) + 1
            })

            // Voter engagement distribution
            const voteDist = { '0 votes': 0, '1-3 votes': 0, '4-10 votes': 0, '10+ votes': 0 }
            allPolls.forEach(p => {
                const v = p.totalVotes || 0
                if (v === 0) voteDist['0 votes']++
                else if (v <= 3) voteDist['1-3 votes']++
                else if (v <= 10) voteDist['4-10 votes']++
                else voteDist['10+ votes']++
            })

            // Multi-select usage
            const multiSelectPolls = allPolls.filter(p => p.allowMultiple).length

            return NextResponse.json({
                totalPolls, totalVotes, activePolls, eventsWithPolls,
                uniqueVoters: allVoters.size,
                avgOptions,
                avgVotesPerPoll: totalPolls > 0 ? (totalVotes / totalPolls).toFixed(1) : '0',
                topPolls,
                categories,
                pollsByDay,
                votesByDay,
                eventTypes,
                voteDist,
                multiSelectPolls,
                multiSelectRate: totalPolls > 0 ? `${Math.round((multiSelectPolls / totalPolls) * 100)}%` : '0%',
            })
        }

        if (pollId) {
            const doc = await db.collection('polls').doc(pollId).get()
            if (!doc.exists) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
            return NextResponse.json(doc.data())
        }

        if (eventId) {
            const snap = await db.collection('polls')
                .where('eventId', '==', eventId)
                .limit(50)
                .get()
            // Sort client-side to avoid needing a composite index
            const polls = snap.docs
                .map(d => d.data())
                .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
            return NextResponse.json({ polls })
        }

        return NextResponse.json({ error: 'Provide id or eventId' }, { status: 400 })
    } catch (error) {
        console.error('[polls GET]', error)
        const msg = error instanceof Error ? error.message : String(error)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

// ── DELETE a poll ─────────────────────────────────────
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const pollId = searchParams.get('id')
        if (!pollId) return NextResponse.json({ error: 'Missing poll id' }, { status: 400 })

        const db = getDb()
        const ref = db.collection('polls').doc(pollId)
        const doc = await ref.get()
        if (!doc.exists) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })

        await ref.delete()
        return NextResponse.json({ deleted: true })
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

// ── VOTE on a poll (PUT) ──────────────────────────────
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json()
        const { pollId, optionIds, voterName } = body

        if (!pollId || !optionIds || !voterName) {
            return NextResponse.json({ error: 'Missing pollId, optionIds, or voterName' }, { status: 400 })
        }

        const db = getDb()
        const pollRef = db.collection('polls').doc(pollId)
        const doc = await pollRef.get()

        if (!doc.exists) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
        const poll = doc.data()!

        if (poll.closed) return NextResponse.json({ error: 'Poll is closed' }, { status: 400 })

        // Check if voter already voted
        const alreadyVoted = poll.options.some(
            (opt: { voters: string[] }) => opt.voters.includes(voterName)
        )
        if (alreadyVoted) {
            return NextResponse.json({ error: 'You already voted!' }, { status: 400 })
        }

        // Apply votes
        const selectedIds = Array.isArray(optionIds) ? optionIds : [optionIds]
        const updatedOptions = poll.options.map((opt: { id: string; votes: number; voters: string[] }) => {
            if (selectedIds.includes(opt.id)) {
                return {
                    ...opt,
                    votes: opt.votes + 1,
                    voters: [...opt.voters, voterName],
                }
            }
            return opt
        })

        await pollRef.update({
            options: updatedOptions,
            totalVotes: (poll.totalVotes || 0) + 1,
        })

        const updatedPoll = { ...poll, options: updatedOptions, totalVotes: (poll.totalVotes || 0) + 1 }
        return NextResponse.json(updatedPoll)
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
