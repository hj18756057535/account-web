<script setup lang="ts">
import { ElButton } from 'element-plus'
import StatePanel from './StatePanel.vue'
import { zhCN } from '@/locales/zh-CN'
</script>

<template>
  <main class="standalone-state">
    <StatePanel :title="zhCN.errors.notFoundTitle" :description="zhCN.errors.notFoundDescription">
      <template #actions>
        <RouterLink :to="{ name: 'users' }"
          ><ElButton type="primary">{{ zhCN.navigation.users }}</ElButton></RouterLink
        >
      </template>
    </StatePanel>
  </main>
</template>

<style scoped>
.standalone-state {
  width: min(42rem, calc(100% - 2rem));
  margin: 15vh auto;
}
</style>
