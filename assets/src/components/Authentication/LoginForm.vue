<script setup lang="ts">
import { ref, type Ref } from 'vue'
import { api } from '@/Game/Api'
import { tokenStorage } from '@/Api/Jwt/TokenStorage'
import router from '@/router'
import { useGameStore } from '@/stores/GameStore'

const gameStore = useGameStore();

const username: Ref<string> = ref('')
const usernameError: Ref<string> = ref('')

const password: Ref<string> = ref('')
const passwordError: Ref<string> = ref('')

const isLoggedIn: Ref<boolean> = ref(tokenStorage.hasValidAccessToken())
const results2: Ref<string> = ref('none')

const handleSubmit = async() => {
  await api.authenticate(username.value, password.value)
    .finally(() => isLoggedIn.value = tokenStorage.hasValidAccessToken())
    .finally(() => {
      api.getInitData()
        .then(data => {
          results2.value = data.playerName
         // gameStore.setMap(data.map)
        })
        .finally(() => {
          router.push({ name: 'canvas' })
        })
    })
}
</script>

<template>
<form @submit.prevent="handleSubmit">
  <label>Username:</label>
  <input type="text" v-model="username" />
  <div v-if="usernameError" class="error">{{usernameError}}</div>

  <label>Password:</label>
  <input type="password" v-model="password" />
  <div v-if="passwordError" class="error">{{passwordError}}</div>
<br/>
  <button type="submit">Login</button>
</form>
</template>

<style scoped>

</style>
