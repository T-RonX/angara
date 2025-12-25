<script setup lang="ts">
const props = defineProps({
  title: { type: String, default: 'button' },
})
</script>

<template>
  <button>{{ props.title }}</button>
</template>

<style scoped>

</style>
