<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElSkeleton } from 'element-plus'

import { getApplication, getUser, type ApplicationResponse, type UserResponse } from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { messages } from '@/locales'
import UserPermissionEditor from './UserPermissionEditor.vue'

const props = defineProps<{ userId: string; appCode: string }>()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const copy = messages.menuPermissions
const user = ref<UserResponse>()
const application = ref<ApplicationResponse>()
const loading = ref(true)
const failed = ref(false)
const retry = ref(0)

async function handleAuthError(error: ApiError) {
  if (error.status === 401) {
    session.expire()
    await router.replace({ name: 'login', query: { redirect: route.fullPath } })
  } else if (error.status === 403) {
    await router.replace({ name: 'forbidden' })
  }
}

watch(
  () => [props.userId, props.appCode, retry.value],
  async (_value, _previous, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    loading.value = true
    failed.value = false
    user.value = undefined
    application.value = undefined
    try {
      const [currentUser, currentApplication] = await Promise.all([
        getUser(props.userId),
        getApplication(props.appCode),
      ])
      if (cancelled) return
      user.value = currentUser
      application.value = currentApplication
    } catch (error) {
      if (cancelled) return
      failed.value = true
      if (error instanceof ApiError) await handleAuthError(error)
    } finally {
      if (!cancelled) loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <section class="permissions-page" aria-labelledby="user-permissions-title">
    <header class="permissions-heading">
      <h1 id="user-permissions-title" class="page-title">{{ copy.title }}</h1>
      <RouterLink
        class="action-link"
        :to="{ name: 'user-authorization', query: { userId, appCode } }"
      >
        ← {{ copy.back }}
      </RouterLink>
    </header>
    <ElSkeleton v-if="loading" animated :rows="5" />
    <StatePanel
      v-else-if="failed"
      :title="copy.loadFailed"
      :description="messages.errors.generic"
      tone="danger"
    >
      <template #actions>
        <ElButton @click="retry++">{{ messages.common.retry }}</ElButton>
      </template>
    </StatePanel>
    <template v-else-if="user && application">
      <dl class="permission-context">
        <div>
          <dt>{{ copy.user }}</dt>
          <dd>
            {{ user.name }}<small>{{ user.account }}</small>
          </dd>
        </div>
        <div>
          <dt>{{ copy.application }}</dt>
          <dd>
            {{ application.name }}<small>{{ application.appCode }}</small>
          </dd>
        </div>
      </dl>
      <div class="authorization-workspace">
        <UserPermissionEditor :user-id="userId" :app-code="appCode" @auth-error="handleAuthError" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.permissions-page {
  display: grid;
  gap: var(--space-5);
}

.permissions-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.permission-context {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.permission-context dt,
.permission-context small {
  color: var(--color-text-muted);
}

.permission-context dd {
  margin: var(--space-2) 0 0;
  font-weight: 700;
}

.permission-context small {
  display: block;
  font-weight: 400;
}

.authorization-workspace {
  min-width: 0;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}
</style>
