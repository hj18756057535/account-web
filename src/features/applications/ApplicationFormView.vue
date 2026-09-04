<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElDialog,
  ElInput,
  ElMessage,
  ElSkeleton,
} from 'element-plus'

import {
  createApplication,
  getApplication,
  updateApplication,
  type CreateApplicationRequest,
} from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { zhCN } from '@/locales/zh-CN'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const copy = zhCN.applications
const editing = computed(() => typeof route.params.appCode === 'string')
const loading = ref(editing.value)
const loadFailed = ref(false)
const notFound = ref(false)
const submitting = ref(false)
const failed = ref(false)
const conflict = ref(false)
const pendingKey = ref('')
const version = ref(0)
const oneTimeSecret = ref('')
const secretDialogVisible = ref(false)
const fieldErrors = reactive<Record<string, string>>({})
const form = reactive<CreateApplicationRequest>({
  appCode: '',
  name: '',
  entryUrl: '',
  ssoCallbackUrl: '',
  permissionIframeUrl: '',
  notifyBaseUrl: '',
  defaultTenantCode: 'default',
  protocolCapabilities: ['sso', 'admin_ticket', 'user_sync'],
})

watch(
  form,
  () => {
    pendingKey.value = ''
    failed.value = false
    conflict.value = false
  },
  { deep: true },
)

async function loadApplication() {
  if (!editing.value) return
  loading.value = true
  loadFailed.value = false
  notFound.value = false
  try {
    const application = await getApplication(String(route.params.appCode))
    form.appCode = application.appCode
    form.name = application.name
    form.entryUrl = application.entryUrl
    form.ssoCallbackUrl = application.ssoCallbackUrl
    form.permissionIframeUrl = application.permissionIframeUrl
    form.notifyBaseUrl = application.notifyBaseUrl
    form.defaultTenantCode = application.defaultTenantCode
    form.protocolCapabilities = [...application.protocolCapabilities]
    version.value = application.version
  } catch (error) {
    if (await handleAuthError(error)) return
    notFound.value = error instanceof ApiError && error.status === 404
    loadFailed.value = !notFound.value
  } finally {
    loading.value = false
  }
}

function validate() {
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]
  for (const field of [
    'appCode',
    'name',
    'entryUrl',
    'ssoCallbackUrl',
    'permissionIframeUrl',
    'notifyBaseUrl',
  ] as const) {
    if (!form[field].trim()) fieldErrors[field] = copy.required
  }
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(form.appCode)) fieldErrors.appCode = copy.invalidAppCode
  for (const field of [
    'entryUrl',
    'ssoCallbackUrl',
    'permissionIframeUrl',
    'notifyBaseUrl',
  ] as const) {
    if (form[field] && !isExactHttpUrl(form[field])) fieldErrors[field] = copy.invalidUrl
  }
  if (form.protocolCapabilities.length === 0)
    fieldErrors.protocolCapabilities = copy.protocolRequired
  return Object.keys(fieldErrors).length === 0
}

