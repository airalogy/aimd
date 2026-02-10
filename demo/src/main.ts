import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/full' },
    { path: '/full', component: () => import('./pages/FullDemo.vue') },
    { path: '/core', component: () => import('./pages/CoreDemo.vue') },
    { path: '/editor', component: () => import('./pages/EditorDemo.vue') },
    { path: '/renderer', component: () => import('./pages/RendererDemo.vue') },
    { path: '/recorder', component: () => import('./pages/RecorderDemo.vue') },
  ],
})

const app = createApp(App)
app.use(router)
app.mount('#app')
