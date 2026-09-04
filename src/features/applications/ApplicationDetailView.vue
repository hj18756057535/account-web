<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElAlert,
  ElButton,
  ElDialog,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElSkeleton,
  ElTag,
} from 'element-plus'

import {
  changeApplicationStatus,
  getApplication,
  revokeApplicationSecret,
  rotateApplicationSecret,
  type ApplicationResponse,
} from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { localizeFeedback, messages } from '@/locales'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const copy = messages.applications
const application = ref<ApplicationResponse | null>(null)
const loading = ref(true)
const notFound = ref(false)
const failed = ref(false)
const reason = ref('')
const actionError = ref('')
const actionSuccess = ref('')
const acting = ref(false)
const actionKey = ref('')
const oneTimeSecret = ref('')

async function loadApplication() {
  loading.value = true
  failed.value = false
  notFound.value = false
  try {
    application.value = await getApplication(String(route.params.appCode))
  } catch (error) {
    await handleReadError(error)
  } finally {
    loading.value = false
  }
}

async function handleReadError(error: unknown) {
  if (await handleAuthError(error)) return
  notFound.value = error instanceof ApiError && error.status === 404
  failed.value = !notFound.value
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

function resetAttempt() {
  actionKey.value = ''
  actionError.value = ''
  actionSuccess.value = ''
}

async function requireReason(confirmText: string) {
  if (!reason.value.trim()) {
    actionError.value = messages.users.statusReasonRequired
    return false
  }
  try {
    await ElMessageBox.confirm(confirmText, messages.common.confirm, {
      confirmButtonText: messages.common.confirm,
      cancelButtonText: messages.common.cancel,
    })
    return true
  } catch {
    return false
  }
}

async function runAction(
  confirmText: string,
  action: (idempotencyKey: string) => Promise<ApplicationResponse>,
) {
  if (!application.value || acting.value) return
  acting.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    if (!(await requireReason(confirmText))) return
    actionKey.value ||= crypto.randomUUID()
    application.value = await action(actionKey.value)
    reason.value = ''
    actionKey.value = ''
    actionSuccess.value = copy.saved
  } catch (error) {
    if (await handleAuthError(error)) return
    actionError.value =
      error instanceof ApiError && error.code === 'RESOURCE_VERSION_CONFLICT'
        ? copy.conflict
        : copy.sensitiveActionFailed
  } finally {
    acting.value = false
  }
}

async function changeStatus() {
  if (!application.value) return
  const target = application.value.status === 'enabled' ? 'disabled' : 'enabled'
  await runAction(target === 'disabled' ? copy.disable : copy.enable, (key) =>
    changeApplicationStatus(
      application.value!.appCode,
      { status: target, version: application.value!.version, reason: reason.value.trim() },
      sessionStore.csrfToken,
      key,
    ),
  )
}

async function rotateSecret() {
  if (!application.value || acting.value) return
  acting.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    if (!(await requireReason(copy.rotate))) return
    actionKey.value ||= crypto.randomUUID()
    const result = await rotateApplicationSecret(
      application.value.appCode,
      { version: application.value.version, reason: reason.value.trim() },
      sessionStore.csrfToken,
      actionKey.value,
    )
    application.value = result.application
    oneTimeSecret.value = result.secret
    reason.value = ''
    actionKey.value = ''
  } catch (error) {
    if (await handleAuthError(error)) return
    actionError.value =
      error instanceof ApiError && error.code === 'RESOURCE_VERSION_CONFLICT'
        ? copy.conflict
        : copy.sensitiveActionFailed
  } finally {
    acting.value = false
  }
}

async function revokeSecret() {
  await runAction(copy.revoke, (key) =>
    revokeApplicationSecret(
      application.value!.appCode,
      { version: application.value!.version, reason: reason.value.trim() },
      sessionStore.csrfToken,
      key,
    ),
  )
}

async function copySecret() {
  try {
    await navigator.clipboard.writeText(oneTimeSecret.value)
    ElMessage.success(copy.secretCopySuccess)
  } catch {
    ElMessage.error(copy.secretCopyFailed)
  }
}

function clearSecret() {
  oneTimeSecret.value = ''
}

function protocolLabel(protocol: string) {
  return (
    {
      sso: copy.protocolSso,
      admin_ticket: copy.protocolAdminTicket,
      user_sync: copy.protocolUserSync,
    }[protocol] ?? protocol
  )
}

onMounted(loadApplication)
onBeforeUnmount(clearSecret)
</script>

