<script setup lang="ts">
import { computed } from 'vue'
import { saveMyLocale } from '@/auth'
import { locale } from '@/i18n'

// Shows the language you'd switch *to*, in that language's own short form.
const other = computed(() => (locale.value === 'es' ? 'en' : 'es'))
</script>

<template>
  <button class="icon-btn" :lang="other" :title="$t('lang.switchTo')" :aria-label="$t('lang.switchTo')" @click="saveMyLocale(other)">
    {{ other.toUpperCase() }}
  </button>
</template>
