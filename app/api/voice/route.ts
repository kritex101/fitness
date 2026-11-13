import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import type { ExerciseVisualGender } from '@/lib/fitness-data'

export const dynamic = 'force-dynamic'

const MAX_TEXT_LENGTH = 1200
const ELEVENLABS_VOICE_IDS: Record<ExerciseVisualGender, string> = {
  male: 'JBFqnCBsd6RMkjVDRZzb',
  female: 'EXAVITQu4vr4xnSDxMaL',
}

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }

function errorResponse(message: string, status: number, unavailable = false) {
  return NextResponse.json({ error: message, unavailable }, { status, headers: noStoreHeaders })
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return errorResponse('Sign in to use the Voice Coach.', 401)

  const body = await request.json().catch(() => null) as { text?: unknown; gender?: unknown } | null
  const text = typeof body?.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : ''
  const gender = body?.gender
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return errorResponse(`Speech text must be between 1 and ${MAX_TEXT_LENGTH} characters.`, 400)
  }
  if (gender !== 'male' && gender !== 'female') return errorResponse('Choose a supported voice.', 400)

  const apiKey = process.env.ELEVENLABS_SOUND?.trim()
  if (!apiKey) return errorResponse('ElevenLabs speech is not configured.', 503, true)

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_IDS[gender]}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    if (response.status === 401 || response.status === 403) {
      return errorResponse('ElevenLabs rejected the server API key.', 503, true)
    }
    if (!response.ok || !response.body) return errorResponse('ElevenLabs could not generate speech.', 502)

    return new Response(response.body, {
      headers: { ...noStoreHeaders, 'Content-Type': response.headers.get('content-type') ?? 'audio/mpeg' },
    })
  } catch {
    return errorResponse('ElevenLabs is temporarily unavailable.', 502)
  }
}
