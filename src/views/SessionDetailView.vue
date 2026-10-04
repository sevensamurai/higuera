<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/auth'
import { useLive } from '@/live'
import { useZones } from '@/zones'
import {
  cancelConfirmed,
  reopenSession,
  saveSummary,
  setPayment,
  updateTitle,
  watchBooking,
  watchMyBookings,
  withdrawRequest,
} from '@/services/bookings'
import type { Unsubscribe } from '@/services/util'
import { caseBookings, caseKey, isSession, sessionTitle } from '@/progress'
import { fmtDate, fmtSlot, tzOffset } from '@/format'
import type { Booking } from '@/types'
import { useI18n } from 'vue-i18n'
import StatusBadge from '@/components/StatusBadge.vue'
import PaymentBadge from '@/components/PaymentBadge.vue'
import StudentTime from '@/components/StudentTime.vue'
import SessionTasks from '@/components/SessionTasks.vue'
import NotesThread from '@/components/NotesThread.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const { t } = useI18n()
const { viewerTz: tz } = useZones()
const id = route.params.id as string

const { value: booking, loaded } = useLive<Booking | null>(null, (set) => watchBooking(id, set))
const back = computed(() => (auth.isAdmin ? '/admin/sessions' : '/sessions'))

// The client's other bookings, to show this session's place in its case.
const theirs = ref<Booking[]>([])
let stopTheirs: Unsubscribe | undefined
watch(
  () => booking.value?.userId,
  (uid) => {
    stopTheirs?.()
    stopTheirs = uid ? watchMyBookings(uid, (v) => (theirs.value = v)) : undefined
  },
)
onScopeDispose(() => stopTheirs?.())
const inCase = computed(() => (booking.value ? caseBookings(theirs.value, booking.value) : []))
const canContinue = computed(() => !auth.isAdmin && !!booking.value && isSession(booking.value))
const whenOf = (b: Booking) => (b.confirmed ? fmtSlot(b.confirmed.start, b.confirmed.durationMin, tz.value) : t('session.proposed', b.options.length))

// Tutor-editable fields. Each is re-seeded only when its own stored value changes, so toggling
// payment (which rewrites the doc) doesn't wipe an unsaved summary.
const title = ref('')
const summary = ref('')
const paymentNote = ref('')
watch(() => booking.value?.title, (v) => (title.value = v ?? ''), { immediate: true })
watch(() => booking.value?.summary, (v) => (summary.value = v ?? ''), { immediate: true })
watch(() => booking.value?.paymentNote, (v) => (paymentNote.value = v ?? ''), { immediate: true })

const saved = ref('')
function flash(msg: string) {
  saved.value = msg
  setTimeout(() => (saved.value = ''), 2000)
}

async function saveTitle() {
  if (!booking.value || !title.value.trim()) return
  await updateTitle(booking.value.id, title.value)
  flash(t('session.savedQuestion'))
}
async function togglePaid() {
  const b = booking.value!
  await setPayment(b.id, b.payment === 'paid' ? 'pending' : 'paid', paymentNote.value)
  flash(t('session.savedPayment'))
}
async function save(complete: boolean) {
  await saveSummary(booking.value!.id, summary.value, complete)
  flash(complete ? t('session.savedCompleted') : t('session.savedFindings'))
}
async function cancel() {
  const note = prompt(t('session.cancelPrompt'), '')
  if (note === null) return
  await cancelConfirmed(booking.value!, note)
}
async function withdraw() {
  if (!confirm(t('session.confirmWithdraw'))) return
  await withdrawRequest(booking.value!.id)
  router.push('/sessions')
}
</script>

