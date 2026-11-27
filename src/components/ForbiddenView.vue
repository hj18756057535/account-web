<script setup lang="ts">
import StatePanel from './StatePanel.vue'
import { messages } from '@/locales'
</script>

<template>
  <StatePanel
    :title="messages.errors.forbiddenTitle"
    :description="messages.errors.forbiddenDescription"
    tone="warning"
  >
    <template #actions>
      <RouterLink class="action-link" :to="{ name: 'users' }">
        {{ messages.common.back }}
      </RouterLink>
    </template>
  </StatePanel>
</template>
