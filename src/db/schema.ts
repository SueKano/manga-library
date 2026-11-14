import Dexie, { type EntityTable, type Table, type Transaction } from 'dexie'
import type { Cover, MetaEntry, Series, Volume } from './types'

export const DB_NAME = 'manga-library'

export interface Migration {
  version: number
  stores: Record<string, string | null>
  upgrade?: (tx: Transaction) => Promise<unknown> | void
}

/**
 * Schema version history. NEVER edit a version that has already shipped:
 * to change the schema, append a new entry (with `upgrade` if data must be
 * transformed). Only indexed fields are declared here; other optional fields
 * need no migration.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    stores: {
      series: '++id, title, updatedAt',
      volumes: '++id, seriesId, &[seriesId+number]',
      covers: 'seriesId',
      meta: 'key',
    },
  },
]

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version

export class MangaDB extends Dexie {
  series!: EntityTable<Series, 'id'>
  volumes!: EntityTable<Volume, 'id'>
  covers!: Table<Cover, number>
  meta!: Table<MetaEntry, string>

  /** `upTo` opens the database at an older version (tests only). */
  constructor(name = DB_NAME, upTo = SCHEMA_VERSION) {
    super(name)
    for (const migration of MIGRATIONS) {
      if (migration.version > upTo) break
      const versionBuilder = this.version(migration.version).stores(migration.stores)
      if (migration.upgrade) versionBuilder.upgrade(migration.upgrade)
    }
  }
}

export const db = new MangaDB()
