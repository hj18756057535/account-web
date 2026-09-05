<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElInput, ElMessageBox, ElSkeleton, ElTag } from 'element-plus'

import {
  changeUserApplicationAccess,
  listUserApplicationAccess,
  retryUserApplicationSynchronization,
  type ApplicationAccessResponse,
} from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { formatDate, formatNumber, localizeFeedback, messages } from '@/locales'
import { synchronizationError } from './synchronization'

const props = defineProps<{ userId: string }>()
const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const copy = messages.access
const rows = ref<ApplicationAccessResponse[]>([])
const loading = ref(true)
const failed = ref(false)
const reasons = reactive<Record<string, string>>({})
const errors = reactive<Record<string, string>>({})
const successes = reactive<Record<string, string>>({})
const keys = reactive<Record<string, string>>({})
const retryKeys = reactive<Record<string, string>>({})
const saving = reactive<Record<string, boolean>>({})
const busy = computed(() => Object.values(saving).some(Boolean))
let generation = 0

async function loadAccess() {
  if (busy.value) return
  const current = ++generation
  const userId = props.userId
  loading.value = true
  failed.value = false
  try {
    const result = await listUserApplicationAccess(userId)
    if (current !== generation) return
    rows.value = result
    for (const row of rows.value) {
      keys[row.appCode] = ''
      retryKeys[row.appCode] = ''
    }
  } catch (error) {
    if (current !== generation) return
    if (await handleAuthError(error)) return
    failed.value = true
  } finally {
    if (current === generation) loading.value = false
  }
}

async function handleAuthError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    sessionStore.expire()
    await router.replace({ name: 'login', query: { redirect: route.fullPath } })
    return true
  }
  if (error instanceof ApiError && error.status === 403) {
    await router.replace({ name: 'forbidden' })
    return true
  }
  return false
}

function resetAttempt(appCode: string) {
  keys[appCode] = ''
  errors[appCode] = ''
  successes[appCode] = ''
}

async function toggle(row: ApplicationAccessResponse) {
  if (saving[row.appCode]) return
  const reason = reasons[row.appCode]?.trim()
  if (!reason) {
    errors[row.appCode] = messages.users.statusReasonRequired
    return
  }
  const target = row.desiredStatus === 'enabled' ? 'disabled' : 'enabled'
  const current = generation
  const userId = props.userId
  saving[row.appCode] = true
  const confirmPermissionReuse = target === 'enabled' && row.appliedVersion != null
  if (confirmPermissionReuse) {
    try {
      await ElMessageBox.confirm(copy.reuseMessage, copy.reuseTitle, { type: 'warning' })
    } catch {
      if (current === generation) saving[row.appCode] = false
      return
    }
    if (current !== generation) return
  }
  errors[row.appCode] = ''
  successes[row.appCode] = ''
  const idempotencyKey = keys[row.appCode] || crypto.randomUUID()
  keys[row.appCode] = idempotencyKey
  try {
    const updated = await changeUserApplicationAccess(
      userId,
      row.appCode,
      { status: target, version: row.version, reason, confirmPermissionReuse },
      sessionStore.csrfToken,
      idempotencyKey,
    )
    if (current !== generation) return
    const index = rows.value.findIndex((item) => item.appCode === row.appCode)
    rows.value[index] = updated
    reasons[row.appCode] = ''
    keys[row.appCode] = ''
    successes[row.appCode] = copy.saved
  } catch (error) {
    if (current !== generation) return
    if (await handleAuthError(error)) return
    errors[row.appCode] =
      error instanceof ApiError && error.code === 'APPLICATION_DISABLED'
        ? copy.disabledApplication
        : error instanceof ApiError &&
            ['RESOURCE_VERSION_CONFLICT', 'SYNC_REUSE_CONFIRMATION_REQUIRED'].includes(error.code)
          ? copy.conflict
          : copy.failed
  } finally {
    if (current === generation) saving[row.appCode] = false
  }
}

async function retrySynchronization(row: ApplicationAccessResponse) {
  if (saving[row.appCode]) return
  const current = generation
  saving[row.appCode] = true
  errors[row.appCode] = ''
  successes[row.appCode] = ''
  const key = retryKeys[row.appCode] || crypto.randomUUID()
  retryKeys[row.appCode] = key
  try {
    const updated = await retryUserApplicationSynchronization(
      props.userId,
      row.appCode,
      row.version,
      sessionStore.csrfToken,
      key,
    )
    if (current !== generation) return
    const index = rows.value.findIndex((item) => item.appCode === row.appCode)
    rows.value[index] = updated
    retryKeys[row.appCode] = ''
    successes[row.appCode] = copy.retrySaved
  } catch (error) {
    if (current !== generation || (await handleAuthError(error))) return
    errors[row.appCode] =
      error instanceof ApiError && error.status === 409
        ? copy.conflict
        : synchronizationError(error instanceof ApiError ? error.code : undefined)
  } finally {
    if (current === generation) saving[row.appCode] = false
  }
}

watch(
  () => props.userId,
  () => {
    generation++
    for (const state of [reasons, errors, successes, keys, retryKeys, saving]) {
      for (const key of Object.keys(state)) delete state[key]
    }
    void loadAccess()
  },
  { immediate: true },
)
onBeforeUnmount(() => generation++)
</script>

