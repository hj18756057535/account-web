<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElSkeleton, ElTag } from 'element-plus'

import { getUser, type UserResponse } from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { zhCN } from '@/locales/zh-CN'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const copy = zhCN.users
const loading = ref(true)
const notFound = ref(false)
const failed = ref(false)
const user = ref<UserResponse | null>(null)

async function loadUser() {
  loading.value = true
  failed.value = false
  notFound.value = false
  try {
    user.value = await getUser(String(route.params.userId))
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      sessionStore.expire()
      await router.replace({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    if (error instanceof ApiError && error.status === 403) {
      await router.replace({ name: 'forbidden' })
      return
    }
    notFound.value = error instanceof ApiError && error.status === 404
    failed.value = !notFound.value
  } finally {
    loading.value = false
  }
}

function formatDate(value?: string | null) {
  if (!value) return zhCN.common.unknown
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

onMounted(loadUser)
</script>

<template>
  <section class="detail-page" aria-labelledby="detail-title">
    <RouterLink class="back-link" :to="{ name: 'users' }">← {{ zhCN.common.back }}</RouterLink>

    <ElSkeleton v-if="loading" animated :rows="8" />

    <StatePanel
      v-else-if="notFound"
      :title="copy.notFoundTitle"
      :description="copy.notFoundDescription"
      tone="warning"
    />

    <StatePanel
      v-else-if="failed"
      :title="copy.errorTitle"
      :description="zhCN.errors.generic"
      tone="danger"
    >
      <template #actions
        ><ElButton @click="loadUser">{{ zhCN.common.retry }}</ElButton></template
      >
    </StatePanel>

    <template v-else-if="user">
      <header class="detail-heading">
        <div class="detail-avatar" aria-hidden="true">{{ user.name.slice(0, 1) }}</div>
        <div>
          <p class="detail-eyebrow">{{ copy.eyebrow }}</p>
          <h1 id="detail-title" class="page-title">{{ user.name }}</h1>
          <p class="page-description">{{ copy.detailDescription }}</p>
        </div>
        <ElTag
          class="detail-status"
          :type="user.status === 'enabled' ? 'success' : 'info'"
          size="large"
        >
          {{ user.status === 'enabled' ? zhCN.common.enabled : zhCN.common.disabled }}
        </ElTag>
      </header>

      <div class="detail-grid">
        <article>
          <span>{{ copy.account }}</span>
          <strong>{{ user.account }}</strong>
        </article>
        <article>
          <span>{{ copy.email }}</span>
          <strong>{{ user.email }}</strong>
        </article>
        <article>
          <span>{{ copy.phone }}</span>
          <strong>{{ user.phone }}</strong>
        </article>
        <article>
          <span>{{ copy.status }}</span>
          <strong>{{
            user.status === 'enabled' ? zhCN.common.enabled : zhCN.common.disabled
          }}</strong>
        </article>
        <article>
          <span>{{ copy.createdAt }}</span>
          <strong>{{ formatDate(user.createdAt) }}</strong>
        </article>
        <article>
          <span>{{ copy.updatedAt }}</span>
          <strong>{{ formatDate(user.updatedAt) }}</strong>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.detail-page {
  display: grid;
  gap: var(--space-6);
}

.back-link {
  width: fit-content;
  color: var(--color-brand);
  font-weight: 700;
}

.detail-heading {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: linear-gradient(145deg, #fff, var(--color-brand-soft));
  box-shadow: var(--shadow-card);
}

.detail-avatar {
  display: grid;
  width: 4rem;
  height: 4rem;
  place-items: center;
  border-radius: 1.2rem;
  color: #fff;
  background: linear-gradient(145deg, var(--color-brand), var(--color-accent));
  font-size: 1.5rem;
  font-weight: 900;
}

.detail-eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--color-brand);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.detail-grid article {
  min-width: 0;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.detail-grid span,
.detail-grid strong {
  display: block;
}

.detail-grid span {
  margin-bottom: var(--space-2);
  color: var(--color-text-muted);
  font-size: 0.76rem;
  font-weight: 700;
}

.detail-grid strong {
  overflow-wrap: anywhere;
}

@media (width <= 42rem) {
  .detail-heading {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .detail-status {
    grid-column: 1 / -1;
    width: fit-content;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
