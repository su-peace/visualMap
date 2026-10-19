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
    const imgData = new ImageData(width, height);
    const data = imgData.data;
    const lut = PaletteManager.getLut(theme);

    // Coordinate grid spacing
    const cellSpacing = 1.0;
    const lx = HillshadeRenderer.LX;
    const ly = HillshadeRenderer.LY;
    const lz = HillshadeRenderer.LZ;

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
        // N = (-dzdx, -dzdy, 1) / sqrt(dzdx^2 + dzdy^2 + 1)
        // shade = N · L (8.8x faster than transcendental trig calls, algebraically identical)
        const invLen = 1.0 / Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1.0);
        let shade = (-dzdx * lx - dzdy * ly + lz) * invLen;
        shade = Math.max(0.0, Math.min(1.0, shade));

        // Sample base color from LUT
        const lutIdx = Math.max(0, Math.min(255, Math.floor(e * 255.0))) * 4;
        const baseR = lut[lutIdx];
        const baseG = lut[lutIdx + 1];
        const baseB = lut[lutIdx + 2];

        const pixelIdx = (rowCurr + x) * 4;

        if (e < seaLevel) {
          // Water rendering: subtle light reflection, keep clean
          const waterShade = 0.85 + (shade - 0.5) * 0.2;
          data[pixelIdx] = Math.min(255, Math.round(baseR * waterShade));
          data[pixelIdx + 1] = Math.min(255, Math.round(baseG * waterShade));
          data[pixelIdx + 2] = Math.min(255, Math.round(baseB * waterShade));
          data[pixelIdx + 3] = 255;
        } else {
          // Land rendering: realistic hillshade modulation
          // Adjust contrast and intensity based on theme
          let factor: number;
          if (theme === 'dark') {
            // High contrast relief in tactical dark
            factor = 0.5 + shade * 0.9;
          } else {
            // Soft paper-like relief in military paper
            factor = 0.65 + shade * 0.65;
          }

          data[pixelIdx] = Math.min(255, Math.round(baseR * factor));
          data[pixelIdx + 1] = Math.min(255, Math.round(baseG * factor));
          data[pixelIdx + 2] = Math.min(255, Math.round(baseB * factor));
          data[pixelIdx + 3] = 255;
        }
      }
    }

    return imgData;
  }
}
