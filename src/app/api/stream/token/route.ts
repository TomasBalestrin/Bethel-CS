import { NextResponse } from 'next/server'
import { StreamChat } from 'stream-chat'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Fetch profile for display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single()

  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!
  const secret = process.env.STREAM_SECRET_KEY!
  const serverClient = StreamChat.getInstance(apiKey, secret)

  const token = serverClient.createToken(user.id)

  // Upsert user in Stream so display name and avatar are set
  await serverClient.upsertUser({
    id: user.id,
    name: profile?.full_name ?? 'Especialista',
    image: profile?.avatar_url ?? undefined,
    role: 'admin',
  })

  return NextResponse.json({
    token,
    api_key: apiKey,
    user_id: user.id,
    user_name: profile?.full_name ?? 'Especialista',
  })
}
