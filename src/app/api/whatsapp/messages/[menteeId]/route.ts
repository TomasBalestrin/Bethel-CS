import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

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

  // Channel filter from query param
  const channel = request.nextUrl.searchParams.get('channel') || 'principal'
  // Backfill: quando o realtime cai e reconecta, o cliente pede só as mensagens
  // mais novas que o último sent_at local (`?since=<ISO>`), evitando recarregar
  // as 100 mensagens inteiras e preenchendo apenas o gap.
  const since = request.nextUrl.searchParams.get('since')
  const skipMarkRead = request.nextUrl.searchParams.get('markRead') === 'false'

  // 1. Fetch messages for this channel (com ou sem filtro de sent_at)
  let query = supabase
    .from('wpp_messages')
    .select('id, mentee_id, specialist_id, instance_id, message_id, direction, message_type, content, media_url, sender_name, is_read, sent_at, created_at, channel, delivery_status, quoted_message_id')
    .eq('mentee_id', menteeId)
    .eq('channel', channel)
    .order('sent_at', { ascending: true })
  if (since) {
    query = query.gt('sent_at', since)
  } else {
    query = query.limit(100)
  }
  const { data: messages, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 2. Mark unread incoming messages as read for this channel.
  // Em requests de backfill/polling passamos markRead=false para não marcar
  // mensagens como lidas enquanto o usuário não está olhando o chat.
  if (!skipMarkRead) {
    await supabase
      .from('wpp_messages')
      .update({ is_read: true })
      .eq('mentee_id', menteeId)
      .eq('direction', 'incoming')
      .eq('is_read', false)
      .eq('channel', channel)
  }

  return NextResponse.json(messages || [])
}
