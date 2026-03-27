import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/nextapps'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // 1. Verify authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { menteeId, message, type, imageUrl } = body

    if (!menteeId || !message) {
      return NextResponse.json({ error: 'menteeId e message são obrigatórios' }, { status: 400 })
    }

    // 2. Find mentee
    const { data: mentee, error: menteeError } = await supabase
      .from('mentees')
      .select('id, phone, created_by')
      .eq('id', menteeId)
      .single()

    if (menteeError || !mentee) {
      console.error('[WPP Send] Mentee not found:', menteeId, menteeError)
      return NextResponse.json({ error: 'Mentorado não encontrado' }, { status: 404 })
    }

    // 3. Find any connected WPP instance
    const { data: instance, error: instanceError } = await supabase
      .from('wpp_instances')
      .select('instance_id, status, specialist_id')
      .eq('status', 'connected')
      .limit(1)
      .single()

    if (instanceError || !instance) {
      console.error('[WPP Send] No connected instance found:', instanceError)
      return NextResponse.json({ error: 'Instância WhatsApp não configurada' }, { status: 404 })
    }

    const specialistId = instance.specialist_id || user.id

    // 4. Normalize phone
    let phone = mentee.phone.replace(/\D/g, '')
    if (!phone.startsWith('55')) {
      phone = '55' + phone
    }

    console.log('[WPP Send] Sending to:', phone, 'via instance:', instance.instance_id, 'message length:', message.length)

    // 5. Send via Next Apps
    const result = await sendMessage(instance.instance_id, phone, message, type, imageUrl)

    if (!result.success) {
      console.error('[WPP Send] sendMessage failed:', result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    console.log('[WPP Send] Message sent successfully')

    // 6. Save to wpp_messages
    const { error: insertError } = await supabase.from('wpp_messages').insert({
      mentee_id: menteeId,
      specialist_id: specialistId,
      instance_id: instance.instance_id,
      direction: 'outgoing',
      message_type: type || 'text',
      content: message,
      media_url: imageUrl || null,
      is_read: true,
      sent_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error('[WPP Send] Insert wpp_messages failed:', insertError)
      // Still return success — message was sent, just not saved
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[WPP Send] Unhandled error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
