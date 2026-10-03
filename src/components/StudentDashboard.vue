<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/auth'
import { useLive } from '@/live'
import { useZones } from '@/zones'
import { watchMyBookings } from '@/services/bookings'
import { watchMyTasks } from '@/services/tasks'
import { byStart, isSession, isUpcoming, sessionTitle, taskProgress } from '@/progress'
import { fmtCalendarDate, fmtSlot, tzLabel } from '@/format'
import type { Booking, Task } from '@/types'
import ProgressBar from './ProgressBar.vue'
import SessionRow from './SessionRow.vue'
import OverviewCard from './OverviewCard.vue'

const auth = useAuth()
const uid = auth.user!.uid
const { viewerTz: tz } = useZones()
const bookings = useLive<Booking[]>([], (set) => watchMyBookings(uid, set)).value
const tasks = useLive<Task[]>([], (set) => watchMyTasks(uid, set)).value

const firstName = computed(() => (auth.user?.displayName ?? '').split(' ')[0])
const overall = computed(() => taskProgress(tasks.value))
const sessions = computed(() => bookings.value.filter(isSession))
const upcoming = computed(() => sessions.value.filter((b) => isUpcoming(b)).sort(byStart))
const completed = computed(() => sessions.value.filter((b) => !isUpcoming(b)).length)
const pending = computed(() => bookings.value.filter((b) => b.status === 'pending'))
const unpaid = computed(() => sessions.value.filter((b) => b.payment === 'pending'))
const openTasks = computed(() =>
  tasks.value
    .filter((t) => t.status === 'open')
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')),
)
const recent = computed(() => [...pending.value, ...[...sessions.value].sort(byStart).reverse()].slice(0, 6))
</script>

<template>
  <h1>{{ firstName ? $t('studentDash.hiName', { name: firstName }) : $t('studentDash.hi') }}</h1>

  <section class="card stack">
    <div class="section-head">
      <h3>{{ $t('studentDash.progress') }}</h3>
      <span class="muted small">{{ $t('studentDash.sessionsDone', completed) }}</span>
    </div>
    <ProgressBar :progress="overall" />
  </section>

  <div class="grid-stats">
    <RouterLink to="/sessions" class="stat"><strong>{{ upcoming.length }}</strong><span>{{ $t('studentDash.upcoming') }}</span></RouterLink>
    <RouterLink to="/sessions" class="stat"><strong>{{ pending.length }}</strong><span>{{ $t('studentDash.awaiting') }}</span></RouterLink>
    <RouterLink to="/sessions" class="stat"><strong>{{ unpaid.length }}</strong><span>{{ $t('studentDash.paymentPending') }}</span></RouterLink>
    <RouterLink to="/tasks" class="stat"><strong>{{ openTasks.length }}</strong><span>{{ $t('studentDash.onChecklist') }}</span></RouterLink>
  </div>

  <RouterLink v-if="upcoming[0]" :to="`/sessions/${upcoming[0].id}`" class="card stack" style="gap: 0.25rem">
    <span class="muted small">{{ $t('studentDash.next') }}</span>
    <h3>{{ sessionTitle(upcoming[0]) }}</h3>
    <span>{{ fmtSlot(upcoming[0].confirmed!.start, upcoming[0].confirmed!.durationMin, tz) }}</span>
    <span class="other-tz">{{ tzLabel(tz, upcoming[0].confirmed!.start) }}</span>
  </RouterLink>
  <RouterLink to="/book" class="btn">{{ $t('studentDash.book') }}</RouterLink>

  <template v-if="openTasks.length">
    <div class="section-head"><h2>{{ $t('studentDash.checklist') }}</h2><RouterLink to="/tasks" class="small">{{ $t('studentDash.seeAll') }}</RouterLink></div>
    <section class="card">
      <ul class="task-list">
        <li v-for="t in openTasks.slice(0, 5)" :key="t.id">
          <span class="check" />
          <div style="flex: 1">
            <div>{{ t.title }}</div>
            <div v-if="t.dueDate" class="muted small">{{ $t('common.due', { date: fmtCalendarDate(t.dueDate) }) }}</div>
          </div>
        </li>
      </ul>
    </section>
  </template>

  <template v-if="recent.length">
    <div class="section-head"><h2>{{ $t('studentDash.sessions') }}</h2><RouterLink to="/sessions" class="small">{{ $t('studentDash.allSessions') }}</RouterLink></div>
    <SessionRow v-for="b in recent" :key="b.id" :booking="b" :tasks="tasks" />
  </template>

  <h2>{{ $t('studentDash.about') }}</h2>
  <OverviewCard />
</template>
