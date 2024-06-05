<script setup lang="ts">
import { onBeforeUnmount, onMounted, type Ref, ref } from 'vue'
import { Game } from '@/Game/Game'
import { useGameStore } from "@/stores/GameStore";

const gameStore = useGameStore();

const props = defineProps({
  showFps: { type: Boolean, default: true },
})

const canvas: Ref<HTMLCanvasElement|undefined> = ref()

const fps = ref(0)

const MAP_WIDTH = 1000
const MAP_HEIGHT = 1000
const MAP_SCALE = 25

onMounted(() => {
  if (canvas.value === undefined) {
    throw new Error('Unable to initiate render canvas.')
  }

  window.addEventListener('resize', updateCanvasSize)
  updateCanvasSize()

  if (gameStore.game === null) {
    const game: Game = new Game(
      canvas.value,
      MAP_WIDTH,
      MAP_HEIGHT,
      MAP_SCALE,
      props.showFps,
    )

    gameStore.setGame(game)
    game.render()
  } else {
    gameStore.game.setCanvasHooks(canvas.value)
  }

  const fpsHandler = () => {
    if (gameStore.game !== null ) {
      fps.value = gameStore.game.getFps()
    }
    setTimeout(fpsHandler, 250)
  }

  setTimeout(fpsHandler, 250)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', () => {})
})

// Force a canvas size that helps with scaling on window resize
const updateCanvasSize = () => {
  if (canvas.value) {
    canvas.value.width = canvas.value?.getBoundingClientRect().width
    canvas.value.height = canvas.value?.getBoundingClientRect().height
  }
}

const continueRendering = () => {
  if (gameStore.game) {
    gameStore.game.continueRendering()
  }
}

const stopRendering = () => {
  if (gameStore.game) {
    gameStore.game.stopRendering()
  }
}

const stepRendering = () => {
  if (gameStore.game) {
    gameStore.game.stepRendering()
  }
}

const isDragging: Ref<boolean> = ref(false)

const mouseDown = () => {
  updateIsDragging()
}

const mouseMove = () => {
  updateIsDragging()
}

const mouseUp = () => {
  updateIsDragging()
}

const mouseOut = () => {
  updateIsDragging()
}

const updateIsDragging = () => {
  if (gameStore.game) {
    isDragging.value = gameStore.game.getIsDragging()
  }
}
</script>

<template>
  <!-- <img :src="testImage" alt="Test Image" /> -->
  <button @click="continueRendering">Start</button>
  <button @click="stopRendering">Stop</button>
  <button @click="stepRendering">Step</button>
  <span>{{ isDragging }}</span>
  <div ref="canvas_wrap" class="canvas_wrap">
    <span id="fps">{{ fps }} fps</span>
    <canvas
      @mousedown="mouseDown"
      @mouseup="mouseUp"
      @mouseout="mouseOut"
      @mousemove="mouseMove"
      ref="canvas" :class="{ canvas: true, dragging: isDragging }"
    />
  </div>
</template>

<style scoped>
.canvas_wrap {
  padding-bottom: 0;
  box-sizing: border-box;
}

.canvas {
  height: 750px;
  width: 100%;
  box-sizing: border-box;
}

.canvas.dragging {
  cursor: move;
}
#fps {
  position: absolute;
  top: 52px;
  right: 30px;
  color: red;
  font-size: 24px;
  font-family: arial,serif;
  font-weight: bold;
}
</style>
