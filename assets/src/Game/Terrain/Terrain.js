export class Terrain {
    constructor(level) {
        Object.defineProperty(this, "level", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: level
        });
    }
    getLevel() {
        return this.level;
    }
}
//# sourceMappingURL=Terrain.js.map