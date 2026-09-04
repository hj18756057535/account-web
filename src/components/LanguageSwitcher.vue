<script setup lang="ts">
import { ElOption, ElSelect } from 'element-plus'
import { locale, messages, setLocale } from '@/locales'
</script>

<template>
  <ElSelect
    class="language-switcher"
    :model-value="locale"
    :aria-label="messages.common.language"
    @update:model-value="setLocale"
  >
    <ElOption
      v-for="(label, value) in messages.common.languages"
      :key="value"
      :label="label"
      :value="value"
    />
  </ElSelect>
</template>

<style scoped>
.language-switcher {
  width: 9rem;
  flex-shrink: 0;
}
</style>
