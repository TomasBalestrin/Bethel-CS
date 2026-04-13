import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecordings } from '@/lib/daily'

/**
 * Retry endpoint for calls with failed/unavailable recording.
 * Re-queries Daily.co API and, if a recording exists, marks as ready
 * and triggers transcription. Safe to call multiple times.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { callId } = await request.json()
  if (!callId) return NextResponse.json({ error: 'callId obrigatório' }, { status: 400 })

  const { data: call } = await supabase
    .from('call_records')
    .select('daily_room_name, recording_status')
    .eq('id', callId)
    .single()

  if (!call) return NextResponse.json({ error: 'Ligação não encontrada' }, { status: 404 })
  if (call.recording_status === 'ready') {
    return NextResponse.json({ status: 'ready', message: 'Gravação já está disponível' })
  }

  try {
    const recordings = await getRecordings(call.daily_room_name)
    console.log('[retry-recording] Daily returned', recordings.length, 'recordings for', call.daily_room_name)

    if (recordings.length > 0) {
      const rec = recordings[0]
      await supabase
        .from('call_records')
        .update({
          recording_url: rec.download_url,
          recording_status: 'ready',
          duration_seconds: Math.round(rec.duration),
          transcription_status: 'pending',
        })
        .eq('id', callId)

      // Trigger transcription in background (same pattern as check-recording)
      const origin = request.nextUrl.origin
      fetch(`${origin}/api/calls/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ callId }),
      }).catch((err) => console.error('[retry-recording] Transcribe trigger failed:', err))

      return NextResponse.json({ status: 'ready', recording_url: rec.download_url })
    }

    return NextResponse.json({
      status: 'not_found',
      message: 'Nenhuma gravação encontrada no Daily.co para esta sala',
    })
  } catch (err) {
    console.error('[retry-recording] Daily API error:', err)
    return NextResponse.json({ error: `Erro ao consultar Daily: ${String(err)}` }, { status: 502 })
  }
}
