'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
  Window,
} from 'stream-chat-react'
import { StreamChat } from 'stream-chat'
import Image from 'next/image'
import { SplashScreen } from '@/components/splash-screen'
import { subscribeToPush } from '@/lib/push/subscribe'
import { InstallBanner } from '@/components/install-banner'

import 'stream-chat-react/dist/css/v2/index.css'

interface TokenData {
  token: string
  api_key: string
  user_id: string
  mentee_id: string
  channel_id: string | null
  specialist_name: string
  mentee_name: string
}

export default function MenteeChatPage() {
  const params = useParams()
  const chatToken = params.chat_token as string

  const [client, setClient] = useState<StreamChat | null>(null)
  const [channel, setChannel] = useState<ReturnType<StreamChat['channel']> | null>(null)
  const [specialistName, setSpecialistName] = useState('')
  const [menteeId, setMenteeId] = useState<string | null>(null)
  const [pushRequested, setPushRequested] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let chatClient: StreamChat | null = null

    async function init() {
      try {
        const res = await fetch(`/api/stream/mentee-token?chat_token=${chatToken}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('Link de chat inválido ou expirado.')
          } else {
            setError('Erro ao conectar ao chat.')
          }
          return
        }

        const data: TokenData = await res.json()

        if (!data.channel_id) {
          setError('Canal de chat ainda não foi configurado. Entre em contato com seu especialista.')
          return
        }

        setSpecialistName(data.specialist_name)
        setMenteeId(data.mentee_id)

        chatClient = StreamChat.getInstance(data.api_key)

        if (chatClient.userID !== data.user_id) {
          await chatClient.connectUser(
            { id: data.user_id, name: data.mentee_name },
            data.token
          )
        }

        const ch = chatClient.channel('messaging', data.channel_id)
        await ch.watch()

        setClient(chatClient)
        setChannel(ch)
      } catch (err) {
        console.error('Chat init error:', err)
        setError('Erro ao conectar ao chat.')
      }
    }

    init()

    return () => {
      if (chatClient) {
        chatClient.disconnectUser().catch(() => {})
      }
    }
  }, [chatToken])

  // Request push permission when mentee sends first message
  useEffect(() => {
    if (!channel || !menteeId || pushRequested) return

    const handleMessage = () => {
      if (!pushRequested) {
        setPushRequested(true)
        subscribeToPush(menteeId)
      }
    }

    channel.on('message.new', (event) => {
      // Only trigger on mentee's own messages
      if (event.message?.user?.id?.startsWith('mentee-')) {
        handleMessage()
      }
    })

    return () => {
      channel.off('message.new', handleMessage)
    }
  }, [channel, menteeId, pushRequested])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <Image src="/logo.png" alt="Bethel CS" width={48} height={48} className="mb-4" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!client || !channel) {
    return <SplashScreen subtitle="Carregando seu chat..." />
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-white px-4 py-3 shadow-sm">
        <Image src="/logo.png" alt="Bethel CS" width={32} height={32} />
        <div>
          <h1 className="text-sm font-semibold text-foreground">Bethel CS</h1>
          {specialistName && (
            <p className="text-xs text-muted-foreground">{specialistName}</p>
          )}
        </div>
      </header>

      {/* Chat */}
      <div className="bethel-chat-public flex-1" style={{ height: 'calc(100vh - 57px)' }}>
        <Chat client={client} theme="str-chat__theme-light">
          <Channel channel={channel}>
            <Window>
              <MessageList />
              <MessageInput />
            </Window>
          </Channel>
        </Chat>
      </div>

      <InstallBanner variant="chat" />
    </div>
  )
}
