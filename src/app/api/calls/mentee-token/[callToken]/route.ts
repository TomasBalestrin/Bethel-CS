import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createMeetingToken, getRoomUrl } from '@/lib/daily'

export async function GET(
  request: NextRequest,
  { params }: { params: { callToken: string } }
) {
  const supabase = createAdminClient()

  // Room name from URL query param — guarantees same room as specialist
  const roomFromUrl = request.nextUrl.searchParams.get('room')

  // Find mentee by call_token
  const { data: mentee } = await supabase
    .from('mentees')
    .select('id, full_name, created_by')
    .eq('call_token', params.callToken)
    .single()

  if (!mentee) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  }

  // Auto-close stale calls (older than 2 hours)
  await supabase
    .from('call_records')
    .update({ ended_at: new Date().toISOString() })
    .eq('mentee_id', mentee.id)
    .is('ended_at', null)
    .lt('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())

  // Find the correct call: if room is in URL, use that specific room
  let call: { daily_room_name: string; daily_room_url: string | null; specialist_id: string; call_type: string | null } | null = null

  if (roomFromUrl) {
    // Find the specific call matching the room from the URL
    const { data } = await supabase
      .from('call_records')
      .select('daily_room_name, daily_room_url, specialist_id, call_type')
      .eq('mentee_id', mentee.id)
      .eq('daily_room_name', roomFromUrl)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    call = data
  }

  if (!call) {
    // Fallback: find latest active call
    const { data } = await supabase
      .from('call_records')
      .select('daily_room_name, daily_room_url, specialist_id, call_type')
      .eq('mentee_id', mentee.id)
      .is('ended_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    call = data
  }

  if (!call) {
    return NextResponse.json({ error: 'Nenhuma ligação ativa' }, { status: 404 })
  }

  // Get specialist name
  let specialistName = 'Seu especialista'
  if (call.specialist_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', call.specialist_id)
      .single()
    if (profile) specialistName = profile.full_name
  }

  const roomName = roomFromUrl || call.daily_room_name
  let token: string
  try {
    token = await createMeetingToken(roomName, false)
  } catch (err) {
    console.error('[MenteeToken] createMeetingToken failed:', err)
    return NextResponse.json({ error: 'Falha ao gerar token' }, { status: 500 })
  }

  const roomUrl = getRoomUrl(roomName)
  console.log('[MenteeToken] Room:', { roomName, roomUrl, roomFromUrl, menteeId: mentee.id })

  return NextResponse.json({
    token,
    roomName,
    roomUrl,
    specialistName,
    callType: call.call_type || 'voice',
  })
}
