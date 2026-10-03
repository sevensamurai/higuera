<script setup lang="ts">
import { ref, watch } from 'vue'
import { saveMyLocale, setMyTimeZone, useAuth } from '@/auth'
import { locale, type Locale } from '@/i18n'
import { saveTutorTimeZone, useZones } from '@/zones'
import { setTheme, theme } from '@/theme'
import { tzLabel } from '@/format'
import TimeZoneSelect from '@/components/TimeZoneSelect.vue'

const auth = useAuth()
const { viewerTz, deviceTz, tutorTz, tutorTzSet } = useZones()

// Each language is named in itself, so it can be found whichever one is showing.
const languages: { id: Locale; name: string }[] = [
  { id: 'es', name: 'Español' },
  { id: 'en', name: 'English' },
]

// The admin sets the researcher's zone (content/settings: availability is typed in it);
// a client pins their own display zone, or follows whichever device they're on.
const tzPick = ref(viewerTz.value)
watch(viewerTz, (v) => (tzPick.value = v)) // the saved zone arrives after first render
const tzSaving = ref(false)
const tzSaved = ref(false)

async function saveTz(tz: string | null) {
  tzSaving.value = true
  try {
    if (auth.isAdmin) await saveTutorTimeZone(tz!)
    else await setMyTimeZone(tz === deviceTz ? null : tz)
    tzSaved.value = true
  } finally {
    tzSaving.value = false
  }
}
watch(tzPick, () => (tzSaved.value = false))
</script>

<template>
  <h1>{{ $t('settings.title') }}</h1>
  <p class="muted" style="margin-bottom: 1rem">{{ $t('settings.intro') }}</p>

  <div class="card stack">
    <h3>{{ $t('settings.language') }}</h3>
    <div class="segmented" role="group" :aria-label="$t('settings.language')">
      <button v-for="l in languages" :key="l.id" :lang="l.id" :class="{ on: locale === l.id }" :aria-pressed="locale === l.id" @click="saveMyLocale(l.id)">
        {{ l.name }}
      </button>
    </div>
  </div>

  <div class="card stack">
    <h3>{{ $t('settings.timeZone') }}</h3>
    <p class="muted small">{{ auth.isAdmin ? $t('settings.tutorZoneIntro') : $t('settings.clientZoneIntro') }}</p>
    <div class="row">
      <TimeZoneSelect v-model="tzPick" style="flex: 1; min-width: 220px" />
      <button
        class="small"
        :disabled="tzSaving || (auth.isAdmin ? tutorTzSet && tzPick === tutorTz : tzPick === viewerTz)"
        @click="saveTz(tzPick)"
      >
        {{ auth.isAdmin && !tutorTzSet ? $t('common.confirm') : $t('common.save') }}
      </button>
      <span v-if="tzSaved" class="small" style="color: var(--ok)" role="status">{{ $t('settings.saved') }}</span>
    </div>
    <template v-if="auth.isAdmin">
      <p v-if="!tutorTzSet" class="small" style="color: var(--warn)">{{ $t('settings.notSaved') }}</p>
      <p v-else-if="tutorTz !== deviceTz" class="other-tz">
        {{ $t('settings.deviceDiffers', { device: tzLabel(deviceTz), zone: tzLabel(tutorTz) }) }}
      </p>
    </template>
    <p v-else-if="auth.chosenTimeZone" class="other-tz">
      {{ $t('tz.deviceOn', { zone: tzLabel(deviceTz) }) }}
      <button class="link" :disabled="tzSaving" @click="saveTz(null)">{{ $t('tz.useDevice') }}</button>
    </p>
    <p v-else class="other-tz">{{ $t('settings.following') }}</p>
  </div>

  <div class="card stack">
    <h3>{{ $t('settings.appearance') }}</h3>
    <div class="segmented" role="group" :aria-label="$t('settings.appearance')">
      <button v-for="m in ['light', 'dark'] as const" :key="m" :class="{ on: theme === m }" :aria-pressed="theme === m" @click="setTheme(m)">
        {{ $t(`theme.${m}`) }}
      </button>
    </div>
    <p class="other-tz">{{ $t('settings.appearanceHint') }}</p>
  </div>
</template>
