<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLive } from '@/live'
import { createTask, deleteTask, setTaskDone, watchAllTasks } from '@/services/tasks'
import { watchUsers } from '@/services/users'
import { watchAllBookings } from '@/services/bookings'
import { fmtCalendarDate, fmtDate, fmtDay } from '@/format'
import { sessionTitle } from '@/progress'
import { useZones } from '@/zones'
import { useI18n } from 'vue-i18n'
import type { Booking, Task, UserProfile } from '@/types'

const { viewerTz: tz } = useZones()
const { t } = useI18n()
const { value: tasks, loaded } = useLive<Task[]>([], watchAllTasks)
const users = useLive<UserProfile[]>([], watchUsers).value
const bookings = useLive<Booking[]>([], watchAllBookings).value
const bookingById = computed(() => new Map(bookings.value.map((b) => [b.id, b])))

// ---- new task ----
const userId = ref('')
const title = ref('')
const details = ref('')
const due = ref('')
const bookingId = ref('')
const busy = ref(false)

const userSessions = computed(() =>
  bookings.value.filter((b) => b.userId === userId.value && b.confirmed && (b.status === 'confirmed' || b.status === 'completed')),
)

async function add() {
  const u = users.value.find((x) => x.uid === userId.value)
  if (!u || !title.value.trim()) return
  busy.value = true
  try {
    await createTask({
      userId: u.uid,
      userName: u.displayName,
      title: title.value,
      details: details.value,
      dueDate: due.value || undefined,
      bookingId: bookingId.value || undefined,
    })
    title.value = details.value = due.value = bookingId.value = ''
  } finally {
    busy.value = false
  }
}

// ---- list ----
const show = ref<'open' | 'done'>('open')
const forUser = ref('')
const shown = computed(() =>
  tasks.value.filter((t) => t.status === show.value && (!forUser.value || t.userId === forUser.value)),
)

async function remove(task: Task) {
  if (confirm(t('checklist.confirmDelete', { title: task.title }))) await deleteTask(task.id)
}
</script>

<template>
  <h1>{{ $t('adminChecklists.title') }}</h1>

  <div class="card stack">
    <h3>{{ $t('adminChecklists.add') }}</h3>
    <div class="fields">
      <label>
        {{ $t('adminChecklists.client') }}
        <select v-model="userId">
          <option value="" disabled>{{ $t('adminChecklists.choose') }}</option>
          <option v-for="u in users" :key="u.uid" :value="u.uid">{{ u.displayName }} ({{ u.email }})</option>
        </select>
      </label>
      <label>{{ $t('checklist.due') }} <input type="date" v-model="due" /></label>
      <label v-if="userSessions.length">
        <span>{{ $t('adminChecklists.fromSession') }} <span class="hint">{{ $t('common.optional') }}</span></span>
        <select v-model="bookingId">
          <option value="">—</option>
          <option v-for="b in userSessions" :key="b.id" :value="b.id">{{ sessionTitle(b) }} · {{ fmtDay(b.confirmed!.start, tz) }}</option>
        </select>
      </label>
    </div>
    <label>{{ $t('common.title') }} <input v-model="title" :placeholder="$t('adminChecklists.titlePlaceholder')" /></label>
    <label>{{ $t('common.details') }} <textarea v-model="details" rows="3" /></label>
    <div><button :disabled="busy || !userId || !title.trim()" @click="add">{{ $t('common.add') }}</button></div>
  </div>

  <div class="row" style="margin: 1.25rem 0 0.75rem">
    <div class="segmented">
      <button :class="{ on: show === 'open' }" @click="show = 'open'">{{ $t('adminChecklists.open') }}</button>
      <button :class="{ on: show === 'done' }" @click="show = 'done'">{{ $t('adminChecklists.completed') }}</button>
    </div>
    <select v-model="forUser" style="width: auto">
      <option value="">{{ $t('adminChecklists.allClients') }}</option>
      <option v-for="u in users" :key="u.uid" :value="u.uid">{{ u.displayName }}</option>
    </select>
  </div>

  <p v-if="!loaded" class="muted">{{ $t('common.loading') }}</p>
  <p v-else-if="shown.length === 0" class="muted">{{ $t('common.nothingHere') }}</p>
  <div v-for="t in shown" :key="t.id" class="card">
    <div class="card-head">
      <div>
        <h3>{{ t.title }}</h3>
        <p class="muted small">
          {{ t.userName }}
          <template v-if="t.bookingId && bookingById.get(t.bookingId)">
            · <RouterLink :to="`/sessions/${t.bookingId}`">{{ sessionTitle(bookingById.get(t.bookingId)!) }}</RouterLink>
          </template>
          <template v-if="t.dueDate"> · {{ $t('common.dueLower', { date: fmtCalendarDate(t.dueDate) }) }}</template>
          <template v-if="t.completedAt"> · {{ $t('adminChecklists.completedOn', { date: fmtDate(t.completedAt, tz) }) }}</template>
        </p>
      </div>
      <div class="row">
        <button class="small" :class="{ ghost: t.status === 'done' }" @click="setTaskDone(t.id, t.status === 'open')">
          {{ t.status === 'open' ? $t('common.markComplete') : $t('common.reopen') }}
        </button>
        <button class="danger small" @click="remove(t)">{{ $t('common.delete') }}</button>
      </div>
    </div>
    <p v-if="t.details" class="prewrap small">{{ t.details }}</p>
  </div>
</template>
