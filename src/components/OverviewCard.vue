<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuth } from '@/auth'
import { useLive } from '@/live'
import { LOCALES, locale, type Locale } from '@/i18n'
import en from '@/i18n/en'
import es from '@/i18n/es'
import { saveOverview, watchOverview } from '@/services/content'
import type { Overview, OverviewDoc } from '@/types'

const auth = useAuth()
const doc = useLive<OverviewDoc>({}, watchOverview).value

// Built-in welcome text per language, used until the admin writes their own.
const fallback: Record<Locale, Overview> = {
  es: { title: es.overview.defaultTitle, body: es.overview.defaultBody },
  en: { title: en.overview.defaultTitle, body: en.overview.defaultBody },
}
// The visitor's language; if that version is missing, the other one rather than nothing.
const shown = computed<Overview>(() => {
  const other: Locale = locale.value === 'es' ? 'en' : 'es'
  return doc.value[locale.value] ?? doc.value[other] ?? fallback[locale.value]
})

const editing = ref(false)
const tab = ref<Locale>(locale.value)
const draft = ref<Record<Locale, Overview>>({ es: { ...fallback.es }, en: { ...fallback.en } })
function edit() {
  draft.value = {
    es: { ...(doc.value.es ?? fallback.es) },
    en: { ...(doc.value.en ?? fallback.en) },
  }
  tab.value = locale.value
  editing.value = true
}
async function save() {
  await saveOverview(draft.value)
  editing.value = false
}
</script>

<template>
  <section class="card stack" v-if="!editing">
    <div class="card-head">
      <h2 style="margin: 0">{{ shown.title }}</h2>
      <button v-if="auth.isAdmin" class="ghost small" @click="edit">{{ $t('common.edit') }}</button>
    </div>
    <p class="prewrap">{{ shown.body }}</p>
    <slot />
  </section>
  <section class="card stack" v-else>
    <div class="row">
      <div class="segmented" role="tablist">
        <button v-for="l in LOCALES" :key="l" role="tab" :aria-selected="tab === l" :class="{ on: tab === l }" @click="tab = l">
          {{ l.toUpperCase() }}
        </button>
      </div>
      <span class="hint">{{ $t('overview.bothLanguages') }}</span>
    </div>
    <label>{{ $t('common.title') }} <input v-model="draft[tab].title" :lang="tab" /></label>
    <label>{{ $t('overview.body') }} <textarea v-model="draft[tab].body" :lang="tab" rows="8" /></label>
    <div class="row">
      <button @click="save">{{ $t('common.save') }}</button>
      <button class="ghost" @click="editing = false">{{ $t('common.cancel') }}</button>
    </div>
  </section>
</template>
