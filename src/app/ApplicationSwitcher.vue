<script setup lang="ts">
import { ref } from 'vue'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus'

import { getMyApplications, type UserApplicationEntry } from '@/api/account'
import { ApiError } from '@/api/http'
import { messages } from '@/locales'

const emit = defineEmits<{ select: [entryUrl: string]; unauthorized: [] }>()
const copy = messages.applicationSwitcher
const applications = ref<UserApplicationEntry[]>([])
const loading = ref(false)
const failed = ref(false)

async function load(visible = true) {
  if (!visible || loading.value) return
  loading.value = true
  failed.value = false
  applications.value = []
  try {
    applications.value = await getMyApplications()
  } catch (error) {
    failed.value = true
    if (error instanceof ApiError && error.status === 401) emit('unauthorized')
  } finally {
    loading.value = false
  }
}

function select(appCode: unknown) {
  const application = applications.value.find((entry) => entry.appCode === appCode)
  if (application) emit('select', application.entryUrl)
}
</script>

<template>
  <ElDropdown
    class="application-switcher"
    trigger="click"
    :hide-on-click="false"
    @visible-change="load"
    @command="select"
  >
    <slot />
    <template #dropdown>
      <ElDropdownMenu class="application-menu">
        <ElDropdownItem v-if="loading" disabled>{{ copy.loading }}</ElDropdownItem>
        <ElDropdownItem v-else-if="failed" @click="load()">{{ copy.retry }}</ElDropdownItem>
        <ElDropdownItem v-else-if="!applications.length" disabled>{{ copy.empty }}</ElDropdownItem>
        <template v-else>
          <ElDropdownItem
            v-for="application in applications"
            :key="application.appCode"
            :command="application.appCode"
          >
            {{ application.name }}
          </ElDropdownItem>
        </template>
      </ElDropdownMenu>
    </template>
  </ElDropdown>
</template>

<style scoped>
.application-switcher {
  width: 100%;
}

.application-menu {
  max-width: min(24rem, calc(100vw - var(--space-8)));
}

.application-menu :deep(.el-dropdown-menu__item) {
  white-space: normal;
}
</style>
