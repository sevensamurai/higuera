<script setup lang="ts">
import { ref } from 'vue'
import { setMyTimeZone, useAuth } from '@/auth'
import { useZones } from '@/zones'
import { tzLabel } from '@/format'
import TimeZoneSelect from './TimeZoneSelect.vue'

const auth = useAuth()
const { viewerTz, deviceTz } = useZones()

const open = ref(false)
const pick = ref(viewerTz.value)
const busy = ref(false)

async function apply(tz: string | null) {
  busy.value = true
  try {
    await setMyTimeZone(tz === deviceTz ? null : tz)
    open.value = false
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="tz-note small">
    <template v-if="auth.isAdmin">
      {{ $t('tz.adminNote') }} <strong>{{ tzLabel(viewerTz) }}</strong> ·
      <RouterLink to="/admin/availability">{{ $t('common.change') }}</RouterLink>
    </template>
    <template v-else>
      <div>
        {{ $t('tz.shownIn') }} <strong>{{ tzLabel(viewerTz) }}</strong> ·
        <button class="link" @click="(pick = viewerTz), (open = !open)">{{ open ? $t('common.close') : $t('common.change') }}</button>
      </div>
      <div v-if="auth.chosenTimeZone && auth.chosenTimeZone !== deviceTz && !open" class="muted">
        {{ $t('tz.deviceOn', { zone: tzLabel(deviceTz) }) }}
        <button class="link" :disabled="busy" @click="apply(null)">{{ $t('tz.useDevice') }}</button>
      </div>
      <div v-if="open" class="row" style="margin-top: 0.5rem">
        <TimeZoneSelect v-model="pick" style="flex: 1; min-width: 220px" />
        <button class="small" :disabled="busy" @click="apply(pick)">{{ $t('common.save') }}</button>
        <button v-if="auth.chosenTimeZone" class="ghost small" :disabled="busy" @click="apply(null)">{{ $t('tz.followDevice') }}</button>
      </div>
    </template>
  </div>
</template>
