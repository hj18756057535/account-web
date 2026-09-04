<script setup lang="ts">
import { ElButton } from 'element-plus'
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
      <RouterLink :to="{ name: 'users' }"
        ><ElButton>{{ messages.common.back }}</ElButton></RouterLink
      >
    </template>
  </StatePanel>
</template>
