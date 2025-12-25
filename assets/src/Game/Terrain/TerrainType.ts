import type { Coordinate } from '@/Game/Terrain/Coordinate'
import { Terrain } from '@/Game/Terrain/Terrain'

export class TerrainType
{
    public constructor(
        private readonly color: string,
        private readonly name: string,
    )
    {
    }

    public getColor(): string
    {
        return this.color
    }

    public getName(): string
    {
        return this.name
    }
}
