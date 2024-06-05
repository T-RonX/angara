import './assets/main.css'
import './global'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// app.config.errorHandler = (err, instance, info) => {
//
//   // Handle the error globally
//     alert(err)
//     // alert(instance)
//     alert(info)
//
//   // Add code for UI notifications, reporting or other error handling logic
// };

app.mount('#app')
