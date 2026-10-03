<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/auth'
import { useLive } from '@/live'
import { watchMyBookings } from '@/services/bookings'
import { watchMyTasks } from '@/services/tasks'
import { byStart, isSession, isUpcoming } from '@/progress'
import type { Booking, Task } from '@/types'
import TimeZoneNote from '@/components/TimeZoneNote.vue'
import SessionRow from '@/components/SessionRow.vue'

const auth = useAuth()
const { value: bookings, loaded } = useLive<Booking[]>([], (set) => watchMyBookings(auth.user!.uid, set))
const tasks = useLive<Task[]>([], (set) => watchMyTasks(auth.user!.uid, set)).value

const upcoming = computed(() => bookings.value.filter((b) => isUpcoming(b)).sort(byStart))
const requests = computed(() => bookings.value.filter((b) => b.status === 'pending'))
const past = computed(() => bookings.value.filter((b) => isSession(b) && !isUpcoming(b)).sort((a, b) => byStart(b, a)))
const closed = computed(() => bookings.value.filter((b) => b.status === 'declined' || b.status === 'cancelled'))
</script>

<template>
  <h1>{{ $t('mySessions.title') }}</h1>
  <TimeZoneNote />
  <p v-if="!loaded" class="muted">{{ $t('common.loading') }}</p>
  <p v-else-if="bookings.length === 0" class="muted">
    {{ $t('mySessions.empty') }} <RouterLink to="/book">{{ $t('mySessions.bookLink') }}</RouterLink>
  </p>

  <template v-if="upcoming.length">
    <h2>{{ $t('mySessions.upcoming') }}</h2>
    <SessionRow v-for="b in upcoming" :key="b.id" :booking="b" :tasks="tasks" />
  </template>
  <template v-if="requests.length">
    <h2>{{ $t('mySessions.awaiting') }}</h2>
    <SessionRow v-for="b in requests" :key="b.id" :booking="b" />
  </template>
  <template v-if="past.length">
    <h2>{{ $t('mySessions.past') }}</h2>
    <SessionRow v-for="b in past" :key="b.id" :booking="b" :tasks="tasks" />
  </template>
  <template v-if="closed.length">
    <h2>{{ $t('mySessions.closed') }}</h2>
    <SessionRow v-for="b in closed" :key="b.id" :booking="b" />
  </template>
</template>
