<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElAlert,
  ElButton,
  ElMessageBox,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus'
import {
  checkApplicationConnection,
  commitApplicationDirectory,
  getApplicationDirectory,
  previewApplicationDirectory,
  type ApplicationResponse,
  type DirectoryImportPreview,
  type DirectorySnapshot,
} from '@/api/account'
import { ApiError } from '@/api/http'
import { useSessionStore } from '@/features/session/session.store'
import { formatDate, localizeFeedback, messages } from '@/locales'

const props = defineProps<{ application: ApplicationResponse }>()
const session = useSessionStore()
const router = useRouter()
const route = useRoute()
const copy = messages.directory
const latest = ref<DirectorySnapshot | null>(null)
const preview = ref<DirectoryImportPreview | null>(null)
const connected = ref<boolean | null>(null)
const pending = ref('')
const error = ref('')
const success = ref('')
const key = ref('')
const source = computed(() => preview.value?.snapshot ?? latest.value)
const enabled = computed(
  () =>
    props.application.status === 'enabled' &&
    props.application.secretState === 'active' &&
    props.application.protocolCapabilities.includes('directory'),
)
const canImport = computed(
  () => session.hasCapability('applications:write') && session.hasCapability('users:import'),
)
const roles = computed(
  () =>
    new Map(
      source.value?.roles.map((role) => [
        role.localRoleId,
        role.name || role.code || role.localRoleId,
      ]),
    ),
)
const organizations = computed(
  () =>
    new Map(
      source.value?.organizations.map((org) => [
        org.localOrganizationId,
        org.name || org.code || org.localOrganizationId,
      ]),
    ),
)
let generation = 0

const userRows = computed(() =>
  (source.value?.users ?? []).map((user) => ({
    ...user,
    roleNames: user.roleIds.map((id) => roles.value.get(id) || id).join(', '),
    organizationNames: user.organizationIds
      .map((id) => organizations.value.get(id) || id)
      .join(', '),
  })),
)

