<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElButton,
  ElDrawer,
  ElInput,
  ElOption,
  ElPagination,
  ElSelect,
  ElSkeleton,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus'

import {
  getAuditEvent,
  listAuditEvents,
  type AuditEventPageResponse,
  type AuditEventQuery,
  type AuditEventResponse,
} from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { formatDate, formatNumber, messages } from '@/locales'

const copy = messages.audit
const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const filterFields = ['operatorId', 'operationType', 'targetType', 'targetId', 'traceId'] as const
const filters = reactive({
  operatorId: '',
  operationType: '',
  targetType: '',
  targetId: '',
  traceId: typeof route.query.traceId === 'string' ? route.query.traceId : '',
})
let appliedFilters: AuditEventQuery = {}
const result = ref<AuditEventPageResponse>({ items: [], page: 1, size: 20, total: 0 })
const loading = ref(true)
const failed = ref(false)
let listRequest = 0
const drawerOpen = ref(false)
const detail = ref<AuditEventResponse | null>(null)
const detailLoading = ref(false)
const detailFailed = ref(false)
const detailMissing = ref(false)
let detailId = ''
let detailRequest = 0
const detailFields = ['id', ...filterFields, 'outcome', 'createdAt'] as const

async function handleAuth(error: unknown) {
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

async function loadEvents(page = result.value.page) {
  const request = ++listRequest
  loading.value = true
  failed.value = false
  try {
    const data = await listAuditEvents({ ...appliedFilters, page, size: result.value.size })
    if (request === listRequest) result.value = data
  } catch (error) {
    if (request !== listRequest) return
    if (!(await handleAuth(error))) failed.value = true
  } finally {
    if (request === listRequest) loading.value = false
  }
}

function search() {
  appliedFilters = {}
  for (const key of filterFields) appliedFilters[key] = filters[key].trim() || undefined
  void loadEvents(1)
}

function reset() {
  for (const key of filterFields) filters[key] = ''
  search()
}

async function openDetail(id: string) {
  detailId = id
  drawerOpen.value = true
  detail.value = null
  detailFailed.value = false
  detailMissing.value = false
  detailLoading.value = true
  const request = ++detailRequest
  try {
    const data = await getAuditEvent(id)
    if (request === detailRequest) detail.value = data
  } catch (error) {
    if (request !== detailRequest || (await handleAuth(error))) return
    detailMissing.value = error instanceof ApiError && error.status === 404
    detailFailed.value = !detailMissing.value
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}

function closeDetail() {
  detailRequest++
  detail.value = null
}

function operationLabel(value: string) {
  return Object.hasOwn(copy.operations, value)
    ? copy.operations[value as keyof typeof copy.operations]
    : value
}

function targetTypeLabel(value: AuditEventResponse['targetType']) {
  if (!value) return messages.common.unknown
  return Object.hasOwn(copy.targetTypes, value)
    ? copy.targetTypes[value as keyof typeof copy.targetTypes]
    : value
}

function detailValue(event: AuditEventResponse, key: (typeof detailFields)[number]) {
  if (key === 'operationType') return operationLabel(event.operationType)
  if (key === 'targetType') return targetTypeLabel(event.targetType)
  if (key === 'outcome') return copy.outcomes[event.outcome]
  if (key === 'createdAt') return formatDate(event.createdAt)
  return event[key] || messages.common.unknown
}

function totalLabel(total: number) {
  return copy.total.replace('{total}', formatNumber(total))
}

onMounted(search)
onUnmounted(() => {
  listRequest++
  detailRequest++
})
</script>

<template>
  <section class="audit-page" aria-labelledby="audit-title">
    <header>
      <h1 id="audit-title" class="page-title">{{ copy.title }}</h1>
      <p class="page-description">{{ copy.description }}</p>
    </header>

    <form class="filter-panel" @submit.prevent="search">
      <label v-for="field in filterFields" :key="field" class="filter-control">
        <span>{{ copy[field] }}</span>
        <ElSelect
          v-if="field === 'operationType' || field === 'targetType'"
          v-model="filters[field]"
          :aria-label="copy[field]"
        >
          <ElOption :label="copy.allTypes" value="" />
          <ElOption
            v-for="(label, value) in field === 'operationType' ? copy.operations : copy.targetTypes"
            :key="value"
            :label="label"
            :value="value"
          />
        </ElSelect>
        <ElInput
          v-else
          v-model="filters[field]"
          clearable
          :maxlength="field === 'targetId' ? 128 : 64"
        />
      </label>
      <div class="filter-actions">
        <ElButton native-type="button" @click="reset">{{ copy.reset }}</ElButton>
        <ElButton type="primary" native-type="submit">{{ copy.search }}</ElButton>
      </div>
    </form>

    <div class="table-card" :aria-busy="loading">
      <p class="privacy-note">{{ copy.privacy }}</p>
      <ElSkeleton v-if="loading" animated :rows="7" />
      <StatePanel
        v-else-if="failed"
        :title="copy.errorTitle"
        :description="messages.errors.generic"
        tone="danger"
      >
        <template #actions>
          <ElButton @click="loadEvents()">{{ messages.common.retry }}</ElButton>
        </template>
      </StatePanel>
      <StatePanel
        v-else-if="result.items.length === 0"
        :title="copy.emptyTitle"
        :description="copy.emptyDescription"
      />
      <template v-else>
        <div class="table-scroll">
          <ElTable :data="result.items" row-key="id">
            <ElTableColumn :label="copy.operationType" min-width="175">
              <template #default="scope">{{ operationLabel(scope.row.operationType) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="operatorId" :label="copy.operatorId" min-width="160" />
            <ElTableColumn :label="copy.targetType" min-width="150">
              <template #default="scope">{{ targetTypeLabel(scope.row.targetType) }}</template>
            </ElTableColumn>
            <ElTableColumn :label="copy.targetId" min-width="170">
              <template #default="scope">{{
                scope.row.targetId || messages.common.unknown
              }}</template>
            </ElTableColumn>
            <ElTableColumn :label="copy.outcome" width="140">
              <template #default="scope">
                <ElTag
                  :type="
                    scope.row.outcome === 'success'
                      ? 'success'
                      : scope.row.outcome === 'failure'
                        ? 'danger'
                        : 'info'
                  "
                >
                  {{ copy.outcomes[scope.row.outcome as AuditEventResponse['outcome']] }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn :label="copy.createdAt" min-width="200">
              <template #default="scope">{{ formatDate(scope.row.createdAt) }}</template>
            </ElTableColumn>
            <ElTableColumn :label="messages.users.action" width="110" fixed="right">
              <template #default="scope">
                <ElButton link type="primary" @click="openDetail(scope.row.id)">
                  {{ messages.common.view }}
                </ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>
        <footer class="pagination-bar">
          <span>{{ totalLabel(result.total) }}</span>
          <ElPagination
            :current-page="result.page"
            :page-size="result.size"
            :total="result.total"
            layout="prev, pager, next"
            @current-change="loadEvents"
          />
        </footer>
      </template>
    </div>

    <ElDrawer
      v-model="drawerOpen"
      :title="copy.detailTitle"
      size="min(36rem, 100%)"
      @close="closeDetail"
    >
      <ElSkeleton v-if="detailLoading" animated :rows="8" />
      <StatePanel
        v-else-if="detailMissing"
        :title="copy.notFound"
        :description="copy.emptyDescription"
      />
      <StatePanel
        v-else-if="detailFailed"
        :title="copy.errorTitle"
        :description="messages.errors.generic"
        tone="danger"
      >
        <template #actions>
          <ElButton @click="openDetail(detailId)">{{ messages.common.retry }}</ElButton>
        </template>
      </StatePanel>
      <template v-else-if="detail">
        <p class="privacy-note">{{ copy.privacy }}</p>
        <dl class="detail-fields">
          <div v-for="field in detailFields" :key="field">
            <dt>{{ copy[field] }}</dt>
            <dd>{{ detailValue(detail, field) }}</dd>
          </div>
        </dl>
      </template>
    </ElDrawer>
  </section>
</template>

<style scoped>
.audit-page {
  display: grid;
  gap: var(--space-6);
}

.filter-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.filter-control {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.filter-actions {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
}

.table-card {
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.privacy-note {
  margin: 0 0 var(--space-4);
  color: var(--color-text-muted);
  font-size: 0.82rem;
}

.table-scroll {
  overflow-x: auto;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-top: var(--space-4);
  color: var(--color-text-muted);
  font-size: 0.82rem;
}

.detail-fields {
  display: grid;
  gap: var(--space-5);
}

.detail-fields dt {
  color: var(--color-text-muted);
  font-size: 0.82rem;
}

.detail-fields dd {
  margin: var(--space-2) 0 0;
  overflow-wrap: anywhere;
}

@media (width <= 40rem) {
  .filter-panel {
    grid-template-columns: 1fr;
  }

  .pagination-bar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
