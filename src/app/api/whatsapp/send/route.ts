import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/nextapps'

export async function POST(request: NextRequest) {
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

  // 2. Find mentee + their specialist
  const { data: mentee } = await supabase
    .from('mentees')
    .select('id, phone, created_by')
    .eq('id', menteeId)
    .single()

  if (!mentee) {
    return NextResponse.json({ error: 'Mentorado não encontrado' }, { status: 404 })
  }

  // 3. Find any connected WPP instance
  const { data: instance } = await supabase
    .from('wpp_instances')
    .select('instance_id, status, specialist_id')
    .eq('status', 'connected')
    .limit(1)
    .single()

  const specialistId = instance?.specialist_id || user.id

  if (!instance) {
    return NextResponse.json({ error: 'Instância WhatsApp não configurada' }, { status: 404 })
  }

  if (instance.status !== 'connected') {
    return NextResponse.json({ error: 'WhatsApp desconectado' }, { status: 400 })
  }

  // 4. Normalize phone
  let phone = mentee.phone.replace(/\D/g, '')
  if (!phone.startsWith('55')) {
    phone = '55' + phone
  }

  // 5. Send via Next Apps
  const result = await sendMessage(instance.instance_id, phone, message, type, imageUrl)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  // 6. Save to wpp_messages
  await supabase.from('wpp_messages').insert({
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

  return NextResponse.json({ success: true })
}
