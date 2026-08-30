<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElInput, ElSkeleton } from 'element-plus'

import {
  createUser,
  getUser,
  updateUser,
  type CreateUserRequest,
  type UserResponse,
} from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { zhCN } from '@/locales/zh-CN'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const copy = zhCN.users
const editing = computed(() => typeof route.params.userId === 'string')
const loading = ref(editing.value)
const submitting = ref(false)
const failed = ref(false)
const loadFailed = ref(false)
const notFound = ref(false)
const conflict = ref(false)
const version = ref(0)
const pendingKey = ref('')
const fieldErrors = reactive<Record<string, string>>({})
const form = reactive<CreateUserRequest>({ account: '', email: '', name: '', phone: '' })

watch(
  form,
  () => {
    pendingKey.value = ''
    conflict.value = false
  },
  { deep: true },
)

async function loadUser() {
  if (!editing.value) return
  loading.value = true
  loadFailed.value = false
  notFound.value = false
  conflict.value = false
  try {
    const user = await getUser(String(route.params.userId))
    form.account = user.account
    form.email = user.email
    form.name = user.name
    form.phone = user.phone
    version.value = user.version
  } catch (error) {
    if (!(await handleAuthError(error))) {
      notFound.value = error instanceof ApiError && error.status === 404
      loadFailed.value = !notFound.value
    }
  } finally {
    loading.value = false
  }
}

function validate() {
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]
  for (const field of ['account', 'email', 'name', 'phone'] as const) {
    if (!form[field].trim()) fieldErrors[field] = copy.required
  }
  if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
    fieldErrors.email = copy.invalidEmail
  }
  return Object.keys(fieldErrors).length === 0
}

async function submit() {
  if (submitting.value || !validate()) return
  submitting.value = true
  failed.value = false
  conflict.value = false
  pendingKey.value ||= crypto.randomUUID()
  const request = {
    account: form.account.trim(),
    email: form.email.trim(),
    name: form.name.trim(),
    phone: form.phone.trim(),
  }
  try {
    let saved: UserResponse
    if (editing.value) {
      saved = await updateUser(
        String(route.params.userId),
        { ...request, version: version.value },
        sessionStore.csrfToken,
        pendingKey.value,
      )
    } else {
      saved = await createUser(request, sessionStore.csrfToken, pendingKey.value)
    }
    pendingKey.value = ''
    await router.replace({
      name: 'user-detail',
      params: { userId: saved.id },
      query: { saved: '1' },
    })
  } catch (error) {
    if (await handleAuthError(error)) return
    if (error instanceof ApiError) {
      for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]
      Object.assign(fieldErrors, error.fieldErrors)
      conflict.value = error.code === 'RESOURCE_VERSION_CONFLICT'
      if (error.code === 'ACCOUNT_ALREADY_EXISTS') fieldErrors.account = copy.duplicateAccount
    }
    failed.value = true
  } finally {
    submitting.value = false
  }
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

onMounted(loadUser)
</script>

<template>
  <section class="user-form-page" aria-labelledby="user-form-title">
    <RouterLink
      class="back-link"
      :to="{
        name: editing ? 'user-detail' : 'users',
        params: editing ? { userId: route.params.userId } : {},
      }"
    >
      ← {{ zhCN.common.back }}
    </RouterLink>

    <header>
      <p class="page-eyebrow">{{ copy.formEyebrow }}</p>
      <h1 id="user-form-title" class="page-title">
        {{ editing ? copy.editTitle : copy.createTitle }}
      </h1>
      <p class="page-description">
        {{ editing ? copy.editDescription : copy.createDescription }}
      </p>
    </header>

    <ElSkeleton v-if="loading" animated :rows="7" />

    <StatePanel
      v-else-if="notFound"
      :title="copy.notFoundTitle"
      :description="copy.notFoundDescription"
      tone="warning"
    />

    <StatePanel
      v-else-if="loadFailed"
      :title="copy.errorTitle"
      :description="zhCN.errors.generic"
      tone="danger"
    >
      <template #actions>
        <ElButton @click="loadUser">{{ zhCN.common.retry }}</ElButton>
      </template>
    </StatePanel>

    <StatePanel
      v-else-if="conflict"
      :title="copy.versionConflict"
      :description="copy.editDescription"
      tone="warning"
    >
      <template #actions>
        <ElButton @click="loadUser">{{ zhCN.common.retry }}</ElButton>
      </template>
    </StatePanel>

    <form v-else class="user-form" novalidate @submit.prevent="submit">
      <label>
        <span>{{ copy.account }}</span>
        <ElInput v-model="form.account" :placeholder="copy.accountPlaceholder" maxlength="128" />
        <small v-if="fieldErrors.account" role="alert">{{ fieldErrors.account }}</small>
      </label>
      <label>
        <span>{{ copy.name }}</span>
        <ElInput v-model="form.name" :placeholder="copy.namePlaceholder" maxlength="128" />
        <small v-if="fieldErrors.name" role="alert">{{ fieldErrors.name }}</small>
      </label>
      <label>
        <span>{{ copy.email }}</span>
        <ElInput
          v-model="form.email"
          type="email"
          :placeholder="copy.emailPlaceholder"
          maxlength="255"
        />
        <small v-if="fieldErrors.email" role="alert">{{ fieldErrors.email }}</small>
      </label>
      <label>
        <span>{{ copy.phone }}</span>
        <ElInput v-model="form.phone" :placeholder="copy.phonePlaceholder" maxlength="64" />
        <small v-if="fieldErrors.phone" role="alert">{{ fieldErrors.phone }}</small>
      </label>

      <p v-if="failed && !conflict" class="form-error" role="alert">{{ copy.submitFailed }}</p>
      <footer>
        <RouterLink
          :to="{
            name: editing ? 'user-detail' : 'users',
            params: editing ? { userId: route.params.userId } : {},
          }"
        >
          <ElButton>{{ zhCN.common.cancel }}</ElButton>
        </RouterLink>
        <ElButton type="primary" native-type="submit" :loading="submitting">
          {{ submitting ? zhCN.common.saving : zhCN.common.save }}
        </ElButton>
      </footer>
    </form>
  </section>
</template>

<style scoped>
.user-form-page {
  display: grid;
  gap: var(--space-6);
  max-width: 54rem;
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

.user-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.user-form label {
  display: grid;
  gap: var(--space-2);
}

.user-form label > span {
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.user-form small,
.form-error {
  margin: 0;
  color: var(--color-danger);
}

.user-form footer,
.form-error {
  grid-column: 1 / -1;
}

.user-form footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

@media (width <= 40rem) {
  .user-form {
    grid-template-columns: 1fr;
    padding: var(--space-5);
  }

  .user-form footer,
  .form-error {
    grid-column: auto;
  }
}
</style>
