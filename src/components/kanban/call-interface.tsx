'use client'

import { useEffect, useState, useRef, useCallback, memo } from 'react'
import { Mic, MicOff, PhoneOff, Loader2 } from 'lucide-react'
import { getOrCreateCall, destroyCall, getActiveCall } from '@/lib/daily-call'

interface CallInterfaceProps {
  roomUrl: string
  token: string
  callId: string
  menteeName: string
  menteeLink: string
  onEnd: () => void
}

export const CallInterface = memo(function CallInterface({
  roomUrl,
  token,
  callId,
  menteeName,
  menteeLink,
  onEnd,
}: CallInterfaceProps) {
  const [joined, setJoined] = useState(false)
  const [remoteCount, setRemoteCount] = useState(0)
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [ended, setEnded] = useState(false)
  const [copied, setCopied] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endedRef = useRef(false)
  const callIdRef = useRef(callId)
  const onEndRef = useRef(onEnd)

  callIdRef.current = callId
  onEndRef.current = onEnd

  const isActive = remoteCount > 0 && joined

  // Start/stop timer based on active state
  useEffect(() => {
    if (isActive && !timerRef.current) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } else if (!isActive && timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [isActive])

  const updateRemoteCount = useCallback(() => {
    const call = getActiveCall()
    if (!call) return
    try {
      const participants = call.participants()
      const remote = Object.values(participants).filter((p) => !p.local).length
      setRemoteCount(remote)
    } catch {
      // call may be destroyed
    }
  }, [])

  const doEnd = useCallback(async () => {
    if (endedRef.current) return
    endedRef.current = true

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    setEnded(true)
    destroyCall()

    fetch('/api/calls/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId: callIdRef.current }),
    }).catch(() => {})

    setTimeout(() => onEndRef.current(), 1500)
  }, [])

  // Single mount — join call using singleton
  useEffect(() => {
    if (!roomUrl || !token) return

    const call = getOrCreateCall(roomUrl)

    // If already joined (remount), just update state
    const meetingState = call.meetingState()
    if (meetingState === 'joined-meeting') {
      console.log('[Call] Already joined, restoring state')
      setJoined(true)
      updateRemoteCount()
      return
    }

    if (meetingState === 'joining-meeting') {
      console.log('[Call] Already joining, waiting...')
      call.on('joined-meeting', () => {
        setJoined(true)
        updateRemoteCount()
      })
      return
    }

    console.log('[Call] Joining room:', roomUrl)

    call.on('joined-meeting', () => {
      console.log('[Call] joined-meeting')
      setJoined(true)
      updateRemoteCount()
      // Start cloud recording automatically
      try {
        call.startRecording()
        console.log('[Call] Cloud recording started')
      } catch (err) {
        console.error('[Call] Failed to start recording:', err)
      }
    })
    call.on('participant-joined', () => updateRemoteCount())
    call.on('participant-updated', () => updateRemoteCount())
    call.on('participant-left', () => updateRemoteCount())
    call.on('left-meeting', () => {
      console.log('[Call] left-meeting')
      if (!endedRef.current) doEnd()
    })
    call.on('error', (e) => {
      console.error('[Call] error:', e)
      if (!endedRef.current) doEnd()
    })

    call.join({ url: roomUrl, token }).then(() => {
      console.log('[Call] join() resolved')
    }).catch((err) => {
      console.error('[Call] join() failed:', err)
      setEnded(true)
    })

    // DO NOT destroy call on unmount — singleton persists
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Polling fallback every 2s
  useEffect(() => {
    const poll = setInterval(updateRemoteCount, 2000)
    return () => clearInterval(poll)
  }, [updateRemoteCount])

  // Cleanup timer on unmount (but NOT the call)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function toggleMute() {
    const call = getActiveCall()
    if (!call) return
    const next = !muted
    call.setLocalAudio(!next)
    setMuted(next)
  }

  const formatTimer = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  const status = ended ? 'ended' : !joined ? 'connecting' : isActive ? 'active' : 'waiting'

  return (
    <div className="flex flex-col items-center justify-center h-full py-6 px-4">
      <p className="text-xs text-white/50">Ligação de voz</p>
      <h2 className="text-lg font-semibold text-white mt-1">{menteeName}</h2>
      <p className="text-3xl font-mono text-white mt-4 tabular">{formatTimer}</p>

      <div className="mt-4 flex items-center gap-2">
        {status === 'connecting' && (
          <><Loader2 className="h-4 w-4 animate-spin text-white/50" /><span className="text-xs text-white/50">Conectando...</span></>
        )}
        {status === 'waiting' && (
          <><span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" /><span className="text-xs text-white/50">Aguardando mentorado...</span></>
        )}
        {status === 'active' && (
          <><span className="h-2 w-2 rounded-full bg-green-500" /><span className="text-xs text-green-400 font-medium">Em ligação</span></>
        )}
        {status === 'ended' && <span className="text-xs text-white/50">Ligação encerrada</span>}
      </div>

      {(status === 'waiting' || status === 'connecting') && menteeLink && (
        <div className="mt-4 w-full rounded-lg bg-white/5 border border-white/10 p-2.5 space-y-1.5">
          <p className="text-[10px] text-white/40 font-medium">Link para o mentorado:</p>
          <div className="flex items-center gap-1.5">
            <code className="flex-1 text-[10px] text-white/70 bg-white/5 rounded px-2 py-1 truncate">
              {menteeLink}
            </code>
            <button
              className="shrink-0 text-[10px] text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded bg-white/5 hover:bg-white/10"
              onClick={() => { navigator.clipboard.writeText(menteeLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      {status !== 'ended' && (
        <div className="mt-8 flex items-center gap-5">
          <button
            className={`rounded-full h-12 w-12 flex items-center justify-center transition-colors ${muted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'}`}
            onClick={toggleMute}
          >
            {muted ? <MicOff className="h-5 w-5 text-white" /> : <Mic className="h-5 w-5 text-white" />}
          </button>
          <button
            className="rounded-full h-12 w-12 flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors"
            onClick={doEnd}
          >
            <PhoneOff className="h-5 w-5 text-white" />
          </button>
        </div>
      )}
    </div>
  )
})
