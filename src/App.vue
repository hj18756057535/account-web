<script setup lang="ts">
import { computed } from 'vue'
import { ElConfigProvider } from 'element-plus'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { locale } from '@/locales'

const componentLocale = computed(() => (locale.value === 'en-US' ? en : zhCn))
</script>

<template>
  <ElConfigProvider :locale="componentLocale">
    <RouterView />
  </ElConfigProvider>
</template>
