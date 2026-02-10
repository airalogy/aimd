<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()

const navItems = [
  { path: '/full', label: '完整工作流' },
  { path: '/core', label: 'Core 解析器' },
  { path: '/editor', label: 'Editor 编辑器' },
  { path: '/renderer', label: 'Renderer 渲染器' },
  { path: '/recorder', label: 'Recorder 记录器' },
]

const currentPath = computed(() => route.path)
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1 class="app-title">AIMD Packages Demo</h1>
      <nav class="app-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :class="['nav-link', { active: currentPath === item.path }]"
        >
          {{ item.label }}
        </router-link>
      </nav>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #333;
  background: #f5f7fa;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  padding: 16px 32px;
  display: flex;
  align-items: center;
  gap: 32px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.app-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  white-space: nowrap;
}

.app-nav {
  display: flex;
  gap: 4px;
}

.nav-link {
  padding: 8px 16px;
  border-radius: 6px;
  text-decoration: none;
  color: #555;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.nav-link:hover {
  background: #f0f2f5;
  color: #333;
}

.nav-link.active {
  background: #e8f0fe;
  color: #1a73e8;
}

.app-main {
  flex: 1;
  padding: 24px 32px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}
</style>
