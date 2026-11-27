<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElSkeleton, ElTable, ElTableColumn, ElTag } from 'element-plus'

import {
  getOverview,
  listApplications,
  type ApplicationResponse,
  type OverviewResponse,
} from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { formatDate, formatNumber, messages } from '@/locales'

const copy = messages.overview
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const result = ref<OverviewResponse | null>(null)
const applications = ref<ApplicationResponse[]>([])
const distributions = computed(() =>
  result.value
    ? [
        {
          label: copy.userDistribution,
          total: result.value.counts.users,
          disabled: result.value.counts.disabledUsers,
        },
        {
          label: copy.applicationDistribution,
          total: result.value.counts.applications,
          disabled: result.value.counts.disabledApplications,
        },
      ]
    : [],
)
const loading = ref(true)
const failed = ref(false)
const metrics = [
  'users',
  'disabledUsers',
  'applications',
  'disabledApplications',
  'grantedAccess',
] as const
let requestId = 0

function protocolLabel(value: ApplicationResponse['protocolCapabilities'][number]) {
  const labels = {
    sso: messages.applications.protocolSso,
    admin_ticket: messages.applications.protocolAdminTicket,
    user_sync: messages.applications.protocolUserSync,
    directory: messages.applications.protocolDirectory,
    menu_permission_v1: messages.applications.protocolMenuPermission,
  }
  return labels[value] || value
}

function operationLabel(value: string) {
  return Object.hasOwn(messages.audit.operations, value)
    ? messages.audit.operations[value as keyof typeof messages.audit.operations]
    : value
}

async function load() {
  const current = ++requestId
  loading.value = true
  failed.value = false
  try {
    const [response, apps] = await Promise.all([getOverview(), listApplications()])
    if (current === requestId) {
      result.value = response
      applications.value = apps
    }
  } catch (error) {
    if (current !== requestId) return
    if (error instanceof ApiError && error.status === 401) {
      session.expire()
      await router.replace({ name: 'login', query: { redirect: route.fullPath } })
    } else if (error instanceof ApiError && error.status === 403) {
      await router.replace({ name: 'forbidden' })
    } else failed.value = true
  } finally {
    if (current === requestId) loading.value = false
  }
}

onMounted(() => void load())
onUnmounted(() => requestId++)
</script>

