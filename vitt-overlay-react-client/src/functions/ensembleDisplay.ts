export type EnsembleMember = {
  modelId?: string
  modelLabel?: string
  language?: string
  languageCode?: string
  confidence?: number
  latencyMs?: number
  error?: string
}

export function parseEnsembleMembers(raw: unknown): EnsembleMember[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const members: EnsembleMember[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    members.push({
      modelId: (row.modelId ?? row.model_id) as string | undefined,
      modelLabel: (row.modelLabel ?? row.model_label) as string | undefined,
      language: row.language as string | undefined,
      languageCode: (row.languageCode ?? row.language_code) as string | undefined,
      confidence:
        typeof row.confidence === 'number'
          ? row.confidence
          : typeof row.confidence === 'string'
            ? Number(row.confidence)
            : undefined,
      latencyMs:
        typeof row.latencyMs === 'number'
          ? row.latencyMs
          : typeof row.latency_ms === 'number'
            ? row.latency_ms
            : typeof row.latencyMs === 'string'
              ? Number(row.latencyMs)
              : undefined,
      error: row.error as string | undefined
    })
  }
  return members.length ? members : undefined
}

export function formatEnsembleMemberLine(member: EnsembleMember): string {
  const label = member.modelLabel ?? member.modelId ?? 'model'
  const latencyMs =
    member.latencyMs != null && Number.isFinite(member.latencyMs)
      ? Math.round(member.latencyMs)
      : null
  const latencyPart =
    latencyMs != null ? `    latency : ${latencyMs} ms` : ''

  if (member.error) {
    return `${label} : error    latency : ${latencyMs ?? '—'} ms`
  }

  const language = member.language || member.languageCode || 'unknown'
  const pct =
    member.confidence != null && Number.isFinite(member.confidence)
      ? Math.round(member.confidence * 1000) / 10
      : null

  if (pct != null) {
    return `${label} : ${language} (${pct}%)${latencyPart}`
  }
  return `${label} : ${language}${latencyPart}`
}

export function formatEnsembleVoteLine(
  language?: string,
  confidence?: number,
  latencyMs?: number
): string {
  if (!language) return '—'
  const lat =
    latencyMs != null && Number.isFinite(latencyMs)
      ? `    latency : ${Math.round(latencyMs)} ms`
      : ''
  if (confidence != null && Number.isFinite(confidence)) {
    const pct = Math.round(confidence * 1000) / 10
    return `${language} (${pct}%)${lat}`
  }
  return `${language}${lat}`
}
