<script setup lang="ts">
import { onBeforeMount, onBeforeUnmount, onMounted, onUnmounted, type Ref, ref } from 'vue'
import { Game } from '@/Game/Game'
import { useGameStore } from '@/stores/GameStore'
import { markRaw } from 'vue'

const gameStore = useGameStore();
const props = defineProps({
  showFps: { type: Boolean, default: true },
})

const canvas: Ref<HTMLCanvasElement|undefined> = ref()

const fps = ref(0)
let fpsTimer: number | null = null

const MAP_WIDTH = 200
const MAP_HEIGHT = 200
const MAP_SCALE = 40

const init = () => {
  if (canvas.value === undefined) {
    throw new Error('Unable to initiate render canvas.')
  }

  window.addEventListener('resize', updateCanvasSize)
  updateCanvasSize()

  if (gameStore.game === null) {
    const game: Game = markRaw(new Game(
      canvas.value,
      MAP_WIDTH,
      MAP_HEIGHT,
      MAP_SCALE,
      props.showFps,
    ))

    gameStore.setGame(game)
    game.render()
  } else {
    gameStore.game.setCanvasHooks(canvas.value)
  }

  const fpsHandler = () => {
    if (gameStore.game) {
      fps.value = gameStore.game.getFps()
    }
    fpsTimer = window.setTimeout(fpsHandler, 250)
  }

  setTimeout(fpsHandler, 250)
}

onBeforeMount(() => {
  if (gameStore.game) {
    console.debug('RenderViewport.onBeforeMount')
    // gameStore.game.reset()
    // gameStore.setGame(null)
  }
})

onMounted(() => {
  console.debug('RenderViewport.onMounted')
  init()
})

onBeforeUnmount(() => {
  console.debug('RenderViewport.onBeforeUnmount')
  if (fpsTimer) clearTimeout(fpsTimer)
  window.removeEventListener('resize', () => {})
})

onUnmounted(() => {
  console.debug('RenderViewport.onUnmounted')
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

const restartRendering = () => {
  if (gameStore.game) {
    gameStore.game.reset()
    gameStore.setGame(null)
    init()
  }
}

const isDragging: Ref<boolean> = ref(false)

const mouseDown = () => {
  isDragging.value = true
}

const mouseUp = () => {
  isDragging.value = false
}

const mouseOut = () => {
  isDragging.value = false
}
</script>

<template>
  <!-- <img :src="testImage" alt="Test Image" /> -->

  <div ref="canvas_wrap" class="canvas_wrap">
    <div id="render_debug">
      <button @click="continueRendering">Start</button>
      <button @click="stopRendering">Stop</button>
      <button @click="stepRendering">Step</button>
      <button @click="restartRendering">Restart</button>
      <br/>
      <span>dragging: {{ isDragging }}</span>
    </div>
    <span id="fps">{{ fps }} fps</span>
    <canvas
      @mousedown="mouseDown"
      @mouseup="mouseUp"
      @mouseout="mouseOut"
      ref="canvas" :class="{ canvas: true, dragging: isDragging }"
    />
  </div>
</template>

<style scoped>
.canvas_wrap {
  padding-bottom: 0;
  box-sizing: border-box;
  position: relative;
}

#render_debug {
  position: absolute;
  top: 10px;
  left: 10px;
  color: whitesmoke;
  text-align: left;
}

.canvas {
  height: calc(100vh - 150px);
  width: 100%;
  box-sizing: border-box;
  background-color: #ececec;
  border: 1px #aaa solid;
}

.canvas.dragging {
  cursor: move;
}

#fps {
  position: absolute;
  top: 10px;
  right: 30px;
  color: red;
  font-size: 24px;
  font-family: arial,serif;
  font-weight: bold;
}
</style>
