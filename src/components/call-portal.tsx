'use client'

import { useEffect, useRef, useCallback } from 'react'
import DailyIframe from '@daily-co/daily-js'
import { useCallStore } from '@/store/call-store'
import { CallInterface } from '@/components/kanban/call-interface'
import { toast } from 'sonner'

export function CallPortal() {
  const isActive = useCallStore((s) => s.isActive)
  const roomUrl = useCallStore((s) => s.roomUrl)
  const token = useCallStore((s) => s.token)
  const callId = useCallStore((s) => s.callId)
  const menteeName = useCallStore((s) => s.menteeName)
  const menteeLink = useCallStore((s) => s.menteeLink)
  const callType = useCallStore((s) => s.callType)

  if (!isActive) return null

  if (callType === 'video' && roomUrl && token) {
    return (
      <VideoCallPortal
        roomUrl={roomUrl!}
        token={token!}
        menteeName={menteeName!}
        menteeLink={menteeLink!}
      />
    )
  }

  return (
    <VoiceCallPortal
      roomUrl={roomUrl!}
      token={token!}
      callId={callId!}
      menteeName={menteeName!}
      menteeLink={menteeLink!}
    />
  )
}

// ─── Video Call (iframe) ───
function VideoCallPortal({ roomUrl, token, menteeName, menteeLink }: {
  roomUrl: string
  token: string
  menteeName: string
  menteeLink: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const callFrameRef = useRef<ReturnType<typeof DailyIframe.createFrame> | null>(null)
  const joinedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!roomUrl || !token || !containerRef.current) return
    if (joinedRef.current === roomUrl) return

    joinedRef.current = roomUrl

    // Cleanup previous frame
    if (callFrameRef.current) {
      try { callFrameRef.current.leave() } catch { /* */ }
      try { callFrameRef.current.destroy() } catch { /* */ }
      callFrameRef.current = null
    }

    const frame = DailyIframe.createFrame(containerRef.current, {
      showLeaveButton: true,
      showFullscreenButton: false,
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: '0 0 16px 16px',
      },
    })

    callFrameRef.current = frame

    const iframe = containerRef.current.querySelector('iframe')
    if (iframe) {
      iframe.setAttribute('allow', 'camera; microphone; autoplay; display-capture')
    }

    frame.on('joined-meeting', () => {
      console.log('[CallPortal/Video] Joined meeting — cloud recording enabled at room level')
    })

    frame.on('left-meeting', () => {
      const cid = useCallStore.getState().callId
      if (cid) {
        fetch('/api/calls/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: cid }),
        }).catch(() => {})

        let attempts = 0
        const recordingPoll = setInterval(async () => {
          attempts++
          if (attempts > 40) {
            clearInterval(recordingPoll)
            // Mark as failed in DB
            fetch('/api/calls/check-recording', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callId: cid, markFailed: true }),
            }).catch(() => {})
            toast.error('Gravação não encontrada. Verifique no histórico de ligações.')
            return
          }
          try {
            const res = await fetch('/api/calls/check-recording', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callId: cid }),
            })
            const data = await res.json()
            if (data.status === 'ready') {
              clearInterval(recordingPoll)
              toast.success('Gravação da ligação disponível')
            } else if (data.status === 'failed') {
              clearInterval(recordingPoll)
              toast.error('Falha na gravação da ligação')
            }
          } catch { /* network error, retry */ }
        }, 15000)
      }
      joinedRef.current = null
      if (callFrameRef.current) {
        try { callFrameRef.current.destroy() } catch { /* */ }
        callFrameRef.current = null
      }
      useCallStore.getState().endCall()
    })

    frame.join({
      url: roomUrl,
      token,
      startVideoOff: false,
      startAudioOff: false,
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl, token])

  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        try { callFrameRef.current.leave() } catch { /* */ }
        try { callFrameRef.current.destroy() } catch { /* */ }
        callFrameRef.current = null
      }
    }
  }, [])

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] w-[340px] rounded-2xl overflow-hidden"
      style={{
        backgroundColor: '#001321',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        height: 420,
      }}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-white/60 text-xs">Videochamada com</p>
          <p className="text-white font-semibold text-sm">{menteeName}</p>
        </div>
        {menteeLink && (
          <button
            onClick={() => navigator.clipboard.writeText(menteeLink)}
            className="text-[10px] text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded bg-white/5 hover:bg-white/10"
          >
            Copiar link
          </button>
        )}
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 'calc(100% - 52px)' }} />
    </div>
  )
}

// ─── Voice Call (compact floating card) ───
function VoiceCallPortal({ roomUrl, token, callId, menteeName, menteeLink }: {
  roomUrl: string
  token: string
  callId: string
  menteeName: string
  menteeLink: string
}) {
  const endCall = useCallStore((s) => s.endCall)

  const handleEnd = useCallback(() => {
    // Poll for recording after ending
    let attempts = 0
    const recordingPoll = setInterval(async () => {
      attempts++
      if (attempts > 40) {
        clearInterval(recordingPoll)
        fetch('/api/calls/check-recording', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId, markFailed: true }),
        }).catch(() => {})
        toast.error('Gravação não encontrada. Verifique no histórico de ligações.')
        return
      }
      try {
        const res = await fetch('/api/calls/check-recording', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId }),
        })
        const data = await res.json()
        if (data.status === 'ready') {
          clearInterval(recordingPoll)
          toast.success('Gravação da ligação disponível')
        } else if (data.status === 'failed') {
          clearInterval(recordingPoll)
          toast.error('Falha na gravação da ligação')
        }
      } catch { /* network error, retry */ }
    }, 15000)

    endCall()
  }, [callId, endCall])

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] w-[340px] rounded-2xl overflow-hidden"
      style={{
        backgroundColor: '#001321',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        height: 360,
      }}
    >
      <CallInterface
        roomUrl={roomUrl}
        token={token}
        callId={callId}
        menteeName={menteeName}
        menteeLink={menteeLink}
        onEnd={handleEnd}
      />
    </div>
  )
}
