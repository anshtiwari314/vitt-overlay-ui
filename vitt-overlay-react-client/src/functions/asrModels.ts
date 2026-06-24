export const ASR_MODEL_STORAGE_KEY = 'vitt-asr-model'

export type AsrModelOption = {
  id: string
  label: string
  description: string
}

/** Must stay in sync with asr_registry.py on the server. */
export const ASR_MODELS: AsrModelOption[] = [
  {
    id: 'faster-whisper-base',
    label: 'Whisper Base (fast)',
    description: 'General-purpose OpenAI Whisper. Default.'
  },
  {
    id: 'faster-whisper-small',
    label: 'Whisper Small',
    description: 'Better accuracy than base; slower.'
  },
  {
    id: 'faster-whisper-medium',
    label: 'Whisper Medium',
    description: 'Higher accuracy than small; slowest on CPU.'
  },
  {
    id: 'faster-whisper-large',
    label: 'Whisper Large v3',
    description: 'Best Whisper accuracy; ~3 GB, very slow on CPU.'
  },
  {
    id: 'faster-whisper-base-translate-en',
    label: 'Whisper Base → English',
    description: 'Translate any language to English (auto-detect).'
  },
  {
    id: 'faster-whisper-small-translate-en',
    label: 'Whisper Small → English',
    description: 'Translate to English; better than base.'
  },
  {
    id: 'faster-whisper-medium-translate-en',
    label: 'Whisper Medium → English',
    description: 'Translate to English; good quality on CPU.'
  },
  {
    id: 'faster-whisper-large-translate-en',
    label: 'Whisper Large → English',
    description: 'Best translate-to-English; slow on CPU.'
  },
  {
    id: 'indic-whisper',
    label: 'IndicWhisper',
    description: 'AI4Bharat Whisper fine-tune for Hindi / Indian languages.'
  },
  {
    id: 'indic-conformer-hi',
    label: 'IndicConformer — Hindi',
    description: 'Hindi transcription (Devanagari).'
  },
  {
    id: 'indic-conformer-mr',
    label: 'IndicConformer — Marathi',
    description: 'Marathi transcription.'
  },
  {
    id: 'indic-conformer-ka',
    label: 'IndicConformer — Kannada',
    description: 'Kannada transcription (model code kn).'
  },
  {
    id: 'indic-conformer',
    label: 'IndicConformer (Hindi)',
    description: 'Legacy alias — Hindi. Indian languages only; use Whisper for English.'
  },
  {
    id: 'hinglish-oriserve-swift',
    label: 'Hinglish — Oriserve Swift',
    description: 'Fast Roman Hinglish for noisy calls.'
  },
  {
    id: 'hinglish-oriserve-apex',
    label: 'Hinglish — Oriserve Apex',
    description: 'Accurate Roman Hinglish.'
  },
  {
    id: 'hinglish-shunya',
    label: 'Hinglish — Shunya',
    description: 'Mixed script: Devanagari + English in Latin.'
  },
  {
    id: 'hinglish-equal',
    label: 'Hinglish — Equal AI',
    description: 'Roman Hinglish conversational style.'
  },
  {
    id: 'hinglish-srota',
    label: 'Hinglish — Srota (Qwen3)',
    description: 'Mixed-script Hinglish (Qwen3-ASR fine-tune).'
  }
]

export const DEFAULT_ASR_MODEL_ID = ASR_MODELS[0].id

export function getAsrModelId(): string {
  try {
    const stored = localStorage.getItem(ASR_MODEL_STORAGE_KEY)
    if (stored && ASR_MODELS.some((m) => m.id === stored)) {
      return stored
    }
  } catch {
    // ignore storage errors (e.g. private mode)
  }
  return DEFAULT_ASR_MODEL_ID
}

export function setAsrModelId(id: string): void {
  localStorage.setItem(ASR_MODEL_STORAGE_KEY, id)
}

export function getAsrModelLabel(id: string): string {
  return ASR_MODELS.find((m) => m.id === id)?.label ?? id
}
