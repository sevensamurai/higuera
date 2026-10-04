<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { signIn } from '@/auth'

// Google sign-in. Where the user goes next is up to the page (it re-renders once signed in).
const { t } = useI18n()
const error = ref('')
const busy = ref(false)

async function go() {
  error.value = ''
  busy.value = true
  try {
    // On success stay busy: the page switches once the account's role is known.
    await signIn()
  } catch (e) {
    busy.value = false
    const code = (e as { code?: string }).code
    if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      error.value = t('login.failed')
      console.error(e)
    }
  }
}
</script>

<template>
  <button :disabled="busy" @click="go">{{ busy ? $t('login.opening') : $t('login.continue') }}</button>
  <p v-if="error" class="error">{{ error }}</p>
</template>