function isExactHttpUrl(value: string) {
  try {
    const normalized = value.replace('{externalUserId}', 'externalUserId')
    const url = new URL(normalized)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !value.includes('*') &&
      !url.hash &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

async function submit() {
  if (submitting.value || secretDialogVisible.value || !validate()) return
  submitting.value = true
  failed.value = false
  conflict.value = false
  pendingKey.value ||= crypto.randomUUID()
  const request = {
    name: form.name.trim(),
    entryUrl: form.entryUrl.trim(),
    ssoCallbackUrl: form.ssoCallbackUrl.trim(),
    permissionIframeUrl: form.permissionIframeUrl.trim(),
    notifyBaseUrl: form.notifyBaseUrl.trim(),
    defaultTenantCode: form.defaultTenantCode?.trim() || null,
    protocolCapabilities: [...form.protocolCapabilities],
  }
  try {
    if (editing.value) {
      const saved = await updateApplication(
        form.appCode,
        { ...request, version: version.value },
        sessionStore.csrfToken,
        pendingKey.value,
      )
      pendingKey.value = ''
      await router.replace({
        name: 'application-detail',
        params: { appCode: saved.appCode },
        query: { saved: '1' },
      })
    } else {
      const created = await createApplication(
        { ...request, appCode: form.appCode.trim() },
        sessionStore.csrfToken,
        pendingKey.value,
      )
      pendingKey.value = ''
      version.value = created.application.version
      oneTimeSecret.value = created.secret
      secretDialogVisible.value = true
    }
  } catch (error) {
    if (await handleAuthError(error)) return
    if (error instanceof ApiError) {
      Object.assign(fieldErrors, error.fieldErrors)
      conflict.value = error.code === 'RESOURCE_VERSION_CONFLICT'
      if (error.code === 'APPLICATION_ALREADY_EXISTS') fieldErrors.appCode = copy.duplicate
    }
    failed.value = true
  } finally {
    submitting.value = false
  }
}

async function copySecret() {
  try {
    await navigator.clipboard.writeText(oneTimeSecret.value)
    ElMessage.success(copy.secretCopySuccess)
  } catch {
    ElMessage.error(copy.secretCopyFailed)
  }
}

async function closeSecret() {
  secretDialogVisible.value = false
  oneTimeSecret.value = ''
  await router.replace({
    name: 'application-detail',
    params: { appCode: form.appCode },
    query: { saved: '1' },
  })
}

async function handleAuthError(error: unknown) {
  if (!(error instanceof ApiError)) return false
  if (error.status === 401) {
    sessionStore.expire()
    await router.replace({ name: 'login', query: { redirect: route.fullPath } })
    return true
  }
  if (error.status === 403) {
    await router.replace({ name: 'forbidden' })
    return true
  }
  return false
}

onMounted(loadApplication)
onBeforeUnmount(() => {
  oneTimeSecret.value = ''
})
</script>

<template>
  <section class="application-form-page" aria-labelledby="application-form-title">
    <RouterLink
      class="back-link"
      :to="
        editing
          ? { name: 'application-detail', params: { appCode: route.params.appCode } }
          : { name: 'applications' }
      "
    >
      ← {{ zhCN.common.back }}
    </RouterLink>
    <header>
      <p class="page-eyebrow">{{ copy.eyebrow }}</p>
      <h1 id="application-form-title" class="page-title">
        {{ editing ? copy.editTitle : copy.createTitle }}
      </h1>
      <p class="page-description">{{ copy.formDescription }}</p>
    </header>

    <ElSkeleton v-if="loading" animated :rows="8" />
    <StatePanel
      v-else-if="notFound"
      :title="copy.notFound"
      :description="copy.loadFailed"
      tone="warning"
    />
    <StatePanel
      v-else-if="loadFailed"
      :title="copy.loadFailed"
      :description="zhCN.errors.generic"
      tone="danger"
    >
      <template #actions
        ><ElButton @click="loadApplication">{{ zhCN.common.retry }}</ElButton></template
      >
    </StatePanel>
    <StatePanel
      v-else-if="conflict"
      :title="copy.conflict"
      :description="copy.formDescription"
      tone="warning"
    >
      <template #actions
        ><ElButton @click="loadApplication">{{ zhCN.common.retry }}</ElButton></template
      >
    </StatePanel>

    <form v-else class="application-form" novalidate @submit.prevent="submit">
      <label>
        <span>{{ copy.appCode }}</span>
        <ElInput v-model="form.appCode" :disabled="editing" maxlength="64" />
        <small v-if="fieldErrors.appCode" role="alert">{{ fieldErrors.appCode }}</small>
      </label>
      <label>
        <span>{{ copy.name }}</span>
        <ElInput v-model="form.name" maxlength="128" />
        <small v-if="fieldErrors.name" role="alert">{{ fieldErrors.name }}</small>
      </label>
      <label class="wide-field">
        <span>{{ copy.entryUrl }}</span>
        <ElInput v-model="form.entryUrl" />
        <small v-if="fieldErrors.entryUrl" role="alert">{{ fieldErrors.entryUrl }}</small>
      </label>
      <label class="wide-field">
        <span>{{ copy.ssoCallbackUrl }}</span>
        <ElInput v-model="form.ssoCallbackUrl" />
        <small v-if="fieldErrors.ssoCallbackUrl" role="alert">{{
          fieldErrors.ssoCallbackUrl
        }}</small>
      </label>
      <label class="wide-field">
        <span>{{ copy.permissionIframeUrl }}</span>
        <ElInput v-model="form.permissionIframeUrl" />
        <small v-if="fieldErrors.permissionIframeUrl" role="alert">{{
          fieldErrors.permissionIframeUrl
        }}</small>
      </label>
      <label class="wide-field">
        <span>{{ copy.notifyBaseUrl }}</span>
        <ElInput v-model="form.notifyBaseUrl" />
        <small v-if="fieldErrors.notifyBaseUrl" role="alert">{{ fieldErrors.notifyBaseUrl }}</small>
      </label>
      <label>
        <span>{{ copy.defaultTenantCode }}</span>
        <ElInput v-model="form.defaultTenantCode" maxlength="64" />
      </label>
      <fieldset class="wide-field">
        <legend>{{ copy.protocols }}</legend>
        <ElCheckboxGroup v-model="form.protocolCapabilities" class="protocol-options">
          <ElCheckbox value="sso" border>{{ copy.protocolSso }}</ElCheckbox>
          <ElCheckbox value="admin_ticket" border>{{ copy.protocolAdminTicket }}</ElCheckbox>
          <ElCheckbox value="user_sync" border>{{ copy.protocolUserSync }}</ElCheckbox>
        </ElCheckboxGroup>
        <small v-if="fieldErrors.protocolCapabilities" role="alert">{{
          fieldErrors.protocolCapabilities
        }}</small>
      </fieldset>
      <p v-if="failed && !conflict" class="form-error" role="alert">{{ copy.saveFailed }}</p>
      <footer>
        <RouterLink
          :to="
            editing
              ? { name: 'application-detail', params: { appCode: route.params.appCode } }
              : { name: 'applications' }
          "
        >
          <ElButton>{{ zhCN.common.cancel }}</ElButton>
        </RouterLink>
        <ElButton type="primary" native-type="submit" :loading="submitting">
          {{ submitting ? zhCN.common.saving : zhCN.common.save }}
        </ElButton>
      </footer>
    </form>

    <ElDialog
      v-model="secretDialogVisible"
      :title="copy.secretOnceTitle"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <p>{{ copy.secretOnceDescription }}</p>
      <ElInput :model-value="oneTimeSecret" readonly type="textarea" :rows="3" />
      <template #footer>
        <ElButton @click="copySecret">{{ zhCN.common.copy }}</ElButton>
        <ElButton type="primary" @click="closeSecret">{{ zhCN.common.confirm }}</ElButton>
      </template>
    </ElDialog>
  </section>
</template>

<style scoped>
.application-form-page {
  display: grid;
  gap: var(--space-6);
  max-width: 58rem;
}

.back-link {
  width: fit-content;
  color: var(--color-brand);
  font-weight: 700;
}

.page-eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--color-brand);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.application-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.application-form label,
.application-form fieldset {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.application-form label > span,
.application-form legend {
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.application-form fieldset {
  margin: 0;
  padding: 0;
  border: 0;
}

.wide-field,
.application-form footer,
.form-error {
  grid-column: 1 / -1;
}

.application-form small,
.form-error {
  color: var(--color-danger);
}

.application-form footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.protocol-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}

.protocol-options :deep(.el-checkbox.is-bordered) {
  display: flex;
  align-items: center;
  min-width: 0;
  height: auto;
  min-height: 3.25rem;
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}

.protocol-options :deep(.el-checkbox.is-bordered:hover) {
  border-color: var(--color-brand);
  background: var(--color-surface-muted);
}

.protocol-options :deep(.el-checkbox.is-bordered.is-checked) {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
}

.protocol-options :deep(.el-checkbox:has(:focus-visible)) {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
}

.protocol-options :deep(.el-checkbox__label) {
  min-width: 0;
  color: var(--color-text);
  font-weight: 600;
  line-height: 1.5;
  white-space: normal;
}

.protocol-options :deep(.is-checked .el-checkbox__label) {
  color: var(--color-brand-strong);
}

.protocol-options :deep(.el-checkbox__inner) {
  width: 18px;
  height: 18px;
  border-radius: var(--space-1);
}

.protocol-options :deep(.el-checkbox__inner::after) {
  top: 3px;
  left: 6px;
}

@media (width <= 42rem) {
  .application-form,
  .protocol-options {
    grid-template-columns: 1fr;
  }

  .wide-field,
  .application-form footer,
  .form-error {
    grid-column: auto;
  }
}
</style>
