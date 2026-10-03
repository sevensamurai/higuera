<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLive } from '@/live'
import { confirmBooking, declineBooking, watchAllBookings } from '@/services/bookings'
import { watchUpcomingSlots } from '@/services/slots'
import { fmtDate, fmtSlot } from '@/format'
import { sessionTitle } from '@/progress'
import { useI18n } from 'vue-i18n'
import { useZones } from '@/zones'
import type { Booking, Slot, SlotOption } from '@/types'
import TimeZoneNote from '@/components/TimeZoneNote.vue'
import StudentTime from '@/components/StudentTime.vue'

const { viewerTz: tz } = useZones()
const { t } = useI18n()
const { value: bookings, loaded } = useLive<Booking[]>([], watchAllBookings)
const slots = useLive<Slot[]>([], watchUpcomingSlots).value

const pending = computed(() =>
  bookings.value.filter((b) => b.status === 'pending').sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
)
const slotById = computed(() => new Map(slots.value.map((s) => [s.id, s])))

/** Whether an option can still be confirmed, given the live slot list. */
function optionState(o: SlotOption): { ok: boolean; label: string } {
  if (o.start.getTime() <= Date.now()) return { ok: false, label: t('requests.optPast') }
  const s = slotById.value.get(o.slotId)
  if (!s) return { ok: false, label: t('requests.optRemoved') }
  if (s.status !== 'open') return { ok: false, label: t('requests.optTaken') }
  return { ok: true, label: t('requests.optOpen') }
}

const busy = ref<string | null>(null)
const errors = ref<Record<string, string>>({})

async function confirm(b: Booking, o: SlotOption) {
  busy.value = b.id
  errors.value[b.id] = ''
  try {
    await confirmBooking(b.id, o)
  } catch (e) {
    errors.value[b.id] = (e as Error).message
  } finally {
    busy.value = null
  }
}

async function decline(b: Booking) {
  const note = prompt(t('requests.declinePrompt'), t('requests.declineDefault'))
  if (note === null) return
  await declineBooking(b.id, note)
}
</script>

<template>
  <h1>{{ $t('requests.title') }}</h1>
  <TimeZoneNote />
  <p v-if="!loaded" class="muted">{{ $t('common.loading') }}</p>
  <p v-else-if="pending.length === 0" class="muted">{{ $t('requests.none') }}</p>

  <div v-for="b in pending" :key="b.id" class="card">
    <div class="card-head">
      <div>
        <h3><RouterLink :to="`/sessions/${b.id}`">{{ sessionTitle(b) }}</RouterLink></h3>
        <p class="small">{{ b.userName }}</p>
        <p class="muted small">{{ b.userEmail }} · {{ $t(`kind.${b.kind}`) }} · {{ $t('requests.requestedOn', { date: fmtDate(b.createdAt, tz) }) }}</p>
      </div>
      <button class="danger small" @click="decline(b)">{{ $t('requests.decline') }}</button>
    </div>
    <p v-if="b.notes" class="prewrap">{{ b.notes }}</p>
    <ul class="option-list">
      <li v-for="(o, i) in b.options" :key="o.slotId">
        <span>
          {{ i + 1 }}. {{ fmtSlot(o.start, o.durationMin, tz) }}
          <span class="badge" :class="optionState(o).ok ? 'ok' : 'plain'">{{ optionState(o).label }}</span>
          <br /><StudentTime :start="o.start" :duration-min="o.durationMin" :tz="b.userTimeZone" />
        </span>
        <button class="small" :disabled="!optionState(o).ok || busy === b.id" @click="confirm(b, o)">{{ $t('requests.confirmThis') }}</button>
      </li>
    </ul>
    <p v-if="errors[b.id]" class="error small">{{ errors[b.id] }}</p>
  </div>
</template>
