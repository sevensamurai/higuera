<script setup lang="ts">
import type { PaymentStatus } from '@/types'

defineProps<{ payment: PaymentStatus }>()
</script>

<template>
  <span class="badge" :class="payment === 'paid' ? 'ok' : 'warn'">
    {{ payment === 'paid' ? $t('payment.paid') : $t('payment.pending') }}
  </span>
</template>
