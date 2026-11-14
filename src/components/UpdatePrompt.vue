<script setup lang="ts">
import { ref } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useToast } from '@/composables/useToast'

const { show } = useToast()
const updating = ref(false)

// registerType 'prompt': the new service worker waits until the user taps
// "Actualizar". Data lives in IndexedDB and is not affected.
const { needRefresh, updateServiceWorker } = useRegisterSW({
  onOfflineReady() {
    show('Lista para usar sin conexión')
  },
  onRegisterError(error) {
    console.error('Service worker registration failed', error)
  },
})

async function update() {
  updating.value = true
  await updateServiceWorker(true)
}
</script>

<template>
  <div v-if="needRefresh" class="card mx-auto flex max-w-xl items-center gap-2 py-1 pr-1 pl-4 shadow-lg" role="status">
    <p class="flex-1 text-sm font-medium">Nueva versión disponible</p>
    <button class="btn-ghost" :disabled="updating" @click="update">Actualizar</button>
    <button class="btn-ghost text-muted" @click="needRefresh = false">Luego</button>
  </div>
</template>
