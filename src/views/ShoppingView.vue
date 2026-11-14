<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import CoverImage from '@/components/CoverImage.vue'
import { useToast } from '@/composables/useToast'
import type { Series } from '@/db/types'
import { useCollectionStore } from '@/stores/collection'
import { todayISO } from '@/utils/text'

const store = useCollectionStore()
const { show } = useToast()
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

const MAX_GAPS_SHOWN = 5

/** Series with something pending: a next volume and/or gaps. Favorites first. */
const pending = computed(() =>
  store.series
    .map((series) => ({ series, summary: store.summaryOf(series.id) }))
    .filter(({ summary }) => summary.next != null || summary.gaps.length > 0)
    .sort(
      (first, second) =>
        Number(second.series.favorite) - Number(first.series.favorite) || collator.compare(first.series.title, second.series.title),
    ),
)

async function addVolume(series: Series, number: number) {
  navigator.vibrate?.(15)
  try {
    await store.setVolume(series.id, number, true, { purchaseDate: todayISO() })
    show(`${series.title} · tomo ${number} añadido`, {
      label: 'Deshacer',
      run: () => void store.setVolume(series.id, number, false, { purchaseDate: undefined }),
    })
  } catch (error) {
    console.error(error)
    show('No se pudo guardar el cambio')
  }
}
</script>

<template>
  <header class="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
    <h1 class="text-2xl font-bold">Lista de la compra</h1>
    <p v-if="pending.length" class="text-sm text-muted">
      {{ pending.length }} {{ pending.length === 1 ? 'serie' : 'series' }} con tomos pendientes
    </p>
  </header>

  <ul v-if="pending.length" class="flex flex-col gap-2 px-3 pb-6">
    <li v-for="{ series, summary } in pending" :key="series.id" class="card p-3">
      <div class="flex items-center gap-3">
        <RouterLink :to="{ name: 'series-detail', params: { id: series.id } }" class="flex min-w-0 flex-1 items-center gap-3">
          <CoverImage :series-id="series.id" :title="series.title" class="w-12 shrink-0 text-xs" />
          <div class="min-w-0">
            <h2 class="line-clamp-2 text-base leading-tight font-bold">{{ series.title }}</h2>
            <p v-if="summary.next != null" class="text-lg font-bold text-accent-text">Tomo {{ summary.next }}</p>
            <p v-else class="text-sm text-muted">Solo faltan huecos</p>
          </div>
        </RouterLink>
        <button v-if="summary.next != null" class="btn-primary shrink-0 px-3" :aria-label="`Añadir el tomo ${summary.next} de ${series.title} a mi colección`"
                @click="addVolume(series, summary.next)">
          <AppIcon name="plus" :size="20" /> Añadir tomo
        </button>
      </div>

      <div v-if="summary.gaps.length" class="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2">
        <span class="flex items-center gap-1 text-sm font-semibold text-warn">
          <AppIcon name="warning" :size="16" /> {{ summary.gaps.length === 1 ? 'Falta' : 'Faltan' }}
        </span>
        <button v-for="gapNumber in summary.gaps.slice(0, MAX_GAPS_SHOWN)" :key="gapNumber"
          class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-warn bg-warn-soft text-base font-bold text-warn active:opacity-70"
          :aria-label="`Añadir el tomo ${gapNumber} de ${series.title} a mi colección`"
          @click="addVolume(series, gapNumber)"
        >
          {{ gapNumber }}
        </button>
        <span v-if="summary.gaps.length > MAX_GAPS_SHOWN" class="text-sm text-muted">
          y {{ summary.gaps.length - MAX_GAPS_SHOWN }} más
        </span>
      </div>
    </li>
  </ul>

  <div v-else class="p-8 text-center">
    <p class="text-lg font-semibold">
      {{ store.series.length ? '¡Todo al día!' : 'Aún no hay series' }}
    </p>
    <p class="mt-1 text-muted">
      {{
        store.series.length ? 'No te falta ningún tomo de tus series.' : 'Cuando añadas series, aquí verás el siguiente tomo de cada una.'
      }}
    </p>
    <RouterLink v-if="!store.series.length" :to="{ name: 'series-new' }" class="btn-primary mt-4">
      <AppIcon name="plus" /> Añadir serie
    </RouterLink>
  </div>
</template>
