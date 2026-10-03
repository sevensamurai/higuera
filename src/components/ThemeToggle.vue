<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { cycleTheme, themePref } from '@/theme'

const { t } = useI18n()
const label = computed(() => t(`theme.${themePref.value}`))
</script>

<template>
  <button class="icon-btn" :title="$t('theme.hint', { name: label })" :aria-label="$t('theme.label', { name: label })" @click="cycleTheme">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <template v-if="themePref === 'light'">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </template>
      <path v-else-if="themePref === 'dark'" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      <template v-else>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5Z" fill="currentColor" />
      </template>
    </svg>
    <span>{{ label }}</span>
  </button>
</template>
