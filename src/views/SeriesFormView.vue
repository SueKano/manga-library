<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppDialog from '@/components/AppDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import CoverImage from '@/components/CoverImage.vue'
import { useToast } from '@/composables/useToast'
import { STATUSES, type PublicationStatus } from '@/db/types'
import { useCollectionStore } from '@/stores/collection'
import { lastPurchase } from '@/utils/collection'
import { processCover } from '@/utils/image'
import { formatBytes } from '@/utils/text'

/** `id` is set when editing an existing series; `initialTitle` pre-fills a new one. */
const props = defineProps<{ id?: number; initialTitle?: string }>()

const router = useRouter()
const store = useCollectionStore()
const { show } = useToast()

const MAX_VOLUME = 2000

const editId = props.id ?? null
const original = editId != null ? store.getSeries(editId) : undefined
if (editId != null && !original) void router.replace({ name: 'series-list' })

const form = reactive({
  title: original?.title ?? props.initialTitle ?? '',
  author: original?.author ?? '',
  publisher: original?.publisher ?? '',
  status: (original?.status ?? '') as PublicationStatus | '',
  totalVolumes: (original?.totalVolumes ?? null) as number | null | '',
  favorite: original?.favorite ?? false,
})
/** New series only: marks volumes 1..N when the series is created. */
const ownedUpTo = ref<number | null | ''>(null)

const saving = ref(false)
const submitted = ref(false)
const titleValid = computed(() => form.title.trim().length > 0)

/** Edit only, informative: "Último tomo comprado: … · Siguiente: N". Empty when there is nothing to say. */
const purchaseInfo = computed(() => {
  if (editId == null) return ''
  const purchase = lastPurchase(store.volumes.filter((volume) => volume.seriesId === editId))
  const next = store.summaryOf(editId).next
  const parts: string[] = []
  if (purchase) {
    const date = new Date(`${purchase.date}T00:00`).toLocaleDateString('es', { dateStyle: 'long' })
    parts.push(`Último tomo comprado: el ${purchase.number}, el ${date}`)
  }
  if (next != null) parts.push(`Siguiente: ${next}`)
  return parts.join(' · ')
})

// The cover is not written to the database until "Guardar" is tapped.

const newCover = ref<Blob | null>(null)
const coverRemoved = ref(false)
const previewUrl = ref<string | null>(null)
const processing = ref(false)
const cameraInput = ref<HTMLInputElement | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)

const hasCover = computed(
  () => !!newCover.value || (!coverRemoved.value && editId != null && store.coverVersions[editId] != null),
)

function releasePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
}
onBeforeUnmount(releasePreview)

async function onPhotoChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  processing.value = true
  try {
    const blob = await processCover(file)
    releasePreview()
    newCover.value = blob
    coverRemoved.value = false
    previewUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    console.error(error)
    show('No se pudo procesar la imagen')
  } finally {
    processing.value = false
  }
}

function removeCover() {
  releasePreview()
  newCover.value = null
  coverRemoved.value = true
}

const toPositiveInt = (value: number | null | '') =>
  typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : null

async function save() {
  submitted.value = true
  if (!titleValid.value || saving.value) return
  saving.value = true
  try {
    const input = {
      title: form.title,
      author: form.author,
      publisher: form.publisher,
      status: form.status || undefined,
      totalVolumes: toPositiveInt(form.totalVolumes),
      favorite: form.favorite,
    }
    const saved = editId != null ? await store.updateSeries(editId, input) : await store.createSeries(input)

    if (newCover.value) await store.saveCover(saved.id, newCover.value)
    else if (coverRemoved.value && editId != null) await store.removeCover(saved.id)

    const upTo = editId == null ? toPositiveInt(ownedUpTo.value) : null
    if (upTo) await store.markUpTo(saved.id, Math.min(upTo, MAX_VOLUME))

    if (editId != null) router.back()
    else await router.replace({ name: 'series-detail', params: { id: saved.id } })
  } catch (error) {
    console.error(error)
    show('No se pudo guardar la serie')
  } finally {
    saving.value = false
  }
}

const deleteDialogOpen = ref(false)

async function deleteSeries() {
  if (editId == null) return
  const title = original?.title
  await store.deleteSeries(editId)
  deleteDialogOpen.value = false
  show(`«${title}» eliminada`)
  // Skip the detail view (it no longer exists) and go back to the list.
  await router.replace({ name: 'series-list' })
}
</script>

