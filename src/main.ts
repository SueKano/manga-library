import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { initInstallPrompt } from './composables/useInstallPrompt'
import { initTheme } from './composables/useTheme'
import { useCollectionStore } from './stores/collection'
import './style.css'

// Before mounting: `beforeinstallprompt` can fire very early.
initInstallPrompt()
initTheme()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

void useCollectionStore().load()
// Request persistent storage from the very first launch (idempotent).
void navigator.storage?.persist?.()
