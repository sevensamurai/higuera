<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { signIn } from '@/auth'

// Google sign-in. Where the user goes next is up to the page (the router re-renders on sign-in).
const { t } = useI18n()
const error = ref('')
const busy = ref(false)

async function go() {
  error.value = ''
  busy.value = true
  try {
    await signIn()
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      error.value = t('login.failed')
      console.error(e)
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button :disabled="busy" @click="go">{{ busy ? $t('login.opening') : $t('login.continue') }}</button>
  <p v-if="error" class="error">{{ error }}</p>
</template>
