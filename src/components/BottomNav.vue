<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon, { type IconName } from './AppIcon.vue'

const route = useRoute()

const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Series', icon: 'books' },
  { to: '/shopping', label: 'Compra', icon: 'cart' },
  { to: '/settings', label: 'Ajustes', icon: 'settings' },
]

// Series detail and form belong to the "Series" tab.
const activeTab = computed(() => {
  if (route.path.startsWith('/shopping')) return '/shopping'
  if (route.path.startsWith('/settings')) return '/settings'
  return '/'
})
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    aria-label="Navegación principal">
    <ul class="mx-auto flex max-w-xl">
      <li v-for="tab in tabs" :key="tab.to" class="flex-1">
        <RouterLink :to="tab.to" class="flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold"
                    :class="activeTab === tab.to ? 'text-accent-text' : 'text-muted'" :aria-current="activeTab === tab.to ? 'page' : undefined">
          <AppIcon :name="tab.icon" />
          {{ tab.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
