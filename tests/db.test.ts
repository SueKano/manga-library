import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { MangaDB, MIGRATIONS, SCHEMA_VERSION } from '@/db/schema'
import { createRepo, type Repo } from '@/db/repo'
import {
  BACKUP_VERSION,
  ImportError,
  base64ToBytes,
  bytesToBase64,
  createBackup,
  estimateSize,
  exportJSON,
  importJSON,
  parseBackup,
} from '@/utils/backup'

let counter = 0
let db: MangaDB
let repo: Repo

beforeEach(() => {
  db = new MangaDB(`test-${++counter}`)
  repo = createRepo(db)
})
afterEach(async () => {
  await db.delete()
})

const base = { totalVolumes: null, favorite: false }
const image = (bytes: number[]) => new Blob([new Uint8Array(bytes)], { type: 'image/webp' })
const bytesOf = async (blob: Blob) => [...new Uint8Array(await blob.arrayBuffer())]

/** Full, comparable database state (covers as bytes). */
async function dump(database: MangaDB) {
  const covers = await database.covers.toArray()
  return {
    series: await database.series.orderBy('id').toArray(),
    volumes: await database.volumes.orderBy('id').toArray(),
    covers: await Promise.all(
      covers.map(async (cover) => ({
        seriesId: cover.seriesId,
        mime: cover.mime,
        updatedAt: cover.updatedAt,
        bytes: await bytesOf(cover.blob),
      })),
    ),
  }
}

async function seed() {
  const berserk = await repo.createSeries({ ...base, title: 'Berserk', author: 'Kentaro Miura', status: 'ongoing', favorite: true })
  const monster = await repo.createSeries({ ...base, title: 'Monster', totalVolumes: 9, status: 'completed' })
  await repo.markUpTo(berserk.id, 3)
  await repo.setVolume(berserk.id, 5, true, { purchaseDate: '2026-01-02', price: 9.5 })
  await repo.setVolume(monster.id, 1, true)
  await repo.setVolume(monster.id, 2, true)
  await repo.setVolume(monster.id, 2, false)
  await repo.setCover(berserk.id, image([0, 1, 2, 250, 251, 255]))
  await repo.setCover(monster.id, image(Array.from({ length: 70_000 }, (_, index) => index % 256)))
  return { berserk, monster }
}

describe('repository', () => {
  it('creates series dropping empty optional fields', async () => {
    const created = await repo.createSeries({ ...base, title: '  Akira ', author: '  ', totalVolumes: 0 })
    expect(created.title).toBe('Akira')
    expect('author' in created).toBe(false)
    expect(created.totalVolumes).toBeNull()
    expect(await db.series.get(created.id)).toEqual(created)
  })

  it('rejects empty titles', async () => {
    await expect(repo.createSeries({ ...base, title: '   ' })).rejects.toThrow()
  })

  it('on edit, cleared optional fields are removed and createdAt is kept', async () => {
    const created = await repo.createSeries({ ...base, title: 'Akira', author: 'Otomo' })
    const edited = await repo.updateSeries(created.id, { ...base, title: 'Akira', author: '' })
    expect('author' in edited).toBe(false)
    expect(edited.createdAt).toBe(created.createdAt)
  })

  it('toggling a volume keeps its data and does not duplicate rows', async () => {
    const created = await repo.createSeries({ ...base, title: 'Akira' })
    await repo.setVolume(created.id, 4, true, { price: 12 })
    await repo.setVolume(created.id, 4, false)
    const { volume } = await repo.setVolume(created.id, 4, true)
    expect(volume).toMatchObject({ number: 4, owned: true, price: 12 })
    expect(await db.volumes.count()).toBe(1)
  })

  it('the [seriesId+number] index prevents duplicates', async () => {
    const created = await repo.createSeries({ ...base, title: 'Akira' })
    await db.volumes.add({ seriesId: created.id, number: 1, owned: true })
    await expect(db.volumes.add({ seriesId: created.id, number: 1, owned: true })).rejects.toThrow()
  })

  it('markUpTo fills 1..N without touching higher volumes', async () => {
    const created = await repo.createSeries({ ...base, title: 'Akira' })
    await repo.setVolume(created.id, 2, false, { price: 7 })
    await repo.setVolume(created.id, 8, true)
    const { volumes } = await repo.markUpTo(created.id, 4)
    const owned = volumes.filter((volume) => volume.owned).map((volume) => volume.number).sort((first, second) => first - second)
    expect(owned).toEqual([1, 2, 3, 4, 8])
    expect(volumes.find((volume) => volume.number === 2)?.price).toBe(7)
  })

  it('deleting a series deletes its volumes and cover, and nothing else', async () => {
    const { berserk, monster } = await seed()
    await repo.deleteSeries(berserk.id)
    expect(await db.series.toCollection().primaryKeys()).toEqual([monster.id])
    expect(await db.volumes.where('seriesId').equals(berserk.id).count()).toBe(0)
    expect(await db.volumes.where('seriesId').equals(monster.id).count()).toBe(2)
    expect(await db.covers.toCollection().primaryKeys()).toEqual([monster.id])
  })

  it('loadAll does not load cover blobs', async () => {
    const { berserk, monster } = await seed()
    const all = await repo.loadAll()
    expect(all.series).toHaveLength(2)
    expect(all.coverIds).toEqual([berserk.id, monster.id])
  })

  it('meta stores and reads values', async () => {
    expect(await repo.getMeta('x')).toBeUndefined()
    await repo.setMeta('x', 42)
    expect(await repo.getMeta('x')).toBe(42)
  })
})

