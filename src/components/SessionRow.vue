<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/auth'
import { useZones } from '@/zones'
import { isSession, sessionTitle, taskProgress } from '@/progress'
import { fmtSlot } from '@/format'
import type { Booking, Task } from '@/types'
import StatusBadge from './StatusBadge.vue'
import PaymentBadge from './PaymentBadge.vue'
import ProgressBar from './ProgressBar.vue'

// A session as a clickable card; pass `tasks` (any superset) to show that session's progress.
const props = defineProps<{ booking: Booking; tasks?: Task[]; showStudent?: boolean }>()
const auth = useAuth()
const { t } = useI18n()
const { viewerTz: tz } = useZones()
const progress = computed(() => taskProgress((props.tasks ?? []).filter((t) => t.bookingId === props.booking.id)))
const when = computed(() => {
  const b = props.booking
  if (b.confirmed) return fmtSlot(b.confirmed.start, b.confirmed.durationMin, tz.value)
  return t('session.proposed', b.options.length)
})
</script>

<template>
  <RouterLink :to="`/sessions/${booking.id}`" class="card stack" style="gap: 0.4rem">
    <div class="card-head">
      <h3>{{ sessionTitle(booking) }}</h3>
      <div class="row">
        <StatusBadge :status="booking.status" />
        <PaymentBadge v-if="isSession(booking)" :payment="booking.payment" />
      </div>
    </div>
    <p class="muted small">
      {{ when }}<template v-if="showStudent && auth.isAdmin"> · {{ booking.userName }}</template>
    </p>
    <ProgressBar v-if="tasks && isSession(booking)" :progress="progress" compact />
  </RouterLink>
</template>
