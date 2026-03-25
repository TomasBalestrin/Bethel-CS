import { NextRequest, NextResponse } from 'next/server'
import { StreamChat } from 'stream-chat'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const chatToken = request.nextUrl.searchParams.get('chat_token')

  if (!chatToken) {
    return NextResponse.json({ error: 'chat_token é obrigatório' }, { status: 400 })
  }

  const supabase = createClient()

  // Look up mentee by chat_token
  const { data: mentee, error } = await supabase
    .from('mentees')
    .select('id, full_name, stream_channel_id, created_by')
    .eq('chat_token', chatToken)
    .single()

  if (error || !mentee) {
    return NextResponse.json({ error: 'Mentorado não encontrado' }, { status: 404 })
  }

  // Get specialist name
  let specialistName = 'Especialista Bethel'
  if (mentee.created_by) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', mentee.created_by)
      .single()
    if (profile) specialistName = profile.full_name
  }

  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!
  const secret = process.env.STREAM_SECRET_KEY!
  const serverClient = StreamChat.getInstance(apiKey, secret)

  const streamUserId = `mentee-${mentee.id}`

  // Upsert mentee user in Stream
  await serverClient.upsertUser({
    id: streamUserId,
    name: mentee.full_name,
    role: 'user',
  })

  const token = serverClient.createToken(streamUserId)

  return NextResponse.json({
    token,
    api_key: apiKey,
    user_id: streamUserId,
    mentee_id: mentee.id,
    channel_id: mentee.stream_channel_id,
    specialist_name: specialistName,
    mentee_name: mentee.full_name,
  })
}
