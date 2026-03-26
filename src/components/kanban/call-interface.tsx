'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import DailyIframe from '@daily-co/daily-js'
import { Mic, MicOff, PhoneOff, Loader2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CallInterfaceProps {
  roomUrl: string
  token: string
  callId: string
  menteeName: string
  menteeLink: string
  onEnd: () => void
}

export function CallInterface({ roomUrl, token, callId, menteeName, menteeLink, onEnd }: CallInterfaceProps) {
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'active' | 'ended'>('connecting')
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [copied, setCopied] = useState(false)
  const callRef = useRef<ReturnType<typeof DailyIframe.createCallObject> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = useCallback(() => {
    if (timerRef.current) return
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    const call = DailyIframe.createCallObject({ audioSource: true, videoSource: false })
    callRef.current = call

    call.on('joined-meeting', () => {
      console.log('[Call] Local joined meeting')
      setStatus('waiting')

      // Check if remote participants already in room
      const participants = call.participants()
      const remoteCount = Object.values(participants).filter((p) => !p.local).length
      if (remoteCount > 0) {
        setStatus('active')
        startTimer()
      }
    })

    // participant-joined fires when a new participant connects
    call.on('participant-joined', (event) => {
      console.log('[Call] participant-joined', event?.participant?.user_id, 'local:', event?.participant?.local)
      if (event?.participant && !event.participant.local) {
        setStatus('active')
        startTimer()
      }
    })

    // participant-updated fires when participant state changes (audio/video toggle etc)
    call.on('participant-updated', () => {
      const participants = call.participants()
      const remoteCount = Object.values(participants).filter((p) => !p.local).length
      if (remoteCount > 0) {
        setStatus((prev) => {
          if (prev === 'waiting' || prev === 'connecting') {
            startTimer()
            return 'active'
          }
          return prev
        })
      }
    })

    call.on('participant-left', (event) => {
      console.log('[Call] participant-left', event?.participant?.user_id, 'local:', event?.participant?.local)
      if (event?.participant && !event.participant.local) {
        // Check if any remote participants remain
        const participants = call.participants()
        const remoteCount = Object.values(participants).filter((p) => !p.local).length
        if (remoteCount === 0) {
          handleEnd()
        }
      }
    })

    call.on('left-meeting', () => {
      console.log('[Call] left-meeting')
      handleEnd()
    })

    call.on('error', (err) => {
      console.error('[Call] error', err)
      handleEnd()
    })

    call.join({ url: roomUrl, token })

    return () => {
      stopTimer()
      call.leave().catch(() => {})
      call.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl, token])

  async function handleEnd() {
    stopTimer()
    setStatus('ended')

    if (callRef.current) {
      await callRef.current.leave().catch(() => {})
      callRef.current.destroy()
      callRef.current = null
    }

    // End call on server
    await fetch('/api/calls/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId }),
    }).catch(() => {})

    setTimeout(onEnd, 1500)
  }

  function toggleMute() {
    if (!callRef.current) return
    const next = !muted
    callRef.current.setLocalAudio(!next)
    setMuted(next)
  }

  const formatTimer = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`

  return (
    <div className="flex flex-col items-center justify-center h-full bg-background py-8">
      {/* Header */}
      <p className="text-sm text-muted-foreground">Ligação com</p>
      <h2 className="text-xl font-semibold text-foreground mt-1">{menteeName}</h2>

      {/* Timer */}
      <p className="text-2xl font-mono text-foreground mt-4 tabular">{formatTimer}</p>

      {/* Status */}
      <div className="mt-6 flex items-center gap-2">
        {status === 'connecting' && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Conectando...</span>
          </>
        )}
        {status === 'waiting' && (
          <>
            <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-sm text-muted-foreground">Aguardando mentorado entrar...</span>
          </>
        )}
        {status === 'active' && (
          <>
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-green-600 font-medium">Em ligação</span>
          </>
        )}
        {status === 'ended' && (
          <span className="text-sm text-muted-foreground">Ligação encerrada</span>
        )}
      </div>

      {/* Mentee link — show while waiting */}
      {(status === 'waiting' || status === 'connecting') && menteeLink && (
        <div className="mt-6 w-full max-w-sm rounded-lg bg-muted/50 border border-border p-3 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Link para o mentorado:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] text-foreground bg-background rounded px-2 py-1.5 truncate border border-border">
              {menteeLink}
            </code>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1 text-xs"
              onClick={() => {
                navigator.clipboard.writeText(menteeLink)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? <><Check className="h-3 w-3" /> Copiado!</> : <><Copy className="h-3 w-3" /> Copiar</>}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Envie este link para o mentorado entrar na ligação</p>
        </div>
      )}

      {/* Controls */}
      {status !== 'ended' && (
        <div className="mt-10 flex items-center gap-6">
          <Button
            size="lg"
            variant={muted ? 'destructive' : 'outline'}
            className="rounded-full h-14 w-14"
            onClick={toggleMute}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>

          <Button
            size="lg"
            variant="destructive"
            className="rounded-full h-14 w-14"
            onClick={handleEnd}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  )
}
