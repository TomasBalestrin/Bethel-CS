'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Chat,
  Channel,
  ChannelHeader,
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

  const init = useCallback(async () => {
    let activeChannelId = channelId

    // Auto-create channel if not configured
    if (!activeChannelId) {
      setCreating(true)
      try {
        const res = await fetch(`/api/admin/create-channel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mentee_id: menteeId }),
        })
        if (!res.ok) throw new Error('Falha ao criar canal')
        const data = await res.json()
        activeChannelId = data.channel_id
        onChannelCreated?.(activeChannelId!)
      } catch (err) {
        console.error('Channel creation error:', err)
        setError('Erro ao criar canal de chat.')
        setCreating(false)
        return
      }
      setCreating(false)
    }

    try {
      const res = await fetch('/api/stream/token')
      if (!res.ok) throw new Error('Falha ao obter token')
      const data = await res.json()

      const chatClient = StreamChat.getInstance(data.api_key)

      if (chatClient.userID !== data.user_id) {
        await chatClient.connectUser(
          { id: data.user_id, name: data.user_name },
          data.token
        )
      }

      const ch = chatClient.channel('messaging', activeChannelId!)
      await ch.watch()

      setClient(chatClient)
      setChannel(ch)

      // Initial unread count
      const state = ch.state
      onUnreadCountChange?.(state.unreadCount ?? 0)
    } catch (err) {
      console.error('Stream Chat init error:', err)
      setError('Erro ao conectar ao chat.')
    }
  }, [channelId, menteeId, onUnreadCountChange, onChannelCreated])

  useEffect(() => {
    init()

    return () => {
      // Don't disconnect — StreamChat.getInstance is a singleton
      // and might be used by other tabs. Just cleanup channel watch.
    }
  }, [init])

  // Listen for unread count changes
  useEffect(() => {
    if (!channel || !onUnreadCountChange) return

    const handler = () => {
      onUnreadCountChange(channel.state.unreadCount ?? 0)
    }

    channel.on('message.new', handler)
    channel.on('message.read', handler)

    return () => {
      channel.off('message.new', handler)
      channel.off('message.read', handler)
    }
  }, [channel, onUnreadCountChange])

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
    <div className="bethel-chat -mx-6 -mt-4 flex flex-col" style={{ height: 'calc(100vh - 260px)' }}>
      <Chat client={client} theme="str-chat__theme-light">
        <Channel channel={channel}>
          <Window>
            <ChannelHeader />
            <MessageList />
            <MessageInput />
          </Window>
        </Channel>
      </Chat>
    </div>
  )
}
