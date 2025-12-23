export class Terrain
{
    public constructor(
        private readonly level: number,
    )
    {
    }

    public getLevel():  number
    {
        return this.level
    }
}
