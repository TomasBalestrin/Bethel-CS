'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import DailyIframe from '@daily-co/daily-js'
import { Mic, MicOff, PhoneOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CallInterfaceProps {
  roomUrl: string
  token: string
  callId: string
  menteeName: string
  onEnd: () => void
}

export function CallInterface({ roomUrl, token, callId, menteeName, onEnd }: CallInterfaceProps) {
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'active' | 'ended'>('connecting')
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
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

    call.on('joined-meeting', () => setStatus('waiting'))

    call.on('participant-joined', (event) => {
      if (event?.participant && !event.participant.local) {
        setStatus('active')
        startTimer()
      }
    })

    call.on('participant-left', (event) => {
      if (event?.participant && !event.participant.local) {
        handleEnd()
      }
    })

    call.on('error', () => handleEnd())

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
