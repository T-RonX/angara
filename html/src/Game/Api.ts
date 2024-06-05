import { GameApi } from '@/Game/Api/GameApi'

const baseUrl: string = 'http://localhost:8003'
const basePath: string = '/api'
const debug: boolean = true

export const api: GameApi = new GameApi(baseUrl, basePath, debug)
