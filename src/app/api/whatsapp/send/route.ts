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

    // 2. Find mentee
    const { data: mentee, error: menteeError } = await supabase
      .from('mentees')
      .select('id, phone, created_by')
      .eq('id', menteeId)
      .single()

    if (menteeError || !mentee) {
      return NextResponse.json({ error: 'Mentorado não encontrado' }, { status: 404 })
    }

    // 3. Find connected WPP instance (for specialist_id and instance_id)
    const { data: instance } = await supabase
      .from('wpp_instances')
      .select('instance_id, specialist_id')
      .eq('status', 'connected')
      .limit(1)
      .single()

    if (!instance) {
      return NextResponse.json({ error: 'Instância WhatsApp não conectada' }, { status: 404 })
    }

    const specialistId = instance.specialist_id || user.id

    // 4. Format phone: ensure 55{DDD}{NUMERO} without special chars
    let phone = mentee.phone.replace(/\D/g, '')
    if (!phone.startsWith('55')) {
      phone = '55' + phone
    }

    // 5. Send via NextTrack API
    let result: { success: boolean; error?: string }

    if (!type || type === 'text') {
      result = await sendTextMessage(phone, message)
    } else {
      result = await sendMediaMessage(
        phone,
        type as 'image' | 'audio' | 'video' | 'document',
        imageUrl || '',
        message || undefined,
        fileName || undefined,
        mimeType || undefined
      )
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // 6. Save to wpp_messages (the webhook will also fire for fromApi,
    //    but we filter fromApi=true in the webhook handler to avoid duplicates)
    await supabase.from('wpp_messages').insert({
      mentee_id: menteeId,
      specialist_id: specialistId,
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
