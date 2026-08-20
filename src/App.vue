<script setup lang="ts">
import { zhCN } from '@/locales/zh-CN'

const copy = zhCN.foundation
</script>

<template>
  <main class="foundation" aria-labelledby="foundation-title">
    <section class="foundation__card">
      <p class="foundation__eyebrow">{{ copy.eyebrow }}</p>
      <h1 id="foundation-title">{{ copy.title }}</h1>
      <p class="foundation__description">{{ copy.description }}</p>
      <p class="foundation__status" role="status">{{ copy.status }}</p>
    </section>
  </main>
</template>

<style scoped>
.foundation__card {
  width: min(42rem, 100%);
  padding: var(--space-8);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
</style>
