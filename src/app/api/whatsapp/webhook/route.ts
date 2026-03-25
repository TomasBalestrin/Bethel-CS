import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Normalize phone: strip +55, spaces, dashes → last 9 digits
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Return last 9 digits (mobile number without country/area code)
  return digits.slice(-9)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const event = body.event as string
    const data = body.data || body
    const instanceId = body.instanceId || data.instanceId

    const supabase = createAdminClient()

    // ─── Connection status events ───
    if (event === 'connected' || event === 'disconnected') {
      if (instanceId) {
        await supabase
          .from('wpp_instances')
          .update({ status: event, updated_at: new Date().toISOString() })
          .eq('instance_id', instanceId)
      }
      return NextResponse.json({ ok: true })
    }

    // ─── Message received ───
    if (event === 'message_received') {
      if (!instanceId || !data.phone) {
        return NextResponse.json({ ok: true })
      }

      // 1. Find specialist via wpp_instances
      const { data: instance } = await supabase
        .from('wpp_instances')
        .select('specialist_id')
        .eq('instance_id', instanceId)
        .single()

      if (!instance) {
        console.warn(`[WPP Webhook] Instance not found: ${instanceId}`)
        return NextResponse.json({ ok: true })
      }

      // 2. Find mentee by phone (last 9 digits match)
      const phoneDigits = normalizePhone(data.phone)
      const { data: mentees } = await supabase
        .from('mentees')
        .select('id')
        .like('phone', `%${phoneDigits}`)

      const mentee = mentees?.[0]
      if (!mentee) {
        console.warn(`[WPP Webhook] Mentee not found for phone: ${data.phone}`)
        return NextResponse.json({ ok: true })
      }

      // 3. Check for duplicate message_id
      const messageId = data.messageId || null
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

      // 4. Determine direction and content
      const direction = data.fromMe ? 'outgoing' : 'incoming'
      const messageType = data.messageType || 'text'
      const content = data.text?.message || data.message || null
      const mediaUrl = data.media?.url || data.audio?.audioUrl || data.video?.videoUrl || null
      const senderName = data.senderName || null
      const sentAt = data.momment || data.moment || new Date().toISOString()

      // 5. Insert message
      await supabase.from('wpp_messages').insert({
        mentee_id: mentee.id,
        specialist_id: instance.specialist_id,
        instance_id: instanceId,
        message_id: messageId,
        direction,
        message_type: ['text', 'image', 'audio', 'video', 'document', 'location', 'sticker'].includes(messageType)
          ? messageType
          : 'text',
        content,
        media_url: mediaUrl,
        sender_name: senderName,
        is_read: data.fromMe ? true : false,
        sent_at: sentAt,
      })

      // 6. Upsert chat_metrics for the day
      const day = new Date(sentAt).toISOString().slice(0, 10)
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
    // Always return 200 to avoid Next Apps retries
    return NextResponse.json({ ok: true })
  }
}