describe('export / import', () => {
  it('base64 round trip, including large payloads', () => {
    const bytes = new Uint8Array(100_001).map((_, index) => (index * 7) % 256)
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes])
    expect(bytesToBase64(new Uint8Array())).toBe('')
  })

  it('importing an export restores the exact state (covers included)', async () => {
    await seed()
    const before = await dump(db)
    const json = await exportJSON(db)

    const target = new MangaDB(`test-target-${counter}`)
    try {
      // The target database has previous data that must disappear.
      const targetRepo = createRepo(target)
      const old = await targetRepo.createSeries({ ...base, title: 'Old' })
      await targetRepo.setVolume(old.id, 1, true)
      await targetRepo.setCover(old.id, image([9]))

      await importJSON(target, json)
      expect(await dump(target)).toEqual(before)

      // After importing, new rows do not collide with restored ids.
      const fresh = await targetRepo.createSeries({ ...base, title: 'New' })
      expect(before.series.map((item) => item.id)).not.toContain(fresh.id)
    } finally {
      await target.delete()
    }
  })

  it('export → import → export is stable', async () => {
    await seed()
    const first = await createBackup(db)
    await importJSON(db, JSON.stringify(first))
    const second = await createBackup(db)
    expect({ ...second, exportedAt: '' }).toEqual({ ...first, exportedAt: '' })
  })

  it('the size estimate is close to the real size', async () => {
    await seed()
    const real = (await exportJSON(db)).length
    const estimated = await estimateSize(db)
    expect(Math.abs(estimated - real) / real).toBeLessThan(0.05)
  })

  it('an empty database exports and imports', async () => {
    const json = await exportJSON(db)
    await importJSON(db, json)
    expect(await db.series.count()).toBe(0)
  })

  describe('invalid JSON', () => {
    const valid = () => ({
      app: 'manga-library',
      version: BACKUP_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      series: [{ id: 1, title: 'A', totalVolumes: null, favorite: false, createdAt: 1, updatedAt: 1 }],
      volumes: [{ id: 1, seriesId: 1, number: 1, owned: true }],
      covers: [{ seriesId: 1, mime: 'image/webp', updatedAt: 1, data: 'AAEC' }],
    })
    const broken = (change: (backup: any) => void) => {
      const backup = valid()
      change(backup)
      return JSON.stringify(backup)
    }

    it('the reference backup is valid', () => {
      expect(() => parseBackup(JSON.stringify(valid()))).not.toThrow()
    })

    const cases: [string, string][] = [
      ['text that is not JSON', '{this is not json'],
      ['empty file', ''],
      ['unrelated JSON', '{"hello":1}'],
      ['an array', '[]'],
      ['another app', broken((backup) => (backup.app = 'other'))],
      ['missing version', broken((backup) => delete backup.version)],
      ['future version', broken((backup) => (backup.version = BACKUP_VERSION + 1))],
      ['missing series', broken((backup) => delete backup.series)],
      ['series without title', broken((backup) => (backup.series[0].title = ''))],
      ['series with invalid id', broken((backup) => (backup.series[0].id = 'x'))],
      ['unknown status', broken((backup) => (backup.series[0].status = 'cancelled'))],
      ['negative total', broken((backup) => (backup.series[0].totalVolumes = -1))],
      ['orphan volume', broken((backup) => (backup.volumes[0].seriesId = 99))],
      ['volume number 0', broken((backup) => (backup.volumes[0].number = 0))],
      ['volume without "owned"', broken((backup) => delete backup.volumes[0].owned)],
      ['orphan cover', broken((backup) => (backup.covers[0].seriesId = 99))],
      ['cover with broken base64', broken((backup) => (backup.covers[0].data = '¡¡no!!'))],
      ['cover that is not an image', broken((backup) => (backup.covers[0].mime = 'text/html'))],
    ]
    it.each(cases)('rejects: %s', (_name, text) => {
      expect(() => parseBackup(text)).toThrow(ImportError)
    })

    // Not caught by parseBackup: IndexedDB rejects them and the transaction rolls back.
    const duplicates: [string, string][] = [
      ['duplicated series', broken((backup) => backup.series.push({ ...backup.series[0] }))],
      ['duplicated volume id', broken((backup) => backup.volumes.push({ ...backup.volumes[0], number: 2 }))],
      ['repeated volume number', broken((backup) => backup.volumes.push({ ...backup.volumes[0], id: 2 }))],
      ['duplicated cover', broken((backup) => backup.covers.push({ ...backup.covers[0] }))],
    ]
    it.each(duplicates)('restore rejects %s and keeps existing data', async (_name, text) => {
      await seed()
      const before = await dump(db)
      await expect(importJSON(db, text)).rejects.toThrow()
      expect(await dump(db)).toEqual(before)
    })

    it('a failed import leaves existing data untouched', async () => {
      await seed()
      const before = await dump(db)
      await expect(importJSON(db, broken((backup) => (backup.volumes[0].seriesId = 99)))).rejects.toThrow(ImportError)
      expect(await dump(db)).toEqual(before)
    })
  })
})