<template>
  <RouterLink :to="back" class="small">{{ $t('common.back') }}</RouterLink>

  <p v-if="!loaded" class="muted">{{ $t('common.loading') }}</p>
  <p v-else-if="!booking" class="muted">{{ $t('session.notFound') }}</p>

  <template v-else>
    <!-- Header: goal, when, status -->
    <section class="card stack" style="margin-top: 0.75rem">
      <div v-if="auth.isAdmin" class="row">
        <input v-model="title" class="title-input" maxlength="120" style="flex: 1" :aria-label="$t('session.question')" />
        <button v-if="title.trim() && title !== booking.title" class="small" @click="saveTitle">{{ $t('common.save') }}</button>
      </div>
      <h1 v-else style="margin: 0">{{ sessionTitle(booking) }}</h1>

      <div class="row">
        <StatusBadge :status="booking.status" />
        <PaymentBadge v-if="isSession(booking)" :payment="booking.payment" />
        <span class="muted small">
          {{ $t(`kind.${booking.kind}`) }}
          <template v-if="auth.isAdmin"> · {{ booking.userName }} ({{ booking.userEmail }})</template>
        </span>
      </div>

      <template v-if="booking.confirmed">
        <h3>
          {{ fmtSlot(booking.confirmed.start, booking.confirmed.durationMin, tz) }}
          <span class="other-tz">{{ tzOffset(tz, booking.confirmed.start) }}</span>
        </h3>
        <StudentTime v-if="auth.isAdmin" :start="booking.confirmed.start" :duration-min="booking.confirmed.durationMin" :tz="booking.userTimeZone" />
      </template>

      <template v-if="booking.status === 'pending'">
        <p class="small">{{ $t('session.requestedTimes') }}</p>
        <ol class="small" style="margin: 0">
          <li v-for="o in booking.options" :key="o.slotId">{{ fmtSlot(o.start, o.durationMin, tz) }}</li>
        </ol>
        <div class="row">
          <RouterLink v-if="auth.isAdmin" to="/admin/requests" class="btn small">{{ $t('session.confirmOnRequests') }}</RouterLink>
          <button v-else class="danger small" @click="withdraw">{{ $t('session.withdraw') }}</button>
        </div>
      </template>

      <p v-if="booking.adminNote" class="prewrap small"><strong>{{ $t('session.researcherSays') }}</strong> {{ booking.adminNote }}</p>
      <div v-if="!auth.isAdmin && booking.status === 'declined'">
        <RouterLink :to="`/book?again=${booking.id}`" class="btn small">{{ $t('session.bookAgain') }}</RouterLink>
      </div>
      <template v-if="booking.notes">
        <p class="small muted">{{ $t('session.requestDetails') }}</p>
        <p class="prewrap">{{ booking.notes }}</p>
      </template>
    </section>

    <!-- Case: the other sessions on this question, and booking the next one -->
    <template v-if="inCase.length > 1 || canContinue">
      <h2>{{ $t('case.title') }}</h2>
      <section class="card stack">
        <ol v-if="inCase.length > 1" class="case-list">
          <li v-for="b in inCase" :key="b.id" :class="{ here: b.id === booking.id }">
            <RouterLink v-if="b.id !== booking.id" :to="`/sessions/${b.id}`">{{ whenOf(b) }}</RouterLink>
            <span v-else>{{ whenOf(b) }} · {{ $t('case.thisSession') }}</span>
            <StatusBadge :status="b.status" />
          </li>
        </ol>
        <div v-if="canContinue" class="row" style="justify-content: space-between">
          <p class="small muted">{{ $t('case.continueHint') }}</p>
          <RouterLink :to="`/book?case=${caseKey(booking)}`" class="btn small">{{ $t('case.continue') }}</RouterLink>
        </div>
      </section>
    </template>

    <!-- Tasks (only once it's a real session) -->
    <template v-if="isSession(booking)">
      <h2>{{ $t('session.checklist') }}</h2>
      <section class="card"><SessionTasks :booking="booking" /></section>
    </template>

    <!-- Summary -->
    <template v-if="isSession(booking) && (auth.isAdmin || booking.summary)">
      <h2>{{ $t('session.findings') }}</h2>
      <section class="card stack">
        <template v-if="auth.isAdmin">
          <textarea v-model="summary" rows="4" :placeholder="$t('session.findingsPlaceholder')" />
          <div class="row">
            <button class="ghost small" @click="save(false)">{{ $t('session.saveFindings') }}</button>
            <button v-if="booking.status === 'confirmed'" class="small" @click="save(true)">{{ $t('session.saveAndComplete') }}</button>
          </div>
        </template>
        <p v-else class="prewrap">{{ booking.summary }}</p>
      </section>
    </template>

    <!-- Notes thread -->
    <h2>{{ $t('session.notes') }}</h2>
    <section class="card"><NotesThread :booking-id="booking.id" /></section>

    <!-- Tutor-only admin -->
    <template v-if="auth.isAdmin && isSession(booking)">
      <h2>{{ $t('session.paymentAndStatus') }}</h2>
      <section class="card stack">
        <div class="row">
          <input v-model="paymentNote" :placeholder="$t('payment.notePlaceholder')" style="flex: 1; min-width: 180px" />
          <button class="small" :class="{ ghost: booking.payment === 'paid' }" @click="togglePaid">
            {{ booking.payment === 'paid' ? $t('payment.markUnpaid') : $t('payment.markPaid') }}
          </button>
        </div>
        <p v-if="booking.paidAt" class="muted small">{{ $t('payment.paidOn', { date: fmtDate(booking.paidAt, tz) }) }}</p>
        <div class="row">
          <button v-if="booking.status === 'completed'" class="ghost small" @click="reopenSession(booking.id)">{{ $t('session.reopen') }}</button>
          <button v-if="booking.status === 'confirmed'" class="danger small" @click="cancel">{{ $t('session.cancel') }}</button>
        </div>
      </section>
    </template>
    <p v-else-if="!auth.isAdmin && isSession(booking) && booking.paymentNote" class="muted small">
      {{ $t('payment.note', { note: booking.paymentNote }) }}
    </p>

  </template>
  <div v-if="saved" class="toast" role="status">{{ saved }}</div>
</template>
