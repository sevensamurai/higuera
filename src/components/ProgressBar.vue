<script setup lang="ts">
import type { Progress } from '@/progress'

withDefaults(defineProps<{ progress: Progress; compact?: boolean }>(), { compact: false })
</script>

<template>
  <div class="progress" :class="{ compact }">
    <div
      class="progress-track"
      role="progressbar"
      :aria-valuenow="progress.pct ?? 0"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="progress-fill" :style="{ width: `${progress.pct ?? 0}%` }" />
    </div>
    <span class="progress-label">
      <template v-if="progress.pct === null">{{ $t('progress.empty') }}</template>
      <template v-else><strong>{{ progress.pct }}%</strong> · {{ $t('progress.done', { done: progress.done, total: progress.total }) }}</template>
    </span>
  </div>
</template>
