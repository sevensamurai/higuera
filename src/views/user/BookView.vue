<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/auth'
import { useLive } from '@/live'
import { watchUpcomingSlots } from '@/services/slots'
import { requestBooking, watchMyBookings } from '@/services/bookings'
import { dayKey, fmtDay, fmtSlot, fmtTime, tzLabel, tzOffset } from '@/format'
import { useZones } from '@/zones'
import { continuableCases } from '@/progress'
import type { Booking, BookingKind, Slot } from '@/types'
import TimeZoneNote from '@/components/TimeZoneNote.vue'
import { useI18n } from 'vue-i18n'

const MAX_OPTIONS = 3

const auth = useAuth()
const route = useRoute()
const router = useRouter()
const user = auth.user!
const { t } = useI18n()
const { viewerTz, tutorTz } = useZones()

const { value: slots, loaded } = useLive<Slot[]>([], watchUpcomingSlots)
const { value: mine, loaded: mineLoaded } = useLive<Booking[]>([], (set) => watchMyBookings(user.uid, set))

// Slots already offered in one of my live requests — no point requesting them twice.
const alreadyRequested = computed(
  () => new Set(mine.value.filter((b) => b.status === 'pending').flatMap((b) => b.options.map((o) => o.slotId))),
)

const days = computed(() => {
  const groups = new Map<string, { label: string; slots: Slot[] }>()
  for (const s of slots.value) {
    if (s.status !== 'open' || s.start.getTime() <= Date.now()) continue
    // Grouped by the student's calendar day: a tutor's Saturday evening may be the student's Sunday.
    const k = dayKey(s.start, viewerTz.value)
    if (!groups.has(k)) groups.set(k, { label: fmtDay(s.start, viewerTz.value), slots: [] })
    groups.get(k)!.slots.push(s)
  }
  return [...groups.values()]
})

const selected = ref<Slot[]>([])
const kind = ref<BookingKind>('tutoring')
const title = ref('')
const notes = ref('')
const busy = ref(false)
const error = ref('')

// Continuing a case: pick one of the client's cases (?case=<id> preselects it from a session page),
// or "another case" and describe it, for one that started before this app.
const cases = computed(() => continuableCases(mine.value))
const caseId = ref(typeof route.query.case === 'string' ? route.query.case : '')
if (caseId.value) kind.value = 'case'
const current = computed(() => (kind.value === 'case' ? cases.value.find((c) => c.id === caseId.value) : undefined))
watch(
  current,
  (c, prev) => {
    if (c) title.value = c.title
    else if (prev && title.value === prev.title) title.value = ''
  },
  { immediate: true },
)
watch(kind, (k) => {
  if (k === 'case' && !caseId.value && cases.value.length) caseId.value = cases.value[0].id
})
watch(mineLoaded, () => {
  if (caseId.value && !cases.value.some((c) => c.id === caseId.value)) caseId.value = '' // not theirs, or nothing to continue yet
})

const isSelected = (s: Slot) => selected.value.some((x) => x.id === s.id)
function toggle(s: Slot) {
  if (isSelected(s)) selected.value = selected.value.filter((x) => x.id !== s.id)
  else if (selected.value.length < MAX_OPTIONS) selected.value = [...selected.value, s]
}

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await requestBooking({
      userId: user.uid,
      userName: user.displayName ?? user.email ?? t('common.unnamed'),
      userEmail: user.email ?? '',
      userTimeZone: viewerTz.value,
      caseId: current.value?.id,
      kind: kind.value,
      title: title.value,
      notes: notes.value,
      options: [...selected.value]
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .map((s) => ({ slotId: s.id, start: s.start, durationMin: s.durationMin })),
    })
    router.push('/')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <h1>{{ $t('book.title') }}</h1>
  <p class="muted">{{ $t('book.intro', { max: MAX_OPTIONS }) }}</p>
  <TimeZoneNote />

  <div class="card stack">
    <div class="row">
      <span class="small">{{ $t('book.thisIsFor') }}</span>
      <div class="segmented">
        <button :class="{ on: kind === 'tutoring' }" :aria-pressed="kind === 'tutoring'" @click="kind = 'tutoring'">{{ $t('kind.tutoring') }}</button>
        <button :class="{ on: kind === 'case' }" :aria-pressed="kind === 'case'" @click="kind = 'case'">{{ $t('book.continuing') }}</button>
      </div>
    </div>
    <template v-if="kind === 'case' && cases.length">
      <label>
        {{ $t('book.whichCase') }}
        <select v-model="caseId">
          <option v-for="c in cases" :key="c.id" :value="c.id">{{ c.title }}</option>
          <option value="">{{ $t('book.otherCase') }}</option>
        </select>
      </label>
      <p v-if="current" class="other-tz" style="margin-top: -0.4rem">{{ $t('book.followUp', { n: current.sessions + 1 }) }}</p>
    </template>
    <label>
      {{ kind === 'case' && !current ? $t('book.caseQuestion') : $t('book.question') }}
      <input v-model="title" maxlength="120" :placeholder="$t('book.questionPlaceholder')" />
    </label>
    <label>
      <span>{{ $t('common.details') }} <span class="hint">{{ $t('common.optional') }}</span></span>
      <textarea v-model="notes" rows="3" :placeholder="$t('book.detailsPlaceholder')" />
    </label>
  </div>

  <h2>{{ $t('book.available') }}</h2>
  <p v-if="tutorTz !== viewerTz" class="other-tz">{{ $t('book.converted', { zone: tzLabel(tutorTz) }) }}</p>
  <p v-if="!loaded" class="muted">{{ $t('common.loading') }}</p>
  <p v-else-if="days.length === 0" class="muted">{{ $t('book.none') }}</p>
  <div v-for="d in days" :key="d.label" class="day">
    <h3>{{ d.label }}</h3>
    <div class="chips">
      <button
        v-for="s in d.slots"
        :key="s.id"
        class="chip"
        :class="{ on: isSelected(s) }"
        :disabled="alreadyRequested.has(s.id) || (!isSelected(s) && selected.length >= MAX_OPTIONS)"
        :title="alreadyRequested.has(s.id) ? $t('book.alreadyRequested') : ''"
        @click="toggle(s)"
      >
        {{ fmtTime(s.start, viewerTz) }} <span class="muted small">· {{ $t('common.minutes', { n: s.durationMin }) }}</span>
      </button>
    </div>
  </div>

  <div class="sticky-bar" v-if="selected.length">
    <div class="small">
      <div v-for="(s, i) in selected" :key="s.id">
        {{ i + 1 }}. {{ fmtSlot(s.start, s.durationMin, viewerTz) }} <span class="muted">{{ tzOffset(viewerTz, s.start) }}</span>
      </div>
    </div>
    <button :disabled="busy || !title.trim()" :title="title.trim() ? '' : $t('book.needQuestion')" @click="submit">
      {{ busy ? $t('book.sending') : title.trim() ? $t('book.request') : $t('book.addQuestion') }}
    </button>
  </div>
  <p v-if="error" class="error">{{ error }}</p>
</template>
