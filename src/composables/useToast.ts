import { ref } from 'vue'

export interface Toast {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

// Module-level state: a single toast shared by the whole app (rendered in App.vue).
const toast = ref<Toast | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let nextId = 0

function dismiss() {
  clearTimeout(timer)
  toast.value = null
}

function show(text: string, action?: Toast['action']) {
  clearTimeout(timer)
  toast.value = { id: ++nextId, text, action }
  timer = setTimeout(dismiss, action ? 6000 : 3000)
}

export function useToast() {
  return { toast, show, dismiss }
}
