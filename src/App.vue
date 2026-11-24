<script setup lang="ts">
import { computed } from 'vue'
import { ElConfigProvider } from 'element-plus'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import zhTw from 'element-plus/es/locale/lang/zh-tw'
import vi from 'element-plus/es/locale/lang/vi'
import { locale } from '@/locales'

const componentLocales = { 'zh-CN': zhCn, 'zh-TW': zhTw, 'en-US': en, 'vi-VN': vi }
const componentLocale = computed(() => componentLocales[locale.value])
</script>

<template>
  <ElConfigProvider :locale="componentLocale">
    <RouterView />
  </ElConfigProvider>
</template>
