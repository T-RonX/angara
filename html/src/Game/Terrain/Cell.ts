import type { Coordinate } from '@/Game/Terrain/Coordinate'
import { Terrain } from '@/Game/Terrain/Terrain'

export class Cell
{
    public constructor(
        private readonly position: Coordinate,
        private readonly terrain: Terrain,
    )
    {
    }

    public getPosition(): Coordinate
    {
        return this.position
    }

    public getTerrain(): Terrain
    {
        return this.terrain
    }
}
