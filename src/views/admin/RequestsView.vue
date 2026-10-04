<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLive } from '@/live'
import { confirmBooking, declineBooking, undoConfirm, watchAllBookings } from '@/services/bookings'
import { watchUpcomingSlots } from '@/services/slots'
import { dayKey, fmtAgo, fmtDate, fmtDay, fmtSlot, fmtTime } from '@/format'
import { casePosition, sessionTitle } from '@/progress'
import { optionState, planRequests } from '@/requests'
import { intlLocale } from '@/i18n'
import { useI18n } from 'vue-i18n'
import { useZones } from '@/zones'
import type { Booking, Slot, SlotOption } from '@/types'
import TimeZoneNote from '@/components/TimeZoneNote.vue'
import StudentTime from '@/components/StudentTime.vue'
import SlotCalendar from '@/components/SlotCalendar.vue'

const { viewerTz: tz } = useZones()
const { t } = useI18n()
const { value: bookings, loaded } = useLive<Booking[]>([], watchAllBookings)
const { value: slots, loaded: slotsLoaded } = useLive<Slot[]>([], watchUpcomingSlots)

const pending = computed(() =>
  bookings.value.filter((b) => b.status === 'pending').sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
)
const slotById = computed(() => new Map(slots.value.map((s) => [s.id, s])))
const plan = computed(() => planRequests(pending.value, slots.value))

// Calendar (by time, the default) or the list of requests (by client).
const view = ref<'calendar' | 'list'>('calendar')

