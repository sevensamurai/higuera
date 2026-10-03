<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { signIn, useAuth } from '@/auth'

const auth = useAuth()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const error = ref('')
const busy = ref(false)

// Wait for the admin check before leaving, so each role lands on its own dashboard.
watchEffect(() => {
  if (auth.ready && auth.user) {
    router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
  }
})

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
  <div class="card stack" style="max-width: 420px; margin: 2rem auto; text-align: center">
    <h1>{{ $t('login.title') }}</h1>
    <p class="muted">{{ $t('login.intro') }}</p>
    <button :disabled="busy" @click="go">{{ busy ? $t('login.opening') : $t('login.continue') }}</button>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>
