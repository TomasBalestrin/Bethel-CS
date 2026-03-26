import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createMeetingToken } from '@/lib/daily'

export async function GET(
  request: NextRequest,
  { params }: { params: { callToken: string } }
) {
  const supabase = createAdminClient()

  // Find mentee by call_token
  const { data: mentee } = await supabase
    .from('mentees')
    .select('id, full_name, created_by')
    .eq('call_token', params.callToken)
    .single()

  if (!mentee) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  }

  // Find active call (no ended_at)
  const { data: call } = await supabase
    .from('call_records')
    .select('daily_room_name, daily_room_url, specialist_id')
    .eq('mentee_id', mentee.id)
    .is('ended_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

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

  const token = await createMeetingToken(call.daily_room_name, false)

  return NextResponse.json({
    token,
    roomName: call.daily_room_name,
    roomUrl: call.daily_room_url,
    specialistName,
  })
}
