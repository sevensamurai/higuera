<script setup lang="ts">
import { computed, ref } from 'vue'
import { dayKey } from '@/format'
import { intlLocale } from '@/i18n'
import type { Slot } from '@/types'

/** Month grid (weeks start Monday) showing, per day in `tz`, how many slots are open and booked. */
const props = defineProps<{ slots: Slot[]; tz: string; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [day: string] }>()

const today = computed(() => dayKey(new Date(), props.tz))
// First of the month on show, as yyyy-mm; starts on the picked day, else this month.
const month = ref((props.modelValue || today.value).slice(0, 7))

const counts = computed(() => {
  const m = new Map<string, { open: number; booked: number }>()
  for (const s of props.slots) {
    const k = dayKey(s.start, props.tz)
    const c = m.get(k) ?? { open: 0, booked: 0 }
    c[s.status === 'booked' ? 'booked' : 'open']++
    m.set(k, c)
  }
  return m
})

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))
const label = (d: Date, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(intlLocale.value, { ...o, timeZone: 'UTC' }).format(d)

const title = computed(() => {
  const [y, m] = month.value.split('-').map(Number)
  return label(utc(y, m - 1, 1), { month: 'long', year: 'numeric' })
})
const weekdays = computed(() => Array.from({ length: 7 }, (_, i) => label(utc(2024, 0, 1 + i), { weekday: 'short' }))) // 2024-01-01 is a Monday

const cells = computed(() => {
  const [y, m] = month.value.split('-').map(Number)
  const lead = (utc(y, m - 1, 1).getUTCDay() + 6) % 7
  const length = utc(y, m, 0).getUTCDate()
  const out: ({ key: string; n: number } | null)[] = Array(lead).fill(null)
  for (let n = 1; n <= length; n++) out.push({ key: `${month.value}-${String(n).padStart(2, '0')}`, n })
  return out
})

function shift(by: number) {
  const [y, m] = month.value.split('-').map(Number)
  const d = utc(y, m - 1 + by, 1)
  month.value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
</script>

<template>
  <div class="cal">
    <div class="cal-head">
      <button class="small" type="button" :aria-label="$t('availability.prevMonth')" @click="shift(-1)">‹</button>
      <strong>{{ title }}</strong>
      <button class="small" type="button" :aria-label="$t('availability.nextMonth')" @click="shift(1)">›</button>
    </div>
    <div class="cal-grid">
      <span v-for="w in weekdays" :key="w" class="cal-dow">{{ w }}</span>
      <template v-for="(c, i) in cells" :key="c?.key ?? `pad${i}`">
        <span v-if="!c" />
        <button
          v-else
          type="button"
          class="cal-day"
          :class="{ today: c.key === today, on: c.key === modelValue, past: c.key < today, has: counts.has(c.key) }"
          :disabled="c.key < today"
          :data-day="c.key"
          :aria-label="label(new Date(`${c.key}T00:00Z`), { dateStyle: 'full' })"
          :aria-pressed="c.key === modelValue"
          @click="emit('update:modelValue', c.key)"
        >
          <span>{{ c.n }}</span>
          <small v-if="counts.get(c.key)?.open" class="open">{{ counts.get(c.key)!.open }}</small>
          <small v-if="counts.get(c.key)?.booked" class="booked">{{ counts.get(c.key)!.booked }}</small>
        </button>
      </template>
    </div>
    <p class="muted small cal-key">
      <small class="open">n</small> {{ $t('availability.openCount') }} · <small class="booked">n</small> {{ $t('availability.booked') }}
    </p>
  </div>
</template>

<style scoped>
.cal { max-width: 420px; }
.cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.cal-head strong { text-transform: capitalize; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-dow { text-align: center; font-size: 0.72rem; font-weight: 700; color: var(--muted); text-transform: uppercase; }
.cal-day {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  min-height: 3.1rem; padding: 0.25rem 0; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface); color: var(--text); font-weight: 600;
}
.cal-day:hover:not(:disabled) { border-color: var(--accent); filter: none; }
.cal-day.past { opacity: 0.4; }
.cal-day.today { border-color: var(--highlight); }
.cal-day.on { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
small.open, small.booked { border-radius: 999px; padding: 0 0.45rem; font-size: 0.7rem; font-weight: 700; line-height: 1.3; }
small.open { background: var(--ok-soft); color: var(--ok); }
small.booked { background: var(--warn-soft); color: var(--warn); }
.cal-key small { margin-right: 0.2rem; }
</style>
