import { ref } from 'vue'

export const THEMES = ['auto', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

// localStorage (not IndexedDB) on purpose: it can be read synchronously by the
// inline script in index.html, before the first paint.
const STORAGE_KEY = 'theme'
const BAR_COLORS = { light: '#f6f6f8', dark: '#0f0f12' }

const theme = ref<Theme>('auto')

function apply(value: Theme) {
  if (value === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = value

  // Browser/status bar color: each <meta> covers one system scheme; a forced theme sets both.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const systemScheme = meta.media.includes('dark') ? 'dark' : 'light'
    meta.content = BAR_COLORS[value === 'auto' ? systemScheme : value]
  })
}

/** Call once at startup. The inline script in index.html has already set the attribute. */
export function initTheme() {
  const saved = document.documentElement.dataset.theme
  theme.value = saved === 'light' || saved === 'dark' ? saved : 'auto'
  apply(theme.value)
}

function setTheme(value: Theme) {
  theme.value = value
  apply(value)
  try {
    if (value === 'auto') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Storage blocked: the choice still applies until the app is closed.
  }
}

export function useTheme() {
  return { theme, setTheme }
}
