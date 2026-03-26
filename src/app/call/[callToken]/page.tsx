'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import DailyIframe from '@daily-co/daily-js'
import { Mic, MicOff, PhoneOff, Phone, Loader2 } from 'lucide-react'
import Image from 'next/image'

export default function MenteeCallPage() {
  const params = useParams()
  const callToken = params.callToken as string

  const [status, setStatus] = useState<'loading' | 'ready' | 'connecting' | 'active' | 'ended' | 'error'>('loading')
  const [specialistName, setSpecialistName] = useState('')
  const [roomUrl, setRoomUrl] = useState('')
  const [token, setToken] = useState('')
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const callRef = useRef<ReturnType<typeof DailyIframe.createCallObject> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch token + roomUrl from API
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/calls/mentee-token/${callToken}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error || 'Link inválido ou ligação encerrada')
          setStatus('error')
          return
        }
        const data = await res.json()
        console.log('[Mentee] API response:', { roomName: data.roomName, roomUrl: data.roomUrl, specialistName: data.specialistName })
        setToken(data.token)
        setRoomUrl(data.roomUrl)
        setSpecialistName(data.specialistName)
        setStatus('ready')
      } catch {
        setError('Erro ao conectar')
        setStatus('error')
      }
    }
    init()
  }, [callToken])

  function startTimer() {
    if (timerRef.current) return
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  async function joinCall() {
    if (!roomUrl || !token) return
    setStatus('connecting')

    console.log('[Mentee] Joining room:', roomUrl)

    const call = DailyIframe.createCallObject({ audioSource: true, videoSource: false })
    callRef.current = call

    call.on('joined-meeting', () => {
      console.log('[Mentee] joined-meeting')
      setStatus('active')
      startTimer()
    })

    call.on('participant-left', (event) => {
      if (event?.participant && !event.participant.local) {
        handleEnd()
      }
    })

    call.on('error', (e) => {
      console.error('[Mentee] error:', e)
      handleEnd()
    })

    try {
      await call.join({ url: roomUrl, token })
      console.log('[Mentee] join() resolved')
    } catch (err) {
      console.error('[Mentee] join() failed:', err)
      setError('Erro ao entrar na ligação')
      setStatus('error')
    }
  }

  async function handleEnd() {
    stopTimer()
    setStatus('ended')
    if (callRef.current) {
      try { await callRef.current.leave() } catch { /* */ }
      try { callRef.current.destroy() } catch { /* */ }
      callRef.current = null
    }
  }

  function toggleMute() {
    if (!callRef.current) return
    const next = !muted
    callRef.current.setLocalAudio(!next)
    setMuted(next)
  }

  const formatTimer = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`

  return (
    <div className="flex min-h-screen flex-col items-center justify-center" style={{ backgroundColor: '#060A16' }}>
      <div className="mb-8">
        <Image src="/logo.png" alt="Bethel CS" width={48} height={48} className="mx-auto" />
        <p className="mt-2 text-sm text-white/60 text-center">Bethel CS</p>
      </div>

      {status === 'error' && (
        <div className="text-center">
          <p className="text-white/70 text-sm">{error}</p>
        </div>
      )}

      {status === 'loading' && (
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/40 mx-auto" />
          <p className="mt-3 text-sm text-white/50">Carregando...</p>
        </div>
      )}

      {status === 'ready' && (
        <div className="text-center">
          <p className="text-white/60 text-sm">Ligação com</p>
          <h1 className="text-xl font-semibold text-white mt-1">{specialistName}</h1>
          <p className="text-white/40 text-xs mt-1">está te chamando</p>
          <button
            onClick={joinCall}
            className="mt-8 flex items-center justify-center gap-2 rounded-full bg-green-600 hover:bg-green-500 transition-colors text-white font-medium px-8 py-4 text-lg mx-auto"
          >
            <Phone className="h-6 w-6" />
            Entrar na ligação
          </button>
        </div>
      )}

      {status === 'connecting' && (
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/40 mx-auto" />
          <p className="mt-3 text-sm text-white/50">Conectando...</p>
        </div>
      )}

      {status === 'active' && (
        <div className="text-center">
          <p className="text-white/60 text-sm">Em ligação com</p>
          <h1 className="text-xl font-semibold text-white mt-1">{specialistName}</h1>
          <p className="text-3xl font-mono text-white mt-6 tabular">{formatTimer}</p>
          <div className="mt-10 flex items-center justify-center gap-6">
            <button
              onClick={toggleMute}
              className={`rounded-full h-14 w-14 flex items-center justify-center transition-colors ${
                muted ? 'bg-red-600 hover:bg-red-500' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {muted ? <MicOff className="h-5 w-5 text-white" /> : <Mic className="h-5 w-5 text-white" />}
            </button>
            <button
              onClick={handleEnd}
              className="rounded-full h-14 w-14 flex items-center justify-center bg-red-600 hover:bg-red-500 transition-colors"
            >
              <PhoneOff className="h-5 w-5 text-white" />
            </button>
          </div>
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
  )
}
