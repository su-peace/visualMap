/**
 * C-TERRAIN-01: Mulberry32 Reproducible Pseudo-Random Number Generator (PRNG)
 * Ensures 100% deterministic terrain and simulation recreation from a single 32-bit seed.
 */
export class PRNG {
  private state: number;

  constructor(seed: number = 1337) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  /**
   * Resets the generator state with a new seed
   */
  public setSeed(seed: number): void {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  /**
   * Returns a pseudo-random 32-bit unsigned integer
   */
  public nextInt(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /**
   * Returns a pseudo-random floating point number in [0, 1)
   */
  public nextFloat(): number {
    return this.nextInt() / 4294967296.0;
  }

  /**
   * Returns a pseudo-random float in [min, max)
   */
  public nextRange(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  /**
   * Returns a pseudo-random integer in [min, max] inclusive
   */
  public nextIntRange(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1));
  }
}
