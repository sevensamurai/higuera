<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/auth'
import { useLive } from '@/live'
import { watchMyTasks } from '@/services/tasks'
import { watchMyBookings } from '@/services/bookings'
import { sessionTitle, taskProgress } from '@/progress'
import ProgressBar from '@/components/ProgressBar.vue'
import { fmtCalendarDate, fmtDate } from '@/format'
import { dayIn } from '@/timezone'
import { useZones } from '@/zones'
import type { Booking, Task } from '@/types'

const auth = useAuth()
const { viewerTz: tz } = useZones()
const { value: tasks, loaded } = useLive<Task[]>([], (set) => watchMyTasks(auth.user!.uid, set))
const bookings = useLive<Booking[]>([], (set) => watchMyBookings(auth.user!.uid, set)).value
const sessionById = computed(() => new Map(bookings.value.map((b) => [b.id, b])))
const progress = computed(() => taskProgress(tasks.value))

const open = computed(() =>
  tasks.value
    .filter((t) => t.status === 'open')
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')),
)
const done = computed(() => tasks.value.filter((t) => t.status === 'done'))
// Overdue once the due day has ended where the student is.
const overdue = (t: Task) => !!t.dueDate && t.dueDate < dayIn(new Date(), tz.value)
</script>

<template>
  <h1>{{ $t('myChecklist.title') }}</h1>
  <p v-if="!loaded" class="muted">{{ $t('common.loading') }}</p>
  <p v-else-if="tasks.length === 0" class="muted">{{ $t('myChecklist.empty') }}</p>
  <section v-else class="card"><ProgressBar :progress="progress" /></section>
  <p v-if="tasks.length" class="muted small">{{ $t('checklist.clientHint') }}</p>

  <template v-if="open.length">
    <h2>{{ $t('myChecklist.toDo') }}</h2>
    <div v-for="t in open" :key="t.id" class="card">
      <div class="card-head">
        <h3>{{ t.title }}</h3>
        <span v-if="t.dueDate" class="badge" :class="overdue(t) ? 'bad' : 'plain'">{{ $t('common.due', { date: fmtCalendarDate(t.dueDate) }) }}</span>
      </div>
      <p v-if="t.details" class="prewrap">{{ t.details }}</p>
      <p v-if="t.bookingId && sessionById.get(t.bookingId)" class="small">
        {{ $t('myChecklist.from') }} <RouterLink :to="`/sessions/${t.bookingId}`">{{ sessionTitle(sessionById.get(t.bookingId)!) }}</RouterLink>
      </p>
    </div>
  </template>

  <template v-if="done.length">
    <h2>{{ $t('myChecklist.completed') }}</h2>
    <div v-for="t in done" :key="t.id" class="card">
      <div class="card-head">
        <h3>{{ t.title }}</h3>
        <span class="badge ok">{{ t.completedAt ? $t('myChecklist.doneOn', { date: fmtDate(t.completedAt, tz) }) : $t('myChecklist.done') }}</span>
      </div>
    </div>
  </template>
</template>
