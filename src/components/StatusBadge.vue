<script setup lang="ts">
import type { BookingStatus } from '@/types'

defineProps<{ status: BookingStatus }>()
const tone: Record<BookingStatus, string> = {
  pending: 'warn',
  confirmed: '',
  completed: 'ok',
  declined: 'bad',
  cancelled: 'plain',
}
</script>

<template>
  <span class="badge" :class="tone[status]">{{ $t(`status.${status}`) }}</span>
</template>
