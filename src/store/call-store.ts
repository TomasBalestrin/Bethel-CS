import { create } from 'zustand'

interface StartCallParams {
  roomUrl: string
  roomName: string
  token: string
  callId: string
  menteeName: string
  menteeLink: string
}

interface CallState {
  isActive: boolean
  roomUrl: string | null
  roomName: string | null
  token: string | null
  callId: string | null
  menteeName: string | null
  menteeLink: string | null
  status: 'idle' | 'connecting' | 'waiting' | 'active' | 'ended'
  muted: boolean
  seconds: number
  remoteCount: number
  startCall: (params: StartCallParams) => void
  endCall: () => void
  setStatus: (status: CallState['status']) => void
  setMuted: (muted: boolean) => void
  setSeconds: (seconds: number) => void
  setRemoteCount: (count: number) => void
}

export const useCallStore = create<CallState>((set) => ({
  isActive: false,
  roomUrl: null,
  roomName: null,
  token: null,
  callId: null,
  menteeName: null,
  menteeLink: null,
  status: 'idle',
  muted: false,
  seconds: 0,
  remoteCount: 0,
  startCall: (params) => set({
    isActive: true,
    status: 'connecting',
    muted: false,
    seconds: 0,
    remoteCount: 0,
    roomUrl: params.roomUrl,
    roomName: params.roomName,
    token: params.token,
    callId: params.callId,
    menteeName: params.menteeName,
    menteeLink: params.menteeLink,
  }),
  endCall: () => set({
    isActive: false,
    status: 'idle',
    roomUrl: null,
    roomName: null,
    token: null,
    callId: null,
    menteeName: null,
    menteeLink: null,
    muted: false,
    seconds: 0,
    remoteCount: 0,
  }),
  setStatus: (status) => set({ status }),
  setMuted: (muted) => set({ muted }),
  setSeconds: (seconds) => set({ seconds }),
  setRemoteCount: (count) => set({ remoteCount: count }),
}))
