<script setup lang="ts">
import { watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/auth'
import HeroBackdrop from '@/components/HeroBackdrop.vue'
import SignInButton from '@/components/SignInButton.vue'

const auth = useAuth()
const route = useRoute()
const router = useRouter()

// Wait for the admin check before leaving, so each role lands on its own dashboard.
watchEffect(() => {
  if (auth.ready && auth.user) {
    router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
  }
})
</script>

<template>
  <HeroBackdrop>
    <div class="card stack" style="text-align: center">
      <h1 style="margin: 0">{{ $t('login.title') }}</h1>
      <p class="muted">{{ $t('login.intro') }}</p>
      <SignInButton />
    </div>
  </HeroBackdrop>
</template>
