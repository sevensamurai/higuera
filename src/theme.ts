import { ref, watch } from 'vue'

// Light/dark. Until someone picks one, it follows the device (light when the device states no
// preference); a click saves an explicit choice. Per-device convenience, so localStorage (guarded: it
// can throw in private mode). index.html applies the saved value before first paint.
export type Theme = 'light' | 'dark'
const KEY = 'theme'

function saved(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

const system = window.matchMedia('(prefers-color-scheme: dark)')
const fromSystem = (): Theme => (system.matches ? 'dark' : 'light')

let chosen = saved()
export const theme = ref<Theme>(chosen ?? fromSystem())

function apply() {
  const root = document.documentElement
  root.setAttribute('data-theme', theme.value)
  // Match the browser/OS chrome (address bar, installed-app title bar) to the header band.
  const band = getComputedStyle(root).getPropertyValue('--band').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', band)
}

watch(theme, apply)
system.addEventListener('change', () => {
  if (!chosen) theme.value = fromSystem()
})
apply()

export function setTheme(t: Theme) {
  chosen = t
  try {
    localStorage.setItem(KEY, chosen)
  } catch {
    /* storage unavailable: choice lasts for this visit */
  }
  theme.value = chosen
}

export const toggleTheme = () => setTheme(theme.value === 'dark' ? 'light' : 'dark')
