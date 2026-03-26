import DailyIframe from '@daily-co/daily-js'

type DailyCall = ReturnType<typeof DailyIframe.createCallObject>

let activeCall: DailyCall | null = null
let activeRoomUrl: string | null = null

export function getOrCreateCall(roomUrl?: string): DailyCall {
  // If room changed, destroy old call first
  if (activeCall && roomUrl && activeRoomUrl && roomUrl !== activeRoomUrl) {
    destroyCall()
  }

  if (!activeCall) {
    activeCall = DailyIframe.createCallObject({
      audioSource: true,
      videoSource: false,
    })
    activeRoomUrl = roomUrl || null
  }
  return activeCall
}

export function destroyCall() {
  if (activeCall) {
    try { activeCall.leave() } catch { /* */ }
    try { activeCall.destroy() } catch { /* */ }
    activeCall = null
    activeRoomUrl = null
  }
}

export function getActiveCall(): DailyCall | null {
  return activeCall
}
