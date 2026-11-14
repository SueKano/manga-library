import { ref } from 'vue'

/** Persistent-storage status for the Settings screen. null = not reported by the browser. */
export function useStoragePersistence() {
  const persisted = ref<boolean | null>(null)
  const usage = ref<StorageEstimate | null>(null)

  async function refresh() {
    persisted.value = (await navigator.storage?.persisted?.()) ?? null
    usage.value = (await navigator.storage?.estimate?.()) ?? null
  }

  /** Asks the browser not to evict the data under storage pressure. */
  async function requestPersistence() {
    await navigator.storage?.persist?.()
    await refresh()
  }

  return { persisted, usage, refresh, requestPersistence }
}
