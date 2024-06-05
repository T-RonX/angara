<script setup lang="ts">

</script>

<template>
  <div id="nav">
    <router-link :to="{ name: 'login' }">Login</router-link> |
    <router-link :to="{ name: 'canvas' }">Game</router-link>
  </div>
</template>

<style scoped>
#nav {
  background-color: #4CAF50; /* Green background */
  height: 100px; /* Fixed height */
  width: 100%; /* Full width */
  text-align: center;
  line-height: 100px; /* Center text vertically */
  color: white;
  padding: 20px;
}
</style>
