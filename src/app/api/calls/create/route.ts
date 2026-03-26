import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRoom, createMeetingToken, getRoomUrl } from '@/lib/daily'
import { sendMessage } from '@/lib/nextapps'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { menteeId } = await request.json()
  if (!menteeId) return NextResponse.json({ error: 'menteeId obrigatório' }, { status: 400 })

  // Get mentee info
  const { data: mentee } = await supabase
    .from('mentees')
    .select('id, full_name, phone, call_token, created_by')
    .eq('id', menteeId)
    .single()

  if (!mentee) return NextResponse.json({ error: 'Mentorado não encontrado' }, { status: 404 })

  // Get specialist name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const specialistName = profile?.full_name || 'Seu especialista'

  // Create Daily room
  console.log('[Calls/Create] Starting for mentee:', mentee.full_name, 'by user:', user.id)
  let room
  try {
    room = await createRoom()
  } catch (err) {
    console.error('[Calls/Create] createRoom failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
  const specialistToken = await createMeetingToken(room.name, true)

  // Save call record
  const { data: callRecord } = await supabase
    .from('call_records')
    .insert({
      mentee_id: menteeId,
      specialist_id: user.id,
      daily_room_name: room.name,
      daily_room_url: room.url,
      recording_status: 'unavailable',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  // Build mentee link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const menteeLink = `${appUrl}/call/${mentee.call_token}?room=${room.name}`

  // Send WPP notification
  const targetSpecialistId = mentee.created_by || user.id
  const { data: instance } = await supabase
    .from('wpp_instances')
    .select('instance_id, status')
    .eq('specialist_id', targetSpecialistId)
    .single()

  if (instance?.status === 'connected') {
    let phone = mentee.phone.replace(/\D/g, '')
    if (!phone.startsWith('55')) phone = '55' + phone

    await sendMessage(
      instance.instance_id,
      phone,
      `🔔 *${specialistName}* está te chamando!\n\nClique para atender:\n${menteeLink}\n\nO link expira em 30 minutos.`
    )
  }

  return NextResponse.json({
    callId: callRecord?.id,
    roomUrl: getRoomUrl(room.name),
    roomName: room.name,
    token: specialistToken,
    menteeLink,
  })
}
