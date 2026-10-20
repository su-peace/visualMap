import { ThemeMode } from '../../types';
import { PaletteManager } from './palette';

/**
 * C-RENDER-02: Military Standard Northwest Hillshading & Raster Compositor
 * Computes surface gradients with 3x3 Sobel kernels and applies Lambertian diffuse shading.
 */
export class HillshadeRenderer {
  // Illumination parameters: NW 315° Azimuth, 45° Zenith
  private static readonly AZIMUTH = (315.0 * Math.PI) / 180.0;
  private static readonly ZENITH = (45.0 * Math.PI) / 180.0;
  // Precomputed normalized light vector L = (lx, ly, lz)
  private static readonly LX = -Math.sin(HillshadeRenderer.AZIMUTH) * Math.sin(HillshadeRenderer.ZENITH);
  private static readonly LY = Math.cos(HillshadeRenderer.AZIMUTH) * Math.sin(HillshadeRenderer.ZENITH);
  private static readonly LZ = Math.cos(HillshadeRenderer.ZENITH);

  /**
   * Fast 32-bit pixel compositing returning raw RGBA Uint8ClampedArray.
   * Can be executed safely in both Web Worker and Main Thread.
   */
  public static renderRaw(
    heightfield: Float32Array,
    width: number,
    height: number,
    theme: ThemeMode,
    seaLevel: number = 0.18,
    zScale: number = 2.4
  ): Uint8ClampedArray {
    const rawData = new Uint8ClampedArray(width * height * 4);
    const u32 = new Uint32Array(rawData.buffer);
    const lut = PaletteManager.getLut(theme);

    const cellSpacing = 1.0;
    const lx = HillshadeRenderer.LX;
    const ly = HillshadeRenderer.LY;
    const lz = HillshadeRenderer.LZ;
    const isDark = theme === 'dark';

    for (let y = 0; y < height; y++) {
      const yPrev = y > 0 ? y - 1 : y;
      const yNext = y < height - 1 ? y + 1 : y;

      const rowPrev = yPrev * width;
      const rowCurr = y * width;
      const rowNext = yNext * width;

      for (let x = 0; x < width; x++) {
        const xPrev = x > 0 ? x - 1 : x;
        const xNext = x < width - 1 ? x + 1 : x;

        // 3x3 neighborhood elevation samples
        const a = heightfield[rowPrev + xPrev] * zScale;
        const b = heightfield[rowPrev + x] * zScale;
        const c = heightfield[rowPrev + xNext] * zScale;
        const d = heightfield[rowCurr + xPrev] * zScale;
        const e = heightfield[rowCurr + x]; // center height (normalized)
        const f = heightfield[rowCurr + xNext] * zScale;
        const g = heightfield[rowNext + xPrev] * zScale;
        const h = heightfield[rowNext + x] * zScale;
        const i = heightfield[rowNext + xNext] * zScale;

        // Sobel filter for gradients
        const dzdx = ((c + 2.0 * f + i) - (a + 2.0 * d + g)) / (8.0 * cellSpacing);
        const dzdy = ((g + 2.0 * h + i) - (a + 2.0 * b + c)) / (8.0 * cellSpacing);

        // Vector dot product Lambertian hillshade formula:
        const invLen = 1.0 / Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1.0);
        let shade = (-dzdx * lx - dzdy * ly + lz) * invLen;
        if (shade < 0.0) shade = 0.0;
        else if (shade > 1.0) shade = 1.0;

        // Sample base color from LUT
        const lutIdx = ((e * 255.0) | 0) * 4;
        const safeIdx = lutIdx < 0 ? 0 : lutIdx > 1020 ? 1020 : lutIdx;
        const baseR = lut[safeIdx];
        const baseG = lut[safeIdx + 1];
        const baseB = lut[safeIdx + 2];

        let r: number;
        let gVal: number;
        let bVal: number;

        if (e < seaLevel) {
          // Water rendering: subtle light reflection
          const waterShade = 0.85 + (shade - 0.5) * 0.2;
          r = (baseR * waterShade + 0.5) | 0;
          gVal = (baseG * waterShade + 0.5) | 0;
          bVal = (baseB * waterShade + 0.5) | 0;
        } else {
          // Land rendering: realistic hillshade modulation
          const factor = isDark ? 0.5 + shade * 0.9 : 0.65 + shade * 0.65;
          r = (baseR * factor + 0.5) | 0;
          gVal = (baseG * factor + 0.5) | 0;
          bVal = (baseB * factor + 0.5) | 0;
        }

        u32[rowCurr + x] =
          0xff000000 |
          ((bVal > 255 ? 255 : bVal) << 16) |
          ((gVal > 255 ? 255 : gVal) << 8) |
          (r > 255 ? 255 : r);
      }
    }

    return rawData;
  }

  /**
   * Renders a complete RGBA raster from a normalized heightfield
   */
  public static render(
    heightfield: Float32Array,
    width: number,
    height: number,
    theme: ThemeMode,
    seaLevel: number = 0.18,
    zScale: number = 2.4
  ): ImageData {
    const raw = HillshadeRenderer.renderRaw(heightfield, width, height, theme, seaLevel, zScale);
    const imgData = new ImageData(width, height);
    imgData.data.set(raw);
    return imgData;
  }
}
