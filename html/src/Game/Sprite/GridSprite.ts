import type { RenderContext } from '@/Renderer/Context/RenderContext'
import type { Map } from '@/Game/Map/Map'
import { MathX } from '@/Math/MathX'
import type { SpriteInterface } from '@/Renderer/Sprite/SpriteInterface'
import { Vector } from '@/Renderer/Positioning/Vector'
import type { SpriteGeneratorInterface } from '@/Renderer/Sprite/Generator/SpriteGeneratorInterface'
import type { Rectangle } from '@/Renderer/Sprite/Type/Rectangle/Rectangle'
import type { SpriteType } from '@/Renderer/Sprite/SpriteType'
import { AbstractAssetGenerator } from '@/Game/Assets/AbstractAssetGenerator'
import { useGameStore } from '@/stores/GameStore'
import { StringDeflater } from '@/composables/Compression'
import type { StaticImage } from '@/Renderer/Sprite/Type/Image/StaticImage'

export class GridSprite extends AbstractAssetGenerator implements SpriteGeneratorInterface {
  private grid: SpriteInterface[] = []
  private isGridComplete: boolean = false

  constructor(
    private map: Map,
    private scale: number,
    spriteType: SpriteType
  ) {

    super(spriteType)
  }

  public reset(): void {
    this.grid = []
    this.isGridComplete = false
  }

  public getSprites(renderContext: RenderContext): SpriteInterface[] {
    if (this.isGridComplete) {
      return this.grid
    }

     // this.createGrid()
    this.createBorder()
    this.createImageTiles()
    this.createBlocks()
    // this.createMap()

    this.isGridComplete = true

    return this.grid
  }

  private createBlocks(): void {
    const x: number[] = MathX.range(this.scale, this.map.getWidth() - this.scale, this.scale)
    const y: number[] = MathX.range(this.scale, this.map.getHeight() - this.scale, this.scale)

    for (let iy: number = 0; iy <= y.length; ++iy) {
      for (let ix: number = 0; ix <= x.length; ++ix) {
        const block: Rectangle = this.getFactory().MapBlockAsset(
          new Vector(x[ix], y[iy]),
          this.scale + 1,
          this.scale + 1,
          this.randomColor()
        )

        if (this.randomNumber(0, 100) > 90) { // -1 was 75 for a 25% density
          this.grid.push(block)
          // this.grid.push(this.getFactory().createStaticText(String(block.getId()), block.getTopLeft().add(new Vector(4, 12)), '14px arial', 'yellow'))
        }
      }
    }
  }

  private createImageTiles() {
    const x: number[] = MathX.range(0, this.map.getWidth() - this.scale, this.scale)
    const y: number[] = MathX.range(0, this.map.getHeight() - this.scale, this.scale)

    const imgX = 4682;
    const imgY = 4735;

    const tileSizeX: number = imgX / x.length;
    const tileSizeY: number = imgY / y.length;

    for (let iy: number = 0; iy < y.length; ++iy) {
      for (let ix: number = 0; ix < x.length; ++ix) {
        const tile: StaticImage = this.getFactory().createStaticImage('/tile.png',
          new Vector(x[ix], y[iy]),
          this.scale + 1,
          this.scale + 1,
          (ix * tileSizeX),
          (iy * tileSizeY),
          tileSizeX,
          tileSizeY,
        )

        this.grid.push(tile)
      }
    }
  }

