import { defineStore } from 'pinia'
import { Game } from '@/Game/Game'
import { BodyMap } from '@/Game/Terrain/BodyMap'

export const useGameStore = defineStore('GameStore', {
  state: () => ({
    game: null as Game|null,
    map: null as BodyMap|null,
  }),
  // getters: {
  //   game(): Game|null {
  //     return this.game
  //   },
  // },
  actions: {
    setGame(game: Game|null): void {
      this.game = game
    },
    setMap(map: BodyMap): void {
      this.map = map
    },
  }
})
