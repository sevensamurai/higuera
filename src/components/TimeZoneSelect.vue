<script setup lang="ts">
import { allTimeZones } from '@/timezone'
import { tzLabel } from '@/format'

const model = defineModel<string>({ required: true })

// ~420 zones, computed once per page load.
const options = (cached ??= allTimeZones().map((tz) => ({ tz, label: `${tzLabel(tz)} — ${tz}` })))
</script>

<script lang="ts">
let cached: { tz: string; label: string }[] | undefined
</script>

<template>
  <select v-model="model">
    <option v-for="o in options" :key="o.tz" :value="o.tz">{{ o.label }}</option>
  </select>
</template>
