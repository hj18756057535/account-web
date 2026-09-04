<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElAlert, ElButton, ElInput, ElMessageBox, ElSkeleton, ElTag } from 'element-plus'

import { changeUserStatus, getUser, type UserResponse } from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import UserApplicationAccess from '@/features/applications/UserApplicationAccess.vue'
import { useSessionStore } from '@/features/session/session.store'
import { formatDate, localizeFeedback, messages } from '@/locales'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const copy = messages.users
const loading = ref(true)
const notFound = ref(false)
const failed = ref(false)
const user = ref<UserResponse | null>(null)
const statusReason = ref('')
const statusError = ref('')
const changingStatus = ref(false)
const statusKey = ref('')
const statusChanged = ref(false)

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

function resetStatusAttempt() {
  statusError.value = ''
  statusKey.value = ''
  statusChanged.value = false
}

async function changeStatus() {
  if (!user.value || changingStatus.value) return
  if (!statusReason.value.trim()) {
    statusError.value = copy.statusReasonRequired
    return
  }
  const targetStatus = user.value.status === 'enabled' ? 'disabled' : 'enabled'
  try {
    await ElMessageBox.confirm(
      targetStatus === 'disabled' ? copy.disableConfirm : copy.enableConfirm,
      messages.common.confirm,
      { confirmButtonText: messages.common.confirm, cancelButtonText: messages.common.cancel },
    )
  } catch {
    return
  }

  changingStatus.value = true
  statusError.value = ''
  statusKey.value ||= crypto.randomUUID()
  try {
    user.value = await changeUserStatus(
      user.value.id,
      { status: targetStatus, version: user.value.version, reason: statusReason.value.trim() },
      sessionStore.csrfToken,
      statusKey.value,
    )
    statusReason.value = ''
    statusKey.value = ''
    statusChanged.value = true
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
    if (
      error instanceof ApiError &&
      ['CURRENT_ADMIN_PROTECTED', 'LAST_ADMIN_PROTECTED'].includes(error.code)
    ) {
      statusError.value = copy.adminProtected
    } else if (error instanceof ApiError && error.code === 'RESOURCE_VERSION_CONFLICT') {
      statusError.value = copy.versionConflict
    } else {
      statusError.value = copy.statusFailed
    }
  } finally {
    changingStatus.value = false
  }
}

onMounted(loadUser)
</script>

<template>
  <section class="detail-page" aria-labelledby="detail-title">
    <RouterLink class="back-link" :to="{ name: 'users' }">← {{ messages.common.back }}</RouterLink>

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
      :description="messages.errors.generic"
      tone="danger"
    >
      <template #actions
        ><ElButton @click="loadUser">{{ messages.common.retry }}</ElButton></template
      >
    </StatePanel>

    <template v-else-if="user">
      <ElAlert
        v-if="route.query.saved === '1'"
        :title="copy.saved"
        type="success"
        show-icon
        :closable="false"
      />
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
          {{ user.status === 'enabled' ? messages.common.enabled : messages.common.disabled }}
        </ElTag>
        <RouterLink
          v-if="sessionStore.hasCapability('users:write')"
          class="detail-edit"
          :to="{ name: 'user-edit', params: { userId: user.id } }"
        >
          <ElButton type="primary" plain>{{ messages.common.edit }}</ElButton>
        </RouterLink>
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
            user.status === 'enabled' ? messages.common.enabled : messages.common.disabled
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
        <article>
          <span>{{ copy.version }}</span>
          <strong>{{ user.version }}</strong>
        </article>
      </div>

      <section v-if="sessionStore.hasCapability('users:write')" class="status-card">
        <div>
          <h2>{{ copy.statusActionTitle }}</h2>
          <p>{{ copy.statusActionDescription }}</p>
        </div>
        <label>
          <span>{{ copy.statusReason }}</span>
          <ElInput
            v-model="statusReason"
            :placeholder="copy.statusReasonPlaceholder"
            maxlength="255"
            show-word-limit
            @input="resetStatusAttempt"
          />
        </label>
        <p v-if="statusError" class="status-error" role="alert">
          {{ localizeFeedback(statusError) }}
        </p>
        <p v-if="statusChanged" class="status-success" role="status">{{ copy.statusChanged }}</p>
        <ElButton
          :type="user.status === 'enabled' ? 'danger' : 'primary'"
          :loading="changingStatus"
          @click="changeStatus"
        >
          {{ user.status === 'enabled' ? copy.disable : copy.enable }}
        </ElButton>
      </section>

      <UserApplicationAccess
        v-if="sessionStore.hasCapability('application-access:read')"
        :user-id="user.id"
      />
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

.detail-edit {
  grid-column: 3;
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

.status-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 1fr) auto;
  align-items: end;
  gap: var(--space-4);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.status-card h2,
.status-card p {
  margin: 0;
}

.status-card h2 {
  font-size: 1rem;
}

.status-card p,
.status-card label span {
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.status-card label {
  display: grid;
  gap: var(--space-2);
}

.status-card .status-error {
  grid-column: 1 / -1;
  color: var(--color-danger);
}

.status-card .status-success {
  grid-column: 1 / -1;
  color: var(--color-success);
}

@media (width <= 42rem) {
  .detail-heading {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .detail-status {
    grid-column: 1 / -1;
    width: fit-content;
  }

  .detail-edit {
    grid-column: auto;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .status-card {
    grid-template-columns: 1fr;
  }
}
</style>