describe('migrations', () => {
  it('versions are increasing and the last one is the schema version', () => {
    const versions = MIGRATIONS.map((migration) => migration.version)
    expect(versions).toEqual([...versions].sort((first, second) => first - second))
    expect(new Set(versions).size).toBe(versions.length)
    expect(SCHEMA_VERSION).toBe(versions[versions.length - 1])
  })

  it('the current schema has the expected tables and indexes', async () => {
    await db.open()
    expect(db.verno).toBe(SCHEMA_VERSION)
    expect(db.tables.map((table) => table.name).sort()).toEqual(['covers', 'meta', 'series', 'volumes'])
    expect(db.volumes.schema.indexes.map((index) => index.name)).toContain('[seriesId+number]')
    expect(db.covers.schema.primKey.name).toBe('seriesId')
  })

  // Walks the history: creates the database at each old version with data and
  // opens it with the current schema. Once a version 2 exists, this test will
  // actually run its `upgrade`.
  it.each(MIGRATIONS.map((migration) => migration.version))('data created at v%i survives opening with the current version', async (version) => {
    const name = `test-migration-${version}`
    const old = new MangaDB(name, version)
    const id = await old.table('series').add({ title: 'Vagabond', totalVolumes: 37, favorite: false, createdAt: 1, updatedAt: 1 })
    await old.table('volumes').add({ seriesId: id, number: 1, owned: true })
    old.close()

    const current = new MangaDB(name)
    try {
      await current.open()
      expect(current.verno).toBe(SCHEMA_VERSION)
      expect((await current.series.get(id as number))?.title).toBe('Vagabond')
      expect(await current.volumes.where('[seriesId+number]').equals([id as number, 1]).count()).toBe(1)
    } finally {
      await current.delete()
    }
  })

  it('reopening the database keeps the data', async () => {
    const created = await repo.createSeries({ ...base, title: 'Persistent' })
    db.close()
    const reopened = new MangaDB(db.name)
    expect((await reopened.series.get(created.id))?.title).toBe('Persistent')
    reopened.close()
    expect(await Dexie.exists(db.name)).toBe(true)
  })
})
