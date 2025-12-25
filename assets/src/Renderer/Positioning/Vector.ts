export class Vector {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {
  }

  public add(vector: Vector): Vector {
    return new Vector(this.x + vector.x, this.y + vector.y)
  }

  public sub(vector: Vector): Vector {
    return new Vector(this.x - vector.x, this.y - vector.y)
  }
}
