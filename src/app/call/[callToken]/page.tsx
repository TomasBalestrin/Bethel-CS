'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import DailyIframe from '@daily-co/daily-js'
import { Phone, Loader2, PhoneOff } from 'lucide-react'
import Image from 'next/image'

export default function MenteeCallPage() {
  const params = useParams()
  const callToken = params.callToken as string

  const [status, setStatus] = useState<'loading' | 'ready' | 'joining' | 'active' | 'ended' | 'error'>('loading')
  const [specialistName, setSpecialistName] = useState('')
  const [roomUrl, setRoomUrl] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const callFrameRef = useRef<ReturnType<typeof DailyIframe.createFrame> | null>(null)

  // Fetch token + roomUrl
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

  // When status changes to 'joining', create iframe and join
  useEffect(() => {
    if (status !== 'joining' || !roomUrl || !token) return

    // Wait for next tick so containerRef is in the DOM
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

      frame.on('joined-meeting', () => {
        setStatus('active')
      })

      frame.on('left-meeting', () => {
        setStatus('ended')
        if (callFrameRef.current) {
          try { callFrameRef.current.destroy() } catch { /* */ }
          callFrameRef.current = null
        }
      })

      frame.join({ url: roomUrl, token, startVideoOff: true, startAudioOff: false })
    }, 100)

    return () => clearTimeout(timer)
  }, [status, roomUrl, token])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        try { callFrameRef.current.leave() } catch { /* */ }
        try { callFrameRef.current.destroy() } catch { /* */ }
      }
    }
  }, [])

  function handleJoinClick() {
    if (!roomUrl || !token) return
    setStatus('joining')
  }

  return (
    <div className="flex flex-col" style={{ backgroundColor: '#001321', height: '100dvh' }}>
      {/* Iframe container — always in DOM, visible when joining/active */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: status === 'joining' || status === 'active' ? 'block' : 'none',
        }}
      />

      {/* Non-active states — centered content */}
      {status !== 'joining' && status !== 'active' && (
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
              <p className="text-white/60 text-sm">Ligação com</p>
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
