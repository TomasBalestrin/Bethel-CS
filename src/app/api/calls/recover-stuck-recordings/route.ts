import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecordings } from '@/lib/daily'

/**
 * Admin utility: finds call_records stuck in 'processing' or 'pending' status
 * with NULL recording_url (caused by the old bug where transcription_status
 * column didn't exist and UPDATEs silently failed).
 * Re-queries Daily.co for each room and recovers records that have a ready
 * recording.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Admin check
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  // Find stuck calls
  const { data: stuckCalls, error: queryErr } = await supabase
    .from('call_records')
    .select('id, daily_room_name')
    .in('recording_status', ['processing', 'pending'])
    .is('recording_url', null)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(100) // batch size to avoid timeouts

  if (queryErr) {
    return NextResponse.json({ error: queryErr.message }, { status: 500 })
  }

  if (!stuckCalls || stuckCalls.length === 0) {
    return NextResponse.json({ total: 0, recovered: 0, not_found: 0, errors: 0, message: 'Nenhuma ligação travada encontrada' })
  }

  let recovered = 0
  let notFound = 0
  let errorCount = 0

  for (const call of stuckCalls) {
    if (!call.daily_room_name) { errorCount++; continue }
    try {
      const recordings = await getRecordings(call.daily_room_name)
      const rec = recordings.find((r) => !!r.download_url)
      if (rec) {
        const { error: updateErr } = await supabase
          .from('call_records')
          .update({
            recording_url: rec.download_url,
            recording_status: 'ready',
            duration_seconds: Math.round(rec.duration),
            transcription_status: 'pending',
          } as never)
          .eq('id', call.id)

        if (updateErr) {
          console.error('[recover-stuck] Update failed for call', call.id, ':', updateErr.message)
          errorCount++
          continue
        }

        recovered++
        // Fire transcription in background (not awaited to keep response fast)
        const origin = request.nextUrl.origin
        fetch(`${origin}/api/calls/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: request.headers.get('cookie') || '',
          },
          body: JSON.stringify({ callId: call.id }),
        }).catch((err) => console.error('[recover-stuck] Transcribe trigger failed:', err))
      } else {
        notFound++
      }
    } catch (err) {
      console.error('[recover-stuck] Daily API error for', call.daily_room_name, ':', err)
      errorCount++
    }
  }

  return NextResponse.json({
    total: stuckCalls.length,
    recovered,
    not_found: notFound,
    errors: errorCount,
    message: `${recovered} gravação(ões) recuperada(s), ${notFound} não encontrada(s), ${errorCount} com erro`,
  })
}
