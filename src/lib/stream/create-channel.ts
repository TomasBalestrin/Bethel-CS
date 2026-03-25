import { StreamChat } from 'stream-chat'

interface CreateStreamChannelInput {
  menteeId: string
  menteeName: string
  specialistId: string
  specialistName: string
  specialistAvatar?: string
}

/**
 * Creates a Stream Chat channel for a mentee and adds the specialist as member.
 * Sends an automatic welcome message.
 * Returns the channel ID (e.g. "mentee-{mentee_id}").
 */
export async function createStreamChannel({
  menteeId,
  menteeName,
  specialistId,
  specialistName,
  specialistAvatar,
}: CreateStreamChannelInput): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!
  const secret = process.env.STREAM_SECRET_KEY!
  const serverClient = StreamChat.getInstance(apiKey, secret)

  const channelId = `mentee-${menteeId}`
  const menteeStreamId = `mentee-${menteeId}`

  // Upsert both users in Stream
  await serverClient.upsertUsers([
    {
      id: specialistId,
      name: specialistName,
      image: specialistAvatar,
      role: 'admin',
    },
    {
      id: menteeStreamId,
      name: menteeName,
      role: 'user',
    },
  ])

  // Create the messaging channel with both members
  const channel = serverClient.channel('messaging', channelId, {
    members: [specialistId, menteeStreamId],
    created_by_id: specialistId,
  } as Record<string, unknown>)

  await channel.create()

  // Send welcome message from the specialist
  await channel.sendMessage({
    text: 'Olá! Este é seu canal direto com nossa equipe de CS. Estamos aqui para te ajudar durante toda a jornada. 🚀',
    user_id: specialistId,
  })

  return channelId
}
