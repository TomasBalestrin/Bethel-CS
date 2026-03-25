'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Send, MessageSquare, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database'

type WppMessage = Database['public']['Tables']['wpp_messages']['Row']

interface TabChatProps {
  menteeId: string
  menteePhone: string
  menteeName: string
  specialistId: string | null
  onUnreadCountChange?: (count: number) => void
}

export function TabChat({ menteeId, menteePhone, menteeName, specialistId, onUnreadCountChange }: TabChatProps) {
  const [messages, setMessages] = useState<WppMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [instanceStatus, setInstanceStatus] = useState<string | null>(null)
  const [noInstance, setNoInstance] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const onUnreadRef = useRef(onUnreadCountChange)
  onUnreadRef.current = onUnreadCountChange

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Fetch messages + instance status of the MENTEE'S specialist
  useEffect(() => {
    async function load() {
      try {
        // Fetch messages
        const res = await fetch(`/api/whatsapp/messages/${menteeId}`)
        if (res.ok) {
          const data = await res.json()
          setMessages(data)
          onUnreadRef.current?.(0)
        }

        // Determine user role and ownership
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const userIsAdmin = profile?.role === 'admin'
        const userIsOwner = specialistId === user.id
        setIsAdmin(userIsAdmin)
        setIsOwner(userIsOwner)

        // Look up the instance of the mentee's specialist (not the logged-in user)
        const targetSpecialistId = specialistId
        if (!targetSpecialistId) {
          setNoInstance(true)
          return
        }

        const { data: instance } = await supabase
          .from('wpp_instances')
          .select('status')
          .eq('specialist_id', targetSpecialistId)
          .single()

        if (instance) {
          setInstanceStatus(instance.status)
        } else {
          setNoInstance(true)
        }
      } catch (err) {
        console.error('Chat load error:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [menteeId, specialistId])

  // Auto-scroll on messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Supabase Realtime for new messages
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`wpp_messages:mentee_id=eq.${menteeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wpp_messages',
          filter: `mentee_id=eq.${menteeId}`,
        },
        (payload) => {
          const newMsg = payload.new as WppMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })

          if (newMsg.direction === 'incoming') {
            supabase
              .from('wpp_messages')
              .update({ is_read: true })
              .eq('id', newMsg.id)
              .then(() => {})
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [menteeId])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')

    const optimisticMsg: WppMessage = {
      id: `temp-${Date.now()}`,
      mentee_id: menteeId,
      specialist_id: specialistId || '',
      instance_id: '',
      message_id: null,
      direction: 'outgoing',
      message_type: 'text',
      content: text,
      media_url: null,
      sender_name: 'Você',
      is_read: true,
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menteeId, message: text }),
      })

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
        const err = await res.json().catch(() => ({}))
        console.error('Send error:', err.error)
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const wppLink = `https://wa.me/${menteePhone.replace(/\D/g, '')}`
  const isDisconnected = instanceStatus !== 'connected'
  const canSend = (isOwner || isAdmin) && !isDisconnected
  const inputDisabledReason = isDisconnected
    ? 'WhatsApp desconectado — reconecte no Admin'
    : null

  // No instance configured
  if (!loading && noInstance) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Configure o WhatsApp no módulo Admin para ativar o chat
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="mt-2 text-xs text-muted-foreground">Carregando mensagens...</p>
      </div>
    )
  }

  return (
    <div className="-mx-4 -mt-4 sm:-mx-6 flex flex-col" style={{ height: 'calc(100vh - 260px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{menteeName}</p>
            <a
              href={wppLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              {menteePhone}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              instanceStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-[10px] text-muted-foreground">
            {instanceStatus === 'connected' ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma mensagem ainda</p>
          </div>
        )}
        {messages.map((msg) => {
          const isOutgoing = msg.direction === 'outgoing'
          return (
            <div
              key={msg.id}
              className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                  isOutgoing
                    ? 'bg-accent/10 text-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {msg.message_type === 'image' && msg.media_url && (
                  <img
                    src={msg.media_url}
                    alt="Imagem"
                    className="mb-1.5 max-w-full rounded-lg"
                    loading="lazy"
                  />
                )}
                {msg.message_type === 'audio' && msg.media_url && (
                  <audio controls className="mb-1.5 max-w-full" src={msg.media_url} />
                )}
                {msg.message_type === 'video' && msg.media_url && (
                  <video controls className="mb-1.5 max-w-full rounded-lg" src={msg.media_url} />
                )}
                {!['text', 'image', 'audio', 'video'].includes(msg.message_type) && !msg.content && (
                  <p className="italic text-muted-foreground text-xs">(mídia não suportada no painel)</p>
                )}

                {msg.content && (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                )}

                <div className={`mt-1 flex items-center gap-1.5 text-[10px] ${
                  isOutgoing ? 'text-accent/60 justify-end' : 'text-muted-foreground'
                }`}>
                  <span>{isOutgoing ? 'Você' : msg.sender_name || menteeName}</span>
                  <span>·</span>
                  <span>{formatTime(msg.sent_at)}</span>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-2.5">
        {inputDisabledReason && (
          <p className="text-[10px] text-destructive mb-1.5">{inputDisabledReason}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={canSend ? 'Responder via WhatsApp...' : inputDisabledReason || ''}
            disabled={!canSend}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '38px', maxHeight: '120px' }}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sending || !canSend}
            className="h-[38px] w-[38px] shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
