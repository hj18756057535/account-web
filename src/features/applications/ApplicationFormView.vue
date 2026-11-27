<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElDialog, ElInput, ElMessage, ElSkeleton } from 'element-plus'

import {
  createApplication,
  getApplication,
  updateApplication,
  type CreateApplicationRequest,
} from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { localizeFeedback, messages } from '@/locales'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const copy = messages.applications
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
type ApplicationForm = CreateApplicationRequest & {
  entryUrl: string
  ssoCallbackUrl: string
  permissionIframeUrl: string
  notifyBaseUrl: string
}
const form = reactive<ApplicationForm>({
  appCode: '',
  name: '',
  entryUrl: '',
  ssoCallbackUrl: '',
  permissionIframeUrl: '',
  notifyBaseUrl: '',
  defaultTenantCode: 'default',
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
  for (const field of ['appCode', 'name'] as const) {
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
      class="back-link action-link"
      :to="
        editing
          ? { name: 'application-detail', params: { appCode: route.params.appCode } }
          : { name: 'applications' }
      "
    >
      ← {{ messages.common.back }}
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
      :description="messages.errors.generic"
      tone="danger"
    >
      <template #actions
        ><ElButton @click="loadApplication">{{ messages.common.retry }}</ElButton></template
      >
    </StatePanel>
    <StatePanel
      v-else-if="conflict"
      :title="copy.conflict"
      :description="copy.formDescription"
      tone="warning"
    >
      <template #actions
        ><ElButton @click="loadApplication">{{ messages.common.retry }}</ElButton></template
      >
    </StatePanel>

    <form v-else class="application-form" novalidate @submit.prevent="submit">
      <label>
        <span>{{ copy.appCode }}</span>
        <ElInput v-model="form.appCode" :disabled="editing" maxlength="64" />
        <small v-if="fieldErrors.appCode" role="alert">{{
          localizeFeedback(fieldErrors.appCode)
        }}</small>
      </label>
      <label>
        <span>{{ copy.name }}</span>
        <ElInput v-model="form.name" maxlength="128" />
        <small v-if="fieldErrors.name" role="alert">{{ localizeFeedback(fieldErrors.name) }}</small>
      </label>
      <label class="wide-field">
        <span>{{ copy.entryUrl }}</span>
        <ElInput v-model="form.entryUrl" />
        <small v-if="fieldErrors.entryUrl" role="alert">{{
          localizeFeedback(fieldErrors.entryUrl)
        }}</small>
      </label>
      <label class="wide-field">
        <span>{{ copy.ssoCallbackUrl }}</span>
        <ElInput v-model="form.ssoCallbackUrl" />
        <small v-if="fieldErrors.ssoCallbackUrl" role="alert">{{
          localizeFeedback(fieldErrors.ssoCallbackUrl)
        }}</small>
      </label>
      <label class="wide-field">
        <span>{{ copy.permissionIframeUrl }}</span>
        <ElInput v-model="form.permissionIframeUrl" />
        <small v-if="fieldErrors.permissionIframeUrl" role="alert">{{
          localizeFeedback(fieldErrors.permissionIframeUrl)
        }}</small>
      </label>
      <label class="wide-field">
        <span>{{ copy.notifyBaseUrl }}</span>
        <ElInput v-model="form.notifyBaseUrl" />
        <small v-if="fieldErrors.notifyBaseUrl" role="alert">{{
          localizeFeedback(fieldErrors.notifyBaseUrl)
        }}</small>
      </label>
      <label>
        <span>{{ copy.defaultTenantCode }}</span>
        <ElInput v-model="form.defaultTenantCode" maxlength="64" />
      </label>
      <p v-if="failed && !conflict" class="form-error" role="alert">{{ copy.saveFailed }}</p>
      <footer>
        <RouterLink
          class="action-link"
          :to="
            editing
              ? { name: 'application-detail', params: { appCode: route.params.appCode } }
              : { name: 'applications' }
          "
        >
          {{ messages.common.cancel }}
        </RouterLink>
        <ElButton type="primary" native-type="submit" :loading="submitting">
          {{ submitting ? messages.common.saving : messages.common.save }}
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
        <ElButton @click="copySecret">{{ messages.common.copy }}</ElButton>
        <ElButton type="primary" @click="closeSecret">{{ messages.common.confirm }}</ElButton>
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

.application-form label {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.application-form label > span {
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 700;
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

@media (width <= 42rem) {
  .application-form {
    grid-template-columns: 1fr;
  }
}
</style>
