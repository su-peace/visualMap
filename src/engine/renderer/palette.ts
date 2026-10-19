import { ThemeMode } from '../../types';

interface ColorStop {
  pos: number;
  r: number;
  g: number;
  b: number;
}

/**
 * C-RENDER-01: Hypsometric Tinting LUTs
 * Dual-theme palettes compliant with military cartographic standards.
 */
export class PaletteManager {
  private static darkLut: Uint8ClampedArray | null = null;
  private static lightLut: Uint8ClampedArray | null = null;

  // Tactical Dark Palette Stops
  private static readonly DARK_STOPS: ColorStop[] = [
    { pos: 0.00, r: 7,   g: 17,  b: 28 },  // Deep Ocean
    { pos: 0.15, r: 14,  g: 34,  b: 56 },  // Shallow Water / Shelf
    { pos: 0.18, r: 20,  g: 45,  b: 55 },  // Shoreline / Marsh
    { pos: 0.22, r: 18,  g: 36,  b: 29 },  // Lowland Plains
    { pos: 0.38, r: 28,  g: 48,  b: 36 },  // Steppe / Forest
    { pos: 0.52, r: 35,  g: 52,  b: 34 },  // Hills
    { pos: 0.68, r: 61,  g: 58,  b: 37 },  // Mid-Highlands
    { pos: 0.82, r: 74,  g: 67,  b: 58 },  // Rocky Cliffs
    { pos: 0.94, r: 110, g: 116, b: 122 }, // Alpine Crests
    { pos: 1.00, r: 155, g: 165, b: 175 }, // Mountain Apex
  ];

  // Classic Military Topo Paper Palette Stops
  private static readonly LIGHT_STOPS: ColorStop[] = [
    { pos: 0.00, r: 197, g: 225, b: 245 }, // Deep Water
    { pos: 0.15, r: 220, g: 238, b: 251 }, // Shallow Coastal Water
    { pos: 0.18, r: 244, g: 242, b: 230 }, // Sand Beach / Mudflat
    { pos: 0.22, r: 247, g: 245, b: 235 }, // Pale Cream Lowlands
    { pos: 0.38, r: 231, g: 237, b: 220 }, // Sage Agricultural Plains
    { pos: 0.52, r: 216, g: 222, b: 202 }, // Undulating Hills
    { pos: 0.68, r: 200, g: 190, b: 178 }, // Khaki Slopes
    { pos: 0.82, r: 185, g: 172, b: 160 }, // Mountain Shoulders
    { pos: 0.94, r: 233, g: 231, b: 228 }, // Rocky Summits
    { pos: 1.00, r: 248, g: 246, b: 244 }, // Glacial / Bare Rock Peak
  ];

  private static buildLut(stops: ColorStop[]): Uint8ClampedArray {
    const lut = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 256; i++) {
      const t = i / 255.0;
      let lower = stops[0];
      let upper = stops[stops.length - 1];

      for (let j = 0; j < stops.length - 1; j++) {
        if (t >= stops[j].pos && t <= stops[j + 1].pos) {
          lower = stops[j];
          upper = stops[j + 1];
          break;
        }
      }

      const span = upper.pos - lower.pos;
      const frac = span > 0.00001 ? (t - lower.pos) / span : 0;

      const r = Math.round(lower.r + (upper.r - lower.r) * frac);
      const g = Math.round(lower.g + (upper.g - lower.g) * frac);
      const b = Math.round(lower.b + (upper.b - lower.b) * frac);

      const offset = i * 4;
      lut[offset] = r;
      lut[offset + 1] = g;
      lut[offset + 2] = b;
      lut[offset + 3] = 255;
    }
    return lut;
  }

  public static getLut(theme: ThemeMode): Uint8ClampedArray {
    if (theme === 'dark') {
      if (!this.darkLut) {
        this.darkLut = this.buildLut(this.DARK_STOPS);
      }
      return this.darkLut;
    } else {
      if (!this.lightLut) {
        this.lightLut = this.buildLut(this.LIGHT_STOPS);
      }
      return this.lightLut;
    }
  }

  /**
   * Returns RGB tuple for a single normalized height [0.0, 1.0]
   */
  public static sample(height: number, theme: ThemeMode): [number, number, number] {
    const lut = this.getLut(theme);
    const idx = Math.max(0, Math.min(255, Math.floor(height * 255.0))) * 4;
    return [lut[idx], lut[idx + 1], lut[idx + 2]];
  }
}
