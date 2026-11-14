<script setup lang="ts">
const ICONS = {
  books: 'M4 4h4v16H4zM10 4h4v16h-4zM16.5 6.2l3.8-1 3 14.8-3.8 1z',
  cart: 'M3 4h2.5l2.2 10.5h10.2L20 7H7M9 20a1.2 1.2 0 1 0 0-2.4A1.2 1.2 0 0 0 9 20zm8 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z',
  settings:
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-1.8-1L15 3.5h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.4-.9c.5.4 1.1.8 1.7 1l.4 2.5h4l.3-2.5c.7-.2 1.3-.6 1.8-1l2.3.9 2-3.4z',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 21 21',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z',
  close: 'M6 6l12 12M18 6 6 18',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4zM12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
  image: 'M4 5h16v14H4zM4 16l4.5-4.5 3.5 3.5 3-3 5 5M9 9.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  warning: 'M12 4 2.5 20h19zM12 10v5M12 17.5v.5',
  sort: 'M7 5v14M7 19l-3-3M7 19l3-3M17 19V5M17 5l-3 3M17 5l3 3',
} as const

export type IconName = keyof typeof ICONS

defineProps<{ name: IconName; filled?: boolean; size?: number }>()
</script>

<template>
  <svg :width="size ?? 24" :height="size ?? 24" viewBox="0 0 24 24" :fill="filled ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path :d="ICONS[name]" />
  </svg>
</template>
