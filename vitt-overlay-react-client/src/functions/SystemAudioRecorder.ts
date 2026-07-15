/** PCM chunks from Electron main (FFmpeg) are sent as binary WebSocket frames. */

import type { MicrophoneMediaRecorderState } from './MicrophoneMediaRecorder'

export type SystemAudioRecorderState = MicrophoneMediaRecorderState

export type SystemAudioRecorderOptions = {
  getWs: () => WebSocket | null
  onStateChange?: (state: SystemAudioRecorderState) => void
  onError?: (error: unknown) => void
}

type OverlayBridge = {
  startSystemAudioCapture?: () => Promise<{ ok: boolean; error?: string; already?: boolean }>
  stopSystemAudioCapture?: () => Promise<{ ok: boolean }>
  onSystemPcmChunk?: (cb: (payload: Uint8Array) => void) => () => void
}

function getOverlayBridge(): OverlayBridge | undefined {
  return (window as unknown as { overlay?: OverlayBridge }).overlay
}

export class SystemAudioRecorder {
  private state: SystemAudioRecorderState = 'idle'
  private unsubscribePcm: (() => void) | null = null
  private readonly getWs: () => WebSocket | null
  private readonly onStateChange?: (state: SystemAudioRecorderState) => void
  private readonly onError?: (error: unknown) => void

  constructor(options: SystemAudioRecorderOptions) {
    this.getWs = options.getWs
    this.onStateChange = options.onStateChange
    this.onError = options.onError
  }

  getState(): SystemAudioRecorderState {
    return this.state
  }

  isActive(): boolean {
    return this.state === 'recording' || this.state === 'paused'
  }

  async start(): Promise<void> {
    const overlay = getOverlayBridge()
    if (!overlay?.startSystemAudioCapture) {
      throw new Error('System audio capture requires the Vitt Overlay Electron app on Linux.')
    }

    if (this.state === 'paused') {
      this.setState('recording')
      return
    }

    if (this.state === 'recording') return

    const result = await overlay.startSystemAudioCapture()
    if (!result?.ok) {
      throw new Error(result?.error ?? 'Failed to start system audio capture.')
    }

    this.unsubscribePcm?.()
    this.unsubscribePcm =
      overlay.onSystemPcmChunk?.((payload) => {
        this.handlePcmChunk(payload)
      }) ?? null

    this.setState('recording')
  }

  pause(): void {
    if (this.state !== 'recording') return
    this.setState('paused')
  }

  stop(): void {
    this.unsubscribePcm?.()
    this.unsubscribePcm = null

    void getOverlayBridge()?.stopSystemAudioCapture?.()

    this.setState('idle')
  }

  private handlePcmChunk(payload: Uint8Array): void {
    if (this.state !== 'recording') return

    const ws = this.getWs()
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    try {
      const buffer =
        payload.byteOffset === 0 && payload.byteLength === payload.buffer.byteLength
          ? payload.buffer
          : payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength)
      ws.send(buffer)
    } catch (error) {
      this.onError?.(error)
    }
  }

  private setState(nextState: SystemAudioRecorderState): void {
    this.state = nextState
    this.onStateChange?.(nextState)
  }
}
