<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLive } from '@/live'
import { watchAllBookings } from '@/services/bookings'
import { watchAllTasks } from '@/services/tasks'
import { byStart, isSession, isUpcoming } from '@/progress'
import type { Booking, Task } from '@/types'
import SessionRow from '@/components/SessionRow.vue'
import TimeZoneNote from '@/components/TimeZoneNote.vue'

type Filter = 'upcoming' | 'past' | 'unpaid'
const filter = ref<Filter>('upcoming')

const { value: bookings, loaded } = useLive<Booking[]>([], watchAllBookings)
const tasks = useLive<Task[]>([], watchAllTasks).value

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
  <SessionRow v-for="b in shown" :key="b.id" :booking="b" :tasks="tasks" show-student />
</template>