// ---- calendar ----
const byDay = computed(() => {
  const m = new Map<string, { requests: Set<string>; clash: boolean }>()
  for (const time of plan.value.times) {
    const k = dayKey(time.start, tz.value)
    const d = m.get(k) ?? { requests: new Set<string>(), clash: false }
    for (const c of time.contenders) d.requests.add(c.booking.id)
    d.clash ||= time.contenders.length > 1
    m.set(k, d)
  }
  return m
})
const day = ref('')
// Open on the first day that needs a decision: a clash if there is one, else the first request.
watch(
  [plan, slotsLoaded, loaded],
  () => {
    if (day.value || !loaded.value || !slotsLoaded.value) return
    const days = [...byDay.value.entries()]
    day.value = (days.find(([, d]) => d.clash) ?? days[0])?.[0] ?? ''
  },
  { immediate: true },
)
const dayTimes = computed(() => plan.value.times.filter((x) => dayKey(x.start, tz.value) === day.value))
const dayTitle = computed(() =>
  new Intl.DateTimeFormat(intlLocale.value, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${day.value}T00:00Z`),
  ),
)
const alsoAsked = (alts: SlotOption[]) => alts.map((o) => `${fmtDay(o.start, tz.value)} ${fmtTime(o.start, tz.value)}`).join(', ')

// ---- list ----
const stateLabel = (o: SlotOption) => {
  const s = optionState(o, slotById.value)
  return { ok: s === 'open', label: t(`requests.opt${s[0].toUpperCase()}${s.slice(1)}`) }
}
/** Others who want the same time as this option of `b`. */
function rivals(b: Booking, o: SlotOption) {
  const time = plan.value.times.find((x) => x.slotId === o.slotId)
  return (time?.contenders ?? []).filter((c) => c.booking.id !== b.id).map((c) => c.booking.userName)
}

// ---- actions ----
const busy = ref<string | null>(null)
const errors = ref<Record<string, string>>({})
const undo = ref<{ id: string; text: string } | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | undefined

async function confirm(b: Booking, o: SlotOption) {
  busy.value = b.id
  errors.value[b.id] = ''
  try {
    await confirmBooking(b.id, o)
    clearTimeout(undoTimer)
    undo.value = { id: b.id, text: t('requests.confirmed', { name: b.userName, when: fmtSlot(o.start, o.durationMin, tz.value) }) }
    undoTimer = setTimeout(() => (undo.value = null), 10_000)
  } catch (e) {
    errors.value[b.id] = (e as Error).message
  } finally {
    busy.value = null
  }
}
async function takeBack() {
  const u = undo.value
  if (!u) return
  undo.value = null
  await undoConfirm(u.id)
}

async function decline(b: Booking, message = t('requests.declineDefault')) {
  const note = prompt(t('requests.declinePrompt'), message)
  if (note === null) return
  await declineBooking(b.id, note)
}
</script>

<template>
  <h1>{{ $t('requests.title') }}</h1>
  <TimeZoneNote />
  <p v-if="!loaded" class="muted">{{ $t('common.loading') }}</p>
  <p v-else-if="pending.length === 0" class="muted">{{ $t('requests.none') }}</p>

  <template v-else>
    <!-- Requests whose every time has gone: they need a nudge, wherever they are on the calendar. -->
    <template v-if="plan.stranded.length">
      <h2 style="margin-top: 0.5rem">{{ $t('requests.needsNewTime') }}</h2>
      <div v-for="b in plan.stranded" :key="b.id" class="card row" style="justify-content: space-between">
        <div>
          <RouterLink :to="`/sessions/${b.id}`"><strong>{{ b.userName }}</strong></RouterLink>
          <span class="muted small"> · {{ sessionTitle(b) }}</span>
          <p class="muted small">{{ $t('requests.strandedHint') }}</p>
        </div>
        <button class="small" @click="decline(b, $t('requests.askAgainDefault'))">{{ $t('requests.askAgain') }}</button>
      </div>
    </template>

    <div class="segmented" role="group" style="margin: 0.5rem 0 1rem">
      <button data-view="calendar" :class="{ on: view === 'calendar' }" :aria-pressed="view === 'calendar'" @click="view = 'calendar'">
        {{ $t('requests.calendar') }}
      </button>
      <button data-view="list" :class="{ on: view === 'list' }" :aria-pressed="view === 'list'" @click="view = 'list'">
        {{ $t('requests.list') }}
      </button>
    </div>

    <!-- By time: pick a day, then who gets each time -->
    <template v-if="view === 'calendar'">
      <div class="card">
        <SlotCalendar v-model="day" :tz="tz">
          <template #day="{ day: k }">
            <span v-if="byDay.get(k)" class="cal-marks">
              <small class="cal-mark">{{ byDay.get(k)!.requests.size }}</small>
              <small v-if="byDay.get(k)!.clash" class="cal-mark clash" :title="$t('requests.clash')">!</small>
            </span>
          </template>
          <template #legend>
            <small class="cal-mark">n</small> {{ $t('requests.legendRequests') }} ·
            <small class="cal-mark clash">!</small> {{ $t('requests.clash') }}
          </template>
        </SlotCalendar>
      </div>

      <template v-if="day">
        <h2>{{ dayTitle }}</h2>
        <p v-if="dayTimes.length === 0" class="muted">{{ $t('requests.dayEmpty') }}</p>
        <section v-for="time in dayTimes" :key="time.slotId" class="card stack">
          <div class="card-head">
            <h3>{{ fmtTime(time.start, tz) }}–{{ fmtTime(new Date(time.start.getTime() + time.durationMin * 60_000), tz) }}</h3>
            <span v-if="time.contenders.length > 1" class="badge warn">{{ $t('requests.wantThis', { n: time.contenders.length }) }}</span>
          </div>
          <ul class="contenders">
            <li v-for="c in time.contenders" :key="c.booking.id" :class="{ suggested: c.suggested }">
              <div>
                <span v-if="c.suggested" class="star" :title="$t('requests.suggestedWhy')" :aria-label="$t('requests.suggested')">★</span>
                <RouterLink :to="`/sessions/${c.booking.id}`"><strong>{{ c.booking.userName }}</strong></RouterLink>
                <span v-if="c.booking.caseId || c.booking.kind === 'case'" class="badge warn" style="margin-left: 0.4rem">{{ $t('case.followUp') }}</span>
                <div class="muted small">{{ sessionTitle(c.booking) }}</div>
                <div class="small">
                  <strong v-if="c.alternatives.length === 0" style="color: var(--warn)">{{ $t('requests.onlyOption') }}</strong>
                  <span v-else class="muted">{{ $t('requests.alsoAsked', { times: alsoAsked(c.alternatives) }) }}</span>
                  <span class="muted"> · {{ $t('requests.asked', { ago: fmtAgo(c.booking.createdAt) }) }}</span>
                </div>
                <StudentTime :start="c.option.start" :duration-min="c.option.durationMin" :tz="c.booking.userTimeZone" />
                <p v-if="errors[c.booking.id]" class="error small">{{ errors[c.booking.id] }}</p>
              </div>
              <button
                class="small"
                :class="{ ghost: time.contenders.length > 1 && !c.suggested }"
                :disabled="busy !== null"
                @click="confirm(c.booking, c.option)"
              >
                {{ $t('requests.confirm') }}
              </button>
            </li>
          </ul>
        </section>
      </template>
    </template>

    <!-- By client: every request with all its times -->
    <template v-else>
      <div v-for="b in pending" :key="b.id" class="card">
        <div class="card-head">
          <div>
            <h3><RouterLink :to="`/sessions/${b.id}`">{{ sessionTitle(b) }}</RouterLink></h3>
            <p v-if="b.caseId" class="small">
              <span class="badge warn">{{ $t('case.followUp') }}</span>
              <template v-if="casePosition(bookings, b)"> {{ $t('case.position', casePosition(bookings, b)!) }} · </template><RouterLink :to="`/sessions/${b.caseId}`">{{ $t('case.firstSession') }}</RouterLink>
            </p>
            <p class="small">{{ b.userName }}</p>
            <p class="muted small">{{ b.userEmail }} · {{ $t(`kind.${b.kind}`) }} · {{ $t('requests.requestedOn', { date: fmtDate(b.createdAt, tz) }) }}</p>
          </div>
          <button class="danger small" @click="decline(b)">{{ $t('requests.decline') }}</button>
        </div>
        <p v-if="b.notes" class="prewrap">{{ b.notes }}</p>
        <ul class="option-list">
          <li v-for="(o, i) in b.options" :key="o.slotId">
            <span>
              {{ i + 1 }}. {{ fmtSlot(o.start, o.durationMin, tz) }}
              <span class="badge" :class="stateLabel(o).ok ? 'ok' : 'plain'">{{ stateLabel(o).label }}</span>
              <span v-if="rivals(b, o).length" class="small" style="color: var(--warn)"> · {{ $t('requests.alsoWantedBy', { names: rivals(b, o).join(', ') }) }}</span>
              <br /><StudentTime :start="o.start" :duration-min="o.durationMin" :tz="b.userTimeZone" />
            </span>
            <button class="small" :disabled="!stateLabel(o).ok || busy !== null" @click="confirm(b, o)">{{ $t('requests.confirmThis') }}</button>
          </li>
        </ul>
        <p v-if="errors[b.id]" class="error small">{{ errors[b.id] }}</p>
      </div>
    </template>
  </template>

  <div v-if="undo" class="toast" role="status">
    {{ undo.text }} <button class="link" @click="takeBack">{{ $t('requests.undo') }}</button>
  </div>
</template>
