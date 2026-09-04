import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { initializeLocale } from './locales'
import 'element-plus/dist/index.css'
import './design/base.css'

const app = createApp(App)
initializeLocale()

app.use(createPinia())
app.use(router)

app.mount('#app')
