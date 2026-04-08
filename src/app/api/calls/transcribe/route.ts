import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })
  }

  const { callId } = await request.json()
  if (!callId) return NextResponse.json({ error: 'callId obrigatório' }, { status: 400 })

  // Get the call record
  const { data: call } = await supabase
    .from('call_records')
    .select('id, recording_url, recording_status, transcription_status')
    .eq('id', callId)
    .single()

  if (!call) return NextResponse.json({ error: 'Ligação não encontrada' }, { status: 404 })
  if (call.transcription_status === 'ready') return NextResponse.json({ status: 'ready' })
  if (call.transcription_status === 'processing') return NextResponse.json({ status: 'processing' })
  if (call.recording_status !== 'ready' || !call.recording_url) {
    return NextResponse.json({ error: 'Gravação ainda não está disponível' }, { status: 400 })
  }

  // Mark as processing
  await supabase
    .from('call_records')
    .update({ transcription_status: 'processing' })
    .eq('id', callId)

  try {
    console.log('[Transcribe] Downloading recording:', call.recording_url)

    // Download the recording audio
    const audioRes = await fetch(call.recording_url)
    if (!audioRes.ok) {
      throw new Error(`Failed to download recording: ${audioRes.status}`)
    }

    const audioBuffer = await audioRes.arrayBuffer()
    const audioFile = new File([audioBuffer], 'recording.mp4', { type: 'audio/mp4' })

    console.log('[Transcribe] Sending to Whisper API, size:', audioBuffer.byteLength)

    // Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'pt',
      response_format: 'text',
    })

    console.log('[Transcribe] Success, length:', transcription.length)

    // Save transcription
    await supabase
      .from('call_records')
      .update({
        transcription: transcription,
        transcription_status: 'ready',
      })
      .eq('id', callId)

    return NextResponse.json({ status: 'ready', transcription })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Transcribe] Error:', message)

    await supabase
      .from('call_records')
      .update({ transcription_status: 'failed' })
      .eq('id', callId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
