<script setup lang="ts">
import { useRouter } from 'vue-router'
import { signOut, useAuth } from './auth'
import ReloadPrompt from './components/ReloadPrompt.vue'
import { APP_NAME } from './copy'
import ThemeToggle from './components/ThemeToggle.vue'
import LanguageToggle from './components/LanguageToggle.vue'

const auth = useAuth()
const router = useRouter()

async function logout() {
  await signOut()
  router.push('/')
}
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="brand">
      <img src="/favicon.svg" alt="" width="30" height="30" />
      <span>{{ APP_NAME }}</span>
    </RouterLink>
    <div class="who">
      <LanguageToggle />
      <ThemeToggle />
      <template v-if="auth.user">
        <img v-if="auth.user.photoURL" :src="auth.user.photoURL" alt="" class="avatar" referrerpolicy="no-referrer" />
        <button class="link" @click="logout">{{ $t('nav.signOut') }}</button>
      </template>
      <RouterLink v-else-if="auth.ready" to="/login" class="btn small">{{ $t('nav.signIn') }}</RouterLink>
    </div>
  </header>

  <nav class="lanes" v-if="auth.user">
    <RouterLink to="/">{{ $t('nav.home') }}</RouterLink>
    <template v-if="auth.isAdmin">
      <RouterLink to="/admin/requests">{{ $t('nav.requests') }}</RouterLink>
      <RouterLink to="/admin/sessions">{{ $t('nav.sessions') }}</RouterLink>
      <RouterLink to="/admin/availability">{{ $t('nav.availability') }}</RouterLink>
      <RouterLink to="/admin/tasks">{{ $t('nav.checklists') }}</RouterLink>
    </template>
    <template v-else>
      <RouterLink to="/book">{{ $t('nav.book') }}</RouterLink>
      <RouterLink to="/sessions">{{ $t('nav.sessions') }}</RouterLink>
      <RouterLink to="/tasks">{{ $t('nav.checklist') }}</RouterLink>
    </template>
  </nav>

  <main class="page">
    <!-- Keyed on user and path so listeners are rebuilt on sign-in/out and between two detail pages. -->
    <RouterView v-if="auth.ready" v-slot="{ Component, route }">
      <component :is="Component" :key="`${auth.user?.uid ?? 'anon'}:${route.path}`" />
    </RouterView>
    <p v-else class="muted">{{ $t('common.loading') }}</p>
  </main>

  <ReloadPrompt />
</template>
