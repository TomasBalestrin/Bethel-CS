'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { Loader2, Send, MessageSquare, ExternalLink, Paperclip, Mic, Square, X, FileDown, Phone, PhoneCall, Play, Video, ChevronDown, Sparkles, ChevronUp, BellOff, Pencil, Check, ClipboardCheck, Timer, TimerOff, CheckSquare, ClipboardList, Reply } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { createTask } from '@/lib/actions/task-actions'
import type { Database } from '@/types/database'

type WppMessage = Database['public']['Tables']['wpp_messages']['Row']
type CallRecord = Pick<Database['public']['Tables']['call_records']['Row'], 'id' | 'mentee_id' | 'duration_seconds' | 'recording_status' | 'recording_url' | 'transcription' | 'transcription_status' | 'notes' | 'created_at'>
type AttendanceNote = Database['public']['Tables']['attendance_notes']['Row']

interface TabChatProps {
  menteeId: string
  menteePhone: string
  menteeName: string
  specialistId: string | null
  onUnreadCountChange?: (count: number) => void
  channel?: string
  signatureName?: string
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

export function TabChat({ menteeId, menteePhone, menteeName, specialistId, onUnreadCountChange, channel = 'principal', signatureName }: TabChatProps) {
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
  const [editingCallNote, setEditingCallNote] = useState<string | null>(null)
  const [callNoteText, setCallNoteText] = useState('')
  const [savingCallNote] = useState(false)

  // Attendance session (start/stop)
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [sessionStart, setSessionStart] = useState<Date | null>(null)

  // Create task from chat
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskNotes, setTaskNotes] = useState('')
  const [taskLoading] = useState(false)

  // Message windowing
  const [visibleLimit, setVisibleLimit] = useState(80)

