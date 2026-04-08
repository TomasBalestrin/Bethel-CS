import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DAILY_WEBHOOK_SECRET = process.env.DAILY_WEBHOOK_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    // Verify webhook authenticity via shared secret header
    if (DAILY_WEBHOOK_SECRET) {
      const authHeader = request.headers.get('authorization') || ''
      if (authHeader !== `Bearer ${DAILY_WEBHOOK_SECRET}`) {
        console.warn('[Daily Webhook] Invalid authorization header')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

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
      })
      .eq('daily_room_name', roomName)
      .in('recording_status', ['pending', 'processing'])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Daily Webhook] Error:', err)
    return NextResponse.json({ ok: true })
  }
}
