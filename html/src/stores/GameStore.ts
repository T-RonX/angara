import { defineStore } from 'pinia'
import { Game } from '@/Game/Game'

export const useGameStore = defineStore('GameStore', {
  state: () => ({
    game: null as Game|null,
    map: [] as {x: number, y: number, data: string }[],
  }),
  // getters: {
  //   game(): Game|null {
  //     return this.game
  //   },
  // },
  actions: {
    setGame(game: Game): void {
      this.game = game
    },
    setMap(map: {x: number, y: number, data: string }[]): void {
      this.map = map
    },
  }
})
