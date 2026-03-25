'use client'

import { useEffect, useState, useRef } from 'react'
import { StreamChat } from 'stream-chat'

/**
 * Hook that connects to Stream Chat and returns unread message counts
 * keyed by stream_channel_id (e.g. "mentee-{uuid}").
 */
export function useUnreadCounts() {
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    let client: StreamChat | null = null

    async function init() {
      try {
        const res = await fetch('/api/stream/token')
        if (!res.ok) return
        const data = await res.json()

        client = StreamChat.getInstance(data.api_key)

        if (client.userID && client.userID !== data.user_id) {
          await client.disconnectUser()
        }

        if (!client.userID) {
          await client.connectUser(
            { id: data.user_id, name: data.user_name },
            data.token
          )
        }

        // Query all channels the specialist is a member of
        const channels = await client.queryChannels(
          { type: 'messaging', members: { $in: [data.user_id] } },
          { last_message_at: -1 },
          { limit: 100 }
        )

        const map: Record<string, number> = {}
        for (const ch of channels) {
          const count = ch.countUnread()
          if (count > 0 && ch.id) {
            map[ch.id] = count
          }
        }
        setUnreadMap(map)

        // Listen for new messages and read events across all channels
        const handleEvent = () => {
          const updated: Record<string, number> = {}
          for (const ch of channels) {
            const count = ch.countUnread()
            if (count > 0 && ch.id) {
              updated[ch.id] = count
            }
          }
          setUnreadMap(updated)
        }

        client.on('message.new', handleEvent)
        client.on('message.read', handleEvent)
      } catch (err) {
        console.error('useUnreadCounts init error:', err)
      }
    }

    init()
  }, [])

  return unreadMap
}
