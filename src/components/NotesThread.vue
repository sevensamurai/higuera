<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/auth'
import { useLive } from '@/live'
import { useZones } from '@/zones'
import { addNote, deleteNote, watchNotes } from '@/services/notes'
import { fmtDay, fmtTime } from '@/format'
import { useI18n } from 'vue-i18n'
import type { SessionNote } from '@/types'

const props = defineProps<{ bookingId: string }>()
const auth = useAuth()
const { viewerTz: tz } = useZones()
const { t } = useI18n()
const { value: notes, loaded } = useLive<SessionNote[]>([], (set) => watchNotes(props.bookingId, set))

const text = ref('')
const error = ref('')

// Cleared optimistically, restored on failure: see SessionTasks for why we don't wait on the ack.
async function post() {
  const draft = text.value
  if (!draft.trim() || !auth.user) return
  text.value = ''
  error.value = ''
  try {
    await addNote(props.bookingId, {
      authorId: auth.user.uid,
      authorName: auth.user.displayName ?? auth.user.email ?? t('common.unnamed'),
      role: auth.isAdmin ? 'tutor' : 'student',
      text: draft,
    })
  } catch (e) {
    if (!text.value) text.value = draft
    error.value = (e as Error).message
  }
}

async function remove(n: SessionNote) {
  if (confirm(t('notes.confirmDelete'))) await deleteNote(props.bookingId, n.id)
}
</script>

<template>
  <div class="stack">
    <p v-if="loaded && notes.length === 0" class="muted small">
      {{ $t('notes.empty') }}
    </p>
    <div v-for="n in notes" :key="n.id" class="note" :class="n.role">
      <div class="note-head small">
        <strong>{{ n.authorName }}</strong>
        <span class="badge" :class="n.role === 'tutor' ? '' : 'plain'">{{ $t(`role.${n.role}`) }}</span>
        <span class="muted">{{ fmtDay(n.createdAt, tz) }} {{ fmtTime(n.createdAt, tz) }}</span>
        <button v-if="n.authorId === auth.user?.uid || auth.isAdmin" class="link small" @click="remove(n)">{{ $t('notes.deleteLink') }}</button>
      </div>
      <p class="prewrap">{{ n.text }}</p>
    </div>
    <label>
      {{ $t('notes.add') }}
      <textarea v-model="text" rows="3" maxlength="4000" :placeholder="$t('notes.placeholder')" />
    </label>
    <div class="row">
      <button class="small" :disabled="!text.trim()" @click="post">{{ $t('notes.post') }}</button>
      <span v-if="error" class="error small">{{ error }}</span>
    </div>
  </div>
</template>
