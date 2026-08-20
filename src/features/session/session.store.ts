import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  getSession,
  login as loginRequest,
  logout as logoutRequest,
  type LoginRequest,
  type SessionResponse,
} from '@/api/account'

export const useSessionStore = defineStore('session', () => {
  const session = ref<SessionResponse | null>(null)
  const initialized = ref(false)
  const loading = ref(false)
  const connectionError = ref(false)

  const authenticated = computed(() => session.value?.authenticated === true)
  const currentUser = computed(() => session.value?.user ?? null)

  async function initialize(force = false) {
    if (initialized.value && !force) return
    loading.value = true
    connectionError.value = false
    try {
      session.value = await getSession()
      initialized.value = true
    } catch (error) {
      session.value = null
      initialized.value = false
      connectionError.value = true
      throw error
    } finally {
      loading.value = false
    }
  }

  async function login(credentials: LoginRequest) {
    if (!session.value?.csrfToken) {
      await initialize(true)
    }
    const csrfToken = session.value?.csrfToken
    if (!csrfToken) throw new Error('CSRF token is unavailable')
    session.value = await loginRequest(credentials, csrfToken)
    initialized.value = true
    connectionError.value = false
  }

  async function logout() {
    const csrfToken = session.value?.csrfToken
    if (csrfToken) {
      await logoutRequest(csrfToken)
    }
    session.value = null
    initialized.value = false
  }

  function hasCapability(capability: string) {
    return session.value?.capabilities.includes(capability as 'users:read') === true
  }

  function expire() {
    session.value = null
    initialized.value = true
  }

  return {
    session,
    initialized,
    loading,
    connectionError,
    authenticated,
    currentUser,
    initialize,
    login,
    logout,
    hasCapability,
    expire,
  }
})
