'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Send, MessageSquare, ExternalLink, Paperclip, Mic, Square, X, FileDown, Phone, PhoneCall, ChevronDown, ChevronRight, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CallInterface } from './call-interface'
import { toast } from 'sonner'
import type { Database } from '@/types/database'

type WppMessage = Database['public']['Tables']['wpp_messages']['Row']
type CallRecord = Database['public']['Tables']['call_records']['Row']

interface TabChatProps {
  menteeId: string
  menteePhone: string
  menteeName: string
  specialistId: string | null
  onUnreadCountChange?: (count: number) => void
}

// ─── Helpers ───

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Hoje'
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isImageUrl(text: string) {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(text)
}

function isAudioUrl(text: string) {
  return /\.(ogg|mp3|wav|m4a|opus)(\?|$)/i.test(text)
}

function getDateKey(dateStr: string) {
  return new Date(dateStr).toDateString()
}

// ─── Component ───

export function TabChat({ menteeId, menteePhone, menteeName, specialistId, onUnreadCountChange }: TabChatProps) {
  const [messages, setMessages] = useState<WppMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [instanceStatus, setInstanceStatus] = useState<string | null>(null)
  const [noInstance, setNoInstance] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  // File attachment
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Call state
  const [inCall, setInCall] = useState(false)
  const [callData, setCallData] = useState<{ roomUrl: string; token: string; callId: string } | null>(null)
  const [callingLoading, setCallingLoading] = useState(false)

  // Call history
  const [callRecords, setCallRecords] = useState<CallRecord[]>([])
  const [callsExpanded, setCallsExpanded] = useState(false)
  const [playingRecording, setPlayingRecording] = useState<string | null>(null)

  // Audio recording
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const onUnreadRef = useRef(onUnreadCountChange)
  onUnreadRef.current = onUnreadCountChange

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  // ─── Load messages + instance ───
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/whatsapp/messages/${menteeId}`)
        if (res.ok) {
          setMessages(await res.json())
          onUnreadRef.current?.(0)
        }

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setIsAdmin(profile?.role === 'admin')
        setIsOwner(specialistId === user.id)

        // Fetch call history
        const { data: calls } = await supabase
          .from('call_records')
          .select('*')
          .eq('mentee_id', menteeId)
          .order('created_at', { ascending: false })
          .limit(20)
        if (calls) setCallRecords(calls)

        const targetId = specialistId
        if (!targetId) { setNoInstance(true); return }

        const { data: instance } = await supabase
          .from('wpp_instances').select('status').eq('specialist_id', targetId).single()

        if (instance) setInstanceStatus(instance.status)
        else setNoInstance(true)
      } catch (err) {
        console.error('Chat load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [menteeId, specialistId])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // ─── Realtime ───
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`wpp_messages:mentee_id=eq.${menteeId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'wpp_messages',
        filter: `mentee_id=eq.${menteeId}`,
      }, (payload) => {
        const newMsg = payload.new as WppMessage
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        if (newMsg.direction === 'incoming') {
          supabase.from('wpp_messages').update({ is_read: true }).eq('id', newMsg.id).then(() => {})
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [menteeId])

  // ─── Upload to Supabase Storage ───
  async function uploadFile(file: File | Blob, filename: string): Promise<string | null> {
    const supabase = createClient()
    const ext = filename.split('.').pop() || 'bin'
    const path = `${menteeId}/${Date.now()}_${filename}`

    const { error } = await supabase.storage
      .from('chat-attachments')
      .upload(path, file, { contentType: file.type || `application/${ext}` })

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(path)
    return publicUrl
  }

  // ─── Send message ───
  async function handleSend() {
    let text = input.trim()
    if ((!text && !attachedFile && !audioBlob) || sending || uploading) return

    setSending(true)
    setUploading(true)

    try {
      // Handle file attachment
      if (attachedFile) {
        const url = await uploadFile(attachedFile, attachedFile.name)
        if (url) {
          text = `📎 Arquivo: ${attachedFile.name}\n${url}`
        } else {
          setSending(false); setUploading(false)
          return
        }
        setAttachedFile(null)
      }

      // Handle audio
      if (audioBlob) {
        const url = await uploadFile(audioBlob, `audio_${Date.now()}.ogg`)
        if (url) {
          text = `🎤 Áudio: ${url}`
        } else {
          setSending(false); setUploading(false)
          return
        }
        setAudioBlob(null)
        setAudioUrl(null)
      }

      setUploading(false)
      if (!text) { setSending(false); return }

      setInput('')

      // Optimistic
      const optimistic: WppMessage = {
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
      setMessages((prev) => [...prev, optimistic])

      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menteeId, message: text }),
      })

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      }
    } catch {
      // Revert handled above
    } finally {
      setSending(false)
      setUploading(false)
      textareaRef.current?.focus()
    }
  }

  // ─── Start call ───
  async function handleCall() {
    setCallingLoading(true)
    try {
      const res = await fetch('/api/calls/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menteeId }),
      })
      if (!res.ok) throw new Error('Falha ao criar ligação')
      const data = await res.json()
      setCallData({ roomUrl: data.roomUrl, token: data.token, callId: data.callId })
      setInCall(true)
      toast.success(`Link enviado para ${menteeName} via WhatsApp`)
    } catch (err) {
      console.error('Call error:', err)
      toast.error('Erro ao iniciar ligação')
    } finally {
      setCallingLoading(false)
    }
  }

  // ─── Audio recording ───
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: 'audio/ogg' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000)
    } catch {
      console.error('Microphone access denied')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  function cancelAudio() {
    setAudioBlob(null)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const wppLink = `https://wa.me/${menteePhone.replace(/\D/g, '')}`
  const isDisconnected = instanceStatus !== 'connected'
  const canSend = (isOwner || isAdmin) && !isDisconnected
  const inputDisabledReason = isDisconnected ? 'WhatsApp desconectado — reconecte no Admin' : null

  // ─── Empty states ───
  if (!loading && noInstance) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Configure o WhatsApp no módulo Admin para ativar o chat</p>
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

  // ─── Render ───
  return (
    <div className="-mx-4 -mt-4 sm:-mx-6 flex flex-col" style={{ height: 'calc(100vh - 260px)' }}>
      {/* Header — fixed top */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0 bg-background">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{menteeName}</p>
          <a href={wppLink} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-accent hover:underline">
            {menteePhone}<ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canSend && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={handleCall}
              disabled={callingLoading || inCall}
            >
              {callingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
              Ligar
            </Button>
          )}
          <span className={`h-2 w-2 rounded-full ${instanceStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-[10px] text-muted-foreground">
            {instanceStatus === 'connected' ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Call interface — replaces messages when in call */}
      {inCall && callData && (
        <CallInterface
          roomUrl={callData.roomUrl}
          token={callData.token}
          callId={callData.callId}
          menteeName={menteeName}
          onEnd={() => { setInCall(false); setCallData(null) }}
        />
      )}

      {/* Messages — scrollable (hidden during call) */}
      {!inCall && (
      <>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma mensagem ainda</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isOutgoing = msg.direction === 'outgoing'
          const prevMsg = messages[idx - 1]
          const showDateSeparator = !prevMsg || getDateKey(msg.sent_at) !== getDateKey(prevMsg.sent_at)

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {showDateSeparator && (
                <div className="flex items-center justify-center my-3">
                  <span className="rounded-full bg-muted px-3 py-0.5 text-[10px] text-muted-foreground">
                    {formatDate(msg.sent_at)}
                  </span>
                </div>
              )}

              <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-1`}>
                <div className="max-w-[75%]">
                  {/* Sender name — incoming only */}
                  {!isOutgoing && (
                    <p className="text-[10px] text-muted-foreground mb-0.5 px-1">
                      {msg.sender_name || menteeName}
                    </p>
                  )}

                  <div className={`rounded-xl px-3 py-2 text-sm ${
                    isOutgoing
                      ? 'bg-accent/15 text-foreground rounded-tr-sm'
                      : 'bg-muted text-foreground rounded-tl-sm'
                  }`}>
                    {/* Media rendering */}
                    <MessageContent msg={msg} menteeName={menteeName} />
                  </div>

                  {/* Time */}
                  <p className={`text-[10px] text-muted-foreground/60 mt-0.5 px-1 ${isOutgoing ? 'text-right' : ''}`}>
                    {formatTime(msg.sent_at)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Call history — collapsible */}
      {callRecords.length > 0 && (
        <div className="border-t border-border shrink-0">
          <button
            type="button"
            onClick={() => setCallsExpanded(!callsExpanded)}
            className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            {callsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <span className="label-xs">LIGAÇÕES ({callRecords.length})</span>
          </button>

          {callsExpanded && (
            <div className="px-4 pb-2 space-y-1.5 max-h-[200px] overflow-y-auto">
              {callRecords.map((call) => (
                <div key={call.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                  <PhoneCall className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground">
                      {new Date(call.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      {' '}
                      {new Date(call.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {call.duration_seconds != null && (
                      <span className="text-muted-foreground ml-2">
                        {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                      </span>
                    )}
                  </div>
                  {call.recording_status === 'ready' && call.recording_url && (
                    <button
                      onClick={() => setPlayingRecording(playingRecording === call.id ? null : call.id)}
                      className="flex items-center gap-1 text-accent hover:underline shrink-0"
                    >
                      <Play className="h-3 w-3" /> Ouvir
                    </button>
                  )}
                  {call.recording_status === 'processing' && (
                    <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                      <Loader2 className="h-3 w-3 animate-spin" /> Processando...
                    </span>
                  )}
                  {call.recording_status === 'pending' && call.ended_at && (
                    <span className="text-muted-foreground shrink-0">Aguardando...</span>
                  )}
                  {call.recording_status === 'failed' && (
                    <span className="text-destructive shrink-0">Falhou</span>
                  )}
                  {call.recording_status === 'unavailable' && (
                    <span className="text-muted-foreground shrink-0 text-[10px]">Gravação disponível em breve</span>
                  )}
                </div>
              ))}

              {/* Audio player modal */}
              {playingRecording && (
                <div className="rounded-lg bg-muted p-3">
                  <audio
                    controls
                    autoPlay
                    src={callRecords.find((c) => c.id === playingRecording)?.recording_url || ''}
                    className="w-full"
                  />
                  <button
                    onClick={() => setPlayingRecording(null)}
                    className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Fechar player
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Input area — fixed bottom */}
      <div className="border-t border-border px-3 py-2 shrink-0 bg-background">
        {inputDisabledReason && (
          <p className="text-[10px] text-destructive mb-1.5">{inputDisabledReason}</p>
        )}

        {/* File preview */}
        {attachedFile && (
          <div className="flex items-center gap-2 mb-2 rounded-lg bg-muted px-3 py-2 text-sm">
            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate flex-1">{attachedFile.name}</span>
            <button onClick={() => setAttachedFile(null)}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
          </div>
        )}

        {/* Audio preview */}
        {audioUrl && !recording && (
          <div className="flex items-center gap-2 mb-2 rounded-lg bg-muted px-3 py-2">
            <audio controls src={audioUrl} className="h-8 flex-1" />
            <Button size="sm" onClick={handleSend} disabled={sending || uploading}>
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </Button>
            <button onClick={cancelAudio}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
          </div>
        )}

        {/* Recording indicator */}
        {recording && (
          <div className="flex items-center gap-3 mb-2 rounded-lg bg-destructive/10 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm text-destructive font-medium">
              {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="destructive" onClick={stopRecording}>
              <Square className="h-3 w-3 mr-1" /> Parar
            </Button>
          </div>
        )}

        {/* Input bar */}
        {!audioUrl && !recording && (
          <div className="flex items-end gap-1.5">
            {/* Attachment */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) setAttachedFile(file)
                e.target.value = ''
              }}
            />
            <Button
              size="icon" variant="ghost"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canSend}
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {/* Audio */}
            <Button
              size="icon" variant="ghost"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              onClick={startRecording}
              disabled={!canSend}
            >
              <Mic className="h-4 w-4" />
            </Button>

            {/* Text input */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={canSend ? 'Mensagem...' : inputDisabledReason || ''}
              disabled={!canSend || uploading}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '36px', maxHeight: '120px' }}
            />

            {/* Send */}
            <Button
              size="icon"
              onClick={handleSend}
              disabled={(!input.trim() && !attachedFile) || sending || uploading || !canSend}
              className="h-9 w-9 shrink-0"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  )
}

// ─── Message Content Renderer ───

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MessageContent({ msg, menteeName }: { msg: WppMessage; menteeName: string }) {
  const content = msg.content || ''
  const mediaUrl = msg.media_url

  // Image from media_url
  if (msg.message_type === 'image' && mediaUrl) {
    return (
      <>
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
          <img src={mediaUrl} alt="Imagem" className="max-w-full rounded-lg mb-1" loading="lazy" />
        </a>
        {content && <p className="whitespace-pre-wrap break-words">{content}</p>}
      </>
    )
  }

  // Audio from media_url
  if ((msg.message_type === 'audio' && mediaUrl) || content.startsWith('🎤')) {
    const src = mediaUrl || content.split('\n').pop()?.trim() || ''
    return <audio controls src={src} className="max-w-full" />
  }

  // Video
  if (msg.message_type === 'video' && mediaUrl) {
    return <video controls src={mediaUrl} className="max-w-full rounded-lg" />
  }

  // File attachment (text message with 📎)
  if (content.startsWith('📎')) {
    const lines = content.split('\n')
    const name = lines[0].replace('📎 Arquivo: ', '')
    const url = lines[1]?.trim()
    return (
      <div className="flex items-center gap-2">
        <FileDown className="h-5 w-5 text-accent shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{name}</p>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-accent hover:underline">Download</a>
          )}
        </div>
      </div>
    )
  }

  // Image URL in text content
  if (isImageUrl(content)) {
    return (
      <a href={content} target="_blank" rel="noopener noreferrer">
        <img src={content} alt="Imagem" className="max-w-full rounded-lg" loading="lazy" />
      </a>
    )
  }

  // Audio URL in text content
  if (isAudioUrl(content)) {
    return <audio controls src={content} className="max-w-full" />
  }

  // Unsupported media type with no text
  if (!['text', 'image', 'audio', 'video'].includes(msg.message_type) && !content) {
    return <p className="italic text-muted-foreground text-xs">(mídia não suportada)</p>
  }

  // Default: plain text
  return <p className="whitespace-pre-wrap break-words">{content}</p>
}
