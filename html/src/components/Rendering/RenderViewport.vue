<script setup lang="ts">
import { onBeforeMount, onBeforeUnmount, onMounted, onUnmounted, type Ref, ref } from 'vue'
import { Game } from '@/Game/Game'
import { useGameStore } from '@/stores/GameStore'
import { markRaw } from 'vue'
import { BodyMap } from '@/Game/Terrain/BodyMap'
import { Cell } from '@/Game/Terrain/Cell'
import { Terrain } from '@/Game/Terrain/Terrain'
import { Coordinate } from '@/Game/Terrain/Coordinate'
import { TerrainType } from '@/Game/Terrain/TerrainType'

const gameStore = useGameStore()
const props = defineProps({
    showFps: { type: Boolean, default: true },
})

const canvas: Ref<HTMLCanvasElement | undefined> = ref()
const mapPreset: Ref<string> = ref('')
const mapSeed: Ref<string> = ref('')

const fps = ref(0)
let fpsTimer: number | null = null

const MAP_WIDTH = 20
const MAP_HEIGHT = 20
const MAP_SCALE = 40

const fetchx = (method: string, path: string, data: any = null): Promise<Response> => {
    const promise: Promise<Response> = fetch(path, { 'method': 'post' })

    return promise
}

const getMap = () => {
    fetchx('POST', 'http://localhost:4100/public/map')
        .then(response => response.status === 200 ? response.json() : Promise.reject(response))
        .then((data) => {
            const json = JSON.parse(data) as {
                map: number[][]
                border: number[][]
                terrainTypes: Array<{color: string, name: string}>
                styleName: string
                seed: string
            }
            let grid: Map<number, Map<number, Cell>> = new Map<number, Map<number, Cell>>

            for (let y in json['map'])
            {
                grid.set(parseInt(y), new Map<number, Cell>())

                for (let x in json.map[y])
                {
                    grid.get(parseInt(y)).set(parseInt(x), new Cell(new Coordinate(parseInt(x), parseInt(y)), new Terrain(json.map[y][x])))
                }
            }



            let borders: Map<number, Map<number, number|null>> = new Map<number, Map<number, number|null>>

            for (let y in json['border'])
            {
                borders.set(parseInt(y), new Map<number, Cell>())

                for (let x in json.border[y])
                {
                    borders.get(parseInt(y)).set(parseInt(x), json.border[y][x])
                }
            }

            let terrainTypes: Map<number, TerrainType> = new Map<number, TerrainType>

            let g = 0;
            for (let i in json['terrainTypes'])
            {
                terrainTypes.set(g++, new TerrainType(json['terrainTypes'][i].color, json['terrainTypes'][i].name))
            }


            const map = new BodyMap(grid, borders, terrainTypes)

            gameStore.setMap(map)


            mapPreset.value = json['styleName']
            mapSeed.value = json['seed']

            init()
        })
}

const init = () => {

    if (canvas.value === undefined)
    {
        throw new Error('Unable to initiate render canvas.')
    }

    window.addEventListener('resize', updateCanvasSize)
    updateCanvasSize()

    if (gameStore.game === null)
    {
        const game: Game = markRaw(new Game(
            canvas.value, gameStore.map.getGrid().size, //MAP_WIDTH,
            gameStore.map.getGrid().size, //MAP_HEIGHT,
            MAP_SCALE,
            props.showFps,
        ))

        gameStore.setGame(game)
        game.render()
    }
    else
    {
        gameStore.game.setCanvasHooks(canvas.value)
    }

    const fpsHandler = () => {
        if (gameStore.game)
        {
            fps.value = gameStore.game.getFps()
        }
        fpsTimer = window.setTimeout(fpsHandler, 250)
    }

    setTimeout(fpsHandler, 250)
}

onBeforeMount(() => {
    if (gameStore.game)
    {
        console.debug('RenderViewport.onBeforeMount')
        // gameStore.game.reset()
        // gameStore.setGame(null)
    }
})

onMounted(() => {
    console.debug('RenderViewport.onMounted')
    getMap()
})

onBeforeUnmount(() => {
    console.debug('RenderViewport.onBeforeUnmount')
    if (fpsTimer) clearTimeout(fpsTimer)
    window.removeEventListener('resize', () => {
    })
})

onUnmounted(() => {
    console.debug('RenderViewport.onUnmounted')
    window.removeEventListener('resize', () => {
    })
})

// Force a canvas size that helps with scaling on window resize
const updateCanvasSize = () => {
    if (canvas.value)
    {
        canvas.value.width = canvas.value?.getBoundingClientRect().width
        canvas.value.height = canvas.value?.getBoundingClientRect().height
    }
}

const continueRendering = () => {
    if (gameStore.game)
    {
        gameStore.game.continueRendering()
    }
}

const stopRendering = () => {
    if (gameStore.game)
    {
        gameStore.game.stopRendering()
    }
}

const stepRendering = () => {
    if (gameStore.game)
    {
        gameStore.game.stepRendering()
    }
}

const restartRendering = () => {
    if (gameStore.game)
    {
        gameStore.game.reset()
        gameStore.setGame(null)
        getMap()
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
            <br />
            <span>dragging: {{ isDragging }}</span><br/>
            <span>map preset: {{ mapPreset }}</span><br/>
            <span>map seed: {{ mapSeed }}</span>
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
    font-family: arial, serif;
    font-weight: bold;
}
</style>
