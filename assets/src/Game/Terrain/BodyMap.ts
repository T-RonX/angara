import type { Cell } from '@/Game/Terrain/Cell'
import type { TerrainType } from '@/Game/Terrain/TerrainType'

export class BodyMap
{
    public constructor(
        private readonly grid: Map<number, Map<number, Cell>>,
        private readonly borders: Map<number|null, Map<number, number|null>>,
        private readonly terrainTypes: Map<number, TerrainType>,
    )
    {
    }

    public getGrid(): Map<number, Map<number, Cell>>
    {
        return this.grid
    }

    public getBorders(): Map<number|null, Map<number, number|null>>
    {
        return this.borders
    }

    public getTerrainTypes(): Map<number, TerrainType>
    {
        return this.terrainTypes
    }
}
