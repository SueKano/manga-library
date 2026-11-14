import { ref } from 'vue'
import { db } from '@/db/schema'
import { useCollectionStore } from '@/stores/collection'
import { backupFileName, exportJSON, restoreBackup, type Backup } from '@/utils/backup'

export type ExportResult = 'shared' | 'downloaded' | 'cancelled'

function download(file: File) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(file)
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
}

/** Shares the file (Drive, etc.) when the system allows it; otherwise downloads it. */
async function shareOrDownload(file: File): Promise<ExportResult> {
  if (!navigator.canShare?.({ files: [file] })) {
    download(file)
    return 'downloaded'
  }
  try {
    await navigator.share({ files: [file], title: 'Copia de mi colección de manga' })
    return 'shared'
  } catch (error) {
    if ((error as DOMException).name === 'AbortError') return 'cancelled'
    download(file)
    return 'downloaded'
  }
}

export function useBackup() {
  const store = useCollectionStore()
  const busy = ref(false)

  async function exportBackup(): Promise<ExportResult> {
    busy.value = true
    try {
      const file = new File([await exportJSON(db)], backupFileName(), { type: 'application/json' })
      const result = await shareOrDownload(file)
      if (result !== 'cancelled') await store.recordExport()
      return result
    } finally {
      busy.value = false
    }
  }

  /** Replaces all data with the backup's and reloads the store. */
  async function restore(backup: Backup) {
    busy.value = true
    try {
      await restoreBackup(db, backup)
      await store.load()
    } finally {
      busy.value = false
    }
  }

  return { busy, exportBackup, restore }
}
