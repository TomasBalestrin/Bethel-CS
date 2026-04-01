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
  return digits.slice(-9)
}

function timestampToISO(momment: unknown): string {
  if (!momment) return new Date().toISOString()
  const ms = typeof momment === 'number' ? momment : Number(momment)
  if (isNaN(ms) || ms < 1e12) return new Date().toISOString()
  return new Date(ms).toISOString()
}

/**
 * Extract content text from message payload.
 * - text messages: data.text.message
 * - documents: data.text.message contains the friendly filename
 * - image/video with caption: data.image.caption / data.video.caption
 */
function extractContent(data: Record<string, unknown>): string | null {
  const text = data.text as { message?: string } | undefined
  if (text?.message) return text.message

  const image = data.image as { caption?: string } | undefined
  if (image?.caption) return image.caption

  const video = data.video as { caption?: string } | undefined
  if (video?.caption) return video.caption

  return null
}

/**
 * Extract media URL from the type-specific payload field.
 * Each type has its own nested object (audio.url, image.url, etc.)
 * Returns a full S3 URL or null.
 */
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

    const supabase = createAdminClient()

    // ─── Connection status events ───
    if (event === 'connected' || event === 'disconnected') {
      const connData = data as { instanceId?: string; connectedPhone?: string }
      const whatsmeowId = connData.instanceId || instanceId

      if (whatsmeowId) {
        const status = event === 'connected' ? 'connected' : 'disconnected'
        const { data: updated } = await supabase
          .from('wpp_instances')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('instance_id', whatsmeowId)
          .select('id')

        if (!updated || updated.length === 0) {
          // Try matching by phone_number from data
          const phone = connData.connectedPhone
          if (phone) {
            await supabase
              .from('wpp_instances')
              .update({ status, updated_at: new Date().toISOString() })
              .eq('phone_number', phone)
          }
        }
      }
      return NextResponse.json({ ok: true })
    }

    // ─── Message received ───
    if (event === 'message_received') {
      const phone = data.phone as string
      if (!phone) return NextResponse.json({ ok: true })

      // Filter: ignore group messages
      if (data.isGroup === true) {
        return NextResponse.json({ ok: true })
      }

      // Filter: ignore messages sent via API to avoid duplicates
      // (our send route already saves the outgoing message)
      if (data.fromApi === true) {
        return NextResponse.json({ ok: true })
      }

      // 1. Find specialist by instance
      const whatsmeowId = (data.instanceId || instanceId) as string
      let instance: { specialist_id: string } | null = null

      if (whatsmeowId) {
        const { data: found } = await supabase
          .from('wpp_instances')
          .select('specialist_id')
          .eq('instance_id', whatsmeowId)
          .single()
        instance = found
      }

      if (!instance) {
        const { data: fallback } = await supabase
          .from('wpp_instances')
          .select('specialist_id')
          .eq('status', 'connected')
          .limit(1)
          .single()
        instance = fallback
      }

      if (!instance) {
        console.warn('[WPP Webhook] No instance found for:', whatsmeowId)
        return NextResponse.json({ ok: true })
      }

      // 2. Find mentee by phone (last 9 digits match)
      const phoneDigits = normalizePhone(phone)
      const { data: mentees } = await supabase
        .from('mentees')
        .select('id')
        .like('phone', `%${phoneDigits}`)

      const mentee = mentees?.[0]
      if (!mentee) {
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

      // 5. Insert message
      await supabase.from('wpp_messages').insert({
        mentee_id: mentee.id,
        specialist_id: instance.specialist_id,
        instance_id: whatsmeowId,
        message_id: messageId,
        direction,
        message_type: messageType,
        content,
        media_url: mediaUrl,
        sender_name: senderName,
        is_read: data.fromMe ? true : false,
        sent_at: sentAt,
      })

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

    // Unknown event — ignore
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[WPP Webhook] Error:', err)
    // Always return 200 to avoid NextTrack marking as failure
    return NextResponse.json({ ok: true })
  }
}
