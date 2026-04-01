import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:bethel@bethelcs.com.br',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

interface SendPayload {
  user_id?: string
  mentee_id?: string
  title: string
  body: string
  icon?: string
  url?: string
}

export async function POST(request: NextRequest) {
  // Simple auth: only allow internal calls (check secret or same origin)
  const authHeader = request.headers.get('x-push-secret')
  if (authHeader !== process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const payload: SendPayload = await request.json()

  if (!payload.user_id && !payload.mentee_id) {
    return NextResponse.json({ error: 'user_id ou mentee_id é obrigatório' }, { status: 400 })
  }

  const supabase = createClient()

  // Fetch subscriptions for the target
  const query = supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth')
  if (payload.user_id) {
    query.eq('user_id', payload.user_id)
  } else {
    query.eq('mentee_id', payload.mentee_id!)
  }

  const { data: subscriptions, error } = await query

  if (error || !subscriptions?.length) {
    return NextResponse.json({ sent: 0 })
  }

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icons/icon-192x192.png',
    url: payload.url || '/',
  })

  let sent = 0
  const staleEndpoints: string[] = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notification
        )
        sent++
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        // 410 Gone or 404 = subscription expired
        if (statusCode === 410 || statusCode === 404) {
          staleEndpoints.push(sub.endpoint)
        }
      }
    })
  )

  // Clean up stale subscriptions
  if (staleEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', staleEndpoints)
  }

  return NextResponse.json({ sent })
}
