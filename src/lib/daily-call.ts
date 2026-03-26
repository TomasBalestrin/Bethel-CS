import DailyIframe from '@daily-co/daily-js'

type DailyCall = ReturnType<typeof DailyIframe.createCallObject>

let activeCall: DailyCall | null = null

export function getOrCreateCall(): DailyCall {
  if (!activeCall) {
    activeCall = DailyIframe.createCallObject({
      audioSource: true,
      videoSource: false,
    })
  }
  return activeCall
}

export function destroyCall() {
  if (activeCall) {
    try { activeCall.leave() } catch { /* */ }
    try { activeCall.destroy() } catch { /* */ }
    activeCall = null
  }
}

export function getActiveCall(): DailyCall | null {
  return activeCall
}
