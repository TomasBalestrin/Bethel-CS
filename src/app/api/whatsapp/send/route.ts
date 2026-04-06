import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTextMessage, sendMediaMessage } from '@/lib/nextapps'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // 1. Verify authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { menteeId, message, type, imageUrl, fileName, mimeType } = body

    if (!menteeId || (!message && !imageUrl)) {
      return NextResponse.json({ error: 'menteeId e message/imageUrl são obrigatórios' }, { status: 400 })
    }

    // 2. Find mentee + specialist owner
    const { data: mentee, error: menteeError } = await supabase
      .from('mentees')
      .select('id, phone, created_by')
      .eq('id', menteeId)
      .single()

    if (menteeError || !mentee) {
      return NextResponse.json({ error: 'Mentorado não encontrado' }, { status: 404 })
    }

    // 3. Find the correct WPP instance:
    //    Priority: mentee's specialist (created_by) → logged-in user → any connected
    const specialistId = mentee.created_by || user.id

    // Try specialist's instance first
    let instance: { instance_id: string; specialist_id: string } | null = null

    const { data: specialistInstance } = await supabase
      .from('wpp_instances')
      .select('instance_id, specialist_id')
      .eq('specialist_id', specialistId)
      .eq('status', 'connected')
      .limit(1)
      .single()

    if (specialistInstance) {
      instance = specialistInstance
    } else if (specialistId !== user.id) {
      // Try logged-in user's instance (admin sending on behalf)
      const { data: userInstance } = await supabase
        .from('wpp_instances')
        .select('instance_id, specialist_id')
        .eq('specialist_id', user.id)
        .eq('status', 'connected')
        .limit(1)
        .single()
      instance = userInstance
    }

    // Fallback: any connected instance
    if (!instance) {
      const { data: anyInstance } = await supabase
        .from('wpp_instances')
        .select('instance_id, specialist_id')
        .eq('status', 'connected')
        .limit(1)
        .single()
      instance = anyInstance
    }

    if (!instance) {
      return NextResponse.json({ error: 'Nenhuma instância WhatsApp conectada' }, { status: 404 })
    }

    // 4. Resolve NextTrack UUID from instance_id
    // The instance_id stored in DB is the NextTrack format: "phone_hash"
    // We need the UUID for the API. Try to find it via the instance record.
    const nextrackUUID = instance.instance_id

    // 5. Format phone
    let phone = mentee.phone.replace(/\D/g, '')
    if (!phone.startsWith('55')) {
      phone = '55' + phone
    }

    // 6. Send via NextTrack API using the correct instance
    let result: { success: boolean; error?: string }

    if (!type || type === 'text') {
      result = await sendTextMessage(phone, message, nextrackUUID)
    } else {
      result = await sendMediaMessage(
        phone,
        type as 'image' | 'audio' | 'video' | 'document',
        imageUrl || '',
        message || undefined,
        fileName || undefined,
        mimeType || undefined,
        nextrackUUID
      )
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // 7. Save message with correct specialist + instance
    await supabase.from('wpp_messages').insert({
      mentee_id: menteeId,
      specialist_id: instance.specialist_id || user.id,
      instance_id: instance.instance_id,
      direction: 'outgoing',
      message_type: type || 'text',
      content: message || null,
      media_url: imageUrl || null,
      is_read: true,
      sent_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[WPP Send] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