<template>
  <section class="overview">
    <header>
      <h1>{{ copy.title }}</h1>
      <ElButton :loading="loading" @click="load">{{ messages.common.retry }}</ElButton>
    </header>
    <ElSkeleton v-if="loading" :rows="6" animated />
    <StatePanel
      v-else-if="failed"
      :title="copy.failed"
      :description="copy.failedDescription"
      tone="danger"
    >
      <template #actions>
        <ElButton @click="load">{{ messages.common.retry }}</ElButton>
      </template>
    </StatePanel>
    <template v-else-if="result">
      <p>{{ copy.sampledAt }}: {{ formatDate(result.sampledAt) }}</p>
      <p v-if="result.counts.users === 0 && result.counts.applications === 0">{{ copy.empty }}</p>
      <dl class="metrics">
        <div v-for="key in metrics" :key="key" class="panel">
          <dt>{{ copy[key] }}</dt>
          <dd>{{ formatNumber(result.counts[key]) }}</dd>
        </div>
      </dl>
      <div class="distributions">
        <section v-for="chart in distributions" :key="chart.label" class="panel distribution">
          <h2>{{ chart.label }}</h2>
          <svg
            viewBox="0 0 120 120"
            role="img"
            :aria-label="`${chart.label}: ${formatNumber(chart.total - chart.disabled)} / ${formatNumber(chart.total)}`"
          >
            <circle class="chart-track" cx="60" cy="60" r="46" />
            <circle
              class="chart-value"
              cx="60"
              cy="60"
              r="46"
              pathLength="100"
              :stroke-dasharray="`${chart.total ? ((chart.total - chart.disabled) / chart.total) * 100 : 0} 100`"
            />
            <text x="60" y="66" text-anchor="middle">{{ formatNumber(chart.total) }}</text>
          </svg>
          <dl class="chart-legend">
            <div>
              <dt>{{ messages.common.enabled }}</dt>
              <dd>{{ formatNumber(chart.total - chart.disabled) }}</dd>
            </div>
            <div>
              <dt>{{ messages.common.disabled }}</dt>
              <dd>{{ formatNumber(chart.disabled) }}</dd>
            </div>
          </dl>
        </section>
      </div>
      <section class="panel">
        <h2>{{ copy.applicationTable }}</h2>
        <ElTable :data="applications" row-key="appCode" :empty-text="messages.access.empty">
          <ElTableColumn prop="name" :label="copy.applicationName" min-width="160" />
          <ElTableColumn prop="appCode" :label="messages.applications.appCode" min-width="130" />
          <ElTableColumn :label="messages.applications.status" min-width="100">
            <template #default="{ row }">
              <ElTag :type="row.status === 'enabled' ? 'success' : 'info'">{{
                row.status === 'enabled' ? messages.common.enabled : messages.common.disabled
              }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn :label="copy.capabilities" min-width="220">
            <template #default="{ row }">
              <span>{{ row.protocolCapabilities.map(protocolLabel).join(' · ') }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn :label="copy.actions" min-width="260">
            <template #default="{ row }">
              <div class="row-actions">
                <RouterLink
                  v-if="session.hasCapability('applications:read')"
                  class="action-link"
                  :to="{ name: 'integration-debug', query: { appCode: row.appCode } }"
                >
                  {{ messages.navigation.data }}
                </RouterLink>
                <RouterLink
                  v-if="session.hasCapability('application-access:read')"
                  class="action-link"
                  :to="{ name: 'user-authorization', query: { appCode: row.appCode } }"
                >
                  {{ messages.navigation.access }}
                </RouterLink>
              </div>
            </template>
          </ElTableColumn>
        </ElTable>
      </section>
      <section v-if="result.insights.length" class="panel">
        <h2>{{ copy.insights }}</h2>
        <p v-if="!result.insightsEnabled">{{ copy.insightsDisabled }}</p>
        <p v-else-if="result.insights.length === 0">{{ copy.noInsights }}</p>
        <ul v-else>
          <li v-for="insight in result.insights" :key="insight.rule">
            <p>{{ copy.rules[insight.rule] }}</p>
            <p>{{ copy.count }}: {{ formatNumber(insight.count) }}</p>
            <RouterLink
              v-if="insight.rule !== 'long_disabled_users' || session.hasCapability('users:read')"
              class="action-link"
              :to="{
                name: insight.rule === 'long_disabled_users' ? 'users' : 'audit-events',
              }"
            >
              {{ copy.evidence }}
            </RouterLink>
          </li>
        </ul>
      </section>
      <section class="panel">
        <h2>{{ copy.failures }}: {{ formatNumber(result.recentFailures) }}</h2>
        <p>{{ copy.failureWindow }}: {{ formatDate(result.failuresSince) }}</p>
        <ElTable :data="result.failureEvents" row-key="id" :empty-text="copy.noFailures">
          <ElTableColumn :label="copy.eventTime" min-width="200"
            ><template #default="{ row }">{{ formatDate(row.createdAt) }}</template></ElTableColumn
          >
          <ElTableColumn :label="copy.eventOperation" min-width="180"
            ><template #default="{ row }">{{
              operationLabel(row.operationType)
            }}</template></ElTableColumn
          >
          <ElTableColumn prop="targetId" :label="copy.eventTarget" min-width="180" />
          <ElTableColumn :label="copy.actions" min-width="180">
            <template #default="{ row }">
              <RouterLink
                class="action-link"
                :to="{ name: 'audit-events', query: { eventId: row.id } }"
              >
                {{ copy.evidence }}
              </RouterLink>
            </template>
          </ElTableColumn>
        </ElTable>
      </section>
    </template>
  </section>
</template>

<style scoped>
.overview {
  display: grid;
  gap: var(--space-4);
}

.metrics {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  margin: 0;
}

.panel {
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  overflow-wrap: anywhere;
}

dd {
  margin: var(--space-3) 0 0;
  font-size: 2rem;
  font-weight: 700;
}

li + li {
  margin-top: var(--space-4);
}

.distributions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: var(--space-4);
}

.distribution {
  display: grid;
  grid-template-columns: 8rem 1fr;
  align-items: center;
  gap: var(--space-4);
}

.distribution h2 {
  grid-column: 1 / -1;
  font-size: 1rem;
}

.distribution svg {
  width: 8rem;
  fill: var(--color-text);
}

.distribution circle {
  fill: none;
  stroke-width: 14;
}

.chart-track {
  stroke: var(--color-border);
}

.chart-value {
  transform: rotate(-90deg);
  transform-origin: center;
  stroke: var(--color-brand);
}

.chart-legend {
  display: grid;
  gap: var(--space-3);
}

.chart-legend div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}

.chart-legend dd {
  margin: 0;
  font-size: 1rem;
}
</style>
