<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLive } from '@/live'
import { watchAllBookings } from '@/services/bookings'
import { watchAllTasks } from '@/services/tasks'
import { watchUpcomingSlots } from '@/services/slots'
import { dayKey, fmtDay, fmtTime, fold } from '@/format'
import { useZones } from '@/zones'
import { byStart, isSession, isUpcoming } from '@/progress'
import type { Booking, Slot, Task } from '@/types'
import SessionRow from '@/components/SessionRow.vue'
import TimeZoneNote from '@/components/TimeZoneNote.vue'

type Filter = 'upcoming' | 'past' | 'unpaid'
const filter = ref<Filter>('upcoming')

const { value: bookings, loaded } = useLive<Booking[]>([], watchAllBookings)
const tasks = useLive<Task[]>([], watchAllTasks).value

const { value: slots, loaded: slotsLoaded } = useLive<Slot[]>([], watchUpcomingSlots)
const { viewerTz } = useZones()
// Open slots nobody has booked yet, by day — the other half of "upcoming".
const openDays = computed(() => {
  const groups = new Map<string, { label: string; slots: Slot[] }>()
  for (const s of slots.value) {
    if (s.status !== 'open') continue
    const k = dayKey(s.start, viewerTz.value)
    if (!groups.has(k)) groups.set(k, { label: fmtDay(s.start, viewerTz.value), slots: [] })
    groups.get(k)!.slots.push(s)
  }
  return [...groups.values()]
})

// Search by client (name or email) or by research question; kept in the URL so Back returns to it.
const route = useRoute()
const router = useRouter()
const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
watch(q, (v) => router.replace({ query: v.trim() ? { q: v } : {} }))
const terms = computed(() => fold(q.value).split(/\s+/).filter(Boolean))
const matches = (b: Booking) => terms.value.every((t) => fold(`${b.userName} ${b.userEmail} ${b.title}`).includes(t))
/** Clients with a matching booking, each linking to their page (every session, request and checklist). */
const clients = computed(() => {
  if (!terms.value.length) return []
  const m = new Map<string, { uid: string; name: string; email: string; n: number }>()
  for (const b of bookings.value.filter(matches)) {
    const c = m.get(b.userId) ?? { uid: b.userId, name: b.userName, email: b.userEmail, n: 0 }
    c.n++
    m.set(b.userId, c)
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const sessions = computed(() => bookings.value.filter(isSession).filter(matches))
const shown = computed(() => {
  switch (filter.value) {
    case 'upcoming':
      return sessions.value.filter((b) => isUpcoming(b)).sort(byStart)
    case 'past':
      return sessions.value.filter((b) => !isUpcoming(b)).sort((a, b) => byStart(b, a))
    case 'unpaid':
      return sessions.value.filter((b) => b.payment === 'pending').sort(byStart)
  }
})
const unpaidCount = computed(() => sessions.value.filter((b) => b.payment === 'pending').length)
</script>

<template>
  <h1>{{ $t('adminSessions.title') }}</h1>
  <TimeZoneNote />
  <input
    v-model="q"
    type="search"
    class="search"
    :placeholder="$t('adminSessions.search')"
    :aria-label="$t('adminSessions.search')"
    autocomplete="off"
  />
  <div v-if="terms.length" class="chips" style="margin: 0.6rem 0 0.9rem">
    <span v-if="loaded && clients.length === 0" class="muted small">{{ $t('adminSessions.noClient') }}</span>
    <RouterLink v-for="c in clients" :key="c.uid" :to="`/admin/students/${c.uid}`" class="chip client-chip">
      {{ c.name }} <span class="muted small">· {{ c.email }} · {{ $t('adminSessions.bookings', c.n) }} →</span>
    </RouterLink>
  </div>
  <div class="segmented" style="margin-bottom: 1rem">
    <button :class="{ on: filter === 'upcoming' }" @click="filter = 'upcoming'">{{ $t('adminSessions.upcoming') }}</button>
    <button :class="{ on: filter === 'past' }" @click="filter = 'past'">{{ $t('adminSessions.past') }}</button>
    <button :class="{ on: filter === 'unpaid' }" @click="filter = 'unpaid'">{{ $t('adminSessions.unpaid', { n: unpaidCount }) }}</button>
  </div>
  <p v-if="!loaded" class="muted">{{ $t('common.loading') }}</p>
  <p v-else-if="shown.length === 0" class="muted">{{ $t('common.nothingHere') }}</p>
  <SessionRow v-for="b in shown" :key="b.id" :booking="b" :all="bookings" :tasks="tasks" show-student />

  <template v-if="filter === 'upcoming' && slotsLoaded && !terms.length">
    <h2>
      {{ $t('adminSessions.openSlots') }}
      <RouterLink to="/admin/availability" class="small">{{ $t('adminSessions.manage') }}</RouterLink>
    </h2>
    <p v-if="openDays.length === 0" class="muted">
      {{ $t('adminSessions.noOpenSlots') }} <RouterLink to="/admin/availability">{{ $t('adminSessions.addAvailability') }}</RouterLink>
    </p>
    <div v-for="d in openDays" :key="d.label" class="day">
      <h3>{{ d.label }}</h3>
      <div class="chips">
        <span v-for="s in d.slots" :key="s.id" class="chip">
          {{ fmtTime(s.start, viewerTz) }} <span class="muted small">· {{ $t('common.minutes', { n: s.durationMin }) }}</span>
        </span>
      </div>
    </div>
  </template>
</template>
