<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppDialog from '@/components/AppDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import CoverImage from '@/components/CoverImage.vue'
import { useToast } from '@/composables/useToast'
import { STATUSES } from '@/db/types'
import { useCollectionStore } from '@/stores/collection'
import { formatRanges, statusPhrase } from '@/utils/collection'

const props = defineProps<{ id: number }>()

const router = useRouter()
const store = useCollectionStore()
const { show } = useToast()

const series = computed(() => store.getSeries(props.id))
const summary = computed(() => store.summaryOf(props.id))

watch(
  series,
  (current) => {
    if (!current) void router.replace({ name: 'series-list' })
  },
  { immediate: true },
)

const details = computed(() => {
  const current = series.value
  if (!current) return []
  return [
    current.author,
    current.publisher,
    STATUSES.find((status) => status.value === current.status)?.label,
    current.totalVolumes ? `${current.totalVolumes} tomos` : null,
  ].filter(Boolean) as string[]
})

const PER_ROW = 5
const EXTRA_STEP = PER_ROW * 2
/** Extra cells revealed with "Mostrar más"; resets when leaving the view. */
const extraCells = ref(0)

const cellCount = computed(() => {
  const total = series.value?.totalVolumes
  const last = summary.value.last ?? 0
  // With a known total the whole series is shown; otherwise leave room ahead.
  // Owned volumes are always part of the base, so "Mostrar menos" never hides them.
  const base = total ? Math.max(total, last) : Math.max(PER_ROW * 2, last + PER_ROW)
  return Math.ceil((base + extraCells.value) / PER_ROW) * PER_ROW
})
const owned = computed(() => new Set(summary.value.owned))

async function toggle(number: number) {
  navigator.vibrate?.(10)
  try {
    await store.toggleVolume(props.id, number)
  } catch (error) {
    console.error(error)
    show('No se pudo guardar el cambio')
  }
}

type VolumeState = 'owned' | 'next' | 'gap' | 'pending'

/** owned: I have it · next: the one to buy · gap: missing below my last one · pending: not yet. */
function volumeState(number: number): VolumeState {
  if (owned.value.has(number)) return 'owned'
  if (number === summary.value.next) return 'next'
  if (summary.value.gaps.includes(number)) return 'gap'
  return 'pending'
}

const VOLUME_LABELS: Record<VolumeState, string> = {
  owned: 'lo tengo. Tocar para desmarcar',
  next: 'no lo tengo (siguiente a comprar). Tocar para marcar',
  gap: 'me falta. Tocar para marcar',
  pending: 'no lo tengo. Tocar para marcar',
}

// ---------- mark up to N ----------

const MAX_VOLUME = 2000
const markDialogOpen = ref(false)
const markUpToValue = ref<number | null>(null)

function openMarkDialog() {
  markUpToValue.value = series.value?.totalVolumes ?? null
  markDialogOpen.value = true
}

const markUpToValid = computed(() => {
  const value = markUpToValue.value
  return value != null && Number.isInteger(value) && value >= 1 && value <= MAX_VOLUME
})

async function confirmMarkUpTo() {
  const value = markUpToValue.value
  if (!markUpToValid.value || value == null) return
  await store.markUpTo(props.id, value)
  navigator.vibrate?.(20)
  markDialogOpen.value = false
  show(`Marcados los tomos 1 a ${value}`)
}
</script>

