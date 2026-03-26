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
  const [joined, setJoined] = useState(false)
  const [remoteCount, setRemoteCount] = useState(0)
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [ended, setEnded] = useState(false)
  const [copied, setCopied] = useState(false)

  const callRef = useRef<ReturnType<typeof DailyIframe.createCallObject> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerStarted = useRef(false)
  const endedRef = useRef(false)
  const roomUrlRef = useRef(roomUrl)
  const tokenRef = useRef(token)
  const callIdRef = useRef(callId)
  const onEndRef = useRef(onEnd)

  // Keep refs in sync without causing re-renders
  roomUrlRef.current = roomUrl
  tokenRef.current = token
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
    const call = callRef.current
    if (!call) return
    try {
      const participants = call.participants()
      const remote = Object.values(participants).filter((p) => !p.local).length
      console.log('[Call] poll remoteCount:', remote, 'participants:', Object.keys(participants).length)
      setRemoteCount(remote)
    } catch (err) {
      console.warn('[Call] participants() failed:', err)
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

    const call = callRef.current
    if (call) {
      try { await call.leave() } catch { /* ignore */ }
      try { call.destroy() } catch { /* ignore */ }
      callRef.current = null
    }

    fetch('/api/calls/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId: callIdRef.current }),
    }).catch(() => {})

    setTimeout(() => onEndRef.current(), 1500)
  }, [])

  // Single useEffect — empty deps — runs once on mount
  useEffect(() => {
    const url = roomUrlRef.current
    const tok = tokenRef.current

    if (!url || !tok) {
      console.warn('[Call] Missing roomUrl or token')
      return
    }

    console.log('[Call] Creating call object, url:', url)
    const call = DailyIframe.createCallObject({ audioSource: true, videoSource: false })
    callRef.current = call

    call.on('joining-meeting', () => console.log('[Call] joining-meeting'))
    call.on('joined-meeting', () => {
      console.log('[Call] joined-meeting')
      setJoined(true)
      updateRemoteCount()
    })
    call.on('participant-joined', () => updateRemoteCount())
    call.on('participant-updated', () => updateRemoteCount())
    call.on('participant-left', () => updateRemoteCount())
    call.on('left-meeting', () => { console.log('[Call] left-meeting'); doEnd() })
    call.on('error', (e) => { console.error('[Call] error', e); doEnd() })

    call.join({ url, token: tok }).then(() => {
      console.log('[Call] join() resolved')
    }).catch((err) => {
      console.error('[Call] join() failed:', err)
      setEnded(true)
    })

    // Polling fallback every 2s
    const poll = setInterval(updateRemoteCount, 2000)

    return () => {
      clearInterval(poll)
      if (timerRef.current) clearInterval(timerRef.current)
      const c = callRef.current
      if (c) {
        try { c.leave() } catch { /* */ }
        try { c.destroy() } catch { /* */ }
        callRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleMute() {
    const call = callRef.current
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
}
