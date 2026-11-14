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
  /** Volumes left to buy: up to the total if known, otherwise just the gaps. */
  missing: number
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
  const missing = total != null ? total - withinTotal : gaps.length

  return { owned, last, next, gaps, missing, percent, complete }
}

/** Most recently bought volume among those with a purchase date (ties: highest number). */
export function lastPurchase(
  volumes: { number: number; owned: boolean; purchaseDate?: string }[],
): { number: number; date: string } | null {
  const dated = volumes.filter((volume) => volume.owned && volume.purchaseDate)
  if (!dated.length) return null
  // ISO yyyy-mm-dd dates sort correctly as plain strings.
  const latest = dated.reduce((best, volume) =>
    volume.purchaseDate! > best.purchaseDate! ||
    (volume.purchaseDate === best.purchaseDate && volume.number > best.number)
      ? volume
      : best,
  )
  return { number: latest.number, date: latest.purchaseDate! }
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

/**
 * Headline shown on cards and in the detail view (UI copy, in Spanish).
 * Without a next volume it always states the last one I own, so I can tell
 * whether a new volume of an ongoing series is one I still need.
 */
export function statusPhrase(summary: Summary, publicationFinished = false): string {
  if (summary.next != null) return `Siguiente: ${summary.next}`
  if (!summary.complete) return `Solo faltan huecos · Último tomo: ${summary.last}`
  return publicationFinished ? `Colección completa (${summary.last})` : `Al día · Último tomo: ${summary.last}`
}
