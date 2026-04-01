import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { menteeId: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { menteeId } = params

  // 1. Fetch last 100 messages
  const { data: messages, error } = await supabase
    .from('wpp_messages')
    .select('id, mentee_id, specialist_id, instance_id, message_id, direction, message_type, content, media_url, sender_name, is_read, sent_at, created_at')
    .eq('mentee_id', menteeId)
    .order('sent_at', { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 2. Mark unread incoming messages as read
  await supabase
    .from('wpp_messages')
    .update({ is_read: true })
    .eq('mentee_id', menteeId)
    .eq('direction', 'incoming')
    .eq('is_read', false)

  return NextResponse.json(messages || [])
}
