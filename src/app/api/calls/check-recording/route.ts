import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecordings } from '@/lib/daily'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { callId } = await request.json()
  if (!callId) return NextResponse.json({ error: 'callId obrigatório' }, { status: 400 })

  // Get the call record
  const { data: call } = await supabase
    .from('call_records')
    .select('daily_room_name, recording_status')
    .eq('id', callId)
    .single()

  if (!call) return NextResponse.json({ error: 'Ligação não encontrada' }, { status: 404 })
  if (call.recording_status === 'ready') return NextResponse.json({ status: 'ready' })

  // Check Daily API for recordings
  try {
    const recordings = await getRecordings(call.daily_room_name)

    if (recordings.length > 0) {
      const rec = recordings[0]
      await supabase
        .from('call_records')
        .update({
          recording_url: rec.download_url,
          recording_status: 'ready',
          duration_seconds: Math.round(rec.duration),
        })
        .eq('id', callId)

      return NextResponse.json({ status: 'ready', recording_url: rec.download_url })
    }
  } catch (err) {
    console.error('[check-recording] Daily API error:', err)
  }

  return NextResponse.json({ status: 'pending' })
}
