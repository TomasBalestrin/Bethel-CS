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
    const { menteeId, message, type, imageUrl, fileName, mimeType, channel = 'principal', signatureName, quotedMessageId } = body

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

    // 3. Find the correct WPP instance
    const specialistId = mentee.created_by || user.id
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
      const { data: userInstance } = await supabase
        .from('wpp_instances')
        .select('instance_id, specialist_id')
        .eq('specialist_id', user.id)
        .eq('status', 'connected')
        .limit(1)
        .single()
      instance = userInstance
    }

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

    const nextrackUUID = instance.instance_id

    // 4. Format phone
    let phone = mentee.phone.replace(/\D/g, '')
    if (!phone.startsWith('55')) phone = '55' + phone

    // 5. Build signed message with channel signature
    let signedMessage = message || ''
    if (signedMessage && signatureName) {
      signedMessage = `*${signatureName}*: ${signedMessage}`
    }

    // 6. Send via NextTrack API
    let result: { success: boolean; error?: string }

    if (!type || type === 'text') {
      result = await sendTextMessage(phone, signedMessage, nextrackUUID, quotedMessageId || undefined)
    } else {
      result = await sendMediaMessage(
        phone,
        type as 'image' | 'audio' | 'video' | 'document',
        imageUrl || '',
        signedMessage || undefined,
        fileName || undefined,
        mimeType || undefined,
        nextrackUUID,
        quotedMessageId || undefined
      )
    }

    if (!result.success) {
      console.error('[WPP Send] NextTrack error:', result.error, { menteeId, instanceId: nextrackUUID, phone, channel, type, mimeType, imageUrl: imageUrl?.slice(0, 80) })
      return NextResponse.json({ error: result.error || 'Falha ao enviar via WhatsApp' }, { status: 502 })
    }

    console.log('[WPP Send] Success:', { menteeId, type, phone, channel, messageId: result.messageId })

    // 7. Save message with channel and delivery status
    await supabase.from('wpp_messages').insert({
      mentee_id: menteeId,
      specialist_id: instance.specialist_id || user.id,
      instance_id: instance.instance_id,
      message_id: result.messageId || null,
      direction: 'outgoing',
      message_type: type || 'text',
      content: message || null,
      media_url: imageUrl || null,
      is_read: true,
      sent_at: new Date().toISOString(),
      channel,
      quoted_message_id: quotedMessageId || null,
      delivery_status: 'sent',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[WPP Send] Uncaught error:', message, err)
    return NextResponse.json({ error: `Erro interno: ${message}` }, { status: 500 })
  }
}
