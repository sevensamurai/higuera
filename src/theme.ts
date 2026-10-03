import { ref, watch } from 'vue'

// Light/dark preference. 'auto' follows the OS. This is a per-device convenience, so localStorage
// (guarded: it can throw in private mode). index.html applies the saved value before first paint.
export type ThemePref = 'auto' | 'light' | 'dark'
const KEY = 'theme'

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export const themePref = ref<ThemePref>(read())

const dark = window.matchMedia('(prefers-color-scheme: dark)')

function apply() {
  const root = document.documentElement
  if (themePref.value === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', themePref.value)
  // Match the browser/OS chrome (address bar, installed-app title bar) to the page.
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}

watch(themePref, (v) => {
  try {
    if (v === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, v)
  } catch {
    /* storage unavailable: preference lasts for this visit */
  }
  apply()
})
dark.addEventListener('change', apply)
apply()

const order: ThemePref[] = ['auto', 'light', 'dark']
export const cycleTheme = () => (themePref.value = order[(order.indexOf(themePref.value) + 1) % order.length])
