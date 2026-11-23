<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElSkeleton } from 'element-plus'

import { getOverview, type OverviewResponse } from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { formatDate, formatNumber, messages } from '@/locales'

const copy = messages.overview
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const result = ref<OverviewResponse | null>(null)
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
    const response = await getOverview()
    if (current === requestId) result.value = response
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
      <p>{{ copy.description }}</p>
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
      <p>{{ copy.accessNote }}</p>
      <section class="panel">
        <h2>{{ copy.runtime }}</h2>
        <p>{{ copy.accountAvailable }}</p>
        <p>{{ copy.downstreamUnknown }}</p>
      </section>
      <section class="panel">
        <h2>{{ copy.insights }}</h2>
        <p v-if="!result.insightsEnabled">{{ copy.insightsDisabled }}</p>
        <p v-else-if="result.insights.length === 0">{{ copy.noInsights }}</p>
        <ul v-else>
          <li v-for="insight in result.insights" :key="insight.rule">
            <p>{{ copy.rules[insight.rule] }}</p>
            <p>{{ copy.count }}: {{ formatNumber(insight.count) }}</p>
            <RouterLink
              :to="{
                name:
                  insight.rule === 'missing_callbacks'
                    ? 'applications'
                    : insight.rule === 'long_disabled_users'
                      ? 'users'
                      : 'audit-events',
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
        <p>{{ copy.failureLimit }}</p>
        <p v-if="result.failureEvents.length === 0">{{ copy.noFailures }}</p>
        <ul v-else>
          <li v-for="event in result.failureEvents" :key="event.id">
            {{ formatDate(event.createdAt) }} · {{ operationLabel(event.operationType) }}
            <RouterLink :to="{ name: 'audit-events', query: { eventId: event.id } }">
              {{ copy.evidence }}
            </RouterLink>
          </li>
        </ul>
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
</style>
