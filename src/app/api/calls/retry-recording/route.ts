import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  // Admin client bypassa RLS em call_records — um especialista retentando a
  // gravação de uma call própria ou admin mexendo em qualquer call não deve
  // falhar silenciosamente por falta de policy.
  const admin = createAdminClient()

  const { callId } = await request.json()
  if (!callId) return NextResponse.json({ error: 'callId obrigatório' }, { status: 400 })

  const { data: call } = await admin
    .from('call_records')
    .select('daily_room_name, recording_status, recording_url')
    .eq('id', callId)
    .single()

  if (!call) return NextResponse.json({ error: 'Ligação não encontrada' }, { status: 404 })
  if (call.recording_status === 'ready' && call.recording_url) {
    return NextResponse.json({ status: 'ready', message: 'Gravação já está disponível' })
  }

  try {
    const recordings = await getRecordings(call.daily_room_name)
    console.log('[retry-recording] Daily returned', recordings.length, 'recordings for', call.daily_room_name)

    if (recordings.length > 0) {
      const rec = recordings.find((r) => !!r.download_url) || recordings[0]
      if (!rec.download_url) {
        return NextResponse.json({
          status: 'not_ready',
          message: `Gravação encontrada (status: ${rec.status || 'desconhecido'}) mas ainda sendo processada pelo Daily — aguarde 1-3 minutos e tente novamente`,
        })
      }
      await admin
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
