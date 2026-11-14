import { ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Module-level state: the event fires once, early, long before Settings is mounted.
const promptEvent = ref<BeforeInstallPromptEvent | null>(null)
const installed = ref(false)

/** Call once at startup, before mounting the app. */
export function initInstallPrompt() {
  installed.value = window.matchMedia('(display-mode: standalone)').matches
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    promptEvent.value = event as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    promptEvent.value = null
  })
}

export function useInstallPrompt() {
  async function install() {
    if (!promptEvent.value) return false
    await promptEvent.value.prompt()
    const { outcome } = await promptEvent.value.userChoice
    promptEvent.value = null
    return outcome === 'accepted'
  }
  return { canInstall: promptEvent, installed, install }
}
