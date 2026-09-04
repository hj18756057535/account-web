<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElButton, ElMessage } from 'element-plus'

import { useSessionStore } from '@/features/session/session.store'
import { messages } from '@/locales'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'

const copy = messages
const router = useRouter()
const sessionStore = useSessionStore()
const initials = computed(() => sessionStore.currentUser?.name.slice(0, 1).toUpperCase() || 'A')

async function signOut() {
  try {
    await sessionStore.logout()
    await router.replace({ name: 'login' })
  } catch {
    ElMessage.error(copy.errors.generic)
  }
}
</script>

<template>
  <div class="console-layout">
    <aside class="console-sidebar" :aria-label="copy.navigation.ariaLabel">
      <div class="brand-block">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <div>
          <strong>{{ copy.brand.name }}</strong>
          <small>{{ copy.brand.product }}</small>
        </div>
      </div>

      <nav class="console-nav">
        <RouterLink class="nav-item" :to="{ name: 'users' }">
          <span class="nav-icon" aria-hidden="true">U</span>
          <span>{{ copy.navigation.users }}</span>
        </RouterLink>
        <RouterLink
          v-if="sessionStore.hasCapability('applications:read')"
          class="nav-item"
          :to="{ name: 'applications' }"
        >
          <span class="nav-icon" aria-hidden="true">A</span>
          <span>{{ copy.navigation.applications }}</span>
        </RouterLink>
        <button class="nav-item nav-item--disabled" type="button" disabled>
          <span class="nav-icon" aria-hidden="true">C</span>
          <span>{{ copy.navigation.access }}</span>
          <small>{{ copy.navigation.accessInUserDetail }}</small>
        </button>
        <RouterLink
          v-if="sessionStore.hasCapability('audit:read')"
          class="nav-item"
          :to="{ name: 'audit-events' }"
        >
          <span class="nav-icon" aria-hidden="true">L</span>
          <span>{{ copy.navigation.audit }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-insight">
        <span class="insight-dot" aria-hidden="true"></span>
        <div>
          <strong>{{ copy.navigation.sliceTitle }}</strong>
          <p>{{ copy.navigation.sliceDescription }}</p>
        </div>
      </div>
    </aside>

    <div class="console-main">
      <header class="console-header">
        <div>
          <span class="environment-dot" aria-hidden="true"></span>
          {{ copy.brand.environment }}
        </div>
        <div class="account-menu">
          <LanguageSwitcher />
          <span class="avatar" aria-hidden="true">{{ initials }}</span>
          <span class="account-copy">
            <strong>{{ sessionStore.currentUser?.name }}</strong>
            <small>{{ sessionStore.currentUser?.account }}</small>
          </span>
          <ElButton text @click="signOut">{{ copy.navigation.signOut }}</ElButton>
        </div>
      </header>
      <main class="console-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.console-layout {
  display: grid;
  min-height: 100vh;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
}

.console-sidebar {
  position: sticky;
  top: 0;
  display: flex;
  height: 100vh;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-6) var(--space-4);
  border-right: 1px solid var(--color-border);
  background: rgb(255 255 255 / 88%);
  backdrop-filter: blur(1rem);
}

.brand-block,
.account-menu,
.console-header,
.nav-item,
.sidebar-insight {
  display: flex;
  align-items: center;
}

.brand-block {
  gap: var(--space-3);
  padding: 0 var(--space-2);
}

.brand-block strong,
.brand-block small,
.account-copy strong,
.account-copy small {
  display: block;
}

.brand-block strong {
  letter-spacing: -0.02em;
}

.brand-block small,
.account-copy small {
  color: var(--color-text-muted);
}

.brand-mark {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  grid-template-columns: repeat(2, 0.55rem);
  grid-template-rows: repeat(2, 0.55rem);
  place-content: center;
  gap: 0.15rem;
  border-radius: 0.8rem;
  background: linear-gradient(145deg, var(--color-brand), var(--color-accent));
  box-shadow: 0 0.55rem 1.25rem rgb(37 99 235 / 24%);
}

.brand-mark span {
  border-radius: 0.18rem;
  background: #fff;
}

.brand-mark span:last-child {
  grid-column: 1 / 3;
}

.console-nav {
  display: grid;
  gap: var(--space-2);
}

.nav-item {
  width: 100%;
  min-height: 3rem;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-radius: var(--radius-control);
  color: var(--color-text-muted);
  background: transparent;
  text-align: left;
}

.nav-item small {
  margin-left: auto;
  color: #94a3b8;
  font-size: 0.68rem;
}

.nav-item.router-link-active {
  color: var(--color-brand-strong);
  background: var(--color-brand-soft);
  font-weight: 700;
}

.nav-icon {
  display: grid;
  width: 1.8rem;
  height: 1.8rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.55rem;
  background: var(--color-surface-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

.router-link-active .nav-icon {
  color: #fff;
  background: var(--color-brand);
}

.nav-item--disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.sidebar-insight {
  gap: var(--space-3);
  margin-top: auto;
  padding: var(--space-4);
  border: 1px solid #ccebf0;
  border-radius: var(--radius-card);
  background: linear-gradient(145deg, var(--color-accent-soft), #f8fdff);
  align-items: flex-start;
}

.sidebar-insight p {
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.insight-dot,
.environment-dot {
  display: inline-block;
  width: 0.55rem;
  height: 0.55rem;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 0 0.25rem rgb(8 145 178 / 12%);
}

.console-main {
  min-width: 0;
}

.console-header {
  position: sticky;
  z-index: 10;
  top: 0;
  min-height: 4.5rem;
  justify-content: space-between;
  padding: var(--space-3) var(--space-8);
  border-bottom: 1px solid var(--color-border);
  background: rgb(245 248 255 / 86%);
  color: var(--color-text-muted);
  backdrop-filter: blur(1rem);
}

.console-header > div:first-child {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.85rem;
  font-weight: 700;
}

.account-menu {
  flex-wrap: wrap;
  gap: var(--space-3);
}

.avatar {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border-radius: 0.75rem;
  color: #fff;
  background: linear-gradient(145deg, var(--color-brand), #60a5fa);
  font-weight: 800;
}

.account-copy {
  min-width: 7rem;
}

.console-content {
  width: min(100%, var(--content-max-width));
  margin: 0 auto;
  padding: var(--space-8);
}

@media (width <= 56rem) {
  .console-layout {
    display: block;
  }

  .console-sidebar {
    position: static;
    height: auto;
    gap: var(--space-4);
    border-right: 0;
    border-bottom: 1px solid var(--color-border);
  }

  .console-nav {
    display: flex;
    overflow-x: auto;
  }

  .nav-item {
    width: auto;
    min-width: max-content;
  }

  .nav-item small,
  .sidebar-insight {
    display: none;
  }

  .console-header,
  .console-content {
    padding-right: var(--space-4);
    padding-left: var(--space-4);
  }
}

@media (width <= 35rem) {
  .account-copy,
  .console-header > div:first-child {
    display: none;
  }
}
</style>
