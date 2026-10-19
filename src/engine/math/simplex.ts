import { PRNG } from './prng';

/**
 * C-TERRAIN-02: Fast 2D Simplex Noise implementation with seedable permutation table.
 * Standard Simplex algorithm optimized for continuous fractal terrain generation.
 */
export class SimplexNoise {
  private perm: Uint8Array = new Uint8Array(512);
  private permMod12: Uint8Array = new Uint8Array(512);

  // Gradient directions for 2D flattened into typed arrays for maximum cache locality and zero heap dereferences
  private static readonly GRAD3_X: Float32Array = new Float32Array([
    1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0
  ]);
  private static readonly GRAD3_Y: Float32Array = new Float32Array([
    1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1
  ]);

  private static readonly F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  private static readonly G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

  constructor(prng: PRNG = new PRNG()) {
    this.reseed(prng);
  }

  /**
   * Reseeds the permutation tables using the provided PRNG
   */
  public reseed(prng: PRNG): void {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Fisher-Yates shuffle with PRNG
    for (let i = 255; i > 0; i--) {
      const j = prng.nextIntRange(0, i);
      const temp = p[i];
      p[i] = p[j];
      p[j] = temp;
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  /**
   * Samples 2D Simplex Noise at coordinates (xin, yin).
   * Returns a value in [-1.0, 1.0].
   */
  public noise2D(xin: number, yin: number): number {
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    // Skew the input space to determine which simplex cell we're in
    const s = (xin + yin) * SimplexNoise.F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * SimplexNoise.G2;
    const X0 = i - t; // Unskew the cell origin back to (x,y) space
    const Y0 = j - t;
    const x0 = xin - X0; // The x,y distances from the cell origin
    const y0 = yin - Y0;

    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    let i1: number;
    let j1: number;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    // Offsets for middle and last corners
    const x1 = x0 - i1 + SimplexNoise.G2;
    const y1 = y0 - j1 + SimplexNoise.G2;
    const x2 = x0 - 1.0 + 2.0 * SimplexNoise.G2;
    const y2 = y0 - 1.0 + 2.0 * SimplexNoise.G2;

    // Work out the hashed gradient indices of the three simplex corners
    const ii = i & 255;
    const jj = j & 255;

    // Calculate the contribution from the three corners
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi0 = this.permMod12[ii + this.perm[jj]];
      t0 *= t0;
      n0 = t0 * t0 * (SimplexNoise.GRAD3_X[gi0] * x0 + SimplexNoise.GRAD3_Y[gi0] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
      t1 *= t1;
      n1 = t1 * t1 * (SimplexNoise.GRAD3_X[gi1] * x1 + SimplexNoise.GRAD3_Y[gi1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
      t2 *= t2;
      n2 = t2 * t2 * (SimplexNoise.GRAD3_X[gi2] * x2 + SimplexNoise.GRAD3_Y[gi2] * y2);
    }

    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1, 1].
    return 70.0 * (n0 + n1 + n2);
  }
}
