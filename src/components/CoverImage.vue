<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { repo } from '@/db/repo'
import { useCollectionStore } from '@/stores/collection'
import { colorFromTitle, initialOf } from '@/utils/text'

const props = defineProps<{
  seriesId?: number
  title: string
  /** Local URL that overrides the stored cover (form preview). */
  preview?: string | null
}>()

const root = ref<HTMLElement | null>(null)
const visible = ref(false)
let observer: IntersectionObserver | undefined

onMounted(() => {
  if (!root.value || !('IntersectionObserver' in window)) {
    visible.value = true
    return
  }
  // Lazy: the image is read from IndexedDB once the card gets near the viewport.
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        visible.value = true
        observer?.disconnect()
      }
    },
    { rootMargin: '300px' },
  )
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())

const store = useCollectionStore()
const storedUrl = ref<string | null>(null)

// Re-runs when the series, its cover version or visibility change. The cleanup
// (also run on unmount) revokes the previous object URL.
watchEffect(async (onCleanup) => {
  const seriesId = props.seriesId
  const hasCover = seriesId != null && store.coverVersions[seriesId] != null
  storedUrl.value = null
  if (!hasCover || !visible.value) return

  let stale = false
  let objectUrl: string | undefined
  onCleanup(() => {
    stale = true
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  })

  const cover = await repo.getCover(seriesId)
  if (stale || !cover) return
  objectUrl = URL.createObjectURL(cover.blob)
  storedUrl.value = objectUrl
})

const src = computed(() => props.preview ?? storedUrl.value)
</script>

<template>
  <div ref="root" class="relative aspect-[2/3] overflow-hidden rounded-lg" :style="{ background: colorFromTitle(title) }">
    <img v-if="src" :src="src" alt="" class="absolute inset-0 size-full object-cover" decoding="async" />
    <span v-else class="absolute inset-0 flex items-center justify-center text-[2.2em] font-bold text-white/90" aria-hidden="true">
      {{ initialOf(title) }}
    </span>
  </div>
</template>
