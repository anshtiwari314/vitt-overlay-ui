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
    id: 'whisper-meta-mms-pipeline',
    label: 'Whisper + Meta MMS-LID Pipeline',
    description:
      'MMS-LID top-3 → forced Whisper Small × 3 → best-scoring transcript. Reduces wrong-language hallucinations.'
  },
  {
    id: 'whisper-whisper-lid-pipeline',
    label: 'Whisper + Whisper LID Pipeline',
    description:
      'Whisper internal LID top-3 → forced Whisper Small × 3 → best-scoring transcript.'
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
    id: 'indic-conformer-gu',
    label: 'IndicConformer — Gujarati',
    description: 'Gujarati transcription (model code gu).'
  },
  {
    id: 'indic-conformer-bn',
    label: 'IndicConformer — Bengali',
    description: 'Bengali transcription (model code bn).'
  },
  {
    id: 'indic-conformer-ml',
    label: 'IndicConformer — Malayalam',
    description: 'Malayalam transcription (model code ml).'
  },
  {
    id: 'indic-conformer-ne',
    label: 'IndicConformer — Nepali',
    description: 'Nepali transcription (model code ne).'
  },
  {
    id: 'indic-conformer-or',
    label: 'IndicConformer — Odia',
    description: 'Odia transcription (model code or).'
  },
  {
    id: 'indic-conformer-ta',
    label: 'IndicConformer — Tamil',
    description: 'Tamil transcription (model code ta).'
  },
  {
    id: 'indic-conformer-te',
    label: 'IndicConformer — Telugu',
    description: 'Telugu transcription (model code te).'
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
  },
  {
    id: 'funasr-sensevoice-hi',
    label: 'FunASR SenseVoice-Small — Hindi',
    description: 'SenseVoice auto LID. Hindi experimental (zh/en/ja/ko/yue trained). FunASR FSMN-VAD.'
  },
  {
    id: 'funasr-sensevoice-en',
    label: 'FunASR SenseVoice-Small — English',
    description: 'SenseVoice English with internal LID. FunASR FSMN-VAD.'
  },
  {
    id: 'funasr-nano-hi',
    label: 'Fun-ASR-Nano — Hindi',
    description: 'Fun-ASR-MLT-Nano Hindi hint + internal LID. FunASR FSMN-VAD.'
  },
  {
    id: 'funasr-nano-en',
    label: 'Fun-ASR-Nano — English',
    description: 'Fun-ASR-MLT-Nano English hint + internal LID. FunASR FSMN-VAD.'
  },
  {
    id: 'funasr-qwen3-hi',
    label: 'Qwen3-ASR — Hindi',
    description: 'Qwen3-ASR-1.7B Hindi + internal LID. Slow on CPU. FunASR FSMN-VAD.'
  },
  {
    id: 'funasr-qwen3-en',
    label: 'Qwen3-ASR — English',
    description: 'Qwen3-ASR-1.7B English + internal LID. Slow on CPU. FunASR FSMN-VAD.'
  },
  {
    id: 'funasr-glm-hi',
    label: 'GLM-ASR-Nano — Hindi',
    description: 'GLM-ASR-Nano auto LID (17 langs). FunASR FSMN-VAD.'
  },
  {
    id: 'funasr-glm-en',
    label: 'GLM-ASR-Nano — English',
    description: 'GLM-ASR-Nano auto LID (17 langs). FunASR FSMN-VAD.'
  },
  {
    id: 'funasr-paraformer-en-hi',
    label: 'Paraformer-en — Hindi',
    description: 'Paraformer-en auto LID. Hindi experimental. FunASR FSMN-VAD.'
  },
  {
    id: 'funasr-paraformer-en-en',
    label: 'Paraformer-en — English',
    description: 'Paraformer English ASR. FunASR FSMN-VAD.'
  },
  {
    id: 'funasr-paraformer-zh-streaming-hi',
    label: 'Paraformer-zh-streaming — Hindi',
    description: 'Streaming Paraformer (zh hint for Hindi — experimental). FunASR FSMN-VAD.'
  },
  {
    id: 'funasr-paraformer-zh-streaming-en',
    label: 'Paraformer-zh-streaming — English',
    description: 'Streaming Paraformer English path. FunASR FSMN-VAD.'
  },
  {
    id: 'funasr-uniasr-hi',
    label: 'UniASR — Hindi (Urdu proxy)',
    description: 'UniASR Urdu as Indo-Aryan proxy (no Hindi checkpoint). FunASR FSMN-VAD.'
  },
  {
    id: 'funasr-uniasr-en',
    label: 'UniASR — English',
    description: 'UniASR English 2-pass model. FunASR FSMN-VAD.'
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