  // Attendance summary
  const [latestNote, setLatestNote] = useState<AttendanceNote | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryExpanded, setSummaryExpanded] = useState(false)

  // Audio recording
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reply/quote
  const [replyingTo, setReplyingTo] = useState<WppMessage | null>(null)

  // Message selection for converting to action plan
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [convertingToPlan, setConvertingToPlan] = useState(false)

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
        const res = await fetch(`/api/whatsapp/messages/${menteeId}?channel=${channel}`)
        if (res.ok) {
          setMessages(await res.json())
          onUnreadRef.current?.(0)
          // Mark all unread messages as read for this channel
          const supabase = createClient()
          supabase.from('wpp_messages')
            .update({ is_read: true })
            .eq('mentee_id', menteeId)
            .eq('is_read', false)
            .eq('direction', 'incoming')
            .eq('channel', channel)
            .then(() => {})
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
          .select('id, mentee_id, duration_seconds, recording_status, recording_url, transcription, transcription_status, notes, created_at')
          .eq('mentee_id', menteeId)
          .order('created_at', { ascending: false })
          .limit(20)
        if (calls) setCallRecords(calls)

        // Check for active attendance session
        const { data: activeSess } = await supabase
          .from('attendance_sessions')
          .select('id, started_at')
          .eq('mentee_id', menteeId)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
        if (activeSess && activeSess.length > 0) {
          setActiveSession(activeSess[0].id)
          setSessionStart(new Date(activeSess[0].started_at))
        }

        // Fetch latest attendance note
        const { data: notes } = await supabase
          .from('attendance_notes')
          .select('*')
          .eq('mentee_id', menteeId)
          .order('created_at', { ascending: false })
          .limit(1)
        if (notes && notes.length > 0) setLatestNote(notes[0])

        // Find WPP instance for the mentee's specialist
        const menteeSpecialistId = specialistId || user.id
        const instanceQuery = supabase
          .from('wpp_instances').select('status')
          .eq('specialist_id', menteeSpecialistId)
          .limit(1)
          .single()
        const { data: specInstance } = await instanceQuery

        if (specInstance) {
          setInstanceStatus(specInstance.status)
        } else {
          // Fallback: check any connected instance
          const { data: anyInstance } = await supabase
            .from('wpp_instances').select('status').limit(1).single()
          if (anyInstance) setInstanceStatus(anyInstance.status)
          else setNoInstance(true)
        }
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
      toast.error('Erro no upload: ' + error.message)
      return null
    }

    const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(path)
    return publicUrl
  }

  // ─── Send message ───
  async function handleSend() {
    const text = input.trim()
    if ((!text && !attachedFile && !audioBlob) || sending || uploading) return

    setSending(true)
    setUploading(true)

    try {
      // Handle file attachment — send as native media
      if (attachedFile) {
        const url = await uploadFile(attachedFile, attachedFile.name)
        if (!url) { setSending(false); setUploading(false); return }

        setUploading(false)

        const isImage = attachedFile.type.startsWith('image/')
        const isVideo = attachedFile.type.startsWith('video/')
        const isAudioFile = attachedFile.type.startsWith('audio/')
        const mediaType = isImage ? 'image' : isVideo ? 'video' : isAudioFile ? 'audio' : 'document'

        const optimistic: WppMessage = {
          id: `temp-${Date.now()}`,
          mentee_id: menteeId,
          specialist_id: specialistId || '',
          instance_id: '',
          message_id: null,
          direction: 'outgoing',
          message_type: mediaType,
          content: text || null,
          media_url: url,
          sender_name: 'Você',
          is_read: true,
          sent_at: new Date().toISOString(),
          channel,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, optimistic])
        setInput('')
        setAttachedFile(null)

        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menteeId,
            message: text || undefined,
            type: mediaType,
            imageUrl: url,
            fileName: attachedFile.name,
            mimeType: attachedFile.type,
            channel,
            signatureName,
          }),
        })

        if (!res.ok) {
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
          toast.error('Erro ao enviar arquivo')
        }
        setSending(false)
        textareaRef.current?.focus()
        return
      }

      // Handle audio — send as native audio
      if (audioBlob) {
        const audioMime = audioBlob.type || 'audio/webm'
        const ext = audioMime.includes('mp4') ? 'mp4' : audioMime.includes('ogg') ? 'ogg' : 'webm'
        const url = await uploadFile(audioBlob, `audio_${Date.now()}.${ext}`)
        if (!url) { setSending(false); setUploading(false); return }

        setUploading(false)

        const optimistic: WppMessage = {
          id: `temp-${Date.now()}`,
          mentee_id: menteeId,
          specialist_id: specialistId || '',
          instance_id: '',
          message_id: null,
          direction: 'outgoing',
          message_type: 'audio',
          content: null,
          media_url: url,
          sender_name: 'Você',
          is_read: true,
          sent_at: new Date().toISOString(),
          channel,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, optimistic])
        setAudioBlob(null)
        setAudioUrl(null)

        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menteeId,
            type: 'audio',
            imageUrl: url,
            mimeType: audioMime,
            channel,
            signatureName,
          }),
        })

        if (!res.ok) {
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
          toast.error('Erro ao enviar áudio')
        }
        setSending(false)
        textareaRef.current?.focus()
        return
      }

      // Handle text message
      setUploading(false)
      if (!text) { setSending(false); return }

      setInput('')

      const quotedId = replyingTo?.message_id || null
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
        channel,
        quoted_message_id: quotedId,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimistic])
      setReplyingTo(null)

      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menteeId, message: text, channel, signatureName, quotedMessageId: quotedId }),
      })

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        const errData = await res.json().catch(() => null)
        toast.error(errData?.error || 'Erro ao enviar mensagem')
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
  const [showCallMenu, setShowCallMenu] = useState(false)

  async function handleCall(callType: 'voice' | 'video' = 'voice') {
    setShowCallMenu(false)
    setCallingLoading(true)
    try {
      const res = await fetch('/api/calls/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menteeId, callType }),
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
        callType: data.callType || callType,
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

  // ─── Generate AI summary ───
  async function handleSummarize() {
    setSummarizing(true)
    try {
      const res = await fetch('/api/chat/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menteeId, channel }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erro ao gerar resumo')
      }
      const { note } = await res.json()
      setLatestNote(note)
      setSummaryExpanded(true)
      toast.success('Resumo gerado com sucesso')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar resumo')
    } finally {
      setSummarizing(false)
    }
  }

  // ─── Audio recording ───
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Pick a supported mimeType (Safari doesn't support webm)
      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '' // let browser pick default
        }
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      const actualMime = recorder.mimeType || mimeType || 'audio/webm'
      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: actualMime })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000)
    } catch (err) {
      console.error('Microphone access denied or not supported:', err)
      toast.error('Não foi possível acessar o microfone')
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

  // Convert selected messages to action plan
  async function handleConvertToPlan() {
    if (selectedIds.size === 0) return
    setConvertingToPlan(true)
    try {
      const selectedMsgs = messages
        .filter((m) => selectedIds.has(m.id) && m.content)
        .map((m) => ({ content: m.content || '', direction: m.direction, sent_at: m.sent_at }))

      const res = await fetch('/api/action-plans/extract-from-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menteeId, messages: selectedMsgs }),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`Plano de ação criado — ${data.fieldCount} campos extraídos`)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erro ao converter mensagens')
      }
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setConvertingToPlan(false)
      setSelectMode(false)
      setSelectedIds(new Set())
    }
  }

  // Paste image from clipboard (Ctrl+V with screenshot)
  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const blob = items[i].getAsFile()
        if (blob) {
          const file = new File([blob], `screenshot_${Date.now()}.png`, { type: blob.type })
          setAttachedFile(file)
          toast.success('Imagem colada — clique enviar')
        }
        return
      }
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
  const canSend = (isOwner || isAdmin) && !isDisconnected && !!activeSession
  const inputDisabledReason = isDisconnected ? 'WhatsApp desconectado — reconecte no Admin' : !activeSession ? 'Clique em "Iniciar" para enviar mensagens' : null

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
            <div className="relative">
              <div className="flex">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs rounded-r-none border-r-0"
                  onClick={() => handleCall('voice')}
                  disabled={callingLoading || callStore.isActive}
                >
                  {callingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
                  Ligar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-1.5 rounded-l-none"
                  onClick={() => setShowCallMenu(!showCallMenu)}
                  disabled={callingLoading || callStore.isActive}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              {showCallMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowCallMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-44 max-w-[calc(100vw-1rem)] rounded-lg border border-border bg-card shadow-lg py-1">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => handleCall('voice')}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Ligação de voz
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => handleCall('video')}
                    >
                      <Video className="h-3.5 w-3.5" />
                      Videochamada
                    </button>
                  </div>
                </>
              )}
            </div>
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
          {activeSession ? (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 gap-1.5 text-xs"
              onClick={async () => {
                // Optimistic: update UI immediately
                const prevSession = activeSession
                const prevStart = sessionStart
                const dur = sessionStart ? Math.round((Date.now() - sessionStart.getTime()) / 60000) : 0
                setActiveSession(null)
                setSessionStart(null)
                toast.success(`Atendimento finalizado (${dur} min)`)

                const sb = createClient()
                const { error } = await sb.from('attendance_sessions').update({ ended_at: new Date().toISOString() }).eq('id', prevSession)
                if (error) {
                  // Revert on error
                  setActiveSession(prevSession)
                  setSessionStart(prevStart)
                  toast.error('Erro ao finalizar atendimento')
                } else {
                  // Auto-generate summary after ending session
                  handleSummarize()
                }
              }}
            >
              <TimerOff className="h-3 w-3" />
              <span className="hidden sm:inline">Finalizar</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs border-success/50 text-success hover:bg-success/10"
              onClick={async () => {
                const sb = createClient()
                const { data: { user } } = await sb.auth.getUser()
                if (!user) return
                const { data: sess } = await sb.from('attendance_sessions').insert({
                  mentee_id: menteeId,
                  specialist_id: user.id,
                  channel,
                }).select('id, started_at').single()
                if (sess) {
                  setActiveSession(sess.id)
                  setSessionStart(new Date(sess.started_at))
                  toast.success('Atendimento iniciado')
                }
              }}
            >
              <Timer className="h-3 w-3" />
              <span className="hidden sm:inline">Iniciar</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setTaskFormOpen(true)}
          >
            <ClipboardCheck className="h-3 w-3" />
            <span className="hidden sm:inline">Tarefa</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={async (e) => {
              e.stopPropagation()
              // Optimistic: update unread count immediately
              onUnreadRef.current?.(1)
              toast.success('Marcado como não lida')
              try {
                const supabase = createClient()
                // Get latest incoming messages to mark as unread
                const { data: incoming } = await supabase
                  .from('wpp_messages')
                  .select('id')
                  .eq('mentee_id', menteeId)
                  .eq('direction', 'incoming')
                  .order('created_at', { ascending: false })
                  .limit(1)
                if (incoming && incoming.length > 0) {
                  const { error } = await supabase
                    .from('wpp_messages')
                    .update({ is_read: false })
                    .eq('id', incoming[0].id)
                  if (error) {
                    // Revert on error
                    onUnreadRef.current?.(0)
                    toast.error('Erro ao marcar como não lida')
                  }
                } else {
                  // No incoming messages to mark — revert
                  onUnreadRef.current?.(0)
                }
              } catch {
                // Revert on error
                onUnreadRef.current?.(0)
                toast.error('Erro ao marcar como não lida')
              }
            }}
            title="Marcar como não lida"
          >
            <BellOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Marcar como não lida</span>
          </Button>
          <span className={`h-2 w-2 rounded-full shrink-0 ${instanceStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {instanceStatus === 'connected' ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Summary bar */}
      <div className="border-b border-border px-4 py-2 shrink-0 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {latestNote ? (
              <button
                type="button"
                onClick={() => setSummaryExpanded(!summaryExpanded)}
                className="flex items-center gap-1.5 text-xs text-foreground hover:text-accent transition-colors min-w-0"
              >
                <Sparkles className="h-3 w-3 text-accent shrink-0" />
                <span className="truncate font-medium">Último resumo: {new Date(latestNote.created_at).toLocaleDateString('pt-BR')}</span>
                <ChevronUp className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${summaryExpanded ? '' : 'rotate-180'}`} />
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Nenhum resumo gerado
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-[11px] shrink-0"
            onClick={handleSummarize}
            disabled={summarizing || messages.length === 0}
          >
            {summarizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {summarizing ? 'Gerando...' : 'Gerar resumo'}
          </Button>
          <Button
            size="sm"
            variant={selectMode ? 'default' : 'outline'}
            className="h-7 gap-1.5 text-[11px] shrink-0"
            onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()) }}
          >
            <CheckSquare className="h-3 w-3" />
            {selectMode ? 'Cancelar' : 'Selecionar'}
          </Button>
        </div>

        {/* Expanded summary */}
        {summaryExpanded && latestNote && (
          <div className="mt-2 rounded-lg bg-card border border-border p-3 space-y-2 text-xs">
            <div>
              <p className="font-medium text-foreground">{latestNote.summary}</p>
            </div>
            {latestNote.questions && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Dúvidas</p>
                <p className="text-foreground">{latestNote.questions}</p>
              </div>
            )}
            {latestNote.difficulties && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Dificuldades</p>
                <p className="text-foreground">{latestNote.difficulties}</p>
              </div>
            )}
            {latestNote.next_steps && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Próximos passos</p>
                <p className="text-foreground">{latestNote.next_steps}</p>
              </div>
            )}
            <p className="text-[9px] text-muted-foreground/40">
              {latestNote.generated_by_ai ? 'Gerado por IA' : 'Manual'} — {new Date(latestNote.created_at).toLocaleString('pt-BR')}
            </p>
          </div>
        )}
      </div>

      {/* Messages — scrollable (windowed) */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 min-h-0">
        {messages.length > visibleLimit && (
          <div className="flex justify-center py-2">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setVisibleLimit((l) => l + 80)}>
              Carregar anteriores ({messages.length - visibleLimit} mensagens)
            </Button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma mensagem ainda</p>
          </div>
        )}
        {messages.slice(-visibleLimit).map((msg, idx, visibleMsgs) => {
          const isOutgoing = msg.direction === 'outgoing'
          const prevMsg = visibleMsgs[idx - 1]
          const nextMsg = visibleMsgs[idx + 1]
          const showDateSeparator = !prevMsg || getDateKey(msg.sent_at) !== getDateKey(prevMsg.sent_at)

          // Group consecutive messages from same sender
          const sameSenderAsPrev = prevMsg && prevMsg.direction === msg.direction && !showDateSeparator
          const sameSenderAsNext = nextMsg && nextMsg.direction === msg.direction && getDateKey(msg.sent_at) === getDateKey(nextMsg?.sent_at ?? '')
          const sameTimeAsNext = sameSenderAsNext && formatTime(msg.sent_at) === formatTime(nextMsg.sent_at)

          // Show sender name only for first message in a group
          const showSenderName = !isOutgoing && !sameSenderAsPrev
          // Show time only for last message in a group with same time
          const showTime = !sameTimeAsNext

          // Bubble border radius based on position in group
          const getBubbleRadius = () => {
            if (isOutgoing) {
              if (!sameSenderAsPrev && !sameSenderAsNext) return 'rounded-2xl rounded-tr-md'
              if (!sameSenderAsPrev) return 'rounded-2xl rounded-tr-md rounded-br-md'
              if (!sameSenderAsNext) return 'rounded-2xl rounded-tr-md rounded-r-md'
              return 'rounded-2xl rounded-r-md'
            }
            if (!sameSenderAsPrev && !sameSenderAsNext) return 'rounded-2xl rounded-tl-md'
            if (!sameSenderAsPrev) return 'rounded-2xl rounded-tl-md rounded-bl-md'
            if (!sameSenderAsNext) return 'rounded-2xl rounded-tl-md rounded-l-md'
            return 'rounded-2xl rounded-l-md'
          }

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {showDateSeparator && (
                <div className="flex items-center justify-center my-4">
                  <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground">
                    {formatDate(msg.sent_at)}
                  </span>
                </div>
              )}

              <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} ${sameSenderAsPrev ? 'mt-0.5' : 'mt-3'} ${selectMode ? 'gap-2 items-start' : ''}`}>
                {selectMode && (
                  <button
                    onClick={() => setSelectedIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(msg.id)) next.delete(msg.id)
                      else next.add(msg.id)
                      return next
                    })}
                    className={`shrink-0 mt-2 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.has(msg.id) ? 'bg-accent border-accent text-white' : 'border-border hover:border-accent/50'}`}
                  >
                    {selectedIds.has(msg.id) && <Check className="h-3 w-3" />}
                  </button>
                )}
                <div className={`${isOutgoing ? 'max-w-[70%]' : 'max-w-[70%]'}`}>
                  {/* Sender name — first in group only */}
                  {showSenderName && (
                    <p className="text-[10px] font-medium text-muted-foreground mb-1 px-1">
                      {msg.sender_name || menteeName}
                    </p>
                  )}

                  <div className="group/msg relative">
                    {/* Quoted message preview */}
                    {msg.quoted_message_id && (() => {
                      const quoted = messages.find((m) => m.message_id === msg.quoted_message_id || m.id === msg.quoted_message_id)
                      if (!quoted) return null
                      return (
                        <div className={`mb-1 rounded-lg px-2.5 py-1.5 text-[11px] border-l-2 border-accent ${isOutgoing ? 'bg-accent/10' : 'bg-background'}`}>
                          <p className="font-medium text-accent text-[10px]">{quoted.direction === 'outgoing' ? 'Você' : (quoted.sender_name || menteeName)}</p>
                          <p className="text-muted-foreground truncate">{quoted.content || (quoted.message_type !== 'text' ? `[${quoted.message_type}]` : '')}</p>
                        </div>
                      )
                    })()}
                    <div className={`px-3 py-2 text-sm shadow-sm ${getBubbleRadius()} ${
                      isOutgoing
                        ? 'bg-accent/15 text-foreground'
                        : 'bg-muted text-foreground'
                    }`}>
                      <MessageContent msg={msg} menteeName={menteeName} />
                    </div>
                    {/* Reply button on hover */}
                    {!selectMode && (
                      <button
                        onClick={() => { setReplyingTo(msg); textareaRef.current?.focus() }}
                        className={`absolute top-1 ${isOutgoing ? '-left-8' : '-right-8'} opacity-0 group-hover/msg:opacity-100 transition-opacity rounded-full p-1 hover:bg-muted`}
                        title="Responder"
                      >
                        <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>

                  {/* Time — last in same-time group only */}
                  {showTime && (
                    <p className={`text-[10px] text-muted-foreground/50 mt-0.5 px-1 ${isOutgoing ? 'text-right' : ''}`}>
                      {formatTime(msg.sent_at)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Selection action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="border-t border-accent/20 bg-accent/5 px-3 py-2 flex items-center justify-between shrink-0">
          <span className="text-xs text-foreground font-medium">
            {selectedIds.size} mensagem{selectedIds.size !== 1 ? 'ns' : ''} selecionada{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-[11px]"
            onClick={handleConvertToPlan}
            disabled={convertingToPlan}
          >
            {convertingToPlan ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
            {convertingToPlan ? 'Processando...' : 'Converter em Plano de Ação'}
          </Button>
        </div>
      )}

      {/* Input area — fixed bottom */}
      <div className="border-t border-border px-3 py-2 shrink-0 bg-background" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}>
        {inputDisabledReason && (
          <p className="text-[10px] text-destructive mb-1.5">{inputDisabledReason}</p>
        )}

        {/* Reply preview */}
        {replyingTo && (
          <div className="flex items-center gap-2 mb-2 rounded-lg border-l-2 border-accent bg-accent/5 px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-accent">{replyingTo.direction === 'outgoing' ? 'Você' : (replyingTo.sender_name || menteeName)}</p>
              <p className="text-xs text-muted-foreground truncate">{replyingTo.content || `[${replyingTo.message_type}]`}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} aria-label="Cancelar resposta"><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
          </div>
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
              onPaste={handlePaste}
              placeholder={canSend ? 'Mensagem...' : inputDisabledReason || ''}
              disabled={!canSend || uploading}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '44px', maxHeight: '120px' }}
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

                    {/* Transcription */}
                    <p className="text-xs text-muted-foreground mt-1">Transcrição:</p>
                    {call.transcription_status === 'ready' && call.transcription ? (
                      <p className="text-xs text-foreground whitespace-pre-line bg-muted/50 rounded p-2 max-h-40 overflow-y-auto">{call.transcription}</p>
                    ) : call.transcription_status === 'processing' ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Transcrevendo...
                      </span>
                    ) : call.transcription_status === 'failed' ? (
                      <span className="text-xs text-destructive">Falha na transcrição</span>
                    ) : call.recording_status === 'ready' ? (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/calls/transcribe', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ callId: call.id }),
                            })
                            if (res.ok) toast.success('Transcrição iniciada')
                            else toast.error('Erro ao iniciar transcrição')
                          } catch { toast.error('Erro ao iniciar transcrição') }
                        }}
                        className="text-xs text-accent hover:underline"
                      >
                        Transcrever gravação
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">Disponível após gravação</span>
                    )}

                    {/* Call notes */}
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground font-medium">Anotações da ligação:</p>
                        {editingCallNote !== call.id && (
                          <button
                            onClick={() => {
                              setEditingCallNote(call.id)
                              setCallNoteText(call.notes ?? '')
                            }}
                            className="flex items-center gap-1 text-[10px] text-accent hover:underline"
                          >
                            <Pencil className="h-3 w-3" />
                            {call.notes ? 'Editar' : 'Adicionar'}
                          </button>
                        )}
                      </div>
                      {editingCallNote === call.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={callNoteText}
                            onChange={(e) => setCallNoteText(e.target.value)}
                            placeholder="Registre o que foi conversado nesta ligação..."
                            className="min-h-[80px] text-xs resize-y"
                            autoFocus
                          />
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => { setEditingCallNote(null); setCallNoteText('') }}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs gap-1"
                              disabled={savingCallNote}
                              onClick={async () => {
                                // Optimistic: update UI immediately
                                const savedNote = callNoteText
                                const prevNotes = call.notes
                                setCallRecords((prev) =>
                                  prev.map((c) => c.id === call.id ? { ...c, notes: savedNote || null } : c)
                                )
                                setEditingCallNote(null)
                                setCallNoteText('')
                                toast.success('Anotação salva')

                                const sb = createClient()
                                const { error } = await sb
                                  .from('call_records')
                                  .update({ notes: savedNote || null })
                                  .eq('id', call.id)
                                if (error) {
                                  // Revert on error
                                  setCallRecords((prev) =>
                                    prev.map((c) => c.id === call.id ? { ...c, notes: prevNotes } : c)
                                  )
                                  toast.error('Erro ao salvar anotação')
                                }
                              }}
                            >
                              <Check className="h-3 w-3" />
                              {savingCallNote ? 'Salvando...' : 'Salvar'}
                            </Button>
                          </div>
                        </div>
                      ) : call.notes ? (
                        <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/30 rounded-md px-2.5 py-2 leading-relaxed">{call.notes}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground/50 italic">Nenhuma anotação registrada</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground">Transcrição via OpenAI Whisper</p>
            <Button variant="outline" size="sm" onClick={() => { setCallsModalOpen(false); setPlayingRecording(null) }}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create task dialog */}
      <Dialog open={taskFormOpen} onOpenChange={(open) => { if (!open) { setTaskFormOpen(false); setTaskTitle(''); setTaskDesc(''); setTaskDueDate(''); setTaskNotes('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova tarefa para {menteeName}</DialogTitle>
            <DialogDescription>A tarefa será vinculada a este mentorado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault()
            // Optimistic: close dialog immediately
            const savedTitle = taskTitle; const savedDesc = taskDesc; const savedNotes = taskNotes; const savedDueDate = taskDueDate
            setTaskFormOpen(false)
            setTaskTitle(''); setTaskDesc(''); setTaskDueDate(''); setTaskNotes('')
            toast.success('Tarefa criada')

            const res = await createTask({
              title: savedTitle,
              description: savedDesc || undefined,
              notes: savedNotes || undefined,
              due_date: savedDueDate || undefined,
              mentee_id: menteeId,
            })
            if (res.error) {
              toast.error(res.error)
            }
          }} className="space-y-3">
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required placeholder="O que precisa ser feito?" />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} className="min-h-[80px] resize-y" placeholder="Descreva a tarefa..." />
            </div>
            <div className="space-y-1">
              <Label>Data de entrega</Label>
              <Input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea value={taskNotes} onChange={(e) => setTaskNotes(e.target.value)} className="min-h-[60px] resize-y" placeholder="Anotações..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setTaskFormOpen(false)}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={taskLoading}>{taskLoading ? 'Criando...' : 'Criar tarefa'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Message Content Renderer ───

const S3_BASE = 'https://whatsapp-avatar.s3.sa-east-1.amazonaws.com'

/** Ensure media URL is a full URL (handles legacy relative paths) */
function resolveMediaUrl(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${S3_BASE}/${url}`
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MessageContent({ msg, menteeName }: { msg: WppMessage; menteeName: string }) {
  const content = msg.content || ''
  const mediaUrl = resolveMediaUrl(msg.media_url)

  // Image from media_url
  if (msg.message_type === 'image' && mediaUrl) {
    return (
      <>
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block relative min-h-[100px]">
          <Image src={mediaUrl} alt="Imagem" width={300} height={200} className="rounded-lg mb-1 w-full h-auto" unoptimized={!mediaUrl.includes('supabase') && !mediaUrl.includes('amazonaws.com')} />
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
