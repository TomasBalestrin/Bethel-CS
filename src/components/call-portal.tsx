'use client'

import { useEffect, useRef, useCallback } from 'react'
import DailyIframe from '@daily-co/daily-js'
import { Mic, MicOff, PhoneOff, Loader2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCallStore } from '@/store/call-store'
import { useState } from 'react'

type DailyCall = ReturnType<typeof DailyIframe.createCallObject>

export function CallPortal() {
  const {
    isActive, roomUrl, token, menteeName, menteeLink,
    status, muted, seconds, remoteCount,
    endCall, setStatus, setMuted, setSeconds, setRemoteCount,
  } = useCallStore()

  const [copied, setCopied] = useState(false)
  const callRef = useRef<DailyCall | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerStarted = useRef(false)
  const endedRef = useRef(false)
  const currentRoomRef = useRef<string | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const updateRemote = useCallback(() => {
    const call = callRef.current
    if (!call) return
    try {
      const p = call.participants()
      const remote = Object.values(p).filter((x) => !x.local).length
      setRemoteCount(remote)
    } catch { /* */ }
  }, [setRemoteCount])

  const doEnd = useCallback(async () => {
    if (endedRef.current) return
    endedRef.current = true

    stopTimer()
    timerStarted.current = false

    if (callRef.current) {
      try { await callRef.current.leave() } catch { /* */ }
      try { callRef.current.destroy() } catch { /* */ }
      callRef.current = null
      currentRoomRef.current = null
    }

    const cid = useCallStore.getState().callId
    if (cid) {
      fetch('/api/calls/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: cid }),
      }).catch(() => {})
    }

    endCall()
  }, [endCall, stopTimer])

  // Start timer when remote joins
  useEffect(() => {
    if (remoteCount > 0 && status !== 'ended' && !timerStarted.current) {
      timerStarted.current = true
      setStatus('active')
      timerRef.current = setInterval(() => {
        setSeconds(useCallStore.getState().seconds + 1)
      }, 1000)
    }
  }, [remoteCount, status, setStatus, setSeconds])

  // Main effect: join/leave when isActive + roomUrl changes
  useEffect(() => {
    if (!isActive || !roomUrl || !token) return

    // Already in this room
    if (currentRoomRef.current === roomUrl && callRef.current) {
      updateRemote()
      return
    }

    // Cleanup previous call if different room
    if (callRef.current) {
      try { callRef.current.leave() } catch { /* */ }
      try { callRef.current.destroy() } catch { /* */ }
      callRef.current = null
    }

    endedRef.current = false
    timerStarted.current = false
    stopTimer()
    currentRoomRef.current = roomUrl

    console.log('[CallPortal] Joining room:', roomUrl)
    const call = DailyIframe.createCallObject({ audioSource: true, videoSource: false })
    callRef.current = call

    call.on('joined-meeting', () => {
      console.log('[CallPortal] joined-meeting')
      setStatus('waiting')
      updateRemote()
    })
    call.on('participant-joined', () => updateRemote())
    call.on('participant-updated', () => updateRemote())
    call.on('participant-left', () => {
      updateRemote()
      // If all remotes left, end
      const p = call.participants()
      const remote = Object.values(p).filter((x) => !x.local).length
      if (remote === 0 && timerStarted.current) doEnd()
    })
    call.on('left-meeting', () => doEnd())
    call.on('error', () => doEnd())

    call.join({ url: roomUrl, token }).then(() => {
      console.log('[CallPortal] join() resolved')
    }).catch((err) => {
      console.error('[CallPortal] join() failed:', err)
      endCall()
    })

    // Polling fallback
    const poll = setInterval(updateRemote, 2000)

    return () => {
      clearInterval(poll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, roomUrl, token])

  // Cleanup on unmount (should never happen since it's in layout)
  useEffect(() => {
    return () => {
      stopTimer()
      if (callRef.current) {
        try { callRef.current.leave() } catch { /* */ }
        try { callRef.current.destroy() } catch { /* */ }
      }
    }
  }, [stopTimer])

  function toggleMute() {
    const call = callRef.current
    if (!call) return
    const next = !muted
    call.setLocalAudio(!next)
    setMuted(next)
  }

  if (!isActive) return null

  const fmt = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  const displayStatus = status === 'ended' ? 'ended' : remoteCount > 0 ? 'active' : status

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] w-[320px] rounded-2xl shadow-2xl overflow-hidden"
      style={{ backgroundColor: '#060A16' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-white/60 text-xs">Ligação com</p>
        <p className="text-white font-semibold text-sm">{menteeName}</p>
      </div>

      {/* Timer + Status */}
      <div className="px-4 pb-2 flex items-center justify-between">
        <span className="text-white font-mono text-lg tabular">{fmt}</span>
        <div className="flex items-center gap-1.5">
          {displayStatus === 'connecting' && (
            <><Loader2 className="h-3 w-3 animate-spin text-white/50" /><span className="text-[11px] text-white/50">Conectando</span></>
          )}
          {displayStatus === 'waiting' && (
            <><span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" /><span className="text-[11px] text-white/50">Aguardando</span></>
          )}
          {displayStatus === 'active' && (
            <><span className="h-2 w-2 rounded-full bg-green-500" /><span className="text-[11px] text-green-400">Em ligação</span></>
          )}
          {displayStatus === 'ended' && (
            <span className="text-[11px] text-white/40">Encerrada</span>
          )}
        </div>
      </div>

      {/* Mentee link — while waiting */}
      {(displayStatus === 'waiting' || displayStatus === 'connecting') && menteeLink && (
        <div className="mx-4 mb-2 rounded-lg bg-white/5 border border-white/10 p-2.5 space-y-1.5">
          <p className="text-[10px] text-white/40">Link para o mentorado:</p>
          <div className="flex items-center gap-1.5">
            <code className="flex-1 text-[10px] text-white/80 bg-white/5 rounded px-1.5 py-1 truncate">
              {menteeLink}
            </code>
            <Button
              size="sm" variant="ghost"
              className="h-7 px-2 text-[10px] text-white/60 hover:text-white hover:bg-white/10"
              onClick={() => { navigator.clipboard.writeText(menteeLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 px-4 pb-4 pt-2">
        <button
          onClick={toggleMute}
          className={`rounded-full h-11 w-11 flex items-center justify-center transition-colors ${
            muted ? 'bg-red-600' : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          {muted ? <MicOff className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4 text-white" />}
        </button>
        <button
          onClick={doEnd}
          className="rounded-full h-11 w-11 flex items-center justify-center bg-red-600 hover:bg-red-500 transition-colors"
        >
          <PhoneOff className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  )
}
