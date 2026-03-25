'use client'

import { useEffect, useState, useRef } from 'react'
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
  const [bottomPadding, setBottomPadding] = useState(0)
  const pushRef = useRef(false)

  // iOS keyboard padding via visualViewport
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function onResize() {
      const offset = window.innerHeight - (vv?.height ?? window.innerHeight)
      setBottomPadding(Math.max(0, offset))
    }

    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

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

        if (chatClient.userID && chatClient.userID !== data.user_id) {
          await chatClient.disconnectUser()
        }

        if (!chatClient.userID) {
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
    if (!channel || !menteeId || pushRef.current) return

    const handler = (event: { message?: { user?: { id?: string } } }) => {
      if (event.message?.user?.id?.startsWith('mentee-') && !pushRef.current) {
        pushRef.current = true
        setPushRequested(true)
        subscribeToPush(menteeId)
      }
    }

    channel.on('message.new', handler)

    return () => {
      channel.off('message.new', handler)
    }
  }, [channel, menteeId])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: '#060A16' }}>
        <Image src="/logo.png" alt="Bethel CS" width={48} height={48} className="mb-4" />
        <p className="text-sm text-white/70">{error}</p>
      </div>
    )
  }

  if (!client || !channel) {
    return <SplashScreen subtitle="Carregando seu chat..." />
  }

  return (
    <div
      className="flex flex-col bg-background"
      style={{ height: '100dvh', paddingBottom: bottomPadding > 0 ? `${bottomPadding}px` : undefined }}
    >
      {/* Header */}
      <header className="flex items-center justify-between shrink-0 px-4 py-3" style={{ backgroundColor: '#060A16' }}>
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Bethel CS" width={32} height={32} className="rounded-md" />
          <div>
            <h1 className="text-sm font-semibold text-white">Bethel CS</h1>
            <p className="text-[11px] text-white/50">Seu canal direto com a equipe de CS</p>
          </div>
        </div>
        {specialistName && (
          <div className="text-right">
            <p className="text-xs font-medium text-white">{specialistName}</p>
            <p className="text-[10px] text-white/40">Especialista</p>
          </div>
        )}
      </header>

      {/* Chat */}
      <div className="bethel-chat-public flex-1 min-h-0">
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
