'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
  Window,
} from 'stream-chat-react'
import { StreamChat } from 'stream-chat'
import { Loader2 } from 'lucide-react'

import 'stream-chat-react/dist/css/v2/index.css'

interface TabChatProps {
  menteeId: string
  channelId: string | null
  onUnreadCountChange?: (count: number) => void
  onChannelCreated?: (channelId: string) => void
}

export function TabChat({ menteeId, channelId, onUnreadCountChange, onChannelCreated }: TabChatProps) {
  const [client, setClient] = useState<StreamChat | null>(null)
  const [channel, setChannel] = useState<ReturnType<StreamChat['channel']> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const initialized = useRef(false)
  const onUnreadRef = useRef(onUnreadCountChange)
  const onCreatedRef = useRef(onChannelCreated)

  // Keep refs in sync
  onUnreadRef.current = onUnreadCountChange
  onCreatedRef.current = onChannelCreated

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    let cancelled = false

    async function init() {
      let activeChannelId = channelId

      // Auto-create channel if not configured
      if (!activeChannelId) {
        setCreating(true)
        try {
          const res = await fetch('/api/admin/create-channel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mentee_id: menteeId }),
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.error || 'Falha ao criar canal')
          }
          const data = await res.json()
          activeChannelId = data.channel_id
          onCreatedRef.current?.(activeChannelId!)
        } catch (err) {
          console.error('Channel creation error:', err)
          if (!cancelled) {
            setError('Erro ao criar canal de chat.')
            setCreating(false)
          }
          return
        }
        if (!cancelled) setCreating(false)
      }

      try {
        const res = await fetch('/api/stream/token')
        if (!res.ok) throw new Error('Falha ao obter token')
        const data = await res.json()

        const chatClient = StreamChat.getInstance(data.api_key)

        if (chatClient.userID && chatClient.userID !== data.user_id) {
          await chatClient.disconnectUser()
        }

        if (!chatClient.userID) {
          await chatClient.connectUser(
            { id: data.user_id, name: data.user_name },
            data.token
          )
        }

        const ch = chatClient.channel('messaging', activeChannelId!)
        await ch.watch()

        if (!cancelled) {
          setClient(chatClient)
          setChannel(ch)

          // Mark as read when opening
          await ch.markRead()
          onUnreadRef.current?.(0)
        }
      } catch (err) {
        console.error('Stream Chat init error:', err)
        if (!cancelled) setError('Erro ao conectar ao chat.')
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [channelId, menteeId])

  // Listen for unread count changes
  useEffect(() => {
    if (!channel) return

    const handler = () => {
      onUnreadRef.current?.(channel.countUnread())
    }

    channel.on('message.new', handler)
    channel.on('message.read', handler)

    return () => {
      channel.off('message.new', handler)
      channel.off('message.read', handler)
    }
  }, [channel])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!client || !channel) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="mt-2 text-xs text-muted-foreground">
          {creating ? 'Criando canal de chat...' : 'Conectando ao chat...'}
        </p>
      </div>
    )
  }

  return (
    <div className="bethel-chat -mx-4 -mt-4 sm:-mx-6 flex flex-col" style={{ height: 'calc(100vh - 260px)' }}>
      <Chat client={client} theme="str-chat__theme-light">
        <Channel channel={channel}>
          <Window>
            <MessageList />
            <MessageInput />
          </Window>
        </Channel>
      </Chat>
    </div>
  )
}
