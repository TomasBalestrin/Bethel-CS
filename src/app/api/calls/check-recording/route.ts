import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecordings } from '@/lib/daily'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { callId, markFailed } = await request.json()
  if (!callId) return NextResponse.json({ error: 'callId obrigatório' }, { status: 400 })

  // Get the call record
  const { data: call } = await supabase
    .from('call_records')
    .select('daily_room_name, recording_status')
    .eq('id', callId)
    .single()

  if (!call) return NextResponse.json({ error: 'Ligação não encontrada' }, { status: 404 })
  if (call.recording_status === 'ready') return NextResponse.json({ status: 'ready' })
  if (call.recording_status === 'failed') return NextResponse.json({ status: 'failed' })

  // Mark as failed if polling exhausted
  if (markFailed) {
    await supabase
      .from('call_records')
      .update({ recording_status: 'failed' })
      .eq('id', callId)
    return NextResponse.json({ status: 'failed' })
  }

  // Check Daily API for recordings
  try {
    const recordings = await getRecordings(call.daily_room_name)

    if (recordings.length > 0) {
      // Pick the first recording with a usable download URL
      const rec = recordings.find((r) => !!r.download_url) || recordings[0]
      // Only mark as 'ready' if we actually have a download URL
      // Daily may return the recording before processing is complete (without download_link)
      if (!rec.download_url) {
        console.log('[check-recording] Recording found but download_url missing — still processing (status:', rec.status, ')')
        return NextResponse.json({ status: 'pending' })
      }
      await supabase
        .from('call_records')
        .update({
          recording_url: rec.download_url,
          recording_status: 'ready',
          duration_seconds: Math.round(rec.duration),
          transcription_status: 'pending',
        })
        .eq('id', callId)

      // Auto-trigger transcription in background
      const origin = request.nextUrl.origin
      fetch(`${origin}/api/calls/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ callId }),
      }).catch((err) => console.error('[check-recording] Transcribe trigger failed:', err))

      return NextResponse.json({ status: 'ready', recording_url: rec.download_url })
    }
  } catch (err) {
    console.error('[check-recording] Daily API error:', err)
  }

  return NextResponse.json({ status: 'pending' })
}
