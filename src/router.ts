import { createRouter, createWebHistory } from 'vue-router'
import { authReady, useAuth } from './auth'

declare module 'vue-router' {
  interface RouteMeta {
    auth?: 'user' | 'admin'
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },

    { path: '/book', name: 'book', component: () => import('./views/user/BookView.vue'), meta: { auth: 'user' } },
    { path: '/sessions', name: 'sessions', component: () => import('./views/user/SessionsView.vue'), meta: { auth: 'user' } },
    // One page per session for both lanes; firestore.rules limit students to their own.
    { path: '/sessions/:id', name: 'session', component: () => import('./views/SessionDetailView.vue'), meta: { auth: 'user' } },
    { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue'), meta: { auth: 'user' } },
    { path: '/tasks', name: 'tasks', component: () => import('./views/user/TasksView.vue'), meta: { auth: 'user' } },

    { path: '/admin', redirect: '/' },
    { path: '/admin/students/:uid', name: 'admin-student', component: () => import('./views/admin/StudentView.vue'), meta: { auth: 'admin' } },
    { path: '/admin/requests', name: 'admin-requests', component: () => import('./views/admin/RequestsView.vue'), meta: { auth: 'admin' } },
    { path: '/admin/sessions', name: 'admin-sessions', component: () => import('./views/admin/SessionsView.vue'), meta: { auth: 'admin' } },
    { path: '/admin/availability', name: 'admin-availability', component: () => import('./views/admin/AvailabilityView.vue'), meta: { auth: 'admin' } },
    { path: '/admin/tasks', name: 'admin-tasks', component: () => import('./views/admin/TasksView.vue'), meta: { auth: 'admin' } },

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// Route guards are UX only; firestore.rules is what actually enforces access.
router.beforeEach(async (to) => {
  if (!to.meta.auth) return true
  await authReady()
  const { user, isAdmin } = useAuth()
  if (!user) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.auth === 'admin' && !isAdmin) return { name: 'home' }
  return true
})

export default router
