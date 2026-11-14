<script setup lang="ts">
import BottomNav from './components/BottomNav.vue'
import UpdatePrompt from './components/UpdatePrompt.vue'
import { useToast } from './composables/useToast'
import { useCollectionStore } from './stores/collection'

const store = useCollectionStore()
const { toast, dismiss } = useToast()

function runAction() {
  toast.value?.action?.run()
  dismiss()
}
</script>

<template>
  <div class="mx-auto min-h-dvh max-w-xl pb-[calc(4rem+env(safe-area-inset-bottom))]">
    <div v-if="store.loadError" class="p-6 text-center" role="alert">
      <p class="text-lg font-semibold">{{ store.loadError }}</p>
      <button class="btn-primary mt-4" @click="store.load()">Reintentar</button>
    </div>
    <RouterView v-else-if="store.loaded" />
  </div>

  <!-- Floating notices, right above the bottom bar -->
  <div class="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col gap-2 px-3">
    <div class="pointer-events-auto"><UpdatePrompt /></div>
    <div v-if="toast" :key="toast.id" class="pointer-events-auto mx-auto flex min-h-12 w-full max-w-xl items-center gap-2 rounded-xl bg-ink py-1 pr-1 pl-4 text-bg shadow-lg"
         role="status" aria-live="polite">
      <p class="flex-1 py-2 text-sm font-medium" @click="dismiss">{{ toast.text }}</p>
      <button v-if="toast.action" class="btn px-3 text-sm text-bg underline" @click="runAction">
        {{ toast.action.label }}
      </button>
    </div>
  </div>

  <BottomNav />
</template>
