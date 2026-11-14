<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import ImportBackup from '@/components/ImportBackup.vue'
import SeriesCard from '@/components/SeriesCard.vue'
import { useCollectionStore } from '@/stores/collection'

const store = useCollectionStore()
const logoUrl = `${import.meta.env.BASE_URL}logo.svg`

function toggleSortOrder() {
  void store.setSortOrder(store.sortOrder === 'alphabetical' ? 'recent' : 'alphabetical')
}
</script>

<template>
  <!-- First run -->
  <section v-if="!store.series.length" class="flex min-h-[80dvh] flex-col items-center justify-center gap-3 p-6 text-center">
    <img :src="logoUrl" alt="" class="size-24 rounded-3xl" />
    <h1 class="mt-2 text-2xl font-bold">Tu colección está vacía</h1>
    <p class="text-muted">Añade tus series y sabrás en segundos qué tomo te toca comprar, también sin conexión.</p>
    <RouterLink :to="{ name: 'series-new' }" class="btn-primary mt-4 w-full max-w-xs">
      <AppIcon name="plus" /> Añadir tu primera serie
    </RouterLink>
    <ImportBackup button-class="btn-secondary w-full max-w-xs" />
  </section>

  <template v-else>
    <header class="sticky top-0 z-20 bg-bg px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
      <h1 class="sr-only">Series</h1>
      <div class="relative">
        <AppIcon name="search" class="pointer-events-none absolute top-3 left-3 text-muted" />
        <input
          v-model="store.query"
          type="search"
          inputmode="search"
          enterkeyhint="search"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          class="input pr-12 pl-11 [&::-webkit-search-cancel-button]:hidden"
          placeholder="Buscar serie, autor o editorial"
          aria-label="Buscar serie"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <button
          v-if="store.query"
          class="btn-icon absolute top-0 right-0 text-muted"
          aria-label="Borrar búsqueda"
          @click="store.query = ''"
        >
          <AppIcon name="close" :size="20" />
        </button>
      </div>

      <div class="mt-1 flex items-center justify-between">
        <button class="btn-ghost -ml-1 px-2 text-sm text-muted" @click="toggleSortOrder">
          <AppIcon name="sort" :size="18" />
          {{ store.sortOrder === 'alphabetical' ? 'A-Z' : 'Recientes' }}
          <span class="sr-only">(cambiar orden)</span>
        </button>
        <span class="text-sm text-muted" aria-live="polite">
          {{ store.filteredSeries.length }} {{ store.filteredSeries.length === 1 ? 'serie' : 'series' }}
        </span>
        <button
          class="btn-ghost -mr-1 px-2 text-sm"
          :class="store.favoritesOnly ? 'text-accent-text' : 'text-muted'"
          :aria-pressed="store.favoritesOnly"
          @click="store.favoritesOnly = !store.favoritesOnly"
        >
          <AppIcon name="star" :size="18" :filled="store.favoritesOnly" />
          Favoritas
        </button>
      </div>
    </header>

    <div
      v-if="store.showBackupReminder && !store.query"
      class="mx-3 mb-2 flex items-center gap-1 rounded-xl bg-warn-soft py-1 pr-1 pl-3 text-sm text-warn"
    >
      <RouterLink :to="{ name: 'settings' }" class="flex min-h-12 flex-1 items-center font-medium">
        <span v-if="store.lastExportAt">
          Hace {{ store.daysSinceExport }} días que no exportas una copia.
        </span>
        <span v-else>Aún no has exportado ninguna copia de seguridad.</span>
      </RouterLink>
      <button class="btn-icon text-warn" aria-label="Recordar más tarde" @click="store.snoozeBackupReminder()">
        <AppIcon name="close" :size="20" />
      </button>
    </div>

    <ul v-if="store.filteredSeries.length" class="flex flex-col gap-2 px-3 pb-24">
      <li v-for="item in store.filteredSeries" :key="item.id">
        <SeriesCard :series="item" />
      </li>
    </ul>

    <div v-else class="p-8 text-center">
      <p class="text-lg font-semibold">
        {{ store.query ? `Nada para «${store.query}»` : 'No tienes series favoritas' }}
      </p>
      <RouterLink
        v-if="store.query"
        :to="{ name: 'series-new', query: { title: store.query } }"
        class="btn-secondary mt-4"
      >
        <AppIcon name="plus" /> Añadir «{{ store.query }}»
      </RouterLink>
    </div>

    <RouterLink
      :to="{ name: 'series-new' }"
      class="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg active:opacity-80"
      aria-label="Añadir serie"
    >
      <AppIcon name="plus" :size="28" />
    </RouterLink>
  </template>
</template>
