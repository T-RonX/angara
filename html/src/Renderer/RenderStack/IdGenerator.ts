export class IdGenerator {
  private lastId: number = 0

  public getNextId(): number {
    return ++this.lastId
  }
}