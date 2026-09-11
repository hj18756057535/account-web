<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElButton, ElDialog, ElSkeleton, ElTag, ElTree, type TreeInstance } from 'element-plus'

import {
  getUserApplicationMenuPermissions,
  replaceUserApplicationMenuPermissions,
  type ApplicationAccessResponse,
  type MenuPermissionNode,
  type MenuPermissionResponse,
} from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { locale, messages } from '@/locales'

interface PermissionTreeNode extends MenuPermissionNode {
  label: string
  disabled: boolean
  children: PermissionTreeNode[]
}

const props = defineProps<{
  userId: string
  access: ApplicationAccessResponse
}>()
const emit = defineEmits<{ authError: [error: ApiError] }>()
const sessionStore = useSessionStore()
const copy = messages.menuPermissions
const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const failed = ref(false)
const conflict = ref(false)
const saved = ref(false)
const errorMessage = ref('')
const snapshot = ref<MenuPermissionResponse>()
const checkedCodes = ref<string[]>([])
const treeRef = ref<TreeInstance>()
const treeGeneration = ref(0)
const requestKey = ref('')
let generation = 0

const treeData = computed(() => {
  const source = snapshot.value
  if (!source) return []
  const inherited = new Set(source.inheritedCodes)
  const byCode = new Map<string, PermissionTreeNode>()
  for (const node of source.nodes) {
    byCode.set(node.code, {
      ...node,
      label: node.localizedNames[locale.value] || node.defaultName,
      disabled: inherited.has(node.code) || !node.assignable,
      children: [],
    })
  }
  const roots: PermissionTreeNode[] = []
  for (const node of byCode.values()) {
    const parent = node.parentCode ? byCode.get(node.parentCode) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
})

function applySnapshot(value: MenuPermissionResponse) {
  snapshot.value = value
  checkedCodes.value = [...new Set([...value.selectedCodes, ...value.inheritedCodes])]
  treeGeneration.value++
}

async function open() {
  visible.value = true
  await load()
}

async function load() {
  const current = ++generation
  loading.value = true
  failed.value = false
  conflict.value = false
  saved.value = false
  errorMessage.value = ''
  requestKey.value = ''
  try {
    const result = await getUserApplicationMenuPermissions(props.userId, props.access.appCode)
    if (current === generation) applySnapshot(result)
  } catch (error) {
    if (current !== generation || handleAuthError(error)) return
    snapshot.value = undefined
    failed.value = true
    errorMessage.value = permissionError(error)
  } finally {
    if (current === generation) loading.value = false
  }
}

function handleAuthError(error: unknown) {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    visible.value = false
    emit('authError', error)
    return true
  }
  return false
}

function updateChecked(_node: PermissionTreeNode, state: { checkedKeys: Array<string | number> }) {
  checkedCodes.value = state.checkedKeys.map(String)
  saved.value = false
}

function selectedForSave() {
  const current = snapshot.value
  if (!current) return []
  const nodes = new Map(current.nodes.map((node) => [node.code, node]))
  const inherited = new Set(current.inheritedCodes)
  const existingSelected = new Set(current.selectedCodes)
  return checkedCodes.value.filter((code) => {
    const node = nodes.get(code)
    return node?.assignable && (!inherited.has(code) || existingSelected.has(code))
  })
}

async function save() {
  if (!snapshot.value || saving.value) return
  const current = generation
  saving.value = true
  failed.value = false
  conflict.value = false
  saved.value = false
  errorMessage.value = ''
  const idempotencyKey = requestKey.value || crypto.randomUUID()
  requestKey.value = idempotencyKey
  try {
    const result = await replaceUserApplicationMenuPermissions(
      props.userId,
      props.access.appCode,
      {
        expectedAccessVersion: snapshot.value.accessVersion,
        expectedCatalogRevision: snapshot.value.catalogRevision,
        expectedPermissionRevision: snapshot.value.permissionRevision,
        selectedCodes: selectedForSave(),
      },
      sessionStore.csrfToken,
      idempotencyKey,
    )
    if (current !== generation) return
    applySnapshot(result)
    requestKey.value = ''
    saved.value = true
  } catch (error) {
    if (current !== generation || handleAuthError(error)) return
    conflict.value = error instanceof ApiError && error.status === 409
    failed.value = !conflict.value
    errorMessage.value = permissionError(error)
  } finally {
    if (current === generation) saving.value = false
  }
}

