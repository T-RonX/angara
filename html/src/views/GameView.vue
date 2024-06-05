<script setup lang="ts">
import RenderViewport from '@/components/Rendering/RenderViewport.vue'
</script>

<template>
  <div id="main-container">
    <div id="left-pane" class="pane">
      Left Pane (Fixed Width)
    </div>
    <div id="middle-pane" class="pane">
      <RenderViewport :showFps="true" />
    </div>
    <div id="right-pane" class="pane">
      Right Pane (Fixed Width)
    </div>
  </div>
</template>

<style scoped>
#main-container {
  display: flex;
  flex: 1;
}
.pane {
  padding: 0px;
  text-align: center;
  font-size: 18px;
}
#left-pane {
  background-color: #f1f1f1;
  width: 200px;
}
#middle-pane {
  background-color: #fff;
  flex: 1;
}
#right-pane {
  background-color: #f1f1f1;
  width: 200px;
}
</style>