<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ImportBackup from '@/components/ImportBackup.vue'
import { useBackup } from '@/composables/useBackup'
import { useInstallPrompt } from '@/composables/useInstallPrompt'
import { useStoragePersistence } from '@/composables/useStoragePersistence'
import { THEMES, useTheme, type Theme } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { db } from '@/db/schema'
import { useCollectionStore } from '@/stores/collection'
import { estimateSize } from '@/utils/backup'
import { formatBytes } from '@/utils/text'

const store = useCollectionStore()
const { show } = useToast()
const { busy, exportBackup } = useBackup()
const { persisted, usage, refresh, requestPersistence } = useStoragePersistence()
const { canInstall, installed, install } = useInstallPrompt()

const backupSize = ref<number | null>(null)
const coverCount = computed(() => Object.keys(store.coverVersions).length)

onMounted(async () => {
  void refresh()
  backupSize.value = await estimateSize(db).catch(() => null)
})

const lastBackupText = computed(() => {
  if (!store.lastExportAt) return 'Nunca has exportado una copia.'
  const days = store.daysSinceExport ?? 0
  const date = new Date(store.lastExportAt).toLocaleDateString('es', { dateStyle: 'long' })
  if (days === 0) return `Última copia: hoy (${date}).`
  return `Última copia: hace ${days} ${days === 1 ? 'día' : 'días'} (${date}).`
})

async function onExport() {
  try {
    const result = await exportBackup()
    if (result === 'shared') show('Copia exportada')
    else if (result === 'downloaded') show('Copia guardada en Descargas')
  } catch (error) {
    console.error(error)
    show('No se pudo exportar la copia')
  }
}

async function onRequestPersistence() {
  await requestPersistence()
  show(persisted.value ? 'Almacenamiento persistente concedido' : 'El navegador no lo ha concedido todavía')
}

async function onInstall() {
  if (await install()) show('App instalada')
}

const { theme, setTheme } = useTheme()
const THEME_LABELS: Record<Theme, string> = { auto: 'Automático', light: 'Claro', dark: 'Oscuro' }

const appVersion = __APP_VERSION__
</script>

<template>
  <header class="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
    <h1 class="text-2xl font-bold">Ajustes</h1>
  </header>

  <div class="flex flex-col gap-3 px-3 pb-6">
    <section class="card p-4" aria-labelledby="settings-theme">
      <h2 id="settings-theme" class="text-lg font-bold">Apariencia</h2>
      <div class="mt-3 flex gap-2" role="group" aria-label="Tema">
        <button v-for="option in THEMES" :key="option" class="flex-1 px-2" :class="theme === option ? 'btn-primary' : 'btn-secondary'"
                :aria-pressed="theme === option" @click="setTheme(option)">
          {{ THEME_LABELS[option] }}
        </button>
      </div>
      <p v-if="theme === 'auto'" class="mt-2 text-sm text-muted">Sigue el modo claro u oscuro del móvil.</p>
    </section>

    <section class="card p-4" aria-labelledby="settings-backup">
      <h2 id="settings-backup" class="text-lg font-bold">Copia de seguridad</h2>
      <p class="mt-1" :class="store.showBackupReminder ? 'font-semibold text-warn' : 'text-muted'">
        {{ lastBackupText }}
      </p>
      <p class="mt-1 text-sm text-muted">
        Un archivo JSON con todas las series, tomos y portadas.
        <template v-if="backupSize != null">
          Tamaño aproximado: <strong>{{ formatBytes(backupSize) }}</strong>.
        </template>
      </p>
      <div class="mt-3 flex flex-col gap-2">
        <button class="btn-primary" :disabled="busy || !store.series.length" @click="onExport">
          {{ busy ? 'Preparando…' : 'Exportar copia' }}
        </button>
        <ImportBackup button-class="btn-secondary" />
      </div>
    </section>

    <section class="card p-4" aria-labelledby="settings-storage">
      <h2 id="settings-storage" class="text-lg font-bold">Almacenamiento</h2>
      <p class="mt-1">
        Persistente:
        <strong v-if="persisted === true" class="text-ok">concedido</strong>
        <strong v-else-if="persisted === false" class="text-warn">no concedido</strong>
        <span v-else class="text-muted">no disponible en este navegador</span>
      </p>
      <p v-if="persisted === false" class="mt-1 text-sm text-muted">
        Sin él, Android podría borrar los datos si el móvil se queda sin espacio. Chrome suele concederlo al instalar la
        app; mientras tanto, exporta copias.
      </p>
      <p v-if="usage" class="mt-1 text-sm text-muted">
        En uso: {{ formatBytes(usage.usage ?? 0) }}<template v-if="usage.quota"> de {{ formatBytes(usage.quota) }} disponibles</template>.
      </p>
      <button v-if="persisted === false" class="btn-secondary mt-3 w-full" @click="onRequestPersistence">
        Solicitar almacenamiento persistente
      </button>
    </section>

    <section class="card p-4" aria-labelledby="settings-app">
      <h2 id="settings-app" class="text-lg font-bold">Aplicación</h2>
      <p v-if="installed" class="mt-1 text-muted">La app está instalada en este dispositivo.</p>
      <template v-else-if="canInstall">
        <p class="mt-1 text-muted">Instálala para abrirla desde la pantalla de inicio, a pantalla completa.</p>
        <button class="btn-primary mt-3 w-full" @click="onInstall">Instalar app</button>
      </template>
      <p v-else class="mt-1 text-muted">
        Para instalarla, usa «Añadir a pantalla de inicio» en el menú de Chrome.
      </p>
      <p class="mt-3 text-sm text-muted">
        {{ store.series.length }} series · {{ store.ownedVolumeCount }} tomos · {{ coverCount }} portadas · v{{ appVersion }}
      </p>
    </section>
  </div>
</template>
