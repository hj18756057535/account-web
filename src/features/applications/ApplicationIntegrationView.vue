<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElAlert, ElButton, ElOption, ElSelect, ElSkeleton } from 'element-plus'
import { listApplications, type ApplicationResponse } from '@/api/account'
import { ApiError } from '@/api/http'
import { useSessionStore } from '@/features/session/session.store'
import { messages } from '@/locales'
import ApplicationDirectoryPanel from './ApplicationDirectoryPanel.vue'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const applications = ref<ApplicationResponse[]>([])
const loading = ref(true)
const failed = ref(false)
const application = computed(() =>
  applications.value.find((app) => app.appCode === route.query.appCode),
)
let generation = 0

async function load() {
  const current = ++generation
  loading.value = true
  failed.value = false
  try {
    const result = await listApplications()
    if (current !== generation) return
    applications.value = result
    if (!route.query.appCode && result.length) {
      const first =
        result.find((app) => app.protocolCapabilities.includes('directory')) ?? result[0]!
      await select(first.appCode)
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

function select(value: string) {
  return router.replace({ query: { appCode: value } })
}

onMounted(() => void load())
onBeforeUnmount(() => generation++)
</script>

<template>
  <section class="data-page" aria-labelledby="integration-debug-title">
    <h1 id="integration-debug-title" class="page-title">{{ messages.navigation.data }}</h1>
    <ElSkeleton v-if="loading" :rows="5" animated />
    <template v-else>
      <ElAlert v-if="failed" :title="messages.errors.generic" type="error" :closable="false" />
      <ElButton v-if="failed" @click="load">{{ messages.common.retry }}</ElButton>
      <label class="app-picker">
        <span>{{ messages.directory.selectApplication }}</span>
        <ElSelect :model-value="application?.appCode" @update:model-value="select">
          <ElOption
            v-for="app in applications"
            :key="app.appCode"
            :label="app.name"
            :value="app.appCode"
          />
        </ElSelect>
      </label>
      <template v-if="application">
        <div class="data-actions">
          <RouterLink
            v-if="session.hasCapability('application-access:read')"
            class="action-link action-link--primary"
            :to="{ name: 'user-authorization', query: { appCode: application.appCode } }"
          >
            {{ messages.navigation.access }}
          </RouterLink>
          <RouterLink
            v-if="session.hasCapability('applications:write')"
            class="action-link"
            :to="{ name: 'application-edit', params: { appCode: application.appCode } }"
          >
            {{ messages.common.edit }}
          </RouterLink>
        </div>
        <ApplicationDirectoryPanel
          v-if="application.protocolCapabilities.includes('directory')"
          :key="application.appCode"
          :application="application"
        />
        <ElAlert
          v-else
          :title="messages.directory.notConfigured"
          type="warning"
          :closable="false"
        />
      </template>
      <p v-else>{{ messages.access.empty }}</p>
    </template>
  </section>
</template>

<style scoped>
.data-page,
.app-picker {
  display: grid;
  gap: var(--space-4);
}

.app-picker {
  max-width: 34rem;
}

.data-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>
