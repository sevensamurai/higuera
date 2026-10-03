<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/auth'
import { useLive } from '@/live'
import { createTask, deleteTask, setTaskDone, watchSessionTasks } from '@/services/tasks'
import { taskProgress } from '@/progress'
import { fmtCalendarDate } from '@/format'
import type { Booking, Task } from '@/types'
import ProgressBar from './ProgressBar.vue'

const props = defineProps<{ booking: Booking }>()
const auth = useAuth()
const { t } = useI18n()
const { value: tasks, loaded } = useLive<Task[]>([], (set) =>
  watchSessionTasks(props.booking.id, props.booking.userId, set),
)
const progress = computed(() => taskProgress(tasks.value))

const title = ref('')
const details = ref('')
const due = ref('')
const error = ref('')

// Clear the form straight away: the task appears from the local cache at once, but the write only
// resolves on server ack (never, while offline). Waiting would block, or wipe, the next entry.
async function add() {
  const draft = { title: title.value, details: details.value, due: due.value }
  if (!draft.title.trim()) return
  title.value = details.value = due.value = ''
  error.value = ''
  try {
    await createTask({
      userId: props.booking.userId,
      userName: props.booking.userName,
      title: draft.title,
      details: draft.details,
      dueDate: draft.due || undefined,
      bookingId: props.booking.id,
    })
  } catch (e) {
    if (!title.value) {
      title.value = draft.title
      details.value = draft.details
      due.value = draft.due
    }
    error.value = (e as Error).message
  }
}

async function remove(task: Task) {
  if (confirm(t('checklist.confirmDelete', { title: task.title }))) await deleteTask(task.id)
}
</script>

<template>
  <div class="stack">
    <ProgressBar v-if="tasks.length" :progress="progress" />
    <p v-else-if="loaded" class="muted small">
      {{ auth.isAdmin ? $t('checklist.emptyAdmin') : $t('checklist.emptyClient') }}
    </p>

    <ul class="task-list">
      <li v-for="task in tasks" :key="task.id" :class="{ done: task.status === 'done' }">
        <span class="check" :aria-label="task.status === 'done' ? $t('checklist.complete') : $t('checklist.open')">{{ task.status === 'done' ? '✓' : '' }}</span>
        <div style="flex: 1">
          <div>{{ task.title }}</div>
          <div v-if="task.details" class="muted small prewrap">{{ task.details }}</div>
          <div v-if="task.dueDate" class="muted small">{{ $t('common.due', { date: fmtCalendarDate(task.dueDate) }) }}</div>
        </div>
        <template v-if="auth.isAdmin">
          <button class="small" :class="{ ghost: task.status === 'done' }" @click="setTaskDone(task.id, task.status === 'open')">
            {{ task.status === 'open' ? $t('common.markComplete') : $t('common.reopen') }}
          </button>
          <button class="link small" :title="$t('common.delete')" :aria-label="$t('common.delete')" @click="remove(task)">✕</button>
        </template>
      </li>
    </ul>

    <details v-if="auth.isAdmin" class="add-task">
      <summary>{{ $t('checklist.addSummary') }}</summary>
      <div class="stack" style="margin-top: 0.75rem">
        <div class="fields">
          <label style="grid-column: span 2">{{ $t('checklist.item') }} <input v-model="title" :placeholder="$t('checklist.itemPlaceholder')" /></label>
          <label>{{ $t('checklist.due') }} <input type="date" v-model="due" /></label>
        </div>
        <label>{{ $t('common.details') }} <textarea v-model="details" rows="2" /></label>
        <div class="row">
          <button class="small" :disabled="!title.trim()" @click="add">{{ $t('common.add') }}</button>
          <span v-if="error" class="error small">{{ error }}</span>
        </div>
      </div>
    </details>
    <p v-else class="muted small">{{ $t('checklist.clientHint') }}</p>
  </div>
</template>
