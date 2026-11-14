<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import AppDialog from './AppDialog.vue'
import { useBackup } from '@/composables/useBackup'
import { useToast } from '@/composables/useToast'
import { useCollectionStore } from '@/stores/collection'
import { parseBackup, type Backup } from '@/utils/backup'

defineProps<{ buttonClass?: string }>()

const store = useCollectionStore()
const { busy, restore } = useBackup()
const { show } = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
// shallowRef: IndexedDB cannot clone Vue's reactive proxies.
const pending = shallowRef<Backup | null>(null)
const error = ref<string | null>(null)

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allows picking the same file again
  if (!file) return
  try {
    pending.value = parseBackup(await file.text())
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo leer el archivo'
  }
}

async function confirm() {
  const backup = pending.value
  if (!backup) return
  try {
    await restore(backup)
    pending.value = null
    show(`Copia restaurada: ${backup.series.length} series`)
  } catch (cause) {
    console.error(cause)
    pending.value = null
    error.value = 'No se pudo restaurar la copia. Tus datos anteriores siguen intactos.'
  }
}

function backupDate(backup: Backup) {
  const date = new Date(backup.exportedAt)
  return Number.isNaN(date.getTime()) ? 'fecha desconocida' : date.toLocaleDateString('es', { dateStyle: 'long' })
}
</script>

<template>
  <button :class="buttonClass ?? 'btn-secondary'" :disabled="busy" @click="fileInput?.click()">
    <slot>Importar copia</slot>
  </button>
  <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="onFileChosen" />

  <AppDialog :open="!!pending" title="¿Restaurar esta copia?" @update:open="pending = null">
    <template v-if="pending">
      <p>
        Copia del {{ backupDate(pending) }} con <strong>{{ pending.series.length }} series</strong>,
        {{ pending.volumes.filter((volume) => volume.owned).length }} tomos y {{ pending.covers.length }} portadas.
      </p>
      <p v-if="store.series.length" class="mt-2 font-semibold text-warn">
        Se sustituirán las {{ store.series.length }} series que hay ahora en este dispositivo.
      </p>
    </template>
    <template #actions>
      <button class="btn-secondary" @click="pending = null">Cancelar</button>
      <button class="btn-primary" :disabled="busy" @click="confirm">Restaurar</button>
    </template>
  </AppDialog>

  <AppDialog :open="!!error" title="No se pudo importar" @update:open="error = null">
    <p>{{ error }}</p>
    <template #actions>
      <button class="btn-primary" @click="error = null">Entendido</button>
    </template>
  </AppDialog>
</template>
