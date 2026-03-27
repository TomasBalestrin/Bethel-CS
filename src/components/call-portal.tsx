'use client'

import { useEffect, useRef } from 'react'
import DailyIframe from '@daily-co/daily-js'
import { useCallStore } from '@/store/call-store'

export function CallPortal() {
  const isActive = useCallStore((s) => s.isActive)
  const roomUrl = useCallStore((s) => s.roomUrl)
  const token = useCallStore((s) => s.token)
  const menteeName = useCallStore((s) => s.menteeName)
  const menteeLink = useCallStore((s) => s.menteeLink)

  const containerRef = useRef<HTMLDivElement>(null)
  const callFrameRef = useRef<ReturnType<typeof DailyIframe.createFrame> | null>(null)
  const joinedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isActive || !roomUrl || !token || !containerRef.current) return
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

    frame.on('left-meeting', () => {
      const cid = useCallStore.getState().callId
      if (cid) {
        fetch('/api/calls/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: cid }),
        }).catch(() => {})

        // Poll for recording (check every 10s for 2 minutes)
        let attempts = 0
        const recordingPoll = setInterval(async () => {
          attempts++
          if (attempts > 12) { clearInterval(recordingPoll); return }
          try {
            const res = await fetch('/api/calls/check-recording', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callId: cid }),
            })
            const data = await res.json()
            if (data.status === 'ready') clearInterval(recordingPoll)
          } catch { /* */ }
        }, 10000)
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
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, roomUrl, token])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        try { callFrameRef.current.leave() } catch { /* */ }
        try { callFrameRef.current.destroy() } catch { /* */ }
        callFrameRef.current = null
      }
    }
  }, [])

  if (!isActive) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] w-[340px] rounded-2xl overflow-hidden"
      style={{
        backgroundColor: '#060A16',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        height: 420,
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-white/60 text-xs">Ligação com</p>
          <p className="text-white font-semibold text-sm">{menteeName}</p>
        </div>
        {menteeLink && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(menteeLink)
            }}
            className="text-[10px] text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded bg-white/5 hover:bg-white/10"
          >
            Copiar link
          </button>
        )}
      </div>

      {/* Daily iframe container */}
      <div ref={containerRef} style={{ width: '100%', height: 'calc(100% - 52px)' }} />
    </div>
  )
}
