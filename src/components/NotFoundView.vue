<script setup lang="ts">
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
        <RouterLink class="action-link action-link--primary" :to="{ name: 'users' }">
          {{ messages.navigation.users }}
        </RouterLink>
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
