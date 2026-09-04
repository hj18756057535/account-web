<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ElButton,
  ElInput,
  ElOption,
  ElSelect,
  ElSkeleton,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus'

import { listApplications, type ApplicationResponse } from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { zhCN } from '@/locales/zh-CN'

const copy = zhCN.applications
const router = useRouter()
const sessionStore = useSessionStore()
const loading = ref(true)
const failed = ref(false)
const applications = ref<ApplicationResponse[]>([])
const filters = reactive({ query: '', status: '' })

async function loadApplications() {
  loading.value = true
  failed.value = false
  try {
    applications.value = await listApplications(filters)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      sessionStore.expire()
      await router.replace({
        name: 'login',
        query: { redirect: router.currentRoute.value.fullPath },
      })
      return
    }
    if (error instanceof ApiError && error.status === 403) {
      await router.replace({ name: 'forbidden' })
      return
    }
    failed.value = true
  } finally {
    loading.value = false
  }
}

function reset() {
  filters.query = ''
  filters.status = ''
  void loadApplications()
}

function protocolLabel(protocol: string) {
  if (protocol === 'sso') return copy.protocolSso
  if (protocol === 'admin_ticket') return copy.protocolAdminTicket
  return copy.protocolUserSync
}

onMounted(loadApplications)
</script>

<template>
  <section class="applications-page" aria-labelledby="applications-title">
    <header class="page-heading">
      <div>
        <p class="page-eyebrow">{{ copy.eyebrow }}</p>
        <h1 id="applications-title" class="page-title">{{ copy.title }}</h1>
        <p class="page-description">{{ copy.description }}</p>
      </div>
      <RouterLink
        v-if="sessionStore.hasCapability('applications:write')"
        :to="{ name: 'application-create' }"
      >
        <ElButton type="primary">{{ zhCN.common.createApplication }}</ElButton>
      </RouterLink>
    </header>

    <form class="filters" @submit.prevent="loadApplications">
      <label>
        <span>{{ copy.searchLabel }}</span>
        <ElInput v-model="filters.query" :placeholder="copy.searchPlaceholder" clearable />
      </label>
      <label>
        <span>{{ copy.statusLabel }}</span>
        <ElSelect v-model="filters.status">
          <ElOption :label="copy.allStatuses" value="" />
          <ElOption :label="zhCN.common.enabled" value="enabled" />
          <ElOption :label="zhCN.common.disabled" value="disabled" />
        </ElSelect>
      </label>
      <div class="filter-actions">
        <ElButton native-type="button" @click="reset">{{ zhCN.common.cancel }}</ElButton>
        <ElButton type="primary" native-type="submit">{{ copy.search }}</ElButton>
      </div>
    </form>

    <ElSkeleton v-if="loading" animated :rows="7" />
    <StatePanel
      v-else-if="failed"
      :title="copy.loadFailed"
      :description="zhCN.errors.generic"
      tone="danger"
    >
      <template #actions
        ><ElButton @click="loadApplications">{{ zhCN.common.retry }}</ElButton></template
      >
    </StatePanel>
    <StatePanel
      v-else-if="applications.length === 0"
      :title="copy.emptyTitle"
      :description="copy.emptyDescription"
    />
    <ElTable v-else :data="applications" class="applications-table">
      <ElTableColumn prop="appCode" :label="copy.appCode" min-width="150" />
      <ElTableColumn prop="name" :label="copy.name" min-width="180" />
      <ElTableColumn :label="copy.protocols" min-width="250">
        <template #default="scope">
          <div class="protocols">
            <ElTag
              v-for="protocol in scope.row.protocolCapabilities"
              :key="protocol"
              effect="plain"
            >
              {{ protocolLabel(protocol) }}
            </ElTag>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn :label="copy.status" width="110">
        <template #default="scope">
          <ElTag :type="scope.row.status === 'enabled' ? 'success' : 'info'">
            {{ scope.row.status === 'enabled' ? zhCN.common.enabled : zhCN.common.disabled }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn :label="copy.action" width="120" fixed="right">
        <template #default="scope">
          <RouterLink :to="{ name: 'application-detail', params: { appCode: scope.row.appCode } }">
            {{ zhCN.common.view }}
          </RouterLink>
        </template>
      </ElTableColumn>
    </ElTable>
  </section>
</template>

<style scoped>
.applications-page {
  display: grid;
  gap: var(--space-6);
}

.page-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.page-eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--color-brand);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.filters {
  display: grid;
  grid-template-columns: minmax(16rem, 1fr) minmax(11rem, 0.35fr) auto;
  align-items: end;
  gap: var(--space-4);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.filters label {
  display: grid;
  gap: var(--space-2);
}

.filters label span {
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.filter-actions,
.protocols {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.applications-table {
  border-radius: var(--radius-panel);
}

@media (width <= 46rem) {
  .page-heading,
  .filters {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
