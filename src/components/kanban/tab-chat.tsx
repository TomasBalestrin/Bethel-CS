'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { Loader2, Send, MessageSquare, ExternalLink, Paperclip, Mic, Square, X, FileDown, Phone, PhoneCall, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useCallStore } from '@/store/call-store'
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

  // Call state (global store)
  const callStore = useCallStore()
  const [callingLoading, setCallingLoading] = useState(false)

  // Call history
  const [callRecords, setCallRecords] = useState<CallRecord[]>([])
  const [callsModalOpen, setCallsModalOpen] = useState(false)
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

        // Find any connected WPP instance (not filtered by specialist)
        const { data: instance } = await supabase
          .from('wpp_instances').select('status').eq('status', 'connected').limit(1).single()

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
  async function handleCall(forceNew = false) {
    setCallingLoading(true)
    try {
      const res = await fetch('/api/calls/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menteeId, forceNew }),
      })
      if (!res.ok) throw new Error('Falha ao criar ligação')
      const data = await res.json()
      callStore.startCall({
        roomUrl: data.roomUrl,
        roomName: data.roomName,
        token: data.token,
        callId: data.callId,
        menteeName,
        menteeLink: data.menteeLink,
      })
      if (data.reused) {
        toast.success('Ligação em andamento — reconectando')
      } else {
        toast.success(`Link enviado para ${menteeName} via WhatsApp`)
      }
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
    <div className="flex flex-col h-full">
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
              onClick={() => handleCall()}
              disabled={callingLoading || callStore.isActive}
            >
              {callingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
              Ligar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setCallsModalOpen(true)}
            disabled={callRecords.length === 0}
          >
            <PhoneCall className="h-3 w-3" />
            Ligações {callRecords.length > 0 && `(${callRecords.length})`}
          </Button>
          <span className={`h-2 w-2 rounded-full shrink-0 ${instanceStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {instanceStatus === 'connected' ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Messages — scrollable */}
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
            <button onClick={() => setAttachedFile(null)} aria-label="Remover arquivo"><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
          </div>
        )}

        {/* Audio preview */}
        {audioUrl && !recording && (
          <div className="flex items-center gap-2 mb-2 rounded-lg bg-muted px-3 py-2">
            <audio controls src={audioUrl} className="h-8 flex-1" />
            <Button size="sm" onClick={handleSend} disabled={sending || uploading}>
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </Button>
            <button onClick={cancelAudio} aria-label="Cancelar áudio"><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
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
              aria-label="Anexar arquivo"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {/* Audio */}
            <Button
              size="icon" variant="ghost"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              onClick={startRecording}
              disabled={!canSend}
              aria-label="Gravar áudio"
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
              aria-label="Enviar mensagem"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>

      {/* Call history modal */}
      <Dialog open={callsModalOpen} onOpenChange={(open) => { if (!open) { setCallsModalOpen(false); setPlayingRecording(null) } }}>
        <DialogContent className="max-w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[80vh] overflow-hidden rounded-none sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Histórico de Ligações — {menteeName}</DialogTitle>
            <DialogDescription>{callRecords.length} ligação{callRecords.length !== 1 ? 'ões' : ''} registrada{callRecords.length !== 1 ? 's' : ''}</DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[55vh] space-y-0">
            {callRecords.map((call, idx) => (
              <div key={call.id}>
                {idx > 0 && <Separator className="my-3" />}
                <div className="space-y-2">
                  {/* Header: date + duration */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {new Date(call.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {' às '}
                        {new Date(call.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {call.duration_seconds != null && (
                      <span className="text-xs text-muted-foreground">
                        Duração: {Math.floor(call.duration_seconds / 60)}min
                      </span>
                    )}
                  </div>

                  {/* Recording */}
                  <div className="pl-6 space-y-1.5">
                    <p className="text-xs text-muted-foreground">Gravação:</p>
                    {call.recording_status === 'ready' && call.recording_url && (
                      <div>
                        <button
                          onClick={() => setPlayingRecording(playingRecording === call.id ? null : call.id)}
                          className="flex items-center gap-1.5 text-sm text-accent hover:underline"
                        >
                          <Play className="h-3.5 w-3.5" />
                          {playingRecording === call.id ? 'Fechar player' : 'Ouvir gravação'}
                        </button>
                        {playingRecording === call.id && (
                          <audio
                            controls
                            autoPlay
                            src={call.recording_url}
                            className="w-full mt-2"
                          />
                        )}
                      </div>
                    )}
                    {call.recording_status === 'processing' && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Processando gravação...
                      </span>
                    )}
                    {call.recording_status === 'unavailable' && (
                      <span className="text-xs text-muted-foreground">Gravação indisponível</span>
                    )}
                    {call.recording_status === 'pending' && (
                      <span className="text-xs text-muted-foreground">Aguardando gravação...</span>
                    )}
                    {call.recording_status === 'failed' && (
                      <span className="text-xs text-destructive">Gravação falhou</span>
                    )}

                    {/* Transcription placeholder */}
                    <p className="text-xs text-muted-foreground mt-1">Transcrição:</p>
                    <p className="text-xs text-muted-foreground/60 italic">Em breve — disponível após upgrade do plano</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground">Transcrição automática disponível em breve</p>
            <Button variant="outline" size="sm" onClick={() => { setCallsModalOpen(false); setPlayingRecording(null) }}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block relative min-h-[100px]">
          <Image src={mediaUrl} alt="Imagem" width={300} height={200} className="rounded-lg mb-1 w-full h-auto" unoptimized={!mediaUrl.includes('supabase')} />
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
      <a href={content} target="_blank" rel="noopener noreferrer" className="block relative min-h-[100px]">
        <Image src={content} alt="Imagem" width={300} height={200} className="rounded-lg w-full h-auto" unoptimized={!content.includes('supabase')} />
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
