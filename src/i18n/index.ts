import { computed } from 'vue'
import { createI18n } from 'vue-i18n'
import en, { type Messages } from './en'
import es from './es'

export type Locale = 'es' | 'en'
export const LOCALES: Locale[] = ['es', 'en']
export const isLocale = (v: unknown): v is Locale => v === 'es' || v === 'en'

// Spanish first: the business is in Chile. A browser set to English starts in English.
// An explicit choice wins: this device's (localStorage), then the account's (auth.ts applies it on sign-in).
const KEY = 'locale'
function initial(): Locale {
  try {
    const saved = localStorage.getItem(KEY)
    if (isLocale(saved)) return saved
  } catch {
    /* storage unavailable */
  }
  for (const l of navigator.languages ?? [navigator.language]) {
    const base = l.slice(0, 2).toLowerCase()
    if (isLocale(base)) return base
  }
  return 'es'
}

export const i18n = createI18n<[Messages], Locale, false>({
  legacy: false,
  locale: initial(),
  fallbackLocale: 'es',
  messages: { es, en },
})

export const locale = i18n.global.locale
export const t = i18n.global.t

/**
 * Locale for Intl date/time formatting. Keeps the browser's regional variant when it matches the chosen
 * language (en-GB stays en-GB), otherwise the business defaults: Chilean Spanish or US English.
 */
export const intlLocale = computed(() => {
  const nav = navigator.language || ''
  if (nav.slice(0, 2).toLowerCase() === locale.value) return nav
  return locale.value === 'es' ? 'es-CL' : 'en-US'
})

function apply(l: Locale) {
  document.documentElement.lang = l
}
apply(locale.value)

/** True once someone picked a language on this device (as opposed to the browser default). */
export function hasDeviceChoice(): boolean {
  try {
    return isLocale(localStorage.getItem(KEY))
  } catch {
    return false
  }
}

/**
 * Switch language. `remember` records it as this device's explicit choice; applying the account's
 * saved language on sign-in doesn't, so a later change on another device still carries over.
 * Saving to the account is auth.ts's job (saveMyLocale).
 */
export function setLocale(l: Locale, remember = true) {
  locale.value = l
  apply(l)
  if (!remember) return
  try {
    localStorage.setItem(KEY, l)
  } catch {
    /* storage unavailable: choice lasts for this visit */
  }
}

declare module 'vue-i18n' {
  // Type-checks message keys passed to t() against en.ts.
  export interface DefineLocaleMessage extends Messages {}
}
