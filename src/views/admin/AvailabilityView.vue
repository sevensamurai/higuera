<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLive } from '@/live'
import { createSlots, deleteSlot, planSlots, watchUpcomingSlots } from '@/services/slots'
import { dayKey, fmtDay, fmtTime, tzLabel } from '@/format'
import { intlLocale } from '@/i18n'
import { saveTutorTimeZone, useZones } from '@/zones'
import type { Slot } from '@/types'
import TimeZoneSelect from '@/components/TimeZoneSelect.vue'

const { value: slots, loaded } = useLive<Slot[]>([], watchUpcomingSlots)
const { tutorTz: tz, tutorTzSet, deviceTz } = useZones()
const { t } = useI18n()

// ---- the tutor's timezone ----
const tzPick = ref(tz.value)
watch(tz, (v) => (tzPick.value = v)) // the saved zone arrives after first render
const tzSaving = ref(false)
async function saveTz() {
  tzSaving.value = true
  try {
    await saveTutorTimeZone(tzPick.value)
  } finally {
    tzSaving.value = false
  }
}

const date = ref('')
const from = ref('14:00')
const to = ref('18:00')
const duration = ref(60)
const busy = ref(false)
const message = ref('')

const overlaps = (start: Date, mins: number, s: Slot) =>
  start.getTime() < s.start.getTime() + s.durationMin * 60_000 && s.start.getTime() < start.getTime() + mins * 60_000

const planned = computed(() => {
  if (!date.value || !from.value || !to.value) return []
  return planSlots(date.value, from.value, to.value, duration.value, tz.value).map((start) => ({
    start,
    clash: slots.value.some((s) => overlaps(start, duration.value, s)),
    past: start.getTime() <= Date.now(),
  }))
})
const creatable = computed(() => planned.value.filter((p) => !p.clash && !p.past))

async function create() {
  busy.value = true
  try {
    // Snapshot first: once written, the new slots show up as clashes and `creatable` empties.
    const starts = creatable.value.map((p) => p.start)
    await createSlots(starts, duration.value)
    message.value = t('availability.added', { n: starts.length })
    date.value = ''
  } finally {
    busy.value = false
  }
}

const days = computed(() => {
  const groups = new Map<string, { label: string; slots: Slot[] }>()
  for (const s of slots.value) {
    const k = dayKey(s.start, tz.value)
    if (!groups.has(k)) groups.set(k, { label: fmtDay(s.start, tz.value), slots: [] })
    groups.get(k)!.slots.push(s)
  }
  return [...groups.values()]
})

async function remove(s: Slot) {
  if (confirm(t('availability.confirmRemove', { when: `${fmtDay(s.start, tz.value)} ${fmtTime(s.start, tz.value)}` }))) {
    await deleteSlot(s.id)
  }
}
</script>

<template>
  <h1>{{ $t('availability.title') }}</h1>

  <div class="card stack">
    <h3>{{ $t('availability.yourZone') }}</h3>
    <p class="muted small">{{ $t('availability.zoneIntro') }}</p>
    <div class="row">
      <TimeZoneSelect v-model="tzPick" style="flex: 1; min-width: 220px" />
      <button class="small" :disabled="tzSaving || (tutorTzSet && tzPick === tz)" @click="saveTz">
        {{ tutorTzSet ? $t('common.save') : $t('common.confirm') }}
      </button>
    </div>
    <p v-if="!tutorTzSet" class="small" style="color: var(--warn)">
      {{ $t('availability.notSaved') }}
    </p>
    <p v-else-if="tz !== deviceTz" class="other-tz">
      {{ $t('availability.deviceDiffers', { device: tzLabel(deviceTz), zone: tzLabel(tz) }) }}
    </p>
  </div>

  <div class="card stack">
    <h3>{{ $t('availability.openTime') }}</h3>
    <p class="muted small">{{ $t('availability.openIntro', { zone: tzLabel(tz) }) }}</p>
    <div class="fields">
      <label>{{ $t('common.date') }} <input type="date" v-model="date" /></label>
      <label>{{ $t('availability.from') }} <input type="time" v-model="from" step="900" /></label>
      <label>{{ $t('availability.to') }} <input type="time" v-model="to" step="900" /></label>
      <label>
        {{ $t('availability.length') }}
        <select v-model.number="duration">
          <option :value="30">{{ $t('common.minutes', { n: 30 }) }}</option>
          <option :value="45">{{ $t('common.minutes', { n: 45 }) }}</option>
          <option :value="60">{{ $t('availability.hours', 1) }}</option>
          <option :value="90">{{ $t('availability.hours', { n: (1.5).toLocaleString(intlLocale) }, 2) }}</option>
          <option :value="120">{{ $t('availability.hours', 2) }}</option>
        </select>
      </label>
    </div>
    <div v-if="planned.length" class="chips">
      <span v-for="p in planned" :key="p.start.getTime()" class="chip" :class="{ taken: p.clash || p.past }"
        :title="p.clash ? $t('availability.overlaps') : p.past ? $t('availability.inPast') : ''">
        {{ fmtTime(p.start, tz) }}
      </span>
    </div>
    <p v-else-if="date" class="muted small">{{ $t('availability.tooShort') }}</p>
    <div class="row">
      <button :disabled="busy || creatable.length === 0" @click="create">
        {{ $t('availability.addSlots', creatable.length) }}
      </button>
      <span class="muted small">{{ message }}</span>
    </div>
  </div>

  <h2>{{ $t('availability.upcoming') }} <span class="other-tz">· {{ tzLabel(tz) }}</span></h2>
  <p v-if="!loaded" class="muted">{{ $t('common.loading') }}</p>
  <p v-else-if="days.length === 0" class="muted">{{ $t('availability.none') }}</p>
  <div v-for="d in days" :key="d.label" class="day">
    <h3>{{ d.label }}</h3>
    <div class="chips">
      <span v-for="s in d.slots" :key="s.id" class="chip row">
        {{ fmtTime(s.start, tz) }} <span class="muted small">{{ s.durationMin }}m</span>
        <span v-if="s.status === 'booked'" class="badge">{{ $t('availability.booked') }}</span>
        <button v-else class="link small" :title="$t('common.remove')" :aria-label="$t('common.remove')" @click="remove(s)">✕</button>
      </span>
    </div>
  </div>
</template>
