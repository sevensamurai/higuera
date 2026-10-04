<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLive } from '@/live'
import { watchAllBookings } from '@/services/bookings'
import { setTaskDone, watchAllTasks } from '@/services/tasks'
import { watchUsers } from '@/services/users'
import { summarizeStudents } from '@/progress'
import { fmtCalendarDate, tzLabel } from '@/format'
import type { Booking, Task, UserProfile } from '@/types'
import ProgressBar from '@/components/ProgressBar.vue'
import SessionRow from '@/components/SessionRow.vue'

const uid = useRoute().params.uid as string
const { value: users, loaded } = useLive<UserProfile[]>([], watchUsers)
const allBookings = useLive<Booking[]>([], watchAllBookings).value
const allTasks = useLive<Task[]>([], watchAllTasks).value

const user = computed(() => users.value.find((u) => u.uid === uid))
const bookings = computed(() => allBookings.value.filter((b) => b.userId === uid))
const tasks = computed(() => allTasks.value.filter((t) => t.userId === uid))
const summary = computed(() => (user.value ? summarizeStudents([user.value], bookings.value, tasks.value)[0] : null))
const zone = computed(() => user.value?.timeZone ?? user.value?.detectedTimeZone)

const sessionTitleById = computed(() => new Map(bookings.value.map((b) => [b.id, b.title])))
const openTasks = computed(() => tasks.value.filter((t) => t.status === 'open'))
const doneTasks = computed(() => tasks.value.filter((t) => t.status === 'done'))
</script>

<template>
  <RouterLink to="/" class="small">{{ $t('client.back') }}</RouterLink>
  <p v-if="!loaded" class="muted">{{ $t('common.loading') }}</p>
  <p v-else-if="!user || !summary" class="muted">{{ $t('client.notFound') }}</p>

  <template v-else>
    <section class="card stack" style="margin-top: 0.75rem">
      <div class="card-head">
        <div>
          <h1 style="margin: 0">{{ user.displayName }}</h1>
          <p class="muted small">{{ user.email }}<template v-if="zone"> · {{ tzLabel(zone) }}</template></p>
        </div>
        <span v-if="summary.unpaid" class="badge warn">{{ $t('tutorDash.unpaidBadge', { n: summary.unpaid }) }}</span>
      </div>
      <ProgressBar :progress="summary.progress" />
      <p class="muted small">
        {{ $t('client.summary', { done: summary.sessionsDone, upcoming: summary.upcoming, pending: summary.pending }) }}
      </p>
    </section>

    <h2>{{ $t('client.sessions') }}</h2>
    <p v-if="bookings.length === 0" class="muted">{{ $t('client.noSessions') }}</p>
    <SessionRow v-for="b in bookings" :key="b.id" :booking="b" :all="allBookings" :tasks="tasks" />

    <div class="section-head">
      <h2>{{ $t('client.checklist') }}</h2>
      <RouterLink to="/admin/tasks" class="small">{{ $t('client.addGeneral') }}</RouterLink>
    </div>
    <p v-if="tasks.length === 0" class="muted small">{{ $t('client.addFromSession') }}</p>
    <section v-else class="card">
      <ul class="task-list">
        <li v-for="t in [...openTasks, ...doneTasks]" :key="t.id" :class="{ done: t.status === 'done' }">
          <span class="check">{{ t.status === 'done' ? '✓' : '' }}</span>
          <div style="flex: 1">
            <div>{{ t.title }}</div>
            <div class="muted small">
              <RouterLink v-if="t.bookingId" :to="`/sessions/${t.bookingId}`">{{ sessionTitleById.get(t.bookingId) || $t('client.session') }}</RouterLink>
              <template v-else>{{ $t('client.general') }}</template>
              <template v-if="t.dueDate"> · {{ $t('common.dueLower', { date: fmtCalendarDate(t.dueDate) }) }}</template>
            </div>
          </div>
          <button class="small" :class="{ ghost: t.status === 'done' }" @click="setTaskDone(t.id, t.status === 'open')">
            {{ t.status === 'open' ? $t('common.markComplete') : $t('common.reopen') }}
          </button>
        </li>
      </ul>
    </section>
  </template>
</template>
