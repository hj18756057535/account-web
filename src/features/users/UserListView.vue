<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElButton,
  ElInput,
  ElOption,
  ElPagination,
  ElSelect,
  ElSkeleton,
  ElSkeletonItem,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus'

import { listUsers, type UserPageResponse, type UserQuery } from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { formatNumber, messages } from '@/locales'
import UserImportDialog from './UserImportDialog.vue'

const copy = messages.users
const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const loading = ref(true)
const failed = ref(false)
const result = ref<UserPageResponse>({ items: [], page: 1, size: 20, total: 0 })
const filters = reactive<{
  query: string
  status: '' | 'enabled' | 'disabled'
  sort: NonNullable<UserQuery['sort']>
}>({ query: '', status: '', sort: 'createdAt,desc' })

async function loadUsers(page = result.value.page) {
  loading.value = true
  failed.value = false
  try {
    result.value = await listUsers({
      page,
      size: result.value.size,
      query: filters.query.trim() || undefined,
      status: filters.status || undefined,
      sort: filters.sort,
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      sessionStore.expire()
      await router.replace({ name: 'login', query: { redirect: route.fullPath } })
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
  filters.sort = 'createdAt,desc'
  void loadUsers(1)
}

function totalLabel(total: number) {
  return copy.total.replace('{total}', formatNumber(total))
}

onMounted(() => loadUsers(1))
</script>

<template>
  <section class="users-page" aria-labelledby="users-title">
    <header class="page-heading">
      <div>
        <p class="page-eyebrow">{{ copy.eyebrow }}</p>
        <h1 id="users-title" class="page-title">{{ copy.title }}</h1>
        <p class="page-description">{{ copy.description }}</p>
      </div>
      <div class="heading-actions">
        <UserImportDialog
          v-if="sessionStore.hasCapability('users:import')"
          @imported="loadUsers(1)"
        />
        <span class="total-pill">{{ totalLabel(result.total) }}</span>
        <RouterLink v-if="sessionStore.hasCapability('users:write')" :to="{ name: 'user-create' }">
          <ElButton type="primary">{{ messages.common.create }}</ElButton>
        </RouterLink>
      </div>
    </header>

    <form class="filter-panel" @submit.prevent="loadUsers(1)">
      <label class="filter-control filter-control--wide">
        <span>{{ copy.searchLabel }}</span>
        <ElInput v-model="filters.query" clearable :placeholder="copy.searchPlaceholder" />
      </label>
      <label class="filter-control">
        <span>{{ copy.statusLabel }}</span>
        <ElSelect v-model="filters.status">
          <ElOption :label="copy.allStatuses" value="" />
          <ElOption :label="messages.common.enabled" value="enabled" />
          <ElOption :label="messages.common.disabled" value="disabled" />
        </ElSelect>
      </label>
      <label class="filter-control">
        <span>{{ copy.sortLabel }}</span>
        <ElSelect v-model="filters.sort">
          <ElOption :label="copy.newestFirst" value="createdAt,desc" />
          <ElOption :label="copy.accountAscending" value="account,asc" />
        </ElSelect>
      </label>
      <div class="filter-actions">
        <ElButton native-type="button" @click="reset">{{ copy.reset }}</ElButton>
        <ElButton type="primary" native-type="submit">{{ copy.search }}</ElButton>
      </div>
    </form>

    <div class="table-card">
      <ElSkeleton v-if="loading" animated :rows="7">
        <template #template>
          <div class="skeleton-row" v-for="index in 7" :key="index">
            <ElSkeletonItem variant="text" />
            <ElSkeletonItem variant="text" />
            <ElSkeletonItem variant="text" />
          </div>
        </template>
      </ElSkeleton>

      <StatePanel
        v-else-if="failed"
        :title="copy.errorTitle"
        :description="messages.errors.generic"
        tone="danger"
      >
        <template #actions>
          <ElButton @click="loadUsers()">{{ messages.common.retry }}</ElButton>
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
            <ElTableColumn :label="copy.account" min-width="150">
              <template #default="scope">
                <div class="identity-cell">
                  <span class="identity-avatar" aria-hidden="true">{{
                    scope.row.name.slice(0, 1)
                  }}</span>
                  <div>
                    <strong>{{ scope.row.account }}</strong
                    ><small>{{ scope.row.name }}</small>
                  </div>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="email" :label="copy.email" min-width="210" />
            <ElTableColumn prop="phone" :label="copy.phone" min-width="145" />
            <ElTableColumn :label="copy.status" width="105">
              <template #default="scope">
                <ElTag :type="scope.row.status === 'enabled' ? 'success' : 'info'" effect="light">
                  {{
                    scope.row.status === 'enabled'
                      ? messages.common.enabled
                      : messages.common.disabled
                  }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn :label="copy.action" width="115" fixed="right">
              <template #default="scope">
                <RouterLink :to="{ name: 'user-detail', params: { userId: scope.row.id } }">
                  <ElButton link type="primary">{{ messages.common.view }}</ElButton>
                </RouterLink>
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
            @current-change="loadUsers"
          />
        </footer>
      </template>
    </div>
  </section>
</template>

<style scoped>
.users-page {
  display: grid;
  gap: var(--space-6);
}

.page-heading {
  display: flex;
  align-items: flex-end;
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

.total-pill {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-text-muted);
  background: var(--color-surface);
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
}

.heading-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.filter-panel {
  display: grid;
  grid-template-columns: minmax(15rem, 1.4fr) minmax(9rem, 0.55fr) minmax(9rem, 0.55fr) auto;
  gap: var(--space-4);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 0.6rem 1.8rem rgb(37 99 235 / 5%);
}

.filter-control {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.filter-control > span {
  color: var(--color-text-muted);
  font-size: 0.76rem;
  font-weight: 700;
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

.table-scroll {
  overflow-x: auto;
}

.identity-cell {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.identity-cell strong,
.identity-cell small {
  display: block;
}

.identity-cell small {
  margin-top: 0.1rem;
  color: var(--color-text-muted);
}

.identity-avatar {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.7rem;
  color: var(--color-brand-strong);
  background: var(--color-brand-soft);
  font-weight: 800;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-2) 0;
  color: var(--color-text-muted);
  font-size: 0.82rem;
}

.skeleton-row {
  display: grid;
  grid-template-columns: 1fr 1.4fr 0.65fr;
  gap: var(--space-6);
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

@media (width <= 68rem) {
  .filter-panel {
    grid-template-columns: 1fr 1fr;
  }

  .filter-control--wide {
    grid-column: 1 / -1;
  }
}

@media (width <= 40rem) {
  .page-heading,
  .pagination-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .heading-actions {
    flex-wrap: wrap;
  }

  .filter-panel {
    grid-template-columns: 1fr;
  }

  .filter-control--wide {
    grid-column: auto;
  }
}
</style>