  private createMap(): void {
    // const gameStore = useGameStore()
    //
    // // const len = gameStore.map.length
    // const size = 6250;
    //
    // // console.log(len)
    // // return
    //
    // for (const tile of gameStore.map) {
    //   this.grid.push(this.getFactory().createStaticImage(
    //     'data:image/webp;base64,' + btoa(StringDeflater.inflate(tile['data'])),
    //     new Vector(tile['x'] * size, tile['y'] * size),
    //     size,
    //     size,
    //   ))
    // }

    // for (let y: number = 0; y < 10; ++y) {
    //   for (let x: number = 0; x < 10; ++x) {
    //     this.grid.push(this.getFactory().createStaticImage(
    //       'data:image/png;base64,' + btoa(StringDeflater.inflate(gameStore.map[y][x])),
    //       new Vector(x * size, y * size),
    //       size,
    //       size,
    //       ))
    //   }
    // }

    // gameStore.setMap([])
    //
    // return;
    //
    // const x: number[] = MathX.range(this.scale, this.map.getWidth() - this.scale, this.scale)
    // const y: number[] = MathX.range(this.scale, this.map.getHeight() - this.scale, this.scale)
    //
    // for (let iy: number = 0; iy <= y.length; ++iy) {
    //   for (let ix: number = 0; ix <= x.length; ++ix) {
    //     const block: Rectangle = this.getFactory().MapBlockAsset(
    //       new Vector(x[ix], y[iy]),
    //       this.scale + 1,
    //       this.scale + 1,
    //       this.rgbToHex(gameStore.map[iy][ix]),
    //     )
    //
    //     if (this.randomNumber(0, 100) > 0) {
    //       this.grid.push(block)
    //       // this.grid.push(this.getFactory().createStaticText(String(block.getId()), block.getTopLeft().add(new Vector(4, 12)), '14px arial', 'yellow'))
    //     }
    //   }
    // }
    //
    // gameStore.setMap([])
  }

  private rgbToHex(rgb: number[]): string {
    const hex = rgb.map(value => {
      const component = value.toString(16);
      return component.length === 1 ? `0${component}` : component;
    }).join('');
    return `#${hex}`;
  }

  private randomColor(): string {
    const red = this.randomNumber(32, 64).toString(16).padStart(2, '0')
    const gre = this.randomNumber(32, 127).toString(16).padStart(2, '0')
    const blu = this.randomNumber(32, 64).toString(16).padStart(2, '0')

    return '#' + red + gre + blu
  }

  private randomNumber(min: number, max: number): number {
    return Math.ceil(Math.random() * (max - min + 1) + min)
  }

  private createGrid(): void {
    // Render vertical grid lines
    const x: number[] = MathX.range(this.scale, this.map.getWidth() - this.scale, this.scale)

    for (let i: number = 0; i <= x.length - 1; ++i) {
      this.grid.push(this.getFactory().createLine(
        new Vector(x[i], 0),
        new Vector(x[i], this.map.getHeight()),
        1,
        '#ddd',
      ))
    }

    // Render horizontal grid lines
    const yStarts: number[] = MathX.range(this.scale, this.map.getHeight() - this.scale, this.scale)

    for (let i: number = 0; i <= yStarts.length - 1; ++i) {
      this.grid.push(this.getFactory().createLine(
        new Vector(0, yStarts[i]),
        new Vector(this.map.getWidth(), yStarts[i]),
        1,
        '#ddd',
      ))
    }
  }

  private createBorder(): void {
    const color: string = '#ccc'
    const borderWidth: number = 10

    // Render border left
    this.grid.push(this.getFactory().createLine(
      new Vector((0 - borderWidth / 2), (0 - borderWidth)),
      new Vector((0 - borderWidth / 2),this.map.getHeight() + borderWidth),
      borderWidth,
      color,
    ))

    // Render border top
    this.grid.push(this.getFactory().createLine(
      new Vector(0, (0 - borderWidth / 2)),
      new Vector(this.map.getWidth(), (0 - borderWidth / 2)),
      borderWidth,
      color,
    ))

    // Render border right
    this.grid.push(this.getFactory().createLine(
      new Vector((this.map.getWidth() + borderWidth / 2), (0 - borderWidth)),
      new Vector((this.map.getWidth() + borderWidth / 2),(this.map.getHeight() + borderWidth)),
      borderWidth,
      color,
    ))

    // Render border right
    this.grid.push(this.getFactory().createLine(
      new Vector((0 - borderWidth), (this.map.getHeight() + borderWidth / 2)),
      new Vector((this.map.getWidth()),(this.map.getHeight() + borderWidth / 2)),
      borderWidth,
      color,
    ))
  }
}