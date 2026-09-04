<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElForm, ElFormItem, ElInput } from 'element-plus'

import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from './session.store'
import { localizeFeedback, messages } from '@/locales'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'

const copy = messages.login
const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const credentials = reactive({ account: '', password: '' })
const submitting = ref(false)
const errorMessage = ref('')

async function submit() {
  errorMessage.value = ''
  submitting.value = true
  try {
    await sessionStore.login(credentials)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    const safeRedirect =
      redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/users'
    await router.replace(safeRedirect)
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError && error.code === 'INVALID_CREDENTIALS'
        ? copy.invalidCredentials
        : messages.errors.generic
  } finally {
    submitting.value = false
  }
}

async function retryConnection() {
  errorMessage.value = ''
  try {
    await sessionStore.initialize(true)
  } catch {
    // 连接状态由 store 呈现。
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-story" aria-labelledby="login-story-title">
      <div class="login-brand">
        <span class="login-brand__mark" aria-hidden="true"></span>
        <span>{{ messages.brand.name }}</span>
      </div>
      <div class="story-copy">
        <p>{{ copy.eyebrow }}</p>
        <h1 id="login-story-title">{{ messages.brand.product }}</h1>
        <span>{{ copy.story }}</span>
      </div>
      <div class="security-grid">
        <article>
          <span class="security-icon" aria-hidden="true">S</span>
          <div>
            <strong>{{ copy.securityTitle }}</strong>
            <p>{{ copy.securityDescription }}</p>
          </div>
        </article>
        <article>
          <span class="security-icon security-icon--accent" aria-hidden="true">R</span>
          <div>
            <strong>{{ copy.scopeTitle }}</strong>
            <p>{{ copy.scopeDescription }}</p>
          </div>
        </article>
      </div>
    </section>

    <section class="login-form-wrap" aria-labelledby="login-title">
      <div class="login-card">
        <LanguageSwitcher class="login-language" />
        <p class="login-card__eyebrow">{{ copy.eyebrow }}</p>
        <h2 id="login-title">{{ copy.title }}</h2>
        <p class="login-card__description">{{ copy.description }}</p>

        <StatePanel
          v-if="sessionStore.connectionError"
          :title="copy.connectionTitle"
          :description="copy.connectionDescription"
          tone="warning"
        >
          <template #actions>
            <ElButton :loading="sessionStore.loading" @click="retryConnection">
              {{ messages.common.retry }}
            </ElButton>
          </template>
        </StatePanel>

        <ElForm v-else class="login-form" label-position="top" @submit.prevent="submit">
          <ElFormItem :label="copy.account">
            <ElInput
              v-model="credentials.account"
              autocomplete="username"
              :placeholder="copy.accountPlaceholder"
              maxlength="128"
            />
          </ElFormItem>
          <ElFormItem :label="copy.password">
            <ElInput
              v-model="credentials.password"
              type="password"
              autocomplete="current-password"
              :placeholder="copy.passwordPlaceholder"
              maxlength="256"
              show-password
              @keyup.enter="submit"
            />
          </ElFormItem>
          <p v-if="errorMessage" class="login-error" role="alert">
            {{ localizeFeedback(errorMessage) }}
          </p>
          <ElButton
            class="login-submit"
            type="primary"
            native-type="submit"
            :loading="submitting"
            :disabled="!credentials.account || !credentials.password"
          >
            {{ submitting ? copy.submitting : copy.submit }}
          </ElButton>
        </ElForm>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-language {
  margin-bottom: var(--space-4);
}

.login-page {
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(0, 1.05fr) minmax(28rem, 0.95fr);
  background:
    radial-gradient(circle at 15% 15%, rgb(96 165 250 / 26%), transparent 35%),
    radial-gradient(circle at 75% 80%, rgb(8 145 178 / 18%), transparent 28%), #07152f;
}

.login-story {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: clamp(2rem, 6vw, 5.5rem);
  color: #fff;
}

.login-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.login-brand__mark {
  width: 2.25rem;
  height: 2.25rem;
  border: 0.55rem solid rgb(255 255 255 / 95%);
  border-right-color: #38bdf8;
  border-radius: 0.8rem;
  transform: rotate(45deg);
}

.story-copy {
  max-width: 42rem;
  margin: clamp(3rem, 10vh, 8rem) 0;
}

.story-copy p,
.login-card__eyebrow {
  margin: 0 0 var(--space-3);
  color: #7dd3fc;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.story-copy h1 {
  margin: 0;
  font-size: clamp(2.7rem, 6vw, 5.25rem);
  line-height: 0.98;
  letter-spacing: -0.055em;
}

.story-copy span {
  display: block;
  max-width: 34rem;
  margin-top: var(--space-6);
  color: #cbdaf3;
  font-size: clamp(1rem, 1.8vw, 1.25rem);
}

.security-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.security-grid article {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: var(--radius-card);
  background: rgb(255 255 255 / 6%);
}

.security-grid p {
  margin: var(--space-1) 0 0;
  color: #b9cae5;
  font-size: 0.82rem;
}

.security-icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.6rem;
  color: #bfdbfe;
  background: rgb(37 99 235 / 34%);
  font-size: 0.75rem;
  font-weight: 900;
}

.security-icon--accent {
  color: #a5f3fc;
  background: rgb(8 145 178 / 30%);
}

.login-form-wrap {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: var(--space-8);
  border-radius: 2.5rem 0 0 2.5rem;
  background: var(--color-canvas);
}

.login-card {
  width: min(30rem, 100%);
  padding: clamp(1.5rem, 4vw, 2.75rem);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  box-shadow: var(--shadow-float);
}

.login-card__eyebrow {
  color: var(--color-brand);
}

.login-card h2 {
  margin: 0;
  font-size: 2rem;
  letter-spacing: -0.035em;
}

.login-card__description {
  margin: var(--space-3) 0 var(--space-6);
  color: var(--color-text-muted);
}

.login-form {
  margin-top: var(--space-2);
}

.login-submit {
  width: 100%;
  min-height: 2.8rem;
  margin-top: var(--space-2);
}

.login-error {
  margin: 0 0 var(--space-3);
  color: var(--color-danger);
  font-size: 0.88rem;
}

@media (width <= 62rem) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .login-story {
    min-height: 30rem;
  }

  .login-form-wrap {
    min-height: auto;
    border-radius: 2rem 2rem 0 0;
  }
}

@media (width <= 36rem) {
  .login-story,
  .login-form-wrap {
    padding: var(--space-5);
  }

  .security-grid {
    grid-template-columns: 1fr;
  }
}
</style>
