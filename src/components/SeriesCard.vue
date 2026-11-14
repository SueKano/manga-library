<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import CoverImage from './CoverImage.vue'
import type { Series } from '@/db/types'
import { useCollectionStore } from '@/stores/collection'
import { formatRanges } from '@/utils/collection'

const props = defineProps<{ series: Series }>()
const store = useCollectionStore()

const summary = computed(() => store.summaryOf(props.series.id))
const subtitle = computed(() => [props.series.author, props.series.publisher].filter(Boolean).join(' · '))
</script>

<template>
  <RouterLink :to="{ name: 'series-detail', params: { id: series.id } }" class="card flex gap-3 p-3 active:bg-surface-2">
    <CoverImage :series-id="series.id" :title="series.title" class="w-[4.5rem] shrink-0 text-base" />

    <div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
      <h2 class="flex items-start gap-1 text-lg leading-tight font-bold">
        <span class="line-clamp-2">{{ series.title }}</span>
        <AppIcon v-if="series.favorite" name="star" filled :size="16" class="mt-1 shrink-0 text-accent-text" />
        <span v-if="series.favorite" class="sr-only">(favorita)</span>
      </h2>
      <p v-if="subtitle" class="truncate text-sm text-muted">{{ subtitle }}</p>

      <!-- What matters at the bookshop: where I am and which one is next -->
      <p class="text-base leading-snug">
        <template v-if="summary.last == null">
          <span class="text-muted">Sin tomos · </span>
          <span class="font-bold text-accent-text">Siguiente: 1</span>
        </template>
        <template v-else-if="summary.next == null">
          <span v-if="summary.complete" class="font-bold text-ok">Colección completa ({{ summary.last }})</span>
          <span v-else>Tengo hasta el tomo <strong>{{ summary.last }}</strong></span>
        </template>
        <template v-else>
          Tengo hasta el tomo <strong>{{ summary.last }}</strong> ·
          <span class="font-bold whitespace-nowrap text-accent-text">Siguiente: {{ summary.next }}</span>
        </template>
      </p>

      <p v-if="summary.gaps.length" class="flex items-start gap-1 text-sm font-semibold text-warn">
        <AppIcon name="warning" :size="16" class="mt-0.5 shrink-0" />
        <span class="line-clamp-1">
          {{ summary.gaps.length === 1 ? 'Falta' : 'Faltan' }}: {{ formatRanges(summary.gaps) }}
        </span>
      </p>

      <div v-if="summary.percent != null && !summary.complete" class="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
           role="progressbar" :aria-valuenow="summary.percent" aria-valuemin="0" aria-valuemax="100" :aria-label="`${summary.percent}% completado`">
        <div class="h-full rounded-full bg-accent" :style="{ width: `${summary.percent}%` }" />
      </div>
    </div>
  </RouterLink>
</template>