<template>
  <section class="access-card" aria-labelledby="access-title">
    <header>
      <div>
        <h2 id="access-title">{{ copy.title }}</h2>
        <p>{{ copy.description }}</p>
      </div>
      <ElButton :disabled="busy || loading" @click="loadAccess">{{ copy.refresh }}</ElButton>
    </header>
    <ElSkeleton v-if="loading" animated :rows="4" />
    <StatePanel
      v-else-if="failed"
      :title="copy.failed"
      :description="messages.errors.generic"
      tone="danger"
    >
      <template #actions
        ><ElButton @click="loadAccess">{{ messages.common.retry }}</ElButton></template
      >
    </StatePanel>
    <StatePanel v-else-if="!rows.length" :title="copy.empty" :description="copy.description" />
    <div v-else class="access-list">
      <article v-for="row in rows" :key="row.appCode">
        <div class="identity">
          <strong>{{ row.applicationName }}</strong
          ><span>{{ row.appCode }}</span>
        </div>
        <div>
          <span>{{ copy.applicationStatus }}</span
          ><ElTag :type="row.applicationStatus === 'enabled' ? 'success' : 'info'">{{
            row.applicationStatus === 'enabled' ? messages.common.enabled : messages.common.disabled
          }}</ElTag>
        </div>
        <div>
          <span>{{ copy.desiredStatus }}</span
          ><ElTag :type="row.desiredStatus === 'enabled' ? 'success' : 'info'">{{
            row.desiredStatus === 'enabled' ? messages.common.enabled : messages.common.disabled
          }}</ElTag>
        </div>
        <div>
          <span>{{ copy.integrationStatus }}</span
          ><strong>{{ copy.syncStates[row.integrationStatus] ?? messages.common.unknown }}</strong>
        </div>
        <div>
          <span>{{ copy.appliedStatus }}</span>
          <strong>{{
            row.appliedStatus === 'enabled'
              ? messages.common.enabled
              : row.appliedStatus === 'disabled'
                ? messages.common.disabled
                : messages.common.unknown
          }}</strong>
        </div>
        <div>
          <span>{{ copy.version }}</span>
          <strong>
            {{ formatNumber(row.version) }} /
            {{
              row.appliedVersion == null
                ? messages.common.unknown
                : formatNumber(row.appliedVersion)
            }}
          </strong>
        </div>
        <div>
          <span>{{ copy.lastSyncedAt }}</span>
          <strong>{{ formatDate(row.lastSyncedAt) }}</strong>
        </div>
        <div v-if="row.lastErrorCode" class="error">
          <span>{{ copy.lastError }}</span>
          <p>{{ synchronizationError(row.lastErrorCode) }}</p>
        </div>
        <template v-if="sessionStore.hasCapability('application-access:write')">
          <ElButton
            v-if="row.retryable"
            :loading="saving[row.appCode]"
            @click="retrySynchronization(row)"
          >
            {{ copy.retrySync }}
          </ElButton>
          <label
            ><span>{{ copy.reason }}</span
            ><ElInput
              v-model="reasons[row.appCode]"
              :placeholder="copy.reasonPlaceholder"
              maxlength="256"
              :disabled="saving[row.appCode]"
              @input="resetAttempt(row.appCode)"
          /></label>
          <ElButton
            :type="row.desiredStatus === 'enabled' ? 'danger' : 'primary'"
            :disabled="row.applicationStatus === 'disabled' && row.desiredStatus !== 'enabled'"
            :loading="saving[row.appCode]"
            @click="toggle(row)"
          >
            {{ row.desiredStatus === 'enabled' ? copy.disable : copy.enable }}
          </ElButton>
          <div v-if="errors[row.appCode]" class="error" role="alert">
            <p>{{ localizeFeedback(errors[row.appCode]) }}</p>
            <ElButton :disabled="saving[row.appCode]" @click="loadAccess">
              {{ messages.common.retry }}
            </ElButton>
          </div>
          <p v-if="successes[row.appCode]" class="success" role="status">
            {{ localizeFeedback(successes[row.appCode]) }}
          </p>
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped>
.access-card {
  display: grid;
  gap: var(--space-4);
}

.access-card header {
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.access-card h2,
.access-card p {
  margin: 0;
}

.access-card header p {
  margin-top: var(--space-1);
  color: var(--color-text-muted);
}

.access-list {
  display: grid;
  gap: var(--space-3);
}

.access-list article {
  display: grid;
  grid-template-columns: minmax(10rem, 1fr) repeat(3, auto);
  align-items: end;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.access-list article > div,
.access-list label {
  display: grid;
  gap: var(--space-2);
}

.identity span {
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.access-list label > span {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.access-list article > div > span {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.access-list label {
  grid-column: 1 / -2;
}

.error,
.success {
  grid-column: 1 / -1;
}

.error {
  color: var(--color-danger);
}

.success {
  color: var(--color-success);
}

@media (width <= 56rem) {
  .access-list article {
    grid-template-columns: 1fr 1fr;
  }

  .access-list label {
    grid-column: 1 / -1;
  }
}
</style>
