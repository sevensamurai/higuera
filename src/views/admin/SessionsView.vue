<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLive } from '@/live'
import { watchAllBookings } from '@/services/bookings'
import { watchAllTasks } from '@/services/tasks'
import { watchUpcomingSlots } from '@/services/slots'
import { dayKey, fmtDay, fmtTime } from '@/format'
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

const sessions = computed(() => bookings.value.filter(isSession))
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
  <div class="segmented" style="margin-bottom: 1rem">
    <button :class="{ on: filter === 'upcoming' }" @click="filter = 'upcoming'">{{ $t('adminSessions.upcoming') }}</button>
    <button :class="{ on: filter === 'past' }" @click="filter = 'past'">{{ $t('adminSessions.past') }}</button>
    <button :class="{ on: filter === 'unpaid' }" @click="filter = 'unpaid'">{{ $t('adminSessions.unpaid', { n: unpaidCount }) }}</button>
  </div>
  <p v-if="!loaded" class="muted">{{ $t('common.loading') }}</p>
  <p v-else-if="shown.length === 0" class="muted">{{ $t('common.nothingHere') }}</p>
  <SessionRow v-for="b in shown" :key="b.id" :booking="b" :all="bookings" :tasks="tasks" show-student />

  <template v-if="filter === 'upcoming' && slotsLoaded">
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