function permissionError(error: unknown) {
  if (!(error instanceof ApiError)) return copy.unavailable
  if (error.code === 'MENU_PERMISSION_PREREQUISITE_NOT_MET') return copy.prerequisite
  if (error.code === 'SUBJECT_UNMANAGEABLE') return copy.unmanageable
  if (error.code === 'PROTOCOL_VERSION_UNSUPPORTED') return copy.unsupported
  if (['PERMISSION_CODE_INVALID', 'CATALOG_INVALID', 'PAYLOAD_TOO_LARGE'].includes(error.code))
    return copy.invalid
  return copy.unavailable
}

function close() {
  generation++
  visible.value = false
  loading.value = false
  saving.value = false
}

onBeforeUnmount(() => generation++)
</script>

<template>
  <ElButton type="primary" plain @click="open">{{ copy.open }}</ElButton>
  <ElDialog
    v-model="visible"
    :title="copy.title"
    width="min(46rem, calc(100vw - 2rem))"
    :close-on-click-modal="!saving"
    destroy-on-close
    @closed="close"
  >
    <div class="permission-dialog" :aria-busy="loading || saving">
      <p>{{ copy.description }}</p>
      <div class="legend" :aria-label="copy.legend">
        <ElTag type="primary">{{ copy.managed }}</ElTag>
        <ElTag type="info">{{ copy.inherited }}</ElTag>
      </div>
      <ElSkeleton v-if="loading" animated :rows="6" />
      <StatePanel
        v-else-if="failed && !snapshot"
        :title="copy.loadFailed"
        :description="errorMessage"
        tone="danger"
      >
        <template #actions
          ><ElButton @click="load">{{ messages.common.retry }}</ElButton></template
        >
      </StatePanel>
      <StatePanel
        v-else-if="snapshot && !snapshot.nodes.length"
        :title="copy.empty"
        :description="copy.emptyDescription"
      />
      <ElTree
        v-else-if="snapshot"
        :key="treeGeneration"
        ref="treeRef"
        class="permission-tree"
        node-key="code"
        :data="treeData"
        :props="{ children: 'children', label: 'label', disabled: 'disabled' }"
        :default-checked-keys="checkedCodes"
        show-checkbox
        check-strictly
        default-expand-all
        @check="updateChecked"
      >
        <template #default="{ data }">
          <span class="tree-node">
            <span>{{ data.label }}</span>
            <small>{{ copy.nodeTypes[data.nodeType as MenuPermissionNode['nodeType']] }}</small>
            <ElTag v-if="snapshot?.inheritedCodes.includes(data.code)" size="small" type="info">
              {{ copy.inherited }}
            </ElTag>
          </span>
        </template>
      </ElTree>
      <p v-if="conflict" class="feedback danger" role="alert">{{ copy.conflict }}</p>
      <p v-else-if="failed" class="feedback danger" role="alert">
        {{ errorMessage || copy.saveFailed }}
      </p>
      <p v-if="saved" class="feedback success" role="status">{{ copy.saved }}</p>
    </div>
    <template #footer>
      <ElButton :disabled="saving" @click="visible = false">{{ messages.common.cancel }}</ElButton>
      <ElButton v-if="conflict" :disabled="saving" @click="load">{{ copy.reload }}</ElButton>
      <ElButton
        v-if="snapshot && snapshot.nodes.length"
        type="primary"
        :loading="saving"
        :disabled="loading || conflict"
        @click="save"
      >
        {{ saving ? messages.common.saving : messages.common.save }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.permission-dialog {
  display: grid;
  gap: var(--space-4);
}

.permission-dialog > p {
  margin: 0;
  color: var(--color-text-muted);
}

.legend,
.tree-node {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.permission-tree {
  max-height: min(32rem, 55vh);
  padding: var(--space-3);
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}

.tree-node small {
  color: var(--color-text-muted);
}

.feedback {
  margin: 0;
}

.danger {
  color: var(--color-danger);
}

.success {
  color: var(--color-success);
}
</style>
