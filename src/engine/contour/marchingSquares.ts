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
    const interp = (v1: number, v2: number): number => {
      const diff = v2 - v1;
      if (diff > -0.000001 && diff < 0.000001) return 0.5;
      const t = (isovalue - v1) / diff;
      return t < 0 ? 0 : t > 1 ? 1 : t;
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

        const eTop = (): Point => [x + step * interp(v0, v1), y];
        const eRight = (): Point => [x + step, y + step * interp(v1, v2)];
        const eBottom = (): Point => [x + step * interp(v3, v2), y + step];
        const eLeft = (): Point => [x, y + step * interp(v0, v3)];

        switch (cellIndex) {
          case 1:
          case 14:
            segments.push({ p1: eLeft(), p2: eBottom(), isovalue });
            break;
          case 2:
          case 13:
            segments.push({ p1: eBottom(), p2: eRight(), isovalue });
            break;
          case 3:
          case 12:
            segments.push({ p1: eLeft(), p2: eRight(), isovalue });
            break;
          case 4:
          case 11:
            segments.push({ p1: eTop(), p2: eRight(), isovalue });
            break;
          case 5: {
            // Saddle ambiguity resolution via center average
            const avg = (v0 + v1 + v2 + v3) * 0.25;
            if (avg >= isovalue) {
              segments.push({ p1: eTop(), p2: eRight(), isovalue });
              segments.push({ p1: eLeft(), p2: eBottom(), isovalue });
            } else {
              segments.push({ p1: eTop(), p2: eLeft(), isovalue });
              segments.push({ p1: eRight(), p2: eBottom(), isovalue });
            }
            break;
          }
          case 6:
          case 9:
            segments.push({ p1: eTop(), p2: eBottom(), isovalue });
            break;
          case 7:
          case 8:
            segments.push({ p1: eTop(), p2: eLeft(), isovalue });
            break;
          case 10: {
            // Saddle ambiguity resolution
            const avg = (v0 + v1 + v2 + v3) * 0.25;
            if (avg >= isovalue) {
              segments.push({ p1: eTop(), p2: eLeft(), isovalue });
              segments.push({ p1: eRight(), p2: eBottom(), isovalue });
            } else {
              segments.push({ p1: eTop(), p2: eRight(), isovalue });
              segments.push({ p1: eLeft(), p2: eBottom(), isovalue });
            }
            break;
          }
        }
      }
    }

    return segments;
  }
}
