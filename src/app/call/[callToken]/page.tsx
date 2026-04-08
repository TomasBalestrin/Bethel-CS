'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import DailyIframe from '@daily-co/daily-js'
import { Phone, Loader2, PhoneOff, Mic, MicOff } from 'lucide-react'
import Image from 'next/image'
import { getOrCreateCall, destroyCall, getActiveCall } from '@/lib/daily-call'

export default function MenteeCallPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const callToken = params.callToken as string
  const roomParam = searchParams.get('room') // Room name from URL — ensures same room as specialist

  const [status, setStatus] = useState<'loading' | 'ready' | 'joining' | 'active' | 'ended' | 'error'>('loading')
  const [specialistName, setSpecialistName] = useState('')
  const [roomUrl, setRoomUrl] = useState('')
  const [token, setToken] = useState('')
  const [callType, setCallType] = useState<'voice' | 'video'>('voice')
  const [error, setError] = useState('')

  // Fetch token + roomUrl
  useEffect(() => {
    async function init() {
      try {
        const url = roomParam
          ? `/api/calls/mentee-token/${callToken}?room=${roomParam}`
          : `/api/calls/mentee-token/${callToken}`
        const res = await fetch(url)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error || 'Link inválido ou ligação encerrada')
          setStatus('error')
          return
        }
        const data = await res.json()
        setToken(data.token)
        setRoomUrl(data.roomUrl)
        setSpecialistName(data.specialistName)
        setCallType(data.callType || 'voice')
        console.log('[MenteeCall] Room from API:', data.roomUrl, 'roomParam:', roomParam)
        setStatus('ready')
      } catch {
        setError('Erro ao conectar')
        setStatus('error')
      }
    }
    init()
  }, [callToken, roomParam])

  function handleJoinClick() {
    if (!roomUrl || !token) return
    setStatus('joining')
  }

  return (
    <div className="flex flex-col" style={{ backgroundColor: '#001321', height: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {status === 'joining' || status === 'active' ? (
        callType === 'video' ? (
          <MenteeVideoCall
            roomUrl={roomUrl}
            token={token}
            status={status}
            onStatusChange={setStatus}
          />
        ) : (
          <MenteeVoiceCall
            roomUrl={roomUrl}
            token={token}
            specialistName={specialistName}
            status={status}
            onStatusChange={setStatus}
          />
        )
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="mb-8">
            <Image src="/logo.png" alt="Bethel CS" width={48} height={48} className="mx-auto" />
            <p className="mt-2 text-sm text-white/60 text-center">Bethel CS</p>
          </div>

          {status === 'error' && (
            <p className="text-white/70 text-sm text-center">{error}</p>
          )}

          {status === 'loading' && (
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-white/40 mx-auto" />
              <p className="mt-3 text-sm text-white/50">Carregando...</p>
            </div>
          )}

          {status === 'ready' && (
            <div className="text-center">
              <p className="text-white/60 text-sm">
                {callType === 'video' ? 'Videochamada com' : 'Ligação de voz com'}
              </p>
              <h1 className="text-xl font-semibold text-white mt-1">{specialistName}</h1>
              <p className="text-white/40 text-xs mt-1">está te chamando</p>
              <button
                onClick={handleJoinClick}
                className="mt-8 flex items-center justify-center gap-2 rounded-full bg-green-600 hover:bg-green-500 transition-colors text-white font-medium px-8 py-4 text-lg mx-auto"
              >
                <Phone className="h-6 w-6" />
                Entrar na ligação
              </button>
            </div>
          )}

          {status === 'ended' && (
            <div className="text-center">
              <PhoneOff className="h-10 w-10 text-white/30 mx-auto" />
              <p className="mt-3 text-white/70 text-sm">Ligação encerrada</p>
              <p className="mt-1 text-white/40 text-xs">Obrigado! Até a próxima.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Video Call (iframe) ───
function MenteeVideoCall({ roomUrl, token, status, onStatusChange }: {
  roomUrl: string
  token: string
  status: string
  onStatusChange: (s: 'joining' | 'active' | 'ended') => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const callFrameRef = useRef<ReturnType<typeof DailyIframe.createFrame> | null>(null)

  useEffect(() => {
    if (status !== 'joining' || !roomUrl || !token) return

    const timer = setTimeout(() => {
      if (!containerRef.current) return

      const frame = DailyIframe.createFrame(containerRef.current, {
        showLeaveButton: true,
        showFullscreenButton: false,
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: 'none',
        },
      })

      callFrameRef.current = frame

      const iframe = containerRef.current.querySelector('iframe')
      if (iframe) {
        iframe.setAttribute('allow', 'camera; microphone; autoplay; display-capture')
      }

      frame.on('joined-meeting', () => onStatusChange('active'))
      frame.on('left-meeting', () => {
        onStatusChange('ended')
        if (callFrameRef.current) {
          try { callFrameRef.current.destroy() } catch { /* */ }
          callFrameRef.current = null
        }
      })

      frame.join({ url: roomUrl, token, startVideoOff: false, startAudioOff: false })
    }, 100)

    return () => clearTimeout(timer)
  }, [status, roomUrl, token, onStatusChange])

  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        try { callFrameRef.current.leave() } catch { /* */ }
        try { callFrameRef.current.destroy() } catch { /* */ }
      }
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ─── Voice Call (audio-only UI) ───
function MenteeVoiceCall({ roomUrl, token, specialistName, status, onStatusChange }: {
  roomUrl: string
  token: string
  specialistName: string
  status: string
  onStatusChange: (s: 'joining' | 'active' | 'ended') => void
}) {
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [remoteCount, setRemoteCount] = useState(0)
  const [ended, setEnded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerStarted = useRef(false)
  const endedRef = useRef(false)

  const isActive = remoteCount > 0

  // Start timer when remote participant present
  useEffect(() => {
    if (isActive && !timerStarted.current) {
      timerStarted.current = true
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    }
  }, [isActive])

  const updateRemoteCount = useCallback(() => {
    const call = getActiveCall()
    if (!call) return
    try {
      const participants = call.participants()
      const remote = Object.values(participants).filter((p) => !p.local).length
      setRemoteCount(remote)
    } catch { /* */ }
  }, [])

  const doEnd = useCallback(() => {
    if (endedRef.current) return
    endedRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    setEnded(true)
    destroyCall()
    onStatusChange('ended')
  }, [onStatusChange])

  // Join call
  useEffect(() => {
    if (status !== 'joining' || !roomUrl || !token) return

    console.log('[MenteeCall] Joining room:', roomUrl)
    const call = getOrCreateCall(roomUrl)
    const meetingState = call.meetingState()

    if (meetingState === 'joined-meeting') {
      onStatusChange('active')
      updateRemoteCount()
      return
    }

    call.on('joined-meeting', () => {
      onStatusChange('active')
      updateRemoteCount()
    })
    call.on('participant-joined', () => updateRemoteCount())
    call.on('participant-updated', () => updateRemoteCount())
    call.on('participant-left', () => updateRemoteCount())
    call.on('left-meeting', () => { if (!endedRef.current) doEnd() })
    call.on('error', () => { if (!endedRef.current) doEnd() })

    call.join({ url: roomUrl, token }).catch(() => {
      setEnded(true)
      onStatusChange('ended')
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll remote count
  useEffect(() => {
    const poll = setInterval(updateRemoteCount, 2000)
    return () => clearInterval(poll)
  }, [updateRemoteCount])

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function toggleMute() {
    const call = getActiveCall()
    if (!call) return
    const next = !muted
    call.setLocalAudio(!next)
    setMuted(next)
  }

  const formatTimer = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  const callStatus = ended ? 'ended' : status === 'joining' ? 'connecting' : isActive ? 'active' : 'waiting'

  return (
    <div className="flex flex-1 flex-col landscape:flex-row items-center justify-center px-6 gap-4">
      <div className="flex flex-col items-center">
        <p className="text-xs text-white/50">Ligação de voz</p>
        <h2 className="text-xl font-semibold text-white mt-1">{specialistName}</h2>
        <p className="text-4xl font-mono text-white mt-4 landscape:mt-2 tabular">{formatTimer}</p>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {callStatus === 'connecting' && (
          <><Loader2 className="h-4 w-4 animate-spin text-white/50" /><span className="text-xs text-white/50">Conectando...</span></>
        )}
        {callStatus === 'waiting' && (
          <><span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" /><span className="text-xs text-white/50">Aguardando especialista...</span></>
        )}
        {callStatus === 'active' && (
          <><span className="h-2 w-2 rounded-full bg-green-500" /><span className="text-xs text-green-400 font-medium">Em ligação</span></>
        )}
      </div>

      {!ended && (
        <div className="mt-8 landscape:mt-4 flex items-center gap-6">
          <button
            className={`rounded-full h-14 w-14 flex items-center justify-center transition-colors ${muted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'}`}
            onClick={toggleMute}
          >
            {muted ? <MicOff className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6 text-white" />}
          </button>
          <button
            className="rounded-full h-14 w-14 flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors"
            onClick={doEnd}
          >
            <PhoneOff className="h-6 w-6 text-white" />
          </button>
        </div>
      )}
    </div>
  )
}
