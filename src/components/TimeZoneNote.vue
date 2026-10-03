<script setup lang="ts">
import { useAuth } from '@/auth'
import { useZones } from '@/zones'
import { tzLabel } from '@/format'

// One quiet line on pages that list times; the zone itself is chosen on the Settings page.
const auth = useAuth()
const { viewerTz, deviceTz, tutorTzSet } = useZones()
</script>

<template>
  <p v-if="auth.isAdmin && !tutorTzSet" class="tz-note warn small">
    {{ $t('tz.notConfirmed') }} <RouterLink to="/settings">{{ $t('tz.confirmIt') }}</RouterLink>
  </p>
  <p v-else class="tz-note small">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
    {{ $t('tz.shownIn') }} <strong>{{ tzLabel(viewerTz) }}</strong>
    <template v-if="!auth.isAdmin && viewerTz !== deviceTz"> · {{ $t('tz.thisDevice', { zone: tzLabel(deviceTz) }) }}</template>
    · <RouterLink to="/settings">{{ $t('common.change') }}</RouterLink>
  </p>
</template>
