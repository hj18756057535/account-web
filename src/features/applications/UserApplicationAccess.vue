<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElInput, ElSkeleton, ElTag } from 'element-plus'

import {
  changeUserApplicationAccess,
  listUserApplicationAccess,
  type ApplicationAccessResponse,
} from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { zhCN } from '@/locales/zh-CN'

const props = defineProps<{ userId: string }>()
const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const copy = zhCN.access
const rows = ref<ApplicationAccessResponse[]>([])
const loading = ref(true)
const failed = ref(false)
const reasons = reactive<Record<string, string>>({})
const errors = reactive<Record<string, string>>({})
const successes = reactive<Record<string, string>>({})
const keys = reactive<Record<string, string>>({})
const saving = reactive<Record<string, boolean>>({})

async function loadAccess() {
  loading.value = true
  failed.value = false
  try {
    rows.value = await listUserApplicationAccess(props.userId)
    for (const row of rows.value) keys[row.appCode] = ''
  } catch (error) {
    if (await handleAuthError(error)) return
    failed.value = true
  } finally {
    loading.value = false
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
    errors[row.appCode] = zhCN.users.statusReasonRequired
    return
  }
  const target = row.desiredStatus === 'enabled' ? 'disabled' : 'enabled'
  saving[row.appCode] = true
  errors[row.appCode] = ''
  successes[row.appCode] = ''
  const idempotencyKey = keys[row.appCode] || crypto.randomUUID()
  keys[row.appCode] = idempotencyKey
  try {
    const updated = await changeUserApplicationAccess(
      props.userId,
      row.appCode,
      { status: target, version: row.version, reason },
      sessionStore.csrfToken,
      idempotencyKey,
    )
    const index = rows.value.findIndex((item) => item.appCode === row.appCode)
    rows.value[index] = updated
    reasons[row.appCode] = ''
    keys[row.appCode] = ''
    successes[row.appCode] = copy.saved
  } catch (error) {
    if (await handleAuthError(error)) return
    errors[row.appCode] =
      error instanceof ApiError && error.code === 'APPLICATION_DISABLED'
        ? copy.disabledApplication
        : error instanceof ApiError && error.code === 'RESOURCE_VERSION_CONFLICT'
          ? copy.conflict
          : copy.failed
  } finally {
    saving[row.appCode] = false
  }
}

onMounted(loadAccess)
</script>

<template>
  <section class="access-card" aria-labelledby="access-title">
    <header>
      <div>
        <h2 id="access-title">{{ copy.title }}</h2>
        <p>{{ copy.description }}</p>
      </div>
    </header>
    <ElSkeleton v-if="loading" animated :rows="4" />
    <StatePanel
      v-else-if="failed"
      :title="copy.failed"
      :description="zhCN.errors.generic"
      tone="danger"
    >
      <template #actions
        ><ElButton @click="loadAccess">{{ zhCN.common.retry }}</ElButton></template
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
            row.applicationStatus === 'enabled' ? zhCN.common.enabled : zhCN.common.disabled
          }}</ElTag>
        </div>
        <div>
          <span>{{ copy.desiredStatus }}</span
          ><ElTag :type="row.desiredStatus === 'enabled' ? 'success' : 'info'">{{
            row.desiredStatus === 'enabled' ? zhCN.common.enabled : zhCN.common.disabled
          }}</ElTag>
        </div>
        <div>
          <span>{{ copy.integrationStatus }}</span
          ><strong>{{ copy.pendingAdaptation }}</strong>
        </div>
        <template v-if="sessionStore.hasCapability('application-access:write')">
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
            <p>{{ errors[row.appCode] }}</p>
            <ElButton :disabled="saving[row.appCode]" @click="loadAccess">
              {{ zhCN.common.retry }}
            </ElButton>
          </div>
          <p v-if="successes[row.appCode]" class="success" role="status">
            {{ successes[row.appCode] }}
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