<template>
  <section class="application-detail" aria-labelledby="application-detail-title">
    <RouterLink class="back-link" :to="{ name: 'applications' }"
      >← {{ messages.common.back }}</RouterLink
    >
    <ElSkeleton v-if="loading" animated :rows="9" />
    <StatePanel
      v-else-if="notFound"
      :title="copy.notFound"
      :description="copy.description"
      tone="warning"
    />
    <StatePanel
      v-else-if="failed"
      :title="copy.loadFailed"
      :description="messages.errors.generic"
      tone="danger"
    >
      <template #actions
        ><ElButton @click="loadApplication">{{ messages.common.retry }}</ElButton></template
      >
    </StatePanel>

    <template v-else-if="application">
      <header class="detail-heading">
        <div>
          <p>{{ copy.eyebrow }}</p>
          <h1 id="application-detail-title">{{ application.name }}</h1>
          <span>{{ application.appCode }}</span>
        </div>
        <ElTag :type="application.status === 'enabled' ? 'success' : 'info'" size="large">
          {{
            application.status === 'enabled' ? messages.common.enabled : messages.common.disabled
          }}
        </ElTag>
        <RouterLink
          v-if="sessionStore.hasCapability('applications:write')"
          :to="{ name: 'application-edit', params: { appCode: application.appCode } }"
        >
          <ElButton type="primary" plain>{{ messages.common.edit }}</ElButton>
        </RouterLink>
      </header>

      <div class="detail-grid">
        <article>
          <span>{{ copy.entryUrl }}</span
          ><strong>{{ application.entryUrl }}</strong>
        </article>
        <article>
          <span>{{ copy.ssoCallbackUrl }}</span
          ><strong>{{ application.ssoCallbackUrl }}</strong>
        </article>
        <article>
          <span>{{ copy.permissionIframeUrl }}</span
          ><strong>{{ application.permissionIframeUrl }}</strong>
        </article>
        <article>
          <span>{{ copy.notifyBaseUrl }}</span
          ><strong>{{ application.notifyBaseUrl }}</strong>
        </article>
        <article>
          <span>{{ copy.defaultTenantCode }}</span
          ><strong>{{ application.defaultTenantCode || messages.common.unknown }}</strong>
        </article>
        <article>
          <span>{{ copy.secretState }}</span
          ><strong>{{
            application.secretState === 'active' ? copy.secretActive : copy.secretRevoked
          }}</strong>
        </article>
        <article>
          <span>{{ copy.secretVersion }}</span
          ><strong>{{ application.secretVersion }}</strong>
        </article>
        <article>
          <span>{{ copy.version }}</span
          ><strong>{{ application.version }}</strong>
        </article>
      </div>

      <section class="protocol-card">
        <h2>{{ copy.protocols }}</h2>
        <div>
          <ElTag v-for="protocol in application.protocolCapabilities" :key="protocol">{{
            protocolLabel(protocol)
          }}</ElTag>
        </div>
      </section>

      <section v-if="sessionStore.hasCapability('applications:write')" class="action-card">
        <label
          ><span>{{ copy.statusReason }}</span
          ><ElInput
            v-model="reason"
            :placeholder="copy.statusReasonPlaceholder"
            maxlength="256"
            show-word-limit
            @input="resetAttempt"
        /></label>
        <p v-if="actionError" class="error" role="alert">{{ localizeFeedback(actionError) }}</p>
        <p v-if="actionSuccess" class="success" role="status">{{ actionSuccess }}</p>
        <div class="actions">
          <ElButton
            :type="application.status === 'enabled' ? 'danger' : 'primary'"
            :loading="acting"
            @click="changeStatus"
          >
            {{ application.status === 'enabled' ? copy.disable : copy.enable }}
          </ElButton>
          <ElButton :loading="acting" @click="rotateSecret">{{ copy.rotate }}</ElButton>
          <ElButton
            type="danger"
            plain
            :disabled="application.secretState === 'revoked'"
            :loading="acting"
            @click="revokeSecret"
            >{{ copy.revoke }}</ElButton
          >
        </div>
      </section>
    </template>

    <ElDialog
      :model-value="Boolean(oneTimeSecret)"
      :title="copy.secretOnceTitle"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      width="min(36rem, 92vw)"
    >
      <ElAlert :title="copy.secretOnceDescription" type="warning" show-icon :closable="false" />
      <code class="secret-value">{{ oneTimeSecret }}</code>
      <template #footer>
        <ElButton @click="copySecret">{{ messages.common.copy }}</ElButton>
        <ElButton type="primary" @click="clearSecret">{{ messages.common.confirm }}</ElButton>
      </template>
    </ElDialog>
  </section>
</template>

<style scoped>
.application-detail {
  display: grid;
  gap: var(--space-6);
}

.back-link {
  width: fit-content;
  color: var(--color-brand);
  font-weight: 700;
}

.detail-heading {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: linear-gradient(145deg, #fff, var(--color-brand-soft));
}

.detail-heading div {
  margin-right: auto;
}

.detail-heading p,
.detail-heading h1 {
  margin: 0;
}

.detail-heading p {
  color: var(--color-brand);
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
}

.detail-heading span {
  color: var(--color-text-muted);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.detail-grid article,
.protocol-card,
.action-card {
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
}

.detail-grid strong {
  overflow-wrap: anywhere;
}

.protocol-card h2 {
  margin-top: 0;
  font-size: 1rem;
}

.protocol-card div {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.action-card {
  display: grid;
  gap: var(--space-3);
}

.action-card label {
  display: grid;
  gap: var(--space-2);
}

.action-card label span {
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.action-card p {
  margin: 0;
}

.error {
  color: var(--color-danger);
}

.success {
  color: var(--color-success);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.secret-value {
  display: block;
  margin-top: var(--space-4);
  padding: var(--space-4);
  overflow-wrap: anywhere;
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}

@media (width <= 42rem) {
  .detail-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
