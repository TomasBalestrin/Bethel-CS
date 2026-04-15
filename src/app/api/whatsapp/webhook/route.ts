import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMediaUrl } from '@/lib/nextapps'

/**
 * NextTrack WhatsApp Webhook Handler
 *
 * Receives: { event, instanceId, data }
 * Events: message_received, connected, disconnected
 *
 * Must return 200 within 5 seconds (fire-and-forget).
 */

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Use last 8 digits for matching — avoids issues with
  // inconsistent 9th digit between WhatsApp and stored phone
  return digits.slice(-8)
}

function timestampToISO(momment: unknown): string {
  if (!momment) return new Date().toISOString()
  const ms = typeof momment === 'number' ? momment : Number(momment)
  if (isNaN(ms) || ms < 1e12) return new Date().toISOString()
  return new Date(ms).toISOString()
}

function extractContent(data: Record<string, unknown>): string | null {
  const text = data.text as { message?: string } | undefined
  if (text?.message) return text.message

  const image = data.image as { caption?: string } | undefined
  if (image?.caption) return image.caption

  const video = data.video as { caption?: string } | undefined
  if (video?.caption) return video.caption

  return null
}

function extractMediaUrl(data: Record<string, unknown>): string | null {
  const audio = data.audio as { url?: string; audioUrl?: string } | undefined
  if (audio?.url) return getMediaUrl(audio.url)
  if (audio?.audioUrl) return getMediaUrl(audio.audioUrl)

  const image = data.image as { url?: string; imageUrl?: string } | undefined
  if (image?.url) return getMediaUrl(image.url)
  if (image?.imageUrl) return getMediaUrl(image.imageUrl)

  const video = data.video as { videoUrl?: string } | undefined
  if (video?.videoUrl) return getMediaUrl(video.videoUrl)

  const document = data.document as { url?: string; documentUrl?: string } | undefined
  if (document?.url) return getMediaUrl(document.url)
  if (document?.documentUrl) return getMediaUrl(document.documentUrl)

  const sticker = data.sticker as { url?: string } | undefined
  if (sticker?.url) return getMediaUrl(sticker.url)

  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const event = body.event as string
    const data = (body.data || body) as Record<string, unknown>
    const instanceId = (body.instanceId || data.instanceId) as string

    console.log('[WPP Webhook] ═══ INCOMING ═══')
    console.log('[WPP Webhook] event:', event)
    console.log('[WPP Webhook] instanceId:', instanceId)
    console.log('[WPP Webhook] data.phone:', data.phone)
    console.log('[WPP Webhook] data.fromMe:', data.fromMe)
    console.log('[WPP Webhook] data.fromApi:', data.fromApi)
    console.log('[WPP Webhook] data.isGroup:', data.isGroup)
    console.log('[WPP Webhook] data.messageType:', data.messageType)
    console.log('[WPP Webhook] data.senderName:', data.senderName)
    console.log('[WPP Webhook] data.messageId:', data.messageId)
    console.log('[WPP Webhook] data.momment:', data.momment)

    const supabase = createAdminClient()

    // ─── Connection status events ───
    if (event === 'connected' || event === 'disconnected') {
      const connData = data as { instanceId?: string; connectedPhone?: string }
      const whatsmeowId = connData.instanceId || instanceId

      console.log('[WPP Webhook] Connection event:', event, '| whatsmeowId:', whatsmeowId)

      if (whatsmeowId) {
        const status = event === 'connected' ? 'connected' : 'disconnected'
        const { data: updated } = await supabase
          .from('wpp_instances')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('instance_id', whatsmeowId)
          .select('id, specialist_id, phone_number')

        if (!updated || updated.length === 0) {
          const phone = connData.connectedPhone
          console.log('[WPP Webhook] No match by instance_id, trying phone:', phone)
          if (phone) {
            await supabase
              .from('wpp_instances')
              .update({ status, updated_at: new Date().toISOString() })
              .eq('phone_number', phone)
          }
        }

        // Alert all admins when a WhatsApp instance disconnects
        if (event === 'disconnected') {
          const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin')

          // Get the specialist name for the notification
          const instanceInfo = updated?.[0]
          let specialistName = 'Desconhecido'
          if (instanceInfo?.specialist_id) {
            const { data: spec } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', instanceInfo.specialist_id)
              .single()
            if (spec) specialistName = spec.full_name
          }

          const phone = instanceInfo?.phone_number || connData.connectedPhone || whatsmeowId

          if (admins && admins.length > 0) {
            const notifications = admins.map((admin) => ({
              recipient_id: admin.id,
              mentee_id: null,
              department: 'system',
              description: `WhatsApp de ${specialistName} (${phone}) foi desconectado. Reconecte na aba Admin → WhatsApp.`,
              mentee_name: `⚠️ WhatsApp Desconectado`,
              mentee_phone: String(phone),
              sent_by: instanceInfo?.specialist_id || null,
            }))
            await supabase.from('forwarding_notifications').insert(notifications as never)
            console.log('[WPP Webhook] Disconnect alert sent to', admins.length, 'admins')
          }
        }
      }
      return NextResponse.json({ ok: true })
    }

    // ─── Message received ───
    if (event === 'message_received' || event === 'messages.upsert' || event === 'message' || event === 'new_message' || event === 'message_sent' || event === 'outgoing_message') {
      const phone = data.phone as string
      if (!phone) {
        console.log('[WPP Webhook] SKIP: no phone in data')
        return NextResponse.json({ ok: true })
      }

      if (data.isGroup === true) {
        console.log('[WPP Webhook] SKIP: group message')
        return NextResponse.json({ ok: true })
      }

      // NOTE: we used to skip fromApi=true here, but some providers flag every
      // outgoing message (including messages typed on the specialist's phone)
      // as fromApi=true, which was causing phone-origin messages to never
      // appear in the chat. Deduplication now relies exclusively on messageId
      // below — if the same messageId is already in wpp_messages, we skip;
      // otherwise we insert. This handles both cases correctly:
      //   - API-sent: /api/whatsapp/send inserts first with messageId, webhook
      //     arrives later and the messageId check dedupes it away.
      //   - Phone-sent: not inserted yet, messageId missing → we insert now.

      // 1. Find specialist by instance
      const whatsmeowId = (data.instanceId || instanceId) as string
      let instance: { specialist_id: string } | null = null

      if (whatsmeowId) {
        const { data: found, error: instErr } = await supabase
          .from('wpp_instances')
          .select('specialist_id')
          .eq('instance_id', whatsmeowId)
          .single()
        instance = found
        console.log('[WPP Webhook] Instance lookup by', whatsmeowId, '→', found ? 'FOUND' : 'NOT FOUND', instErr?.message || '')
      }

      if (!instance) {
        const { data: fallback, error: fbErr } = await supabase
          .from('wpp_instances')
          .select('specialist_id')
          .eq('status', 'connected')
          .limit(1)
          .single()
        instance = fallback
        console.log('[WPP Webhook] Instance fallback (connected) →', fallback ? 'FOUND' : 'NOT FOUND', fbErr?.message || '')
      }

      if (!instance) {
        console.error('[WPP Webhook] ABORT: No wpp_instance found at all')
        return NextResponse.json({ ok: true })
      }

      console.log('[WPP Webhook] specialist_id:', instance.specialist_id)

      // 2. Find mentee by phone (last 9 digits match)
      const phoneDigits = normalizePhone(phone)
      console.log('[WPP Webhook] Phone:', phone, '→ last 8 digits:', phoneDigits, '→ LIKE %' + phoneDigits)

      // Match by last 8 digits — fetch candidates and compare cleaned digits
      const { data: allMentees, error: menteeErr } = await supabase
        .from('mentees')
        .select('id, phone, full_name')

      console.log('[WPP Webhook] Total mentees to search:', allMentees?.length ?? 0, menteeErr?.message || '')

      const mentee = allMentees?.find((m) => {
        if (!m.phone) return false
        const cleanPhone = m.phone.replace(/\D/g, '')
        return cleanPhone.endsWith(phoneDigits)
      }) || null
      if (!mentee) {
        console.warn('[WPP Webhook] ABORT: Mentee not found for phone:', phone, '(digits:', phoneDigits, ')')
        return NextResponse.json({ ok: true })
      }

      // 3. Deduplicate by messageId
      const messageId = (data.messageId as string) || null
      if (messageId) {
        const { data: existing } = await supabase
          .from('wpp_messages')
          .select('id')
          .eq('message_id', messageId)
          .maybeSingle()

        if (existing) {
          console.log('[WPP Webhook] SKIP: duplicate messageId:', messageId)
          return NextResponse.json({ ok: true })
        }
      }

      // 4. Parse message data
      const direction = data.fromMe ? 'outgoing' : 'incoming'
      type WppMessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'sticker'
      const validTypes: WppMessageType[] = ['text', 'image', 'audio', 'video', 'document', 'location', 'sticker']
      const rawType = (data.messageType as string) || 'text'
      const messageType: WppMessageType = validTypes.includes(rawType as WppMessageType)
        ? (rawType as WppMessageType)
        : 'text'

      const content = extractContent(data)
      const mediaUrl = extractMediaUrl(data)
      const senderName = (data.senderName as string) || null
      const sentAt = timestampToISO(data.momment)

      console.log('[WPP Webhook] INSERT → mentee:', mentee.full_name, '| direction:', direction, '| type:', messageType, '| content:', content?.slice(0, 50), '| mediaUrl:', mediaUrl?.slice(0, 60), '| sentAt:', sentAt)

      // 5. Detect channel: find the last outgoing message within 4h window
      let channel = 'principal'
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      const { data: lastOutgoing } = await supabase
        .from('wpp_messages')
        .select('*')
        .eq('mentee_id', mentee.id)
        .eq('direction', 'outgoing')
        .gte('sent_at', fourHoursAgo)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single()

      if (lastOutgoing && (lastOutgoing as Record<string, unknown>).channel) {
        channel = String((lastOutgoing as Record<string, unknown>).channel)
      }
      console.log('[WPP Webhook] Detected channel:', channel)

      // Extract quoted message reference
      const quotedMsgId = (data.quotedMsg as string) || (data.quotedMsgId as string) || (data.quotedMessageId as string) || null

      // 6. Insert message
      const { error: insertErr } = await supabase.from('wpp_messages').insert({
        mentee_id: mentee.id,
        specialist_id: instance.specialist_id,
        instance_id: whatsmeowId,
        message_id: messageId,
        direction,
        message_type: messageType,
        content,
        media_url: mediaUrl,
        sender_name: senderName,
        quoted_message_id: quotedMsgId,
        is_read: data.fromMe ? true : false,
        sent_at: sentAt,
        channel,
      })

      if (insertErr) {
        console.error('[WPP Webhook] INSERT FAILED:', insertErr.message, insertErr.details, insertErr.hint)
        // Return 500 so NextTrack retries the webhook delivery. Previously this
        // returned 200 which caused messages to be silently lost whenever a DB
        // change introduced a schema mismatch.
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }

      console.log('[WPP Webhook] INSERT SUCCESS ✓')

      // 6. Update chat_metrics for the day
      const day = sentAt.slice(0, 10)
      const metricField = direction === 'incoming'
        ? 'messages_from_mentee'
        : 'messages_from_specialist'

      const { data: existingMetric } = await supabase
        .from('chat_metrics')
        .select('id, messages_from_mentee, messages_from_specialist')
        .eq('mentee_id', mentee.id)
        .eq('date', day)
        .maybeSingle()

      if (existingMetric) {
        await supabase
          .from('chat_metrics')
          .update({
            [metricField]: (existingMetric[metricField] || 0) + 1,
          })
          .eq('id', existingMetric.id)
      } else {
        await supabase.from('chat_metrics').insert({
          mentee_id: mentee.id,
          specialist_id: instance.specialist_id,
          date: day,
          messages_from_mentee: direction === 'incoming' ? 1 : 0,
          messages_from_specialist: direction === 'outgoing' ? 1 : 0,
        })
      }

      return NextResponse.json({ ok: true })
    }

    // ─── Message status update (delivered / read) ───
    if (event === 'message_status' || event === 'message_update' || event === 'messages.update') {
      const msgId = (data.messageId as string) || (data.id as string) || null
      const status = (data.status as string) || (data.type as string) || ''

      console.log('[WPP Webhook] Status update:', { msgId, status, event })

      if (msgId && (status === 'delivered' || status === 'DELIVERY_ACK' || status === 'received' || status === '3')) {
        await supabase
          .from('wpp_messages')
          .update({ delivery_status: 'delivered' })
          .eq('message_id', msgId)
          .eq('delivery_status', 'sent')
        console.log('[WPP Webhook] Marked as delivered:', msgId)
      }

      if (msgId && (status === 'read' || status === 'READ' || status === 'viewed' || status === '4')) {
        await supabase
          .from('wpp_messages')
          .update({ delivery_status: 'read' })
          .eq('message_id', msgId)
        console.log('[WPP Webhook] Marked as read:', msgId)
      }

      return NextResponse.json({ ok: true })
    }

    console.log('[WPP Webhook] Unknown event:', event, JSON.stringify(data).slice(0, 200))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[WPP Webhook] EXCEPTION:', err)
    return NextResponse.json({ ok: true })
  }
}
