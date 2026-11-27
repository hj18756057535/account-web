<script setup lang="ts">
import { computed } from 'vue'
import type { ApplicationResponse } from '@/api/account'
import { messages } from '@/locales'

const props = defineProps<{
  application: Pick<ApplicationResponse, 'entryUrl' | 'status' | 'secretState' | 'name'>
}>()

const validUrl = computed(() => {
  try {
    const url = new URL(props.application.entryUrl)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
})
const available = computed(
  () =>
    validUrl.value &&
    props.application.status === 'enabled' &&
    props.application.secretState === 'active',
)
</script>

<template>
  <a
    v-if="available"
    class="action-link"
    :href="application.entryUrl"
    target="_blank"
    rel="noopener noreferrer"
    :title="messages.applications.openInNewTab"
    :aria-label="`${messages.applications.enter} ${application.name} (${messages.applications.openInNewTab})`"
  >
    {{ messages.applications.enter }}<span aria-hidden="true">↗</span>
  </a>
  <button
    v-else
    type="button"
    class="action-link"
    disabled
    :title="validUrl ? messages.applications.entryDisabled : messages.applications.entryUnavailable"
  >
    {{ messages.applications.enter }}<span aria-hidden="true">↗</span>
  </button>
</template>
