<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/auth'
import { useLive } from '@/live'
import { useZones } from '@/zones'
import { watchAllBookings } from '@/services/bookings'
import { watchAllTasks } from '@/services/tasks'
import { watchUsers } from '@/services/users'
import { byStart, isSession, isUpcoming, sessionTitle, summarizeStudents, taskProgress } from '@/progress'
import { fmtDay, fmtSlot } from '@/format'
import type { Booking, Task, UserProfile } from '@/types'
import ProgressBar from './ProgressBar.vue'
import OverviewCard from './OverviewCard.vue'
import TimeZoneNote from './TimeZoneNote.vue'

const auth = useAuth()
const { viewerTz: tz } = useZones()
const bookings = useLive<Booking[]>([], watchAllBookings).value
const tasks = useLive<Task[]>([], watchAllTasks).value
const { value: users, loaded: usersLoaded } = useLive<UserProfile[]>([], watchUsers)

const students = computed(() =>
  summarizeStudents(
    users.value.filter((u) => u.uid !== auth.user?.uid),
    bookings.value,
    tasks.value,
  ),
)
const pending = computed(() => bookings.value.filter((b) => b.status === 'pending'))
const upcoming = computed(() => bookings.value.filter((b) => isUpcoming(b)).sort(byStart))
const unpaid = computed(() => bookings.value.filter((b) => isSession(b) && b.payment === 'pending'))
const overall = computed(() => taskProgress(tasks.value))
</script>

<template>
  <h1>{{ $t('tutorDash.title') }}</h1>
  <TimeZoneNote />

  <div class="grid-stats">
    <RouterLink to="/admin/requests" class="stat"><strong>{{ pending.length }}</strong><span>{{ $t('tutorDash.requests') }}</span></RouterLink>
    <RouterLink to="/admin/sessions" class="stat"><strong>{{ upcoming.length }}</strong><span>{{ $t('tutorDash.upcoming') }}</span></RouterLink>
    <RouterLink to="/admin/sessions" class="stat"><strong>{{ unpaid.length }}</strong><span>{{ $t('tutorDash.unpaid') }}</span></RouterLink>
    <RouterLink to="/admin/tasks" class="stat">
      <strong>{{ overall.pct === null ? '—' : `${overall.pct}%` }}</strong><span>{{ $t('tutorDash.checklistsDone') }}</span>
    </RouterLink>
  </div>

  <template v-if="upcoming.length">
    <div class="section-head"><h2>{{ $t('tutorDash.next') }}</h2><RouterLink to="/admin/sessions" class="small">{{ $t('tutorDash.all') }}</RouterLink></div>
    <RouterLink v-for="b in upcoming.slice(0, 5)" :key="b.id" :to="`/sessions/${b.id}`" class="card stack" style="gap: 0.2rem">
      <div class="card-head">
        <h3>{{ sessionTitle(b) }}</h3>
        <span class="small">{{ b.userName }}</span>
      </div>
      <span class="muted small">{{ fmtSlot(b.confirmed!.start, b.confirmed!.durationMin, tz) }}</span>
    </RouterLink>
  </template>

  <h2>{{ $t('tutorDash.clients') }}</h2>
  <p v-if="!usersLoaded" class="muted">{{ $t('common.loading') }}</p>
  <p v-else-if="students.length === 0" class="muted">{{ $t('tutorDash.noClients') }}</p>
  <RouterLink v-for="s in students" :key="s.user.uid" :to="`/admin/students/${s.user.uid}`" class="card stack" style="gap: 0.4rem">
    <div class="card-head">
      <h3>{{ s.user.displayName }}</h3>
      <div class="row">
        <span v-if="s.pending" class="badge warn">{{ $t('tutorDash.pendingBadge', s.pending) }}</span>
        <span v-if="s.unpaid" class="badge warn">{{ $t('tutorDash.unpaidBadge', { n: s.unpaid }) }}</span>
      </div>
    </div>
    <ProgressBar :progress="s.progress" compact />
    <p class="muted small">
      {{ $t('tutorDash.sessionsDone', s.sessionsDone) }} · {{ $t('tutorDash.upcomingCount', s.upcoming) }}
      <template v-if="s.next"> · {{ $t('tutorDash.nextOn', { date: fmtDay(s.next.confirmed!.start, tz) }) }}</template>
    </p>
  </RouterLink>

  <h2>{{ $t('tutorDash.overview') }}</h2>
  <OverviewCard />
</template>
