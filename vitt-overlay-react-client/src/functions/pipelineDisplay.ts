export type PipelineCandidate = {
  language?: string
  languageCode?: string
  confidence?: number
  score?: number
  scorePercent?: number
  selected?: boolean
}

export type PipelinePayload = {
  lidSource?: string
  lidCandidates?: PipelineCandidate[]
  whisperCandidates?: PipelineCandidate[]
  selectedLanguageCode?: string
}

export function formatPipelineLidLine(pipeline?: PipelinePayload | null): string {
  const parts = (pipeline?.lidCandidates ?? []).map((item) => {
    const language = item.language || item.languageCode || 'unknown'
    const pct = Math.round((item.confidence ?? 0) * 100)
    return `${language} ${pct}%`
  })
  return parts.join(', ')
}

export function formatPipelineWhisperLine(pipeline?: PipelinePayload | null): string {
  const parts = (pipeline?.whisperCandidates ?? []).map((item) => {
    const language = item.language || item.languageCode || 'unknown'
    const scorePct =
      item.scorePercent ??
      Math.round((item.score ?? 0) * 100 * 10) / 10
    return `${language} score ${scorePct}%`
  })
  return parts.join(', ')
}

export function formatPipelineTranscriptionLine(text?: string): string {
  const value = text?.trim()
  return value ? value : "''"
}
