import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { subscription, mentee_id } = body

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'Subscription inválida' }, { status: 400 })
  }

  const supabase = createClient()

  // Determine owner: authenticated user or mentee (public chat)
  let userId: string | null = null

  if (!mentee_id) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    userId = user.id
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        mentee_id: mentee_id || null,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: request.headers.get('user-agent') || null,
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    console.error('Push subscribe error:', error)
    return NextResponse.json({ error: 'Erro ao salvar subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
