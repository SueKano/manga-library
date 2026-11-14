import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { repo, type VolumeExtra } from '@/db/repo'
import type { Series, SeriesInput, Volume } from '@/db/types'
import { computeSummary, type Summary } from '@/utils/collection'
import { matches, normalize } from '@/utils/text'

export type SortOrder = 'alphabetical' | 'recent'

const META_LAST_EXPORT = 'lastExportAt'
const META_REMINDER_SNOOZED = 'backupReminderSnoozedUntil'
const META_SORT_ORDER = 'sortOrder'
const DAY_MS = 86_400_000
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

export const useCollectionStore = defineStore('collection', () => {
  const series = ref<Series[]>([])
  const volumes = ref<Volume[]>([])
  /** seriesId → version stamp of its cover. No entry = no cover. */
  const coverVersions = ref<Record<number, number>>({})
  const loaded = ref(false)
  const loadError = ref<string | null>(null)

  // Series list screen state (kept when coming back from the detail view).
  const query = ref('')
  const sortOrder = ref<SortOrder>('alphabetical')
  const favoritesOnly = ref(false)

  const lastExportAt = ref<number | null>(null)
  const reminderSnoozedUntil = ref(0)

  // ---------- derived ----------

  const volumesBySeries = computed(() => {
    const map = new Map<number, Volume[]>()
    for (const volume of volumes.value) {
      const list = map.get(volume.seriesId)
      if (list) list.push(volume)
      else map.set(volume.seriesId, [volume])
    }
    return map
  })

  const summaries = computed(() => {
    const map = new Map<number, Summary>()
    for (const seriesItem of series.value) {
      const seriesVolumes = volumesBySeries.value.get(seriesItem.id) ?? []
      const ownedNumbers = seriesVolumes.filter((volume) => volume.owned).map((volume) => volume.number)
      map.set(seriesItem.id, computeSummary(ownedNumbers, seriesItem.totalVolumes))
    }
    return map
  })

  /** Searchable text of each series, already normalized. */
  const searchIndex = computed(() => {
    const map = new Map<number, string>()
    for (const seriesItem of series.value) {
      const searchableFields = [seriesItem.title, seriesItem.author, seriesItem.publisher]
      map.set(seriesItem.id, normalize(searchableFields.filter(Boolean).join(' ')))
    }
    return map
  })

  /** Series matching the query and the favorites filter, in the chosen order. */
  const filteredSeries = computed(() =>
    series.value
      .filter(
        (seriesItem) =>
          (!favoritesOnly.value || seriesItem.favorite) &&
          matches(searchIndex.value.get(seriesItem.id) ?? '', query.value),
      )
      .sort((first, second) =>
        sortOrder.value === 'recent' ? second.updatedAt - first.updatedAt : collator.compare(first.title, second.title),
      ),
  )

  const ownedVolumeCount = computed(() => volumes.value.filter((volume) => volume.owned).length)

  /** Days since the last backup (or since the first series if never exported). */
  const daysSinceExport = computed<number | null>(() => {
    if (!series.value.length) return null
    const since = lastExportAt.value ?? Math.min(...series.value.map((seriesItem) => seriesItem.createdAt))
    return Math.max(0, Math.floor((Date.now() - since) / DAY_MS))
  })

  const showBackupReminder = computed(() => {
    const days = daysSinceExport.value
    if (days == null || Date.now() < reminderSnoozedUntil.value) return false
    return days >= (lastExportAt.value == null ? 7 : 30)
  })

  function getSeries(id: number) {
    return series.value.find((seriesItem) => seriesItem.id === id)
  }
  function summaryOf(id: number): Summary {
    return summaries.value.get(id) ?? computeSummary([], null)
  }

  // ---------- loading ----------

  async function load() {
    try {
      const [all, exportedAt, snoozedUntil, savedOrder] = await Promise.all([
        repo.loadAll(),
        repo.getMeta<number>(META_LAST_EXPORT),
        repo.getMeta<number>(META_REMINDER_SNOOZED),
        repo.getMeta<SortOrder>(META_SORT_ORDER),
      ])
      series.value = all.series
      volumes.value = all.volumes
      const now = Date.now()
      coverVersions.value = Object.fromEntries(all.coverIds.map((id) => [id, now]))
      lastExportAt.value = exportedAt ?? null
      reminderSnoozedUntil.value = snoozedUntil ?? 0
      if (savedOrder === 'alphabetical' || savedOrder === 'recent') sortOrder.value = savedOrder
      loadError.value = null
    } catch (error) {
      console.error(error)
      loadError.value = 'No se pudo abrir la base de datos del dispositivo.'
    } finally {
      loaded.value = true
    }
  }

  // ---------- series ----------

  async function createSeries(input: SeriesInput): Promise<Series> {
    const created = await repo.createSeries(input)
    series.value.push(created)
    return created
  }

  async function updateSeries(id: number, input: SeriesInput): Promise<Series> {
    const updated = await repo.updateSeries(id, input)
    const index = series.value.findIndex((seriesItem) => seriesItem.id === id)
    if (index >= 0) series.value[index] = updated
    return updated
  }

  async function toggleFavorite(id: number) {
    const seriesItem = getSeries(id)
    if (!seriesItem) return
    await repo.setFavorite(id, !seriesItem.favorite)
    seriesItem.favorite = !seriesItem.favorite
  }

  async function deleteSeries(id: number) {
    await repo.deleteSeries(id)
    series.value = series.value.filter((seriesItem) => seriesItem.id !== id)
    volumes.value = volumes.value.filter((volume) => volume.seriesId !== id)
    delete coverVersions.value[id]
  }

  // ---------- volumes ----------

  function touch(seriesId: number, updatedAt: number) {
    const seriesItem = getSeries(seriesId)
    if (seriesItem) seriesItem.updatedAt = updatedAt
  }

  async function setVolume(seriesId: number, number: number, owned: boolean, extra?: VolumeExtra) {
    const { volume, updatedAt } = await repo.setVolume(seriesId, number, owned, extra)
    const index = volumes.value.findIndex((existing) => existing.id === volume.id)
    if (index >= 0) volumes.value[index] = volume
    else volumes.value.push(volume)
    touch(seriesId, updatedAt)
  }

  async function toggleVolume(seriesId: number, number: number) {
    const owned = summaryOf(seriesId).owned.includes(number)
    await setVolume(seriesId, number, !owned)
    return !owned
  }

  async function markUpTo(seriesId: number, upTo: number) {
    const result = await repo.markUpTo(seriesId, upTo)
    volumes.value = [...volumes.value.filter((volume) => volume.seriesId !== seriesId), ...result.volumes]
    touch(seriesId, result.updatedAt)
  }

  // ---------- covers ----------

  async function saveCover(seriesId: number, blob: Blob) {
    await repo.setCover(seriesId, blob)
    coverVersions.value[seriesId] = Date.now()
  }

  async function removeCover(seriesId: number) {
    await repo.deleteCover(seriesId)
    delete coverVersions.value[seriesId]
  }

  // ---------- preferences / backups ----------

  async function setSortOrder(order: SortOrder) {
    sortOrder.value = order
    await repo.setMeta(META_SORT_ORDER, order)
  }

  async function recordExport() {
    lastExportAt.value = Date.now()
    await repo.setMeta(META_LAST_EXPORT, lastExportAt.value)
  }

  async function snoozeBackupReminder(days = 7) {
    reminderSnoozedUntil.value = Date.now() + days * DAY_MS
    await repo.setMeta(META_REMINDER_SNOOZED, reminderSnoozedUntil.value)
  }

  return {
    series, volumes, coverVersions, loaded, loadError,
    query, sortOrder, favoritesOnly, lastExportAt,
    summaries, filteredSeries, ownedVolumeCount, daysSinceExport, showBackupReminder,
    getSeries, summaryOf, load, createSeries, updateSeries, toggleFavorite, deleteSeries,
    setVolume, toggleVolume, markUpTo, saveCover, removeCover,
    setSortOrder, recordExport, snoozeBackupReminder,
  }
})
