import type { MangaDB } from '@/db/schema'
import type { Cover, PublicationStatus, Series, Volume } from '@/db/types'

/** Backup format version. Bump it on format changes and upgrade old backups in `parseBackup`. */
export const BACKUP_VERSION = 1
export const BACKUP_APP = 'manga-library'

export interface ExportedCover {
  seriesId: number
  mime: string
  updatedAt: number
  /** Base64 image (without the data: prefix). */
  data: string
}

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  series: Series[]
  volumes: Volume[]
  covers: ExportedCover[]
}

/** Thrown for invalid backups. The message is user-facing (Spanish). */
export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportError'
  }
}

// ---------- base64 ----------

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK))
  }
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

// ---------- export ----------

export async function createBackup(db: MangaDB): Promise<Backup> {
  const [series, volumes, covers] = await Promise.all([
    db.series.toArray(),
    db.volumes.toArray(),
    db.covers.toArray(),
  ])
  const exportedCovers: ExportedCover[] = []
  for (const cover of covers) {
    exportedCovers.push({
      seriesId: cover.seriesId,
      mime: cover.mime,
      updatedAt: cover.updatedAt,
      data: bytesToBase64(new Uint8Array(await cover.blob.arrayBuffer())),
    })
  }
  const exportedAt = new Date().toISOString()
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt, series, volumes, covers: exportedCovers }
}

export async function exportJSON(db: MangaDB): Promise<string> {
  return JSON.stringify(await createBackup(db))
}

/** Approximate export size in bytes, without building the file. */
export async function estimateSize(db: MangaDB): Promise<number> {
  const [series, volumes] = await Promise.all([db.series.toArray(), db.volumes.toArray()])
  let total = JSON.stringify(series).length + JSON.stringify(volumes).length + 120
  await db.covers.each((cover) => {
    total += Math.ceil(cover.blob.size / 3) * 4 + 90
  })
  return total
}

export function backupFileName(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `mangas-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

// ---------- validate ----------
// Shape checks only. Duplicate ids and repeated volumes are rejected by
// IndexedDB itself on restore (primary keys and the unique index), which
// aborts the transaction and leaves the previous data untouched.

const VALID_STATUSES: unknown[] = ['ongoing', 'completed', 'hiatus'] satisfies PublicationStatus[]

const isPositiveInt = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1
const isOptional = (value: unknown, type: 'string' | 'number') => value === undefined || typeof value === type

// `any`: these guards exist precisely to inspect untrusted JSON.
function isSeries(value: any): value is Series {
  return (
    isPositiveInt(value?.id) &&
    typeof value.title === 'string' &&
    value.title.trim() !== '' &&
    (value.totalVolumes === null || isPositiveInt(value.totalVolumes)) &&
    typeof value.favorite === 'boolean' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    (value.status === undefined || VALID_STATUSES.includes(value.status)) &&
    isOptional(value.author, 'string') &&
    isOptional(value.publisher, 'string')
  )
}

function isVolume(value: any, seriesIds: Set<unknown>): value is Volume {
  return (
    isPositiveInt(value?.id) &&
    seriesIds.has(value.seriesId) &&
    isPositiveInt(value.number) &&
    typeof value.owned === 'boolean' &&
    isOptional(value.purchaseDate, 'string') &&
    isOptional(value.price, 'number')
  )
}

function isExportedCover(value: any, seriesIds: Set<unknown>): value is ExportedCover {
  return (
    seriesIds.has(value?.seriesId) &&
    typeof value.mime === 'string' &&
    value.mime.startsWith('image/') &&
    typeof value.data === 'string' &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(value.data) &&
    typeof value.updatedAt === 'number'
  )
}

/** `label` is user-facing: "la serie", "el tomo", "la portada". */
function assertAllValid(items: unknown[], isValid: (item: unknown) => boolean, label: string) {
  const invalidIndex = items.findIndex((item) => !isValid(item))
  if (invalidIndex >= 0) throw new ImportError(`La copia está dañada (${label} nº ${invalidIndex + 1})`)
}

/** Parses and validates backup text. Throws ImportError with a readable message. */
export function parseBackup(text: string): Backup {
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('El archivo no es un JSON válido')
  }
  if (data?.app !== BACKUP_APP) throw new ImportError('El archivo no es una copia de esta app')
  if (!isPositiveInt(data.version)) throw new ImportError('La copia no indica su versión')
  if (data.version > BACKUP_VERSION) {
    throw new ImportError('La copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo')
  }
  // When BACKUP_VERSION is bumped, upgrade older `data` to the current format here.

  const { series, volumes, covers } = data
  if (![series, volumes, covers].every(Array.isArray)) throw new ImportError('La copia está incompleta')

  assertAllValid(series, isSeries, 'la serie')
  const seriesIds = new Set(series.map((item: Series) => item.id))
  assertAllValid(volumes, (item) => isVolume(item, seriesIds), 'el tomo')
  assertAllValid(covers, (item) => isExportedCover(item, seriesIds), 'la portada')

  const exportedAt = String(data.exportedAt ?? '')
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt, series, volumes, covers }
}

// ---------- import ----------

/**
 * Replaces ALL content with the backup's, in a single transaction: if anything
 * fails, the previous data stays untouched.
 */
export async function restoreBackup(db: MangaDB, backup: Backup): Promise<void> {
  const covers: Cover[] = backup.covers.map((cover) => ({
    seriesId: cover.seriesId,
    mime: cover.mime,
    updatedAt: cover.updatedAt,
    blob: new Blob([base64ToBytes(cover.data)], { type: cover.mime }),
  }))
  await db.transaction('rw', db.series, db.volumes, db.covers, async () => {
    await Promise.all([db.series.clear(), db.volumes.clear(), db.covers.clear()])
    await db.series.bulkAdd(backup.series)
    await db.volumes.bulkAdd(backup.volumes)
    await db.covers.bulkAdd(covers)
  })
}

export async function importJSON(db: MangaDB, text: string): Promise<Backup> {
  const backup = parseBackup(text)
  await restoreBackup(db, backup)
  return backup
}
