/**
 * Daily.co server-side API client.
 * NEVER import in client components.
 */

const DAILY_API_KEY = process.env.DAILY_API_KEY || ''
const DAILY_DOMAIN = process.env.NEXT_PUBLIC_DAILY_DOMAIN || ''

export async function createRoom(): Promise<{ name: string; url: string }> {
  console.log('[Daily] createRoom - API key exists:', !!DAILY_API_KEY, 'length:', DAILY_API_KEY?.length)
  console.log('[Daily] createRoom - domain:', DAILY_DOMAIN)

  const res = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      properties: {
        max_participants: 2,
        exp: Math.floor(Date.now() / 1000) + 7200,
        enable_recording: 'cloud',
        enable_chat: false,
        enable_screenshare: false,
        start_video_off: true,
      },
    }),
  })

  console.log('[Daily] createRoom - response status:', res.status)

  if (!res.ok) {
    const text = await res.text()
    console.error('[Daily] createRoom - error body:', text)
    throw new Error(`Daily createRoom failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  console.log('[Daily] createRoom - success, room:', data.name)
  return { name: data.name, url: data.url }
}

export async function createMeetingToken(
  roomName: string,
  isOwner: boolean
): Promise<string> {
  const res = await fetch('https://api.daily.co/v1/meeting-tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        is_owner: isOwner,
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Daily createMeetingToken failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.token
}

export function getRoomUrl(roomName: string): string {
  return `https://${DAILY_DOMAIN}/${roomName}`
}
