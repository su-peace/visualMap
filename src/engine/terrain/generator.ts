import { TerrainConfig } from '../../types';
import { PRNG } from '../math/prng';
import { SimplexNoise } from '../math/simplex';

/**
 * C-TERRAIN-02 & C-TERRAIN-03: Multi-Octave Fractal Noise and Topological Shapers
 * Produces heightfields with realistic geomorphological features.
 */
export class TerrainGenerator {
  /**
   * Generates a normalized Float32Array heightfield [0.0, 1.0]
   */
  public static generate(config: TerrainConfig): Float32Array {
    const {
      seed,
      width,
      height,
      scale,
      octaves,
      persistence,
      lacunarity,
      shapeType,
    } = config;

    const size = width * height;
    const heightfield = new Float32Array(size);

    const prng = new PRNG(seed);
    const simplex = new SimplexNoise(prng);

    // Random offsets per octave to avoid symmetry artifacts
    const octaveOffsets: [number, number][] = [];
    for (let i = 0; i < octaves; i++) {
      octaveOffsets.push([
        prng.nextRange(-10000, 10000),
        prng.nextRange(-10000, 10000),
      ]);
    }

    const halfW = width / 2.0;
    const halfH = height / 2.0;
    const maxRadius = Math.sqrt(halfW * halfW + halfH * halfH);

    let minVal = Infinity;
    let maxVal = -Infinity;

    // Precompute octave frequency and amplitude tables
    const freqs = new Float32Array(octaves);
    const amps = new Float32Array(octaves);
    let curFreq = 1.0;
    let curAmp = 1.0;
    let totalAmp = 0.0;
    for (let o = 0; o < octaves; o++) {
      freqs[o] = curFreq;
      amps[o] = curAmp;
      totalAmp += curAmp;
      curAmp *= persistence;
      curFreq *= lacunarity;
    }
    const invTotalAmp = 1.0 / totalAmp;

    const rowSampleY = new Float32Array(octaves);

    // Phase 1: Compute raw FBM / Ridged noise with hoisted row-invariants
    for (let y = 0; y < height; y++) {
      const yRow = y * width;
      const dy = (y - halfH) / halfH;
      const dy2 = dy * dy;

      for (let o = 0; o < octaves; o++) {
        rowSampleY[o] = ((y - halfH) / scale) * freqs[o] + octaveOffsets[o][1];
      }

      for (let x = 0; x < width; x++) {
        let noiseHeight = 0.0;
        const normX = (x - halfW) / scale;

        for (let o = 0; o < octaves; o++) {
          const sampleX = normX * freqs[o] + octaveOffsets[o][0];
          let n = simplex.noise2D(sampleX, rowSampleY[o]);

          if (shapeType === 'ridge') {
            // Ridged multifractal: sharp mountain crests and valleys
            n = 1.0 - Math.abs(n);
            n = n * n; // sharpen ridges
          }

          noiseHeight += n * amps[o];
        }

        let val = noiseHeight * invTotalAmp; // normalized to approx [-1, 1] or [0, 1]

        // Phase 2: Apply topological shaping masks
        const dx = (x - halfW) / halfW;
        const distFromCenter = Math.sqrt(dx * dx + dy2);

        if (shapeType === 'island') {
          // Radial dropoff to water at boundaries (smooth step)
          const falloff = Math.pow(Math.min(1.0, distFromCenter), 2.2);
          val = val - falloff * 1.25;
        } else if (shapeType === 'basin') {
          // Basin: lower in center, surrounded by mountains
          const elevationBoost = Math.pow(Math.min(1.0, distFromCenter), 1.8) * 0.8;
          val = val * 0.7 + elevationBoost;
        }

        const idx = yRow + x;
        heightfield[idx] = val;

        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }

    // Phase 3: Normalize to [0.0, 1.0]
    const range = maxVal - minVal > 0.00001 ? maxVal - minVal : 1.0;
    for (let i = 0; i < size; i++) {
      let norm = (heightfield[i] - minVal) / range;

      // Optional Terrace quantization filter
      if (shapeType === 'terraces') {
        const steps = 14;
        const stepVal = Math.floor(norm * steps) / steps;
        const frac = (norm * steps) % 1.0;
        // Blend slightly with smooth step to avoid harsh pixel edges
        norm = stepVal + Math.pow(frac, 3.5) / steps;
      }

      heightfield[i] = Math.max(0.0, Math.min(1.0, norm));
    }

    return heightfield;
  }
}
