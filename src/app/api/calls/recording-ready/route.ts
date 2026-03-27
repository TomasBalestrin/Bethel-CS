import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[Daily Webhook] Received:', JSON.stringify(body).slice(0, 500))

    const action = body.action || body.type
    if (action !== 'recording-ready' && action !== 'recording.ready-to-download') {
      return NextResponse.json({ ok: true })
    }

    const roomName = body.room_name || body.payload?.room_name
    const recording = body.recording || body.payload

    if (!roomName || !recording) {
      return NextResponse.json({ ok: true })
    }

    const supabase = createAdminClient()

    await supabase
      .from('call_records')
      .update({
        recording_url: recording.download_url,
        recording_status: 'ready',
        duration_seconds: recording.duration || null,
        ended_at: new Date().toISOString(),
      })
      .eq('daily_room_name', roomName)
      .eq('recording_status', 'pending')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Daily Webhook] Error:', err)
    return NextResponse.json({ ok: true })
  }
}
