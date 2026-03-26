'use client'

import { useEffect, useState, useRef, useCallback, memo } from 'react'
import { Mic, MicOff, PhoneOff, Loader2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const timerStarted = useRef(false)
  const endedRef = useRef(false)
  const callIdRef = useRef(callId)
  const onEndRef = useRef(onEnd)

  callIdRef.current = callId
  onEndRef.current = onEnd

  const isActive = remoteCount > 0 && joined

  // Start timer when active
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

    const call = getOrCreateCall()

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
    <div className="flex flex-col items-center justify-center h-full bg-background py-8">
      <p className="text-sm text-muted-foreground">Ligação com</p>
      <h2 className="text-xl font-semibold text-foreground mt-1">{menteeName}</h2>
      <p className="text-2xl font-mono text-foreground mt-4 tabular">{formatTimer}</p>

      <div className="mt-6 flex items-center gap-2">
        {status === 'connecting' && (
          <><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">Conectando...</span></>
        )}
        {status === 'waiting' && (
          <><span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" /><span className="text-sm text-muted-foreground">Aguardando mentorado entrar...</span></>
        )}
        {status === 'active' && (
          <><span className="h-2 w-2 rounded-full bg-green-500" /><span className="text-sm text-green-600 font-medium">Em ligação</span></>
        )}
        {status === 'ended' && <span className="text-sm text-muted-foreground">Ligação encerrada</span>}
      </div>

      {(status === 'waiting' || status === 'connecting') && menteeLink && (
        <div className="mt-6 w-full max-w-sm rounded-lg bg-muted/50 border border-border p-3 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Link para o mentorado:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] text-foreground bg-background rounded px-2 py-1.5 truncate border border-border">
              {menteeLink}
            </code>
            <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1 text-xs"
              onClick={() => { navigator.clipboard.writeText(menteeLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
              {copied ? <><Check className="h-3 w-3" /> Copiado!</> : <><Copy className="h-3 w-3" /> Copiar</>}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Envie este link para o mentorado entrar na ligação</p>
        </div>
      )}

      {status !== 'ended' && (
        <div className="mt-10 flex items-center gap-6">
          <Button size="lg" variant={muted ? 'destructive' : 'outline'} className="rounded-full h-14 w-14" onClick={toggleMute}>
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button size="lg" variant="destructive" className="rounded-full h-14 w-14" onClick={doEnd}>
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  )
})