<template>
  <form class="pb-24" novalidate @submit.prevent="save">
    <header class="sticky top-0 z-20 flex items-center gap-1 bg-bg px-1 pt-[max(0.25rem,env(safe-area-inset-top))] pb-1">
      <button type="button" class="btn-icon" aria-label="Cancelar" @click="router.back()">
        <AppIcon name="close" />
      </button>
      <h1 class="flex-1 text-lg font-bold">{{ editId != null ? 'Editar serie' : 'Nueva serie' }}</h1>
      <button type="submit" class="btn-primary mr-2" :disabled="saving || processing">Guardar</button>
    </header>

    <div class="flex flex-col gap-4 px-4 pt-2">
      <p v-if="purchaseInfo" class="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{{ purchaseInfo }}</p>

      <div class="flex items-center gap-4">
        <CoverImage :series-id="coverRemoved ? undefined : (editId ?? undefined)" :title="form.title || '?'" :preview="previewUrl" class="w-24 shrink-0 text-xl"/>
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <button type="button" class="btn-secondary" :disabled="processing" @click="cameraInput?.click()">
            <AppIcon name="camera" :size="20" /> {{ hasCover ? 'Repetir foto' : 'Añadir portada' }}
          </button>
          <button type="button" class="btn-secondary" :disabled="processing" @click="galleryInput?.click()">
            <AppIcon name="image" :size="20" /> Elegir de la galería
          </button>
          <button v-if="hasCover" type="button" class="btn-ghost" @click="removeCover">Quitar portada</button>
          <p v-if="processing" class="text-sm text-muted" role="status">Procesando imagen…</p>
          <p v-else-if="newCover" class="text-sm text-muted">Nueva portada: {{ formatBytes(newCover.size) }}</p>
        </div>
        <!-- `capture` opens the camera directly; the second input allows picking from the gallery -->
        <input ref="cameraInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onPhotoChosen" />
        <input ref="galleryInput" type="file" accept="image/*" class="hidden" @change="onPhotoChosen" />
      </div>

      <div>
        <label class="label" for="title">Título *</label>
        <input id="title" v-model="form.title" class="input" :class="{ 'border-accent': submitted && !titleValid }" required autocomplete="off"
               autocapitalize="words" :autofocus="editId == null" :aria-invalid="submitted && !titleValid" aria-describedby="title-error"/>
        <p v-if="submitted && !titleValid" id="title-error" class="mt-1 text-sm font-medium text-accent-text" role="alert">
          El título es obligatorio.
        </p>
      </div>

      <div v-if="editId == null">
        <label class="label" for="owned-up-to">Tengo hasta el tomo</label>
        <input id="owned-up-to" v-model.number="ownedUpTo" type="number" inputmode="numeric" min="1" :max="MAX_VOLUME" class="input"
               placeholder="Opcional: marca del 1 al N"/>
      </div>

      <div>
        <label class="label" for="author">Autor</label>
        <input id="author" v-model="form.author" class="input" autocomplete="off" autocapitalize="words" />
      </div>

      <div>
        <label class="label" for="publisher">Editorial</label>
        <input id="publisher" v-model="form.publisher" class="input" autocomplete="off" autocapitalize="words" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label" for="status">Publicación</label>
          <select id="status" v-model="form.status" class="input">
            <option value="">Sin indicar</option>
            <option v-for="status in STATUSES" :key="status.value" :value="status.value">{{ status.label }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="total-volumes">Total de tomos</label>
          <input id="total-volumes" v-model.number="form.totalVolumes" type="number" inputmode="numeric" min="1" :max="MAX_VOLUME" class="input" placeholder="¿?"/>
        </div>
      </div>

      <label class="flex min-h-12 items-center gap-3 text-base font-medium">
        <input v-model="form.favorite" type="checkbox" class="size-6 accent-(--color-accent)" />
        Favorita
      </label>

      <button v-if="editId != null" type="button" class="btn mt-4 border border-line text-accent-text" @click="deleteDialogOpen = true">
        <AppIcon name="trash" :size="20" /> Borrar serie
      </button>
    </div>

    <AppDialog v-model:open="deleteDialogOpen" title="¿Borrar esta serie?">
      <p>
        Se eliminará <strong>{{ original?.title }}</strong> con todos sus tomos y su portada. Esta acción no se puede deshacer.
      </p>
      <template #actions>
        <button type="button" class="btn-secondary" @click="deleteDialogOpen = false">Cancelar</button>
        <button type="button" class="btn-primary" @click="deleteSeries">Borrar</button>
      </template>
    </AppDialog>
  </form>
</template>
