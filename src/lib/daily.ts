/**
 * Daily.co server-side API client.
 * NEVER import in client components.
 */

const DAILY_API_KEY = process.env.DAILY_API_KEY || ''
const DAILY_DOMAIN = process.env.NEXT_PUBLIC_DAILY_DOMAIN || ''

export async function createRoom(enableVideo = false): Promise<{ name: string; url: string }> {
  console.log('[Daily] createRoom - API key exists:', !!DAILY_API_KEY, 'length:', DAILY_API_KEY?.length, 'video:', enableVideo)

  const body = {
    privacy: 'private',
    properties: {
      max_participants: 10,
      exp: Math.floor(Date.now() / 1000) + 7200,
      start_video_off: !enableVideo,
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

export async function getRecordings(roomName: string): Promise<{ id: string; download_url: string; duration: number; status: string }[]> {
  const res = await fetch(`https://api.daily.co/v1/recordings?room_name=${roomName}`, {
    headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[Daily] getRecordings failed:', res.status, text)
    return []
  }

  const data = await res.json()
  const items = (data.data || []) as Array<{
    id: string
    download_link?: string
    duration?: number
    status?: string
  }>

  // For finished recordings without download_link, fetch the access link.
  // Daily's listing endpoint sometimes omits download_link even when the
  // recording is ready — the access-link endpoint always returns a fresh URL.
  const enriched = await Promise.all(
    items.map(async (r) => {
      let url = r.download_link || ''
      const status = (r.status || '').toLowerCase()
      const isFinished = !status || status === 'finished' || status === 'ready' || status === 'completed'
      if (!url && isFinished && r.id) {
        try {
          const linkRes = await fetch(`https://api.daily.co/v1/recordings/${r.id}/access-link`, {
            headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
          })
          if (linkRes.ok) {
            const linkData = await linkRes.json()
            url = linkData.download_link || linkData.url || ''
            console.log('[Daily] access-link fetched for recording', r.id, '→', url ? 'OK' : 'EMPTY')
          } else {
            const text = await linkRes.text().catch(() => '')
            console.error('[Daily] access-link failed for', r.id, ':', linkRes.status, text)
          }
        } catch (err) {
          console.error('[Daily] access-link exception for', r.id, ':', err)
        }
      }
      return {
        id: r.id,
        download_url: url,
        duration: r.duration ?? 0,
        status: r.status ?? '',
      }
    })
  )

  return enriched
}
