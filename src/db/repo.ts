import { db as defaultDb, type MangaDB } from './schema'
import type { Cover, Series, SeriesInput, Volume } from './types'

export type VolumeExtra = Partial<Pick<Volume, 'purchaseDate' | 'price'>>

/** Drops empty strings and normalizes the total so no junk gets stored. */
export function sanitizeSeriesInput(input: SeriesInput): SeriesInput {
  const text = (value?: string) => (value && value.trim() ? value.trim() : undefined)
  const total =
    input.totalVolumes != null && Number.isFinite(input.totalVolumes) && input.totalVolumes >= 1 ? Math.floor(input.totalVolumes) : null
  const clean: SeriesInput = {
    title: input.title.trim(),
    totalVolumes: total,
    favorite: !!input.favorite,
  }
  const optional = {
    author: text(input.author),
    publisher: text(input.publisher),
    status: input.status || undefined,
  }
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) (clean as unknown as Record<string, unknown>)[key] = value
  }
  return clean
}

export function createRepo(db: MangaDB) {
  async function touchSeries(seriesId: number): Promise<number> {
    const now = Date.now()
    await db.series.update(seriesId, { updatedAt: now })
    return now
  }

  return {
    /** Everything except cover blobs (only their keys). */
    async loadAll() {
      const [series, volumes, coverIds] = await Promise.all([
        db.series.toArray(),
        db.volumes.toArray(),
        db.covers.toCollection().primaryKeys(),
      ])
      return { series, volumes, coverIds }
    },

    async createSeries(input: SeriesInput): Promise<Series> {
      const clean = sanitizeSeriesInput(input)
      if (!clean.title) throw new Error('Title is required')
      const now = Date.now()
      const data = { ...clean, createdAt: now, updatedAt: now }
      const id = await db.series.add(data)
      return { ...data, id }
    },

    async updateSeries(id: number, input: SeriesInput): Promise<Series> {
      const clean = sanitizeSeriesInput(input)
      if (!clean.title) throw new Error('Title is required')
      return db.transaction('rw', db.series, async () => {
        const current = await db.series.get(id)
        if (!current) throw new Error('Series not found')
        // put (not update) so that cleared optional fields are removed.
        const series: Series = { ...clean, id, createdAt: current.createdAt, updatedAt: Date.now() }
        await db.series.put(series)
        return series
      })
    },

    async setFavorite(id: number, favorite: boolean): Promise<void> {
      await db.series.update(id, { favorite })
    },

    async deleteSeries(id: number): Promise<void> {
      await db.transaction('rw', db.series, db.volumes, db.covers, async () => {
        await db.volumes.where('seriesId').equals(id).delete()
        await db.covers.delete(id)
        await db.series.delete(id)
      })
    },

    /** Marks/unmarks a volume while keeping its purchase date and price. */
    async setVolume(
      seriesId: number,
      number: number,
      owned: boolean,
      extra: VolumeExtra = {},
    ): Promise<{ volume: Volume; updatedAt: number }> {
      if (!Number.isInteger(number) || number < 1) throw new Error('Invalid volume number')
      return db.transaction('rw', db.series, db.volumes, async () => {
        const existing = await db.volumes.where('[seriesId+number]').equals([seriesId, number]).first()
        let volume: Volume
        if (existing) {
          volume = { ...existing, ...extra, owned }
          await db.volumes.put(volume)
        } else {
          const data = { seriesId, number, owned, ...extra }
          const id = await db.volumes.add(data)
          volume = { ...data, id }
        }
        const updatedAt = await touchSeries(seriesId)
        return { volume, updatedAt }
      })
    },

    /** Bulk entry: marks volumes 1..N as owned. Higher volumes are left alone. */
    async markUpTo(seriesId: number, upTo: number): Promise<{ volumes: Volume[]; updatedAt: number }> {
      if (!Number.isInteger(upTo) || upTo < 1) throw new Error('Invalid volume number')
      return db.transaction('rw', db.series, db.volumes, async () => {
        const current = await db.volumes.where('seriesId').equals(seriesId).toArray()
        const byNumber = new Map(current.map((volume) => [volume.number, volume]))
        const added: Omit<Volume, 'id'>[] = []
        const changed: Volume[] = []
        for (let number = 1; number <= upTo; number++) {
          const existing = byNumber.get(number)
          if (!existing) added.push({ seriesId, number: number, owned: true })
          else if (!existing.owned) changed.push({ ...existing, owned: true })
        }
        if (added.length) await db.volumes.bulkAdd(added)
        if (changed.length) await db.volumes.bulkPut(changed)
        const updatedAt = await touchSeries(seriesId)
        const volumes = await db.volumes.where('seriesId').equals(seriesId).toArray()
        return { volumes, updatedAt }
      })
    },

    getCover(seriesId: number): Promise<Cover | undefined> {
      return db.covers.get(seriesId)
    },

    async setCover(seriesId: number, blob: Blob): Promise<void> {
      await db.covers.put({ seriesId, blob, mime: blob.type || 'image/webp', updatedAt: Date.now() })
    },

    async deleteCover(seriesId: number): Promise<void> {
      await db.covers.delete(seriesId)
    },

    async getMeta<Value>(key: string): Promise<Value | undefined> {
      return (await db.meta.get(key))?.value as Value | undefined
    },

    async setMeta(key: string, value: unknown): Promise<void> {
      await db.meta.put({ key, value })
    },
  }
}

export type Repo = ReturnType<typeof createRepo>
export const repo = createRepo(defaultDb)
