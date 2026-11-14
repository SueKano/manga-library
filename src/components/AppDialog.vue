<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const dialog = ref<HTMLDialogElement | null>(null)

function sync() {
  const element = dialog.value
  if (!element) return
  if (props.open && !element.open) element.showModal()
  else if (!props.open && element.open) element.close()
}
watch(() => props.open, sync)
onMounted(sync)

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('update:open', false)
}
</script>

<template>
  <dialog ref="dialog" class="m-auto mb-0 w-full max-w-md rounded-t-3xl bg-surface p-0 text-ink sm:mb-auto sm:rounded-3xl" :aria-label="title"
          @close="emit('update:open', false)" @click="onBackdropClick">
    <div class="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <h2 class="mb-2 text-xl font-bold">{{ title }}</h2>
      <slot />
      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <slot name="actions" />
      </div>
    </div>
  </dialog>
</template>
