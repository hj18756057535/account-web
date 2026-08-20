<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description: string
    tone?: 'neutral' | 'danger' | 'warning'
  }>(),
  { tone: 'neutral' },
)
</script>

<template>
  <section class="state-panel" :class="`state-panel--${tone}`" role="status">
    <span class="state-panel__symbol" aria-hidden="true"></span>
    <div>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
      <div v-if="$slots.actions" class="state-panel__actions">
        <slot name="actions" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.state-panel {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-muted);
}

.state-panel--danger {
  border-color: #ffd2cc;
  background: var(--color-danger-soft);
}

.state-panel--warning {
  border-color: #f9dfae;
  background: var(--color-warning-soft);
}

.state-panel__symbol {
  width: 0.75rem;
  height: 0.75rem;
  flex: 0 0 auto;
  margin-top: 0.35rem;
  border-radius: 50%;
  background: var(--color-brand);
  box-shadow: 0 0 0 0.35rem rgb(37 99 235 / 12%);
}

.state-panel--danger .state-panel__symbol {
  background: var(--color-danger);
  box-shadow: 0 0 0 0.35rem rgb(180 35 24 / 10%);
}

.state-panel--warning .state-panel__symbol {
  background: var(--color-warning);
  box-shadow: 0 0 0 0.35rem rgb(180 83 9 / 10%);
}

h2 {
  margin: 0;
  font-size: 1rem;
}

p {
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
}

.state-panel__actions {
  margin-top: var(--space-4);
}
</style>
