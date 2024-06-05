<script setup>
import LayoutHeader from '@/components/Layout/LayoutHeader.vue'
</script>

<template>
  <LayoutHeader />
  <router-view/>
</template>

<style>
body, html {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}
</style>
