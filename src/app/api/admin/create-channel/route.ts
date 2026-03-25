import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createStreamChannel } from '@/lib/stream/create-channel'

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { mentee_id } = await request.json()
  if (!mentee_id) {
    return NextResponse.json({ error: 'mentee_id é obrigatório' }, { status: 400 })
  }

  // Fetch mentee
  const { data: mentee } = await supabase
    .from('mentees')
    .select('id, full_name, stream_channel_id, created_by')
    .eq('id', mentee_id)
    .single()

  if (!mentee) {
    return NextResponse.json({ error: 'Mentorado não encontrado' }, { status: 404 })
  }

  // Already has channel
  if (mentee.stream_channel_id) {
    return NextResponse.json({ channel_id: mentee.stream_channel_id })
  }

  // Get current user profile for channel creation
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single()

  const channelId = await createStreamChannel({
    menteeId: mentee.id,
    menteeName: mentee.full_name,
    specialistId: user.id,
    specialistName: profile?.full_name || 'Especialista Bethel',
    specialistAvatar: profile?.avatar_url || undefined,
  })

  await supabase
    .from('mentees')
    .update({ stream_channel_id: channelId })
    .eq('id', mentee.id)

  return NextResponse.json({ channel_id: channelId })
}
