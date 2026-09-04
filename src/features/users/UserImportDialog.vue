<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElAlert, ElButton, ElDialog, ElTable, ElTableColumn } from 'element-plus'
import {
  commitUserImport,
  downloadUserImportTemplate,
  getUserImport,
  previewUserImport,
  type UserImportPreview,
  type UserImportResult,
} from '@/api/account'
import { ApiError } from '@/api/http'
import { useSessionStore } from '@/features/session/session.store'
import { formatNumber, locale, messages } from '@/locales'
import { userImportErrorKey } from './user-import-errors'

const emit = defineEmits<{ imported: [] }>()
const session = useSessionStore()
const copy = messages.imports
const open = ref(false)
const busy = ref(false)
const file = ref<File>()
const preview = ref<UserImportPreview>()
const result = ref<UserImportResult>()
const errorKey = ref<keyof typeof copy>()

function fieldLabel(field: string) {
  if (field === 'account' || field === 'email' || field === 'name' || field === 'phone') {
    return messages.users[field]
  }
  return field
}
let uploadKey = ''
let commitKey = ''
let revision = 0

function reset() {
  revision++
  file.value = undefined
  preview.value = undefined
  result.value = undefined
  errorKey.value = undefined
  uploadKey = ''
  commitKey = ''
}

function selectFile(event: Event) {
  reset()
  const selected = (event.target as HTMLInputElement).files?.[0]
  if (!selected) return
  if (!selected.name.toLowerCase().endsWith('.xlsx') || selected.size > 5 * 1024 * 1024) {
    errorKey.value = 'fileInvalid'
    return
  }
  file.value = selected
  uploadKey = crypto.randomUUID()
}

function failed(error: unknown) {
  errorKey.value = userImportErrorKey(error)
  if (!(error instanceof ApiError)) return
  if (error.status === 401) session.expire()
  if (errorKey.value === 'expired' || errorKey.value === 'conflict') {
    preview.value = undefined
    uploadKey = crypto.randomUUID()
  }
}

async function download() {
  busy.value = true
  errorKey.value = undefined
  try {
    const blob = await downloadUserImportTemplate()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'users-template.xlsx'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    failed(error)
  } finally {
    busy.value = false
  }
}

async function upload() {
  if (!file.value || busy.value) return
  busy.value = true
  errorKey.value = undefined
  const current = ++revision
  try {
    const response = await previewUserImport(file.value, session.csrfToken, uploadKey)
    if (revision !== current) return
    preview.value = response
    commitKey = crypto.randomUUID()
  } catch (error) {
    if (revision === current) failed(error)
  } finally {
    if (revision === current) busy.value = false
  }
}

async function commit() {
  if (!preview.value?.valid || busy.value) return
  busy.value = true
  errorKey.value = undefined
  const current = ++revision
  try {
    const response = await commitUserImport(preview.value.importId, session.csrfToken, commitKey)
    if (revision !== current) return
    result.value = response
    preview.value = undefined
    file.value = undefined
    emit('imported')
  } catch (error) {
    if (revision === current) failed(error)
  } finally {
    if (revision === current) busy.value = false
  }
}

watch(locale, async () => {
  if (!preview.value || busy.value) return
  const current = ++revision
  busy.value = true
  try {
    const response = await getUserImport(preview.value.importId)
    if (revision === current) preview.value = response
  } catch (error) {
    if (revision === current) failed(error)
  } finally {
    if (revision === current) busy.value = false
  }
})
onBeforeUnmount(() => revision++)
</script>

<template>
  <ElButton @click="open = true">{{ copy.title }}</ElButton>
  <ElDialog
    v-model="open"
    :title="copy.title"
    width="min(960px, 95vw)"
    :show-close="!busy"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    destroy-on-close
    @closed="reset"
  >
    <p>{{ copy.description }}</p>
    <p>{{ copy.credentials }}</p>
    <ElAlert v-if="errorKey" :title="copy[errorKey]" type="error" :closable="false" />
    <template v-if="!result">
      <p>
        <ElButton :disabled="busy" @click="download">{{ copy.download }}</ElButton>
      </p>
      <label>
        {{ copy.file }}
        <input type="file" accept=".xlsx" :disabled="busy" @change="selectFile" />
      </label>
      <p>
        <ElButton :disabled="!file || busy" :loading="busy" @click="upload">
          {{ copy.preview }}
        </ElButton>
      </p>
    </template>
    <template v-if="preview">
      <p>{{ copy.count.replace('{count}', formatNumber(preview.rowCount)) }}</p>
      <p>
        {{ copy.expires.replace('{time}', new Date(preview.expiresAt).toLocaleString(locale)) }}
      </p>
      <ElAlert
        :title="preview.valid ? copy.valid : copy.invalid"
        :type="preview.valid ? 'success' : 'warning'"
        :closable="false"
      />
      <ElTable :data="preview.rows" max-height="400" row-key="rowNumber">
        <ElTableColumn prop="rowNumber" :label="copy.row" width="70" />
        <ElTableColumn prop="account" :label="messages.users.account" />
        <ElTableColumn prop="email" :label="messages.users.email" />
        <ElTableColumn prop="name" :label="messages.users.name" />
        <ElTableColumn prop="phone" :label="messages.users.phone" />
        <ElTableColumn :label="copy.errors" min-width="220">
          <template #default="{ row }">
            <div v-for="(error, index) in row.errors" :key="index">
              {{ fieldLabel(error.field) }}: {{ error.message }}
            </div>
          </template>
        </ElTableColumn>
      </ElTable>
    </template>
    <ElAlert
      v-if="result"
      :title="copy.success.replace('{count}', formatNumber(result.createdCount))"
      type="success"
      :closable="false"
    />
    <template #footer>
      <ElButton :disabled="busy" @click="open = false">{{ copy.close }}</ElButton>
      <ElButton
        v-if="preview && !result"
        type="primary"
        :disabled="!preview.valid || busy"
        :loading="busy"
        @click="commit"
      >
        {{ copy.commit }}
      </ElButton>
    </template>
  </ElDialog>
</template>
