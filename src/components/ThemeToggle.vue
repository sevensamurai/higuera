<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { theme, toggleTheme } from '@/theme'

const { t } = useI18n()
const label = computed(() => t(`theme.${theme.value}`))
</script>

<template>
  <button class="icon-btn" :title="$t('theme.hint', { name: label })" :aria-label="$t('theme.label', { name: label })" @click="toggleTheme">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <template v-if="theme === 'light'">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </template>
      <path v-else d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </svg>
    <span>{{ label }}</span>
  </button>
</template>
