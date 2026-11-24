<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElAlert, ElOption, ElSelect } from 'element-plus'
import { getUser, listUsers, type UserResponse } from '@/api/account'
import { ApiError } from '@/api/http'
import { useSessionStore } from '@/features/session/session.store'
import { messages } from '@/locales'
import UserApplicationAccess from './UserApplicationAccess.vue'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const selected = ref('')
const users = ref<UserResponse[]>([])
const loading = ref(false)
const failed = ref(false)
let generation = 0

async function search(query = '') {
  const current = ++generation
  loading.value = true
  failed.value = false
  try {
    const result = await listUsers({ query, page: 1, size: 30 })
    if (current === generation) {
      const active = users.value.find((user) => user.id === selected.value)
      users.value =
        active && !result.items.some((user) => user.id === active.id)
          ? [active, ...result.items]
          : result.items
      if (!selected.value && route.query.account === query) {
        const matches = result.items.filter((user) => user.account === query)
        if (matches.length === 1) await select(matches[0]!.id)
      }
    }
  } catch (error) {
    if (current !== generation) return
    if (error instanceof ApiError && error.status === 401) {
      session.expire()
      await router.replace({ name: 'login', query: { redirect: route.fullPath } })
    } else if (error instanceof ApiError && error.status === 403) {
      await router.replace({ name: 'forbidden' })
    } else failed.value = true
  } finally {
    if (current === generation) loading.value = false
  }
}

watch(
  () => route.query.userId,
  async (value, _previous, onCleanup) => {
    selected.value = typeof value === 'string' ? value : ''
    if (!selected.value || users.value.some((user) => user.id === selected.value)) return
    const id = selected.value
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    try {
      const user = await getUser(id)
      if (!cancelled) users.value = [user, ...users.value.filter((row) => row.id !== id)]
    } catch (error) {
      if (cancelled) return
      if (error instanceof ApiError && error.status === 401) {
        session.expire()
        await router.replace({ name: 'login', query: { redirect: route.fullPath } })
      } else if (error instanceof ApiError && error.status === 403) {
        await router.replace({ name: 'forbidden' })
      } else failed.value = true
    }
  },
  { immediate: true },
)

function select(value: string) {
  return router.replace({ query: { ...route.query, userId: value } })
}

onMounted(() => void search(typeof route.query.account === 'string' ? route.query.account : ''))
onBeforeUnmount(() => generation++)
</script>

<template>
  <section class="access-page">
    <h1 class="page-title">{{ messages.access.title }}</h1>
    <label class="user-picker">
      <span>{{ messages.access.selectUser }}</span>
      <ElSelect
        :model-value="selected"
        filterable
        remote
        :remote-method="search"
        :loading="loading"
        :placeholder="messages.access.searchUser"
        @update:model-value="select"
      >
        <ElOption
          v-for="user in users"
          :key="user.id"
          :value="user.id"
          :label="`${user.name} (${user.account})`"
        />
      </ElSelect>
    </label>
    <ElAlert v-if="failed" :title="messages.errors.generic" type="error" :closable="false" />
    <UserApplicationAccess
      v-if="selected"
      :key="selected"
      :user-id="selected"
      :app-code="typeof route.query.appCode === 'string' ? route.query.appCode : undefined"
    />
    <p v-else>{{ messages.access.selectUser }}</p>
  </section>
</template>

<style scoped>
.access-page,
.user-picker {
  display: grid;
  gap: var(--space-4);
}

.user-picker {
  max-width: 34rem;
}
</style>
