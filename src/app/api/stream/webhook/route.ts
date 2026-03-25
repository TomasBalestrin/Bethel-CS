import { NextRequest, NextResponse } from 'next/server'
import { StreamChat } from 'stream-chat'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Verify webhook signature
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!
  const secret = process.env.STREAM_SECRET_KEY!
  const serverClient = StreamChat.getInstance(apiKey, secret)

  const signature = request.headers.get('x-signature')
  if (signature) {
    const rawBody = JSON.stringify(body)
    const isValid = serverClient.verifyWebhook(rawBody, signature)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  // Only handle new messages
  if (body.type !== 'message.new') {
    return NextResponse.json({ ok: true })
  }

  const message = body.message
  const channelId = body.channel_id as string
  const senderId = message?.user?.id as string

  if (!message || !channelId || !senderId) {
    return NextResponse.json({ ok: true })
  }

  const messagePreview = (message.text || '').slice(0, 80)
  const supabase = createClient()

  // Find the mentee associated with this channel
  const { data: mentee } = await supabase
    .from('mentees')
    .select('id, full_name, created_by')
    .eq('stream_channel_id', channelId)
    .single()

  if (!mentee) {
    return NextResponse.json({ ok: true })
  }

  const origin = request.nextUrl.origin

  if (senderId.startsWith('mentee-')) {
    // Mentee sent a message → notify the specialist
    if (mentee.created_by) {
      await sendPushNotification(origin, {
        user_id: mentee.created_by,
        title: `Nova mensagem — ${mentee.full_name}`,
        body: messagePreview,
        url: '/mentorados',
      })
    }
  } else {
    // Specialist sent a message → notify the mentee
    await sendPushNotification(origin, {
      mentee_id: mentee.id,
      title: 'Resposta do seu especialista',
      body: messagePreview,
      url: `/chat`,
    })
  }

  return NextResponse.json({ ok: true })
}

async function sendPushNotification(
  origin: string,
  payload: {
    user_id?: string
    mentee_id?: string
    title: string
    body: string
    url: string
  }
) {
  try {
    await fetch(`${origin}/api/push/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-push-secret': process.env.VAPID_PRIVATE_KEY!,
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('Failed to send push notification:', err)
  }
}
