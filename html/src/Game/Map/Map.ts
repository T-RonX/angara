export class Map {
  constructor(
    private width: number,
    private height: number,
  ) {
  }

  public getWidth(): number {
    return this.width
  }

  public getHeight(): number {
    return this.height
  }
}
