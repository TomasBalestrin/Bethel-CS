'use client'

import { useEffect, useState, useRef, useCallback, memo } from 'react'
import { Mic, MicOff, PhoneOff, Loader2 } from 'lucide-react'
import { destroyCall, getActiveCall, forceNewCall } from '@/lib/daily-call'

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
  const audioRef = useRef<HTMLAudioElement>(null)

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

    // Check if we have an existing call for this room
    let call = getActiveCall()
    if (call) {
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
    }

    // Force new call object to ensure clean audio state
    call = forceNewCall(roomUrl)

    console.log('[Call] Joining room:', roomUrl)

    call.on('joined-meeting', () => {
      console.log('[Call] joined-meeting — cloud recording enabled at room level')
      setJoined(true)
      updateRemoteCount()
      // Ensure audio is active
      call!.setLocalAudio(true)
    })
    call.on('participant-joined', () => updateRemoteCount())
    call.on('participant-updated', (ev) => {
      updateRemoteCount()
      // Attach remote audio track when available
      if (ev?.participant && !ev.participant.local && ev.participant.tracks?.audio?.persistentTrack) {
        const track = ev.participant.tracks.audio.persistentTrack
        if (audioRef.current && audioRef.current.srcObject !== track.mediaStream) {
          const stream = new MediaStream([track])
          audioRef.current.srcObject = stream
          audioRef.current.play().catch(() => {})
          console.log('[Call] Remote audio track attached')
        }
      }
    })
    call.on('participant-left', () => {
      updateRemoteCount()
      if (audioRef.current) audioRef.current.srcObject = null
    })
    call.on('left-meeting', () => {
      console.log('[Call] left-meeting')
      if (!endedRef.current) doEnd()
    })
    call.on('error', (e) => {
      console.error('[Call] error:', e)
      if (!endedRef.current) doEnd()
    })

    // Request mic permission then join
    call.startCamera({ audioSource: true, videoSource: false }).then(() => {
      console.log('[Call] Mic permission granted, joining...')
      call!.join({ url: roomUrl, token, startAudioOff: false, startVideoOff: true })
    }).catch(() => {
      // Fallback: join without pre-requesting camera
      console.log('[Call] startCamera failed, joining directly...')
      call!.join({ url: roomUrl, token, startAudioOff: false, startVideoOff: true })
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
      {/* Hidden audio element for remote participant audio playback */}
      <audio ref={audioRef} autoPlay playsInline />
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
