import { createRouter, createWebHistory } from 'vue-router'

import ConsoleShell from '@/app/ConsoleShell.vue'
import { useSessionStore } from '@/features/session/session.store'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/session/LoginView.vue'),
    },
    {
      path: '/',
      component: ConsoleShell,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'users' } },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/features/users/UserListView.vue'),
          meta: { requiresAuth: true, capability: 'users:read' },
        },
        {
          path: 'users/new',
          name: 'user-create',
          component: () => import('@/features/users/UserFormView.vue'),
          meta: { requiresAuth: true, capability: 'users:write' },
        },
        {
          path: 'users/:userId/edit',
          name: 'user-edit',
          component: () => import('@/features/users/UserFormView.vue'),
          meta: { requiresAuth: true, capability: 'users:write' },
        },
        {
          path: 'users/:userId',
          name: 'user-detail',
          component: () => import('@/features/users/UserDetailView.vue'),
          meta: { requiresAuth: true, capability: 'users:read' },
        },
        {
          path: 'applications',
          name: 'applications',
          component: () => import('@/features/applications/ApplicationListView.vue'),
          meta: { requiresAuth: true, capability: 'applications:read' },
        },
        {
          path: 'applications/new',
          name: 'application-create',
          component: () => import('@/features/applications/ApplicationFormView.vue'),
          meta: { requiresAuth: true, capability: 'applications:write' },
        },
        {
          path: 'applications/:appCode/edit',
          name: 'application-edit',
          component: () => import('@/features/applications/ApplicationFormView.vue'),
          meta: { requiresAuth: true, capability: 'applications:write' },
        },
        {
          path: 'applications/:appCode',
          name: 'application-detail',
          component: () => import('@/features/applications/ApplicationDetailView.vue'),
          meta: { requiresAuth: true, capability: 'applications:read' },
        },
        {
          path: 'forbidden',
          name: 'forbidden',
          component: () => import('@/components/ForbiddenView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'audit-events',
          name: 'audit-events',
          component: () => import('@/features/audit/AuditEventsView.vue'),
          meta: { requiresAuth: true, capability: 'audit:read' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/components/NotFoundView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const sessionStore = useSessionStore()
  if (!sessionStore.initialized) {
    try {
      await sessionStore.initialize()
    } catch {
      if (to.name !== 'login') {
        return { name: 'login', query: { redirect: to.fullPath } }
      }
    }
  }

  if (to.name === 'login' && sessionStore.authenticated) {
    return { name: 'users' }
  }
  if (to.meta.requiresAuth && !sessionStore.authenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  const capability = typeof to.meta.capability === 'string' ? to.meta.capability : null
  if (capability && !sessionStore.hasCapability(capability)) {
    return { name: 'forbidden' }
  }
  return true
})

export default router
