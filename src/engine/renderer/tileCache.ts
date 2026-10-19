/**
 * C-RENDER-03: Offscreen Raster Tile Cache
 * Caches baked terrain bitmaps for ultra-fast 60 FPS viewport transformations.
 */
export class TileCache {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isReady: boolean = false;

  constructor(width: number = 1024, height: number = 1024) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context for tile cache');
    }
    this.ctx = context;
  }

  public update(imageData: ImageData): void {
    if (this.canvas.width !== imageData.width || this.canvas.height !== imageData.height) {
      this.canvas.width = imageData.width;
      this.canvas.height = imageData.height;
    }
    this.ctx.putImageData(imageData, 0, 0);
    this.isReady = true;
  }

  public draw(
    targetCtx: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number
  ): void {
    if (!this.isReady) return;
    targetCtx.drawImage(
      this.canvas,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      dx,
      dy,
      dWidth,
      dHeight
    );
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public get ready(): boolean {
    return this.isReady;
  }

  public get width(): number {
    return this.canvas.width;
  }

  public get height(): number {
    return this.canvas.height;
  }
}
