'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import DailyIframe from '@daily-co/daily-js'
import { Mic, MicOff, PhoneOff, Phone, Loader2 } from 'lucide-react'
import Image from 'next/image'

export default function MenteeCallPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const callToken = params.callToken as string

  const [status, setStatus] = useState<'loading' | 'ready' | 'connecting' | 'active' | 'ended' | 'error'>('loading')
  const [specialistName, setSpecialistName] = useState('')
  const [roomName, setRoomName] = useState('')
  const [token, setToken] = useState('')
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const callRef = useRef<ReturnType<typeof DailyIframe.createCallObject> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch token
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
        setToken(data.token)
        setRoomName(data.roomName)
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
    setStatus('connecting')

    const dailyDomain = process.env.NEXT_PUBLIC_DAILY_DOMAIN || ''
    const url = `https://${dailyDomain}/${roomName}`

    const call = DailyIframe.createCallObject({ audioSource: true, videoSource: false })
    callRef.current = call

    call.on('joined-meeting', () => setStatus('active'))

    call.on('participant-joined', (event) => {
      if (event?.participant && !event.participant.local) {
        startTimer()
      }
    })

    call.on('participant-left', (event) => {
      if (event?.participant && !event.participant.local) {
        handleEnd()
      }
    })

    call.on('error', () => handleEnd())

    // Start timer immediately on join (specialist is likely already there)
    call.on('joined-meeting', () => startTimer())

    await call.join({ url, token })
  }

  async function handleEnd() {
    stopTimer()
    setStatus('ended')
    if (callRef.current) {
      await callRef.current.leave().catch(() => {})
      callRef.current.destroy()
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
      {/* Logo */}
      <div className="mb-8">
        <Image src="/logo.png" alt="Bethel CS" width={48} height={48} className="mx-auto" />
        <p className="mt-2 text-sm text-white/60 text-center">Bethel CS</p>
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="text-center">
          <p className="text-white/70 text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/40 mx-auto" />
          <p className="mt-3 text-sm text-white/50">Carregando...</p>
        </div>
      )}

      {/* Ready — show join button */}
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

      {/* Connecting */}
      {status === 'connecting' && (
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/40 mx-auto" />
          <p className="mt-3 text-sm text-white/50">Conectando...</p>
        </div>
      )}

      {/* Active call */}
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

      {/* Ended */}
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
