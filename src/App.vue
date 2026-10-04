<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signOut, useAuth } from './auth'
import ReloadPrompt from './components/ReloadPrompt.vue'
import { APP_NAME } from './copy'
import ThemeToggle from './components/ThemeToggle.vue'
import LanguageToggle from './components/LanguageToggle.vue'
import BrandMark from './components/BrandMark.vue'

const auth = useAuth()
const year = new Date().getFullYear()
const router = useRouter()
const route = useRoute()
// Signed-out home and sign-in fill the space between header and footer with a photo.
const fullBleed = computed(() => auth.ready && !auth.user && (route.name === 'home' || route.name === 'login'))

async function logout() {
  await signOut()
  router.push('/')
}
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="brand">
      <BrandMark />
      <span>{{ APP_NAME }}</span>
    </RouterLink>
    <div class="who">
      <LanguageToggle />
      <ThemeToggle />
      <template v-if="auth.user">
        <span v-if="auth.isAdmin" class="badge ok" :title="$t('nav.adminHint')">{{ $t('nav.admin') }}</span>
        <RouterLink to="/settings" class="icon-btn" :title="$t('nav.settings')" :aria-label="$t('nav.settings')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
          </svg>
        </RouterLink>
        <img v-if="auth.user.photoURL" :src="auth.user.photoURL" alt="" class="avatar" referrerpolicy="no-referrer" />
        <button class="link" @click="logout">{{ $t('nav.signOut') }}</button>
      </template>
      <!-- The photo pages carry their own sign-in button. -->
      <RouterLink v-else-if="auth.ready && !fullBleed" to="/login" class="btn small">{{ $t('nav.signIn') }}</RouterLink>
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

  <main class="page" :class="{ 'page-full': fullBleed }">
    <!-- Keyed on user and path so listeners are rebuilt on sign-in/out and between two detail pages. -->
    <RouterView v-if="auth.ready" v-slot="{ Component, route }">
      <component :is="Component" :key="`${auth.user?.uid ?? 'anon'}:${route.path}`" />
    </RouterView>
    <p v-else class="muted">{{ $t('common.loading') }}</p>
  </main>

  <footer class="site-footer">
    <div class="site-footer-inner">
      <div>
        <RouterLink to="/" class="brand">{{ APP_NAME }}</RouterLink>
        <p>{{ $t('footer.tagline') }}</p>
      </div>
      <p>© {{ year }}</p>
    </div>
  </footer>

  <ReloadPrompt />
</template>
