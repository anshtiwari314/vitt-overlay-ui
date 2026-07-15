export const AUDIO_SOURCE_STORAGE_KEY = 'vitt-audio-source'

export type AudioSourceId = 'mic' | 'system'

export const AUDIO_SOURCES: { id: AudioSourceId; label: string; description: string }[] = [
  {
    id: 'mic',
    label: 'Microphone',
    description: 'Capture from your microphone (default).'
  },
  {
    id: 'system',
    label: 'System audio',
    description: 'Capture speaker output via PulseAudio monitor (Linux + Electron only).'
  }
]

export function getAudioSourceId(): AudioSourceId {
  try {
    const stored = localStorage.getItem(AUDIO_SOURCE_STORAGE_KEY)
    if (stored === 'mic' || stored === 'system') {
      return stored
    }
  } catch {
    // ignore storage errors
  }
  return 'mic'
}

export function setAudioSourceId(id: AudioSourceId): void {
  localStorage.setItem(AUDIO_SOURCE_STORAGE_KEY, id)
}

export function getAudioSourceLabel(id: AudioSourceId): string {
  return AUDIO_SOURCES.find((s) => s.id === id)?.label ?? id
}
