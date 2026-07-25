export const LID_MODEL_STORAGE_KEY = 'vitt-lid-model'

export type LidModelOption = {
  id: string
  label: string
  description: string
}

/** Must stay in sync with lid_registry.py on the server. */
export const LID_MODELS: LidModelOption[] = [
  {
    id: 'off',
    label: 'Off',
    description: 'Language detection disabled.'
  },
  {
    id: 'speechbrain-ecapa-voxlingua107',
    label: 'SpeechBrain ECAPA (VoxLingua107)',
    description: 'ECAPA-TDNN — 107 languages with confidence scores.'
  },
  {
    id: 'meta-mms-lid',
    label: 'Meta MMS-LID',
    description: 'Facebook MMS Wav2Vec2 LID — 126 languages by default.'
  },
  {
    id: 'indic-superb-lid',
    label: 'IndicSUPERB LID (12 Indian langs)',
    description: '12-language Indian speech LID (Kathbath / Vakgyata Wav2Vec2).'
  },
  {
    id: 'vakgyata-lid',
    label: 'Vakgyata LID',
    description: 'OneCXI open-vakgyata Wav2Vec2 — Indian speech LID.'
  },
  {
    id: 'codeswitch-lora-lid',
    label: 'Code-Switched LoRA LID',
    description: 'Whisper-large-v3 + LoRA on IndicVoices — 22 Indic langs.'
  },
  {
    id: 'voxlect-indic-lid',
    label: 'Voxlect Indic LID',
    description: 'Voxlect Whisper-small + LoRA — 22 Indic langs + Indian English.'
  },
  {
    id: 'vaani-lid-v0',
    label: 'Vaani-LID v0',
    description: 'ARTPARK-IISc — 42 Indic languages/dialects (Whisper-turbo).'
  },
  {
    id: 'nemo-langid-titanet',
    label: 'NeMo TitaNet-LID (AmberNet)',
    description: 'NVIDIA NeMo langid_ambernet on VoxLingua107.'
  },
  {
    id: 'nemo-langid-matchboxnet',
    label: 'NeMo MatchboxNet LangID',
    description: 'NeMo EncDecSpeakerLabelModel LangID checkpoint.'
  },
  {
    id: 'whisper-internal-lid',
    label: 'Whisper Internal LID',
    description: 'Whisper Small encoder language detection (faster-whisper).'
  },
  {
    id: 'fastconformer-lid',
    label: 'FastConformer LID (NeMo + linear probe)',
    description:
      'NeMo FastConformer encoder + linear head on FLEURS Indic langs (13 languages). First warmup trains head if missing.'
  },
  {
    id: 'ensemble-lid-five',
    label: 'Ensemble LID (6): ECAPA + MMS + IndicSUPERB + LoRA + NeMo + Whisper',
    description:
      'Six models: SpeechBrain ECAPA, Meta MMS, IndicSUPERB, Code-Switched LoRA, NeMo AmberNet, Whisper internal LID.'
  },
  {
    id: 'ensemble-lid-four',
    label: 'Ensemble LID (4): ECAPA + IndicSUPERB + NeMo + Whisper',
    description:
      'Four models: SpeechBrain ECAPA, IndicSUPERB, NeMo AmberNet, Whisper internal LID (no Meta MMS, no Code-Switched LoRA).'
  }
]

export const DEFAULT_LID_MODEL_ID = LID_MODELS[0].id

export function getLidModelId(): string {
  try {
    const stored = localStorage.getItem(LID_MODEL_STORAGE_KEY)
    if (stored && LID_MODELS.some((m) => m.id === stored)) {
      return stored
    }
  } catch {
    // ignore storage errors (e.g. private mode)
  }
  return DEFAULT_LID_MODEL_ID
}

export function setLidModelId(id: string): void {
  localStorage.setItem(LID_MODEL_STORAGE_KEY, id)
}

export function getLidModelLabel(id: string): string {
  return LID_MODELS.find((m) => m.id === id)?.label ?? id
}

export function isLidEnabled(id: string): boolean {
  return id !== 'off'
}
