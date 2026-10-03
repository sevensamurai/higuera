<script setup lang="ts">
import { computed } from 'vue'
import { fmtSlot, tzLabel } from '@/format'
import { useZones } from '@/zones'

const props = defineProps<{ start: Date; durationMin: number; tz?: string }>()
const { viewerTz } = useZones()

// Only worth showing when the student's clock reads differently from the tutor's.
const theirs = computed(() =>
  props.tz ? fmtSlot(props.start, props.durationMin, props.tz) : '',
)
const show = computed(() => !!props.tz && theirs.value !== fmtSlot(props.start, props.durationMin, viewerTz.value))
</script>

<template>
  <span v-if="show" class="other-tz">{{ $t('tz.theirTime', { time: theirs, zone: tzLabel(tz!, start) }) }}</span>
</template>
