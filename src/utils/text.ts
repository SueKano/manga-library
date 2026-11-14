/** Lowercase and without accents/diacritics, for searching and sorting. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Every word of the query must appear in the (already normalized) text. */
export function matches(normalizedText: string, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return words.every((word) => normalizedText.includes(word))
}

/** Stable color derived from the title, for the cover placeholder. */
export function colorFromTitle(title: string): string {
  let hash = 0
  for (const char of normalize(title)) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return `hsl(${hash % 360} 55% 42%)`
}

export function initialOf(title: string): string {
  const first = [...title.trim()][0]
  return first ? first.toUpperCase() : '?'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

export function todayISO(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
