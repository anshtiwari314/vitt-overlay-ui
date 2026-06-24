/** PCM chunks are sent as binary WebSocket frames (no base64). */

export type MicrophoneMediaRecorderState = 'idle' | 'recording' | 'paused'

export type MicrophoneMediaRecorderOptions = {
  getWs: () => WebSocket | null
  getUserid: () => string
  getSessionid: () => string
  chunkIntervalMs?: number
  onStateChange?: (state: MicrophoneMediaRecorderState) => void
  onError?: (error: unknown) => void
}

/** Target format for server-side Silero VAD + faster-whisper. */
const TARGET_SAMPLE_RATE = 16_000
const DEFAULT_CHUNK_MS = 200

export class MicrophoneMediaRecorder {
  private audioContext: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private processorNode: ScriptProcessorNode | null = null
  private stream: MediaStream | null = null
  private state: MicrophoneMediaRecorderState = 'idle'
  private resampleBuffer: Float32Array = new Float32Array(0)
  private pcmChunkBuffer: Int16Array = new Int16Array(0)
  private readonly chunkSamples: number
  private readonly getWs: () => WebSocket | null
  private readonly getUserid: () => string
  private readonly getSessionid: () => string
  private readonly onStateChange?: (state: MicrophoneMediaRecorderState) => void
  private readonly onError?: (error: unknown) => void

  constructor(options: MicrophoneMediaRecorderOptions) {
    this.getWs = options.getWs
    this.getUserid = options.getUserid
    this.getSessionid = options.getSessionid
    const chunkMs = options.chunkIntervalMs ?? DEFAULT_CHUNK_MS
    this.chunkSamples = Math.round((TARGET_SAMPLE_RATE * chunkMs) / 1000)
    this.onStateChange = options.onStateChange
    this.onError = options.onError
  }

  getState(): MicrophoneMediaRecorderState {
    return this.state
  }

  isActive(): boolean {
    return this.state === 'recording' || this.state === 'paused'
  }

  async start(): Promise<void> {
    if (this.state === 'recording') return

    if (this.state === 'paused' && this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      this.setState('recording')
      return
    }

    await this.acquireStream()
    await this.createPcmPipeline()
    this.setState('recording')
  }

  pause(): void {
    if (this.state !== 'recording' || !this.audioContext) return
    void this.audioContext.suspend()
    this.setState('paused')
  }

  stop(): void {
    this.teardownPcmPipeline()
    this.releaseStream()
    this.resampleBuffer = new Float32Array(0)
    this.pcmChunkBuffer = new Int16Array(0)
    this.setState('idle')
  }

  private async acquireStream(): Promise<void> {
    if (this.stream) return

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
  }

  private async createPcmPipeline(): Promise<void> {
    if (!this.stream) return

    this.audioContext = new AudioContext()
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream)
    // ScriptProcessor: widely supported in Electron/Chromium for PCM capture.
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1)

    this.processorNode.onaudioprocess = (event) => {
      if (this.state !== 'recording') return
      const input = event.inputBuffer.getChannelData(0)
      this.handleAudioFrame(input, this.audioContext!.sampleRate)
    }

    this.sourceNode.connect(this.processorNode)
    this.processorNode.connect(this.audioContext.destination)
  }

  private handleAudioFrame(input: Float32Array, inputSampleRate: number): void {
    const downsampled = this.downsample(input, inputSampleRate, TARGET_SAMPLE_RATE)
    if (downsampled.length === 0) return

    this.resampleBuffer = this.concatFloat32(this.resampleBuffer, downsampled)
    const pcm = this.float32ToInt16(this.resampleBuffer)
    this.resampleBuffer = new Float32Array(0)
    this.pcmChunkBuffer = this.concatInt16(this.pcmChunkBuffer, pcm)

    while (this.pcmChunkBuffer.length >= this.chunkSamples) {
      const chunk = this.pcmChunkBuffer.slice(0, this.chunkSamples)
      this.pcmChunkBuffer = this.pcmChunkBuffer.slice(this.chunkSamples)
      void this.sendPcmChunk(chunk)
    }
  }

  private downsample(
    input: Float32Array,
    inputRate: number,
    outputRate: number
  ): Float32Array {
    if (outputRate === inputRate) {
      return input.slice()
    }

    const ratio = inputRate / outputRate
    const outputLength = Math.floor(input.length / ratio)
    const output = new Float32Array(outputLength)

    for (let i = 0; i < outputLength; i += 1) {
      const start = Math.floor(i * ratio)
      const end = Math.min(Math.floor((i + 1) * ratio), input.length)
      let sum = 0
      for (let j = start; j < end; j += 1) {
        sum += input[j]
      }
      output[i] = sum / Math.max(1, end - start)
    }

    return output
  }

  private float32ToInt16(samples: Float32Array): Int16Array {
    const pcm = new Int16Array(samples.length)
    for (let i = 0; i < samples.length; i += 1) {
      const clamped = Math.max(-1, Math.min(1, samples[i]))
      pcm[i] = clamped < 0 ? clamped * 32768 : clamped * 32767
    }
    return pcm
  }

  private concatFloat32(a: Float32Array, b: Float32Array): Float32Array {
    if (a.length === 0) return b
    const out = new Float32Array(a.length + b.length)
    out.set(a, 0)
    out.set(b, a.length)
    return out
  }

  private concatInt16(a: Int16Array, b: Int16Array): Int16Array {
    if (a.length === 0) return b
    const out = new Int16Array(a.length + b.length)
    out.set(a, 0)
    out.set(b, a.length)
    return out
  }

  private sendPcmChunk(pcm: Int16Array): void {
    const ws = this.getWs()
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    try {
      // Copy slice so we send exactly this chunk (ArrayBuffer may be larger than view).
      const payload = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength)
      ws.send(payload)
    } catch (error) {
      this.onError?.(error)
    }
  }

  private teardownPcmPipeline(): void {
    this.processorNode?.disconnect()
    this.sourceNode?.disconnect()
    this.processorNode = null
    this.sourceNode = null

    if (this.audioContext) {
      void this.audioContext.close()
      this.audioContext = null
    }
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
  }

  private setState(nextState: MicrophoneMediaRecorderState): void {
    this.state = nextState
    this.onStateChange?.(nextState)
  }
}
