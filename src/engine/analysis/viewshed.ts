import { Point, TerrainConfig, ViewportTransform } from '../../types';
import { CartoProjection } from '../carto/projection';

/**
 * C-ANA-02: 360° Radial Viewshed Analyzer & Shadow Mask
 * Computes terrain blind spots and visible fire sectors from an observation post.
 */
export class ViewshedAnalyzer {
  public static computeViewshedMask(
    center: Point,
    radius: number, // in grid units
    heightfield: Float32Array,
    gridWidth: number,
    gridHeight: number,
    config: TerrainConfig,
    observerEyeHeight: number = 2.5
  ): { visiblePolys: Point[][]; shadowPolys: Point[][] } {
    const numRays = 180;
    const stepSize = 1.0;
    const maxSteps = Math.floor(radius / stepSize);

    const sampleZ = (gx: number, gy: number): number => {
      const ix = Math.max(0, Math.min(gridWidth - 1, Math.floor(gx)));
      const iy = Math.max(0, Math.min(gridHeight - 1, Math.floor(gy)));
      const normH = heightfield[iy * gridWidth + ix];
      const seaLevel = config.seaLevel || 0.18;
      const maxElev = config.heightScale || 1200;
      if (normH < seaLevel) return 0;
      return ((normH - seaLevel) / (1.0 - seaLevel)) * maxElev;
    };

    const obsZ = sampleZ(center[0], center[1]) + observerEyeHeight;

    const visibleRays: Point[][] = [];
    const shadowRays: Point[][] = [];

    for (let r = 0; r < numRays; r++) {
      const angle = (r * 2.0 * Math.PI) / numRays;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      let maxSlope = -Infinity;
      const currentVis: Point[] = [center];
      const currentShadow: Point[] = [];

      for (let s = 1; s <= maxSteps; s++) {
        const d = s * stepSize;
        const gx = center[0] + cosA * d;
        const gy = center[1] + sinA * d;

        if (gx < 0 || gx >= gridWidth || gy < 0 || gy >= gridHeight) break;

        const gz = sampleZ(gx, gy);
        const slope = (gz - obsZ) / d;

        if (slope >= maxSlope) {
          maxSlope = slope;
          currentVis.push([gx, gy]);
        } else {
          currentShadow.push([gx, gy]);
        }
      }

      if (currentVis.length > 1) visibleRays.push(currentVis);
      if (currentShadow.length > 0) shadowRays.push(currentShadow);
    }

    return { visiblePolys: visibleRays, shadowPolys: shadowRays };
  }

  /**
   * Renders the viewshed shadow mask on canvas
   */
  public static renderViewshed(
    ctx: CanvasRenderingContext2D,
    center: Point,
    radius: number,
    viewshed: { visiblePolys: Point[][]; shadowPolys: Point[][] },
    proj: CartoProjection,
    vp: ViewportTransform
  ): void {
    ctx.save();

    const sCenter = proj.gridToScreen(center[0], center[1], vp);
    const sRadius = radius * vp.zoom;

    // Draw total surveillance boundary circle
    ctx.beginPath();
    ctx.arc(sCenter[0], sCenter[1], sRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(63, 208, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw blind spot shadow points
    ctx.fillStyle = 'rgba(255, 77, 94, 0.35)'; // Reddish blind zone mask
    for (const ray of viewshed.shadowPolys) {
      for (const p of ray) {
        const s = proj.gridToScreen(p[0], p[1], vp);
        ctx.fillRect(s[0] - 1.5, s[1] - 1.5, 3, 3);
      }
    }

    // Observer center icon (MW Tactical Amber)
    ctx.fillStyle = '#E5A93C';
    ctx.strokeStyle = '#080A0D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sCenter[0], sCenter[1], 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}
