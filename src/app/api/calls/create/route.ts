import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRoom, createMeetingToken, getRoomUrl } from '@/lib/daily'
import { sendMessage } from '@/lib/nextapps'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  // Admin client bypassa o RLS da call_records para os writes (INSERT/UPDATE).
  // Sem isso, especialistas caem em "INSERT sem policy" (silent reject) — é o
  // que impedia ligações de serem registradas.
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { menteeId, forceNew, callType = 'voice' } = await request.json()
  if (!menteeId) return NextResponse.json({ error: 'menteeId obrigatório' }, { status: 400 })

  // Get mentee info
  const { data: mentee } = await supabase
    .from('mentees')
    .select('id, full_name, phone, call_token, created_by')
    .eq('id', menteeId)
    .single()

  if (!mentee) return NextResponse.json({ error: 'Mentorado não encontrado' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  // Auto-close stale calls (older than 2 hours — Daily rooms expire after 2h)
  await admin
    .from('call_records')
    .update({ ended_at: new Date().toISOString() })
    .is('ended_at', null)
    .lt('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())

  // Check for existing RECENT active call (unless forceNew) — max 30 min old
  if (!forceNew) {
    const recentThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    // Admin client para garantir que a lookup enxergue ligações criadas por
    // outros especialistas (admin clicando ligar num mentorado de outra pessoa).
    const { data: existingCall } = await admin
      .from('call_records')
      .select('id, daily_room_name, daily_room_url, call_type, created_at')
      .eq('mentee_id', menteeId)
      .is('ended_at', null)
      .gte('created_at', recentThreshold)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingCall) {
      console.log('[Calls/Create] Reusing recent call:', existingCall.daily_room_name)
      const token = await createMeetingToken(existingCall.daily_room_name, true)
      const menteeLink = `${appUrl}/call/${mentee.call_token}?room=${existingCall.daily_room_name}`

      return NextResponse.json({
        callId: existingCall.id,
        roomUrl: existingCall.daily_room_url || getRoomUrl(existingCall.daily_room_name),
        roomName: existingCall.daily_room_name,
        token,
        menteeLink,
        reused: true,
        callType: existingCall.call_type || callType,
      })
    }
  }

  // End all existing active calls for this mentee before creating new one
  await admin
    .from('call_records')
    .update({ ended_at: new Date().toISOString() })
    .eq('mentee_id', menteeId)
    .is('ended_at', null)

  // Get specialist name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const specialistName = profile?.full_name || 'Seu especialista'

  // Create Daily room
  console.log('[Calls/Create] Creating new room for mentee:', mentee.full_name)
  let room
  try {
    room = await createRoom(callType === 'video')
  } catch (err) {
    console.error('[Calls/Create] createRoom failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
  let specialistToken: string
  try {
    specialistToken = await createMeetingToken(room.name, true)
  } catch (err) {
    console.error('[Calls/Create] createMeetingToken failed:', err)
    return NextResponse.json({ error: 'Falha ao gerar token' }, { status: 500 })
  }

  // Save call record — usa admin client para contornar RLS (sem isso, a
  // especialista não teria policy de INSERT — é o bug do caso da Aline).
  // Para calls feitas por um admin em nome de outro especialista, o registro
  // fica atribuído ao owner do mentorado (mesma semântica do /api/whatsapp/send).
  const { data: menteeOwner } = await admin
    .from('mentees')
    .select('created_by')
    .eq('id', menteeId)
    .single()
  const specialistIdForCall = menteeOwner?.created_by || user.id

  const { data: callRecord, error: insertError } = await admin
    .from('call_records')
    .insert({
      mentee_id: menteeId,
      specialist_id: specialistIdForCall,
      daily_room_name: room.name,
      daily_room_url: room.url,
      recording_status: 'pending',
      call_type: callType as 'voice' | 'video',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[Calls/Create] Insert failed:', insertError.message, insertError.details, insertError.hint)
    return NextResponse.json({ error: `Falha ao salvar ligação: ${insertError.message}` }, { status: 500 })
  }

  // Build mentee link
  const menteeLink = `${appUrl}/call/${mentee.call_token}?room=${room.name}`

  // Send WPP notification
  const { data: instance } = await supabase
    .from('wpp_instances')
    .select('instance_id, status')
    .eq('status', 'connected')
    .limit(1)
    .single()

  if (instance?.status === 'connected') {
    let phone = mentee.phone.replace(/\D/g, '')
    if (!phone.startsWith('55')) phone = '55' + phone

    try { await sendMessage(
      instance.instance_id,
      phone,
      `🔔 *${specialistName}* está te chamando!\n\nClique para atender:\n${menteeLink}\n\nO link expira em 30 minutos.`
    ) } catch (err) { console.error('[Calls/Create] WPP notification failed:', err) }
  }

  const roomUrl = room.url || getRoomUrl(room.name)
  console.log('[Calls/Create] Specialist room:', { roomName: room.name, roomUrl, storedUrl: room.url, menteeId })

  return NextResponse.json({
    callId: callRecord?.id,
    roomUrl,
    roomName: room.name,
    token: specialistToken,
    menteeLink,
    reused: false,
    callType,
  })
}