<template>
  <article v-if="series" class="pb-24">
    <header class="sticky top-0 z-20 flex items-center gap-1 bg-bg px-1 pt-[max(0.25rem,env(safe-area-inset-top))] pb-1">
      <button class="btn-icon" aria-label="Volver" @click="router.back()">
        <AppIcon name="back" />
      </button>
      <h1 class="min-w-0 flex-1 truncate text-lg font-bold">{{ series.title }}</h1>
      <button class="btn-icon" :class="series.favorite ? 'text-accent-text' : 'text-muted'" :aria-pressed="series.favorite"
              aria-label="Favorita" @click="store.toggleFavorite(series.id)">
        <AppIcon name="star" :filled="series.favorite" />
      </button>
      <RouterLink :to="{ name: 'series-edit', params: { id: series.id } }" class="btn-icon" aria-label="Editar serie">
        <AppIcon name="edit" />
      </RouterLink>
    </header>

    <div class="flex gap-4 px-4 pt-2">
      <CoverImage :series-id="series.id" :title="series.title" class="w-28 shrink-0 text-2xl" />
      <div class="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <p class="text-xl leading-tight font-bold">{{ series.title }}</p>
        <p v-if="details.length" class="text-sm text-muted">{{ details.join(' · ') }}</p>
        <p v-if="summary.percent != null" class="text-sm text-muted">
          {{ summary.owned.length }} de {{ series.totalVolumes }} · {{ summary.percent }}%
        </p>
      </div>
    </div>

    <div class="mx-4 mt-4 rounded-2xl bg-accent-soft p-4" aria-live="polite">
      <p class="text-lg leading-snug font-bold" :class="summary.complete ? 'text-ok' : 'text-accent-text'">
        {{ statusPhrase(summary) }}
      </p>
      <p v-if="summary.gaps.length" class="mt-1 flex items-start gap-1.5 font-semibold text-warn">
        <AppIcon name="warning" :size="20" class="mt-0.5 shrink-0" />
        <span>
          {{ summary.gaps.length === 1 ? 'Te falta el tomo' : 'Te faltan los tomos' }}
          {{ formatRanges(summary.gaps) }}
        </span>
      </p>
    </div>

    <section class="mt-5 px-4" aria-labelledby="volumes-heading">
      <div class="mb-2 flex items-center justify-between">
        <h2 id="volumes-heading" class="text-base font-bold">Tomos</h2>
        <button class="btn-ghost -mr-2 px-2 text-sm" @click="openMarkDialog">Marcar hasta el tomo…</button>
      </div>

      <ul class="grid grid-cols-5 gap-2">
        <li v-for="number in cellCount" :key="number">
          <button class="volume-cell" :class="`volume-cell-${volumeState(number)}`" :aria-pressed="owned.has(number)"
                  :aria-label="`Tomo ${number}: ${VOLUME_LABELS[volumeState(number)]}`" @click="toggle(number)">
            {{ number }}
          </button>
        </li>
      </ul>

      <div class="mt-3 flex gap-2">
        <!-- Only shown after "Mostrar más"; never hides owned volumes (see `cellCount`). -->
        <button v-if="extraCells > 0" class="btn-secondary flex-1" @click="extraCells -= EXTRA_STEP">
          Mostrar menos
        </button>
        <button class="btn-secondary flex-1" @click="extraCells += EXTRA_STEP">
          <AppIcon name="plus" :size="20" /> Mostrar más<template v-if="extraCells === 0"> tomos</template>
        </button>
      </div>
    </section>


    <AppDialog v-model:open="markDialogOpen" title="Marcar hasta el tomo…">
      <form id="mark-up-to-form" @submit.prevent="confirmMarkUpTo">
        <label class="label" for="mark-up-to">Tengo todos los tomos del 1 al</label>
        <input
          id="mark-up-to"
          v-model.number="markUpToValue"
          type="number"
          inputmode="numeric"
          min="1"
          :max="MAX_VOLUME"
          step="1"
          class="input text-xl font-bold"
          placeholder="N"
        />
        <p class="mt-2 text-sm text-muted">Los tomos que ya tengas por encima de ese número no se tocan.</p>
      </form>
      <template #actions>
        <button class="btn-secondary" type="button" @click="markDialogOpen = false">Cancelar</button>
        <button class="btn-primary" type="submit" form="mark-up-to-form" :disabled="!markUpToValid">Marcar</button>
      </template>
    </AppDialog>
  </article>
</template>
