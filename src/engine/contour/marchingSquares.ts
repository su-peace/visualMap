import { Point } from '../../types';

export interface ContourSegment {
  p1: Point;
  p2: Point;
  isovalue: number;
}

/**
 * C-CONTOUR-01: Marching Squares Contour Segment Extractor
 * Extracts discrete isovalue line segments from a scalar heightfield.
 */
export class MarchingSquares {
  /**
   * Extracts contour segments for a given isovalue threshold.
   * Uses step=2 for fast, clean cartographic contours on 1024x1024 grid,
   * avoiding single-pixel noise artifacts while reducing cell iterations by 4x.
   */
  public static extractSegments(
    heightfield: Float32Array,
    width: number,
    height: number,
    isovalue: number,
    step: number = 2
  ): ContourSegment[] {
    const segments: ContourSegment[] = [];

    // Helper for linear interpolation along edge
    const interpolate = (v1: number, v2: number): number => {
      const diff = v2 - v1;
      if (Math.abs(diff) < 0.000001) return 0.5;
      return Math.max(0.0, Math.min(1.0, (isovalue - v1) / diff));
    };

    // Marching across grid cells with configurable step
    for (let y = 0; y < height - step; y += step) {
      const rowCurr = y * width;
      const rowNext = (y + step) * width;

      for (let x = 0; x < width - step; x += step) {
        const v0 = heightfield[rowCurr + x];            // TL
        const v1 = heightfield[rowCurr + x + step];     // TR
        const v2 = heightfield[rowNext + x + step];     // BR
        const v3 = heightfield[rowNext + x];            // BL

        let cellIndex = 0;
        if (v0 >= isovalue) cellIndex |= 8;
        if (v1 >= isovalue) cellIndex |= 4;
        if (v2 >= isovalue) cellIndex |= 2;
        if (v3 >= isovalue) cellIndex |= 1;

        if (cellIndex === 0 || cellIndex === 15) continue;

        // Lazy edge calculation: only instantiate edges when required by cell topology
        const top = (): Point => [x + step * interpolate(v0, v1), y];
        const right = (): Point => [x + step, y + step * interpolate(v1, v2)];
        const bottom = (): Point => [x + step * interpolate(v3, v2), y + step];
        const left = (): Point => [x, y + step * interpolate(v0, v3)];

        switch (cellIndex) {
          case 1:
            segments.push({ p1: left(), p2: bottom(), isovalue });
            break;
          case 2:
            segments.push({ p1: bottom(), p2: right(), isovalue });
            break;
          case 3:
            segments.push({ p1: left(), p2: right(), isovalue });
            break;
          case 4:
            segments.push({ p1: top(), p2: right(), isovalue });
            break;
          case 5: {
            // Saddle ambiguity resolution via center average
            const avg = (v0 + v1 + v2 + v3) * 0.25;
            if (avg >= isovalue) {
              segments.push({ p1: top(), p2: right(), isovalue });
              segments.push({ p1: left(), p2: bottom(), isovalue });
            } else {
              segments.push({ p1: top(), p2: left(), isovalue });
              segments.push({ p1: right(), p2: bottom(), isovalue });
            }
            break;
          }
          case 6:
            segments.push({ p1: top(), p2: bottom(), isovalue });
            break;
          case 7:
            segments.push({ p1: top(), p2: left(), isovalue });
            break;
          case 8:
            segments.push({ p1: top(), p2: left(), isovalue });
            break;
          case 9:
            segments.push({ p1: top(), p2: bottom(), isovalue });
            break;
          case 10: {
            // Saddle ambiguity resolution
            const avg = (v0 + v1 + v2 + v3) * 0.25;
            if (avg >= isovalue) {
              segments.push({ p1: top(), p2: left(), isovalue });
              segments.push({ p1: right(), p2: bottom(), isovalue });
            } else {
              segments.push({ p1: top(), p2: right(), isovalue });
              segments.push({ p1: left(), p2: bottom(), isovalue });
            }
            break;
          }
          case 11:
            segments.push({ p1: top(), p2: right(), isovalue });
            break;
          case 12:
            segments.push({ p1: left(), p2: right(), isovalue });
            break;
          case 13:
            segments.push({ p1: bottom(), p2: right(), isovalue });
            break;
          case 14:
            segments.push({ p1: left(), p2: bottom(), isovalue });
            break;
        }
      }
    }

    return segments;
  }
}
