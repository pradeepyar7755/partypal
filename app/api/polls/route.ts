import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// ── CREATE a poll ─────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { question, options, eventId, creatorName, type, allowMultiple } = body

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

// ── GET a poll (or list polls for an event) ───────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const pollId = searchParams.get('id')
        const eventId = searchParams.get('eventId')

        const db = getDb()

        if (pollId) {
            const doc = await db.collection('polls').doc(pollId).get()
            if (!doc.exists) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
            return NextResponse.json(doc.data())
        }

        if (eventId) {
            const snap = await db.collection('polls')
                .where('eventId', '==', eventId)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get()
            return NextResponse.json({ polls: snap.docs.map(d => d.data()) })
        }

        return NextResponse.json({ error: 'Provide id or eventId' }, { status: 400 })
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
