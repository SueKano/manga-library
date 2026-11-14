/**
 * Pure collection logic: from the volume numbers I own, derive last, next,
 * gaps and completion percentage. No dependencies.
 */

export interface Summary {
  /** Owned volume numbers, sorted and deduplicated. */
  owned: number[]
  /** Highest owned volume (null if none). */
  last: number | null
  /** Next one to buy: last + 1 (null once the total is reached). */
  next: number | null
  /** Missing volumes below the last owned one. */
  gaps: number[]
  /** 0-100, or null when the total volume count is unknown. */
  percent: number | null
  /** Every volume of a series with a known total is owned. */
  complete: boolean
}

export function computeSummary(numbers: Iterable<number>, totalVolumes: number | null): Summary {
  const owned = [...new Set(numbers)]
    .filter((value) => Number.isInteger(value) && value >= 1)
    .sort((first, second) => first - second)
  const last = owned.length ? owned[owned.length - 1] : null
  const total = totalVolumes != null && totalVolumes >= 1 ? totalVolumes : null

  const ownedSet = new Set(owned)
  const gaps: number[] = []
  for (let number = 1; number < (last ?? 0); number++) if (!ownedSet.has(number)) gaps.push(number)

  const candidate = (last ?? 0) + 1
  const next = total != null && candidate > total ? null : candidate

  // Volumes above the declared total do not count towards the percentage.
  const withinTotal = total != null ? owned.filter((number) => number <= total).length : 0
  const percent = total != null ? Math.min(100, Math.round((withinTotal / total) * 100)) : null
  const complete = total != null && withinTotal === total

  return { owned, last, next, gaps, percent, complete }
}

/** [1,2,3,5,7,8] → "1-3, 5, 7-8" */
export function formatRanges(numbers: number[]): string {
  const sorted = [...numbers].sort((first, second) => first - second)
  const parts: string[] = []
  let start = 0
  while (start < sorted.length) {
    let end = start
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end++
    parts.push(start === end ? `${sorted[start]}` : `${sorted[start]}-${sorted[end]}`)
    start = end + 1
  }
  return parts.join(', ')
}

/** Headline sentence shown to the user (UI copy, in Spanish). */
export function statusPhrase(summary: Summary): string {
  if (summary.last == null) return 'Sin tomos · Siguiente: 1'
  if (summary.next == null) {
    return summary.gaps.length ? `Tengo hasta el tomo ${summary.last}` : 'Colección completa'
  }
  return `Tengo hasta el tomo ${summary.last} · Siguiente: ${summary.next}`
}
