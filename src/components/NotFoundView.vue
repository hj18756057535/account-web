<script setup lang="ts">
import { ElButton } from 'element-plus'
import StatePanel from './StatePanel.vue'
import { messages } from '@/locales'
</script>

<template>
  <main class="standalone-state">
    <StatePanel
      :title="messages.errors.notFoundTitle"
      :description="messages.errors.notFoundDescription"
    >
      <template #actions>
        <RouterLink :to="{ name: 'users' }"
          ><ElButton type="primary">{{ messages.navigation.users }}</ElButton></RouterLink
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
