<script setup lang="ts">
import { ElButton } from 'element-plus'
import StatePanel from './StatePanel.vue'
import { zhCN } from '@/locales/zh-CN'
</script>

<template>
  <StatePanel
    :title="zhCN.errors.forbiddenTitle"
    :description="zhCN.errors.forbiddenDescription"
    tone="warning"
  >
    <template #actions>
      <RouterLink :to="{ name: 'users' }"
        ><ElButton>{{ zhCN.common.back }}</ElButton></RouterLink
      >
    </template>
  </StatePanel>
</template>
