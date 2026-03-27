/**
 * Daily.co server-side API client.
 * NEVER import in client components.
 */

const DAILY_API_KEY = process.env.DAILY_API_KEY || ''
const DAILY_DOMAIN = process.env.NEXT_PUBLIC_DAILY_DOMAIN || ''

export async function createRoom(): Promise<{ name: string; url: string }> {
  console.log('[Daily] createRoom - API key exists:', !!DAILY_API_KEY, 'length:', DAILY_API_KEY?.length)

  const body = {
    privacy: 'private',
    properties: {
      max_participants: 2,
      exp: Math.floor(Date.now() / 1000) + 7200,
      start_video_off: true,
      start_audio_off: false,
      enable_recording: 'cloud',
    },
  }

  console.log('[Daily] createRoom - request body:', JSON.stringify(body))

  const res = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify(body),
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

export async function getRecordings(roomName: string): Promise<{ id: string; download_url: string; duration: number }[]> {
  const res = await fetch(`https://api.daily.co/v1/recordings?room_name=${roomName}`, {
    headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
  })

  if (!res.ok) return []

  const data = await res.json()
  return (data.data || []).map((r: { id: string; download_link: string; duration: number }) => ({
    id: r.id,
    download_url: r.download_link,
    duration: r.duration,
  }))
}
