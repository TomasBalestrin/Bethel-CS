import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTextMessage, sendMediaMessage } from '@/lib/nextapps'
import { logOpError } from '@/lib/log-op-error'

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

    // Prefer NextTrack UUID from env; fallback to Whatsmeow ID only if not configured
    const nextrackUUID = process.env.NEXTRACK_INSTANCE_UUID || process.env.NEXTAPPS_INSTANCE_ID || instance.instance_id
    console.log('[WPP Send] Using instanceUUID:', nextrackUUID, 'source:', process.env.NEXTRACK_INSTANCE_UUID ? 'env NEXTRACK_INSTANCE_UUID' : process.env.NEXTAPPS_INSTANCE_ID ? 'env NEXTAPPS_INSTANCE_ID' : 'wpp_instances.instance_id (Whatsmeow)')

    // 4. Format phone — Brazilian numbers must be 55 + DDD (2) + 9 + 8 digits = 13 digits
    let phone = mentee.phone.replace(/\D/g, '')
    if (phone.length === 10 || phone.length === 11) {
      // Number without country code: add 55 prefix
      phone = '55' + phone
    } else if (phone.length === 12 || phone.length === 13) {
      // Already has country code (12 = old 8-digit mobile, 13 = new 9-digit mobile)
      if (!phone.startsWith('55')) phone = '55' + phone
    } else {
      // Other lengths: just ensure 55 prefix exists
      if (!phone.startsWith('55')) phone = '55' + phone
    }
    console.log('[WPP Send] Phone formatted:', mentee.phone, '→', phone, 'length:', phone.length)

    // 5. Build signed message with channel signature
    let signedMessage = message || ''
    if (signedMessage && signatureName) {
      signedMessage = `*${signatureName}*: ${signedMessage}`
    }

    // 6. Send via NextTrack API
    let result: { success: boolean; error?: string; messageId?: string }

    if (!type || type === 'text') {
      result = await sendTextMessage(phone, signedMessage, nextrackUUID, quotedMessageId || undefined)
    } else {
      // Verify the media URL is publicly accessible (NextTrack downloads via http.Get)
      let mediaCheckInfo = ''
      if (imageUrl) {
        try {
          const checkRes = await fetch(imageUrl, { method: 'HEAD', cache: 'no-store' })
          mediaCheckInfo = `status=${checkRes.status} type=${checkRes.headers.get('content-type')} size=${checkRes.headers.get('content-length')}`
          if (!checkRes.ok) {
            console.error('[WPP Send] Media URL not publicly accessible:', checkRes.status, imageUrl)
            return NextResponse.json({ error: `URL da mídia não está pública (${checkRes.status})` }, { status: 502 })
          }
        } catch (err) {
          console.error('[WPP Send] Media URL HEAD failed:', err, 'url:', imageUrl)
          return NextResponse.json({ error: `Erro ao verificar URL da mídia: ${String(err)}` }, { status: 502 })
        }
      }

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

      // Consolidated log: media check + NextTrack result
      console.log('[WPP Send] MEDIA', { type, success: result.success, messageId: result.messageId, error: result.error, mediaCheck: mediaCheckInfo, urlFull: imageUrl })
    }

    if (!result.success) {
      console.error('[WPP Send] NextTrack error:', result.error, { menteeId, instanceId: nextrackUUID, phone, channel, type, mimeType, imageUrl: imageUrl?.slice(0, 80) })
      await logOpError({
        route: '/api/whatsapp/send',
        operation: 'api',
        target: `nextrack:${type || 'text'}`,
        error: { message: result.error || 'Falha ao enviar via WhatsApp' },
        menteeId,
        context: { instanceId: nextrackUUID, phone, channel, type, mimeType },
      })
      return NextResponse.json({ error: result.error || 'Falha ao enviar via WhatsApp' }, { status: 502 })
    }

    console.log('[WPP Send] Success:', { menteeId, type, phone, channel, messageId: result.messageId, imageUrl: imageUrl?.slice(0, 120) })
    if (imageUrl) console.log('[WPP Send] FULL imageUrl:', imageUrl)

    // 7. Save message with channel and delivery status.
    // IMPORTANT: use the admin client to bypass the "specialist_id = auth.uid()"
    // RLS policy. When Kennedy/any admin sends a message on a mentee owned by
    // Aline, specialist_id is set to Aline (so the row is correctly scoped to
    // the mentee owner), and the policy would otherwise reject the INSERT —
    // the message would reach WhatsApp successfully but silently disappear
    // from the chat history after a refresh.
    const admin = createAdminClient()
    const { error: insertErr } = await admin.from('wpp_messages').insert({
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
      source: 'api',
    })
    if (insertErr) {
      // Unique violation on message_id means the webhook beat us to the insert
      // (it fired and ran before our /send INSERT completed). That's fine —
      // the row exists, treat as success.
      const code = (insertErr as { code?: string }).code
      const isDuplicate = code === '23505' || /duplicate key/i.test(insertErr.message || '')
      if (isDuplicate && result.messageId) {
        console.log('[WPP Send] Row already inserted by webhook (messageId', result.messageId, ') — treating as success')
        return NextResponse.json({ success: true })
      }
      console.error('[WPP Send] DB INSERT FAILED (message was sent but not saved):', insertErr.message, insertErr.details, insertErr.hint)
      await logOpError({
        route: '/api/whatsapp/send',
        operation: 'insert',
        target: 'wpp_messages',
        error: insertErr,
        menteeId,
        specialistId: instance.specialist_id || user.id,
        context: { type: type || 'text', channel, hasMediaUrl: !!imageUrl, contentLen: (message || '').length },
      })
      return NextResponse.json({ error: `Mensagem enviada mas não foi salva: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[WPP Send] Uncaught error:', message, err)
    return NextResponse.json({ error: `Erro interno: ${message}` }, { status: 500 })
  }
}
