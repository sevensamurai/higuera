<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLive } from '@/live'
import { createSlots, deleteSlot, planSlots, watchUpcomingSlots } from '@/services/slots'
import { dayKey, fmtDay, fmtTime, tzLabel } from '@/format'
import { intlLocale } from '@/i18n'
import { useZones } from '@/zones'
import type { Slot } from '@/types'
import TimeZoneNote from '@/components/TimeZoneNote.vue'
import SlotCalendar from '@/components/SlotCalendar.vue'

const { value: slots, loaded } = useLive<Slot[]>([], watchUpcomingSlots)
const { tutorTz: tz } = useZones()
const { t } = useI18n()

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
// Slots the admin has unticked; every free slot in the window is ticked until said otherwise.
const skipped = ref(new Set<number>())
watch([date, from, to, duration], () => (skipped.value = new Set()))
function toggle(p: { start: Date; clash: boolean; past: boolean }) {
  if (p.clash || p.past) return
  const next = new Set(skipped.value)
  const k = p.start.getTime()
  if (!next.delete(k)) next.add(k)
  skipped.value = next
}
const isOn = (p: { start: Date; clash: boolean; past: boolean }) => !p.clash && !p.past && !skipped.value.has(p.start.getTime())
const creatable = computed(() => planned.value.filter(isOn))

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

  <TimeZoneNote />

  <div class="card stack">
    <h3>{{ $t('availability.openTime') }}</h3>
    <p class="muted small">{{ $t('availability.openIntro', { zone: tzLabel(tz) }) }}</p>
    <SlotCalendar v-model="date" :slots="slots" :tz="tz" />
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
    <template v-if="planned.length">
      <p class="muted small">{{ $t('availability.pickSlots') }}</p>
      <div class="chips">
        <button v-for="p in planned" :key="p.start.getTime()" type="button" class="chip"
          :class="{ on: isOn(p), taken: p.clash || p.past }" :disabled="p.clash || p.past" :aria-pressed="isOn(p)"
          :title="p.clash ? $t('availability.overlaps') : p.past ? $t('availability.inPast') : ''" @click="toggle(p)">
          {{ fmtTime(p.start, tz) }}
        </button>
      </div>
    </template>
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