async function report(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 401) {
    session.expire()
    await router.replace({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  if (cause instanceof ApiError && cause.status === 403) {
    await router.replace({ name: 'forbidden' })
    return
  }
  const errors: Record<string, string> = {
    DIRECTORY_AUTH_FAILED: copy.authFailed,
    DIRECTORY_PROVIDER_MISSING: copy.providerMissing,
    DIRECTORY_NOT_CONFIGURED: copy.notConfigured,
    DIRECTORY_TOO_LARGE: copy.tooLarge,
    DIRECTORY_IDENTITY_CONFLICT: copy.identityConflict,
    DIRECTORY_PREVIEW_CHANGED: copy.changed,
    DIRECTORY_PREVIEW_EXPIRED: copy.changed,
  }
  error.value =
    cause instanceof ApiError ? errors[cause.code] || copy.unavailable : copy.unavailable
}

async function load() {
  const current = ++generation
  pending.value = 'load'
  try {
    const result = await getApplicationDirectory(props.application.appCode)
    if (current === generation) latest.value = result
  } catch (cause) {
    if (current === generation) await report(cause)
  } finally {
    if (current === generation) pending.value = ''
  }
}

async function check() {
  if (pending.value) return
  const current = generation
  error.value = ''
  pending.value = 'check'
  try {
    const result = await checkApplicationConnection(props.application.appCode, session.csrfToken)
    if (current === generation) connected.value = result.connected
  } catch (cause) {
    if (current === generation) {
      connected.value = false
      await report(cause)
    }
  } finally {
    if (current === generation) pending.value = ''
  }
}

async function pull() {
  if (pending.value) return
  const current = generation
  error.value = ''
  success.value = ''
  pending.value = 'preview'
  try {
    const result = await previewApplicationDirectory(props.application.appCode, session.csrfToken)
    if (current === generation) {
      preview.value = result
      key.value = crypto.randomUUID()
      connected.value = true
    }
  } catch (cause) {
    if (current === generation) await report(cause)
  } finally {
    if (current === generation) pending.value = ''
  }
}

async function commit() {
  if (!preview.value || pending.value) return
  const current = generation
  const importId = preview.value.importId
  const snapshot = preview.value.snapshot
  const idempotencyKey = key.value
  pending.value = 'confirm'
  try {
    await ElMessageBox.confirm(copy.confirm, messages.common.confirm, { type: 'warning' })
  } catch {
    if (current === generation) pending.value = ''
    return
  }
  if (current !== generation) return
  pending.value = 'commit'
  error.value = ''
  try {
    await commitApplicationDirectory(
      props.application.appCode,
      importId,
      session.csrfToken,
      idempotencyKey,
    )
    if (current !== generation) return
    latest.value = snapshot
    preview.value = null
    success.value = copy.success
    key.value = ''
  } catch (cause) {
    if (current === generation) await report(cause)
  } finally {
    if (current === generation) pending.value = ''
  }
}

watch(
  () => [props.application.appCode, props.application.version],
  () => {
    preview.value = null
    latest.value = null
    key.value = ''
    connected.value = null
    error.value = ''
    success.value = ''
    void load()
  },
  { immediate: true },
)
onBeforeUnmount(() => generation++)
</script>

<template>
  <section class="directory-panel" aria-labelledby="directory-title">
    <header class="directory-heading">
      <h2 id="directory-title">{{ copy.title }}</h2>
      <ElTag :type="connected ? 'success' : 'info'">
        {{
          connected === null ? copy.notChecked : connected ? copy.connected : copy.checkingFailed
        }}
      </ElTag>
    </header>
    <p>{{ copy.description }}</p>
    <ElAlert v-if="!enabled" :title="copy.notConfigured" type="info" :closable="false" />
    <div v-if="session.hasCapability('applications:write')" class="directory-actions">
      <ElButton :loading="pending === 'check'" :disabled="!enabled || !!pending" @click="check">
        {{ copy.check }}
      </ElButton>
      <ElButton
        v-if="canImport"
        :loading="pending === 'preview'"
        :disabled="!enabled || !!pending"
        @click="pull"
      >
        {{ copy.pull }}
      </ElButton>
      <ElButton
        v-if="preview && canImport"
        type="primary"
        :loading="pending === 'commit'"
        :disabled="!!pending"
        @click="commit"
      >
        {{ copy.commit }}
      </ElButton>
    </div>
    <p v-if="error" class="directory-error" role="alert">{{ localizeFeedback(error) }}</p>
    <p v-if="success" role="status">{{ localizeFeedback(success) }}</p>
    <p v-if="preview" role="status">
      {{ copy.preview }} · {{ copy.created }}: {{ preview.newUsers }} · {{ copy.reused }}:
      {{ preview.existingUsers }}
    </p>
    <p v-if="source?.capturedAt">{{ copy.capturedAt }}: {{ formatDate(source.capturedAt) }}</p>
    <p>{{ copy.passwordHint }}</p>
    <ElTabs v-if="source?.capturedAt">
      <ElTabPane :label="copy.users">
        <ElTable :data="userRows" :max-height="360" row-key="localUserId">
          <ElTableColumn prop="localUserId" :label="copy.localId" />
          <ElTableColumn prop="account" :label="copy.account" />
          <ElTableColumn prop="name" :label="copy.name" />
          <ElTableColumn prop="roleNames" :label="copy.roles" />
          <ElTableColumn prop="organizationNames" :label="copy.organizations" />
          <ElTableColumn
            v-if="session.hasCapability('application-access:read')"
            :label="messages.overview.actions"
            min-width="180"
          >
            <template #default="{ row }">
              <RouterLink
                class="action-link"
                :to="{
                  name: 'user-authorization',
                  query: { appCode: application.appCode, account: row.account },
                }"
              >
                {{ messages.navigation.access }}
              </RouterLink>
            </template>
          </ElTableColumn>
        </ElTable>
      </ElTabPane>
      <ElTabPane :label="copy.roles">
        <ElTable :data="source.roles" :max-height="360" row-key="localRoleId">
          <ElTableColumn prop="localRoleId" :label="copy.localId" />
          <ElTableColumn prop="code" :label="copy.code" />
          <ElTableColumn prop="name" :label="copy.name" />
        </ElTable>
      </ElTabPane>
      <ElTabPane :label="copy.organizations">
        <ElTable :data="source.organizations" :max-height="360" row-key="localOrganizationId">
          <ElTableColumn prop="localOrganizationId" :label="copy.localId" />
          <ElTableColumn prop="code" :label="copy.code" />
          <ElTableColumn prop="name" :label="copy.name" />
          <ElTableColumn :label="copy.parent">
            <template #default="{ row }">{{
              organizations.get(row.parentId) || row.parentId || '—'
            }}</template>
          </ElTableColumn>
        </ElTable>
      </ElTabPane>
    </ElTabs>
    <p v-else-if="!pending">{{ copy.empty }}</p>
  </section>
</template>

<style scoped>
.directory-panel {
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.directory-heading,
.directory-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.directory-heading h2 {
  margin-right: auto;
}

.directory-panel p {
  color: var(--color-text-muted);
}

.directory-panel .directory-error {
  color: var(--color-danger);
}
</style>
