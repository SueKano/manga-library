export type PublicationStatus = 'ongoing' | 'completed' | 'hiatus'

export const STATUSES: { value: PublicationStatus; label: string }[] = [
  { value: 'ongoing', label: 'En curso' },
  { value: 'completed', label: 'Finalizada' },
  { value: 'hiatus', label: 'Pausada' },
]

export interface Series {
  id: number
  title: string
  author?: string
  publisher?: string
  status?: PublicationStatus
  /** null = the final volume count is unknown. */
  totalVolumes: number | null
  favorite: boolean
  createdAt: number
  updatedAt: number
}

/** Editable fields of a series (what the form fills in). */
export type SeriesInput = Omit<Series, 'id' | 'createdAt' | 'updatedAt'>

export interface Volume {
  id: number
  seriesId: number
  number: number
  owned: boolean
  /** ISO yyyy-mm-dd */
  purchaseDate?: string
  price?: number
}

export interface Cover {
  seriesId: number
  blob: Blob
  mime: string
  updatedAt: number
}

export interface MetaEntry {
  key: string
  value: unknown
}
