import { LOSResult, Point, TerrainConfig } from '../../types';
import { CartoProjection } from '../carto/projection';

/**
 * C-ANA-01: Line-of-Sight (LOS) 3D Ray Caster
 * Evaluates visibility between two arbitrary points across 3D terrain.
 */
export class LOSAnalyzer {
  public static calculateLOS(
    start: Point,
    end: Point,
    heightfield: Float32Array,
    gridWidth: number,
    gridHeight: number,
    config: TerrainConfig,
    observerEyeHeight: number = 2.0, // meters above ground
    targetHeight: number = 2.0 // meters above ground
  ): LOSResult {
    const dist = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const numSteps = Math.max(20, Math.floor(dist * 2.5));

    const sampleElevation = (gx: number, gy: number): number => {
      const ix = Math.max(0, Math.min(gridWidth - 1, Math.floor(gx)));
      const iy = Math.max(0, Math.min(gridHeight - 1, Math.floor(gy)));
      const normH = heightfield[iy * gridWidth + ix];
      const seaLevel = config.seaLevel || 0.18;
      const maxElev = config.heightScale || 1200;
      if (normH < seaLevel) {
        return ((normH - seaLevel) / seaLevel) * 80;
      }
      return ((normH - seaLevel) / (1.0 - seaLevel)) * maxElev;
    };

    const startGround = sampleElevation(start[0], start[1]);
    const endGround = sampleElevation(end[0], end[1]);

    const zA = startGround + observerEyeHeight;
    const zB = endGround + targetHeight;

    const visiblePoints: Point[] = [start];
    const blockedPoints: Point[] = [];
    let hasObstruction = false;
    let blockedAt: Point | undefined;
    let minClearance = Infinity;

    for (let i = 1; i <= numSteps; i++) {
      const t = i / numSteps;
      const gx = start[0] + (end[0] - start[0]) * t;
      const gy = start[1] + (end[1] - start[1]) * t;

      const groundZ = sampleElevation(gx, gy);
      const losZ = zA + (zB - zA) * t;
      const clearance = losZ - groundZ;

      if (clearance < minClearance) {
        minClearance = clearance;
      }

      if (!hasObstruction) {
        if (groundZ > losZ && i < numSteps) {
          hasObstruction = true;
          blockedAt = [gx, gy];
          blockedPoints.push([gx, gy]);
        } else {
          visiblePoints.push([gx, gy]);
        }
      } else {
        blockedPoints.push([gx, gy]);
      }
    }

    return {
      start,
      end,
      visiblePoints,
      blockedPoints,
      blockedAt,
      hasObstruction,
      minClearance,
    };
  }

  /**
   * Renders the LOS ray on canvas
   */
  public static renderLOS(
    ctx: CanvasRenderingContext2D,
    result: LOSResult,
    proj: CartoProjection,
    vp: any
  ): void {
    ctx.save();

    // Visible segment (Green)
    if (result.visiblePoints.length >= 2) {
      ctx.beginPath();
      const s0 = proj.gridToScreen(result.visiblePoints[0][0], result.visiblePoints[0][1], vp);
      ctx.moveTo(s0[0], s0[1]);
      for (let i = 1; i < result.visiblePoints.length; i++) {
        const s = proj.gridToScreen(result.visiblePoints[i][0], result.visiblePoints[i][1], vp);
        ctx.lineTo(s[0], s[1]);
      }
      ctx.strokeStyle = '#3DDC97'; // Bright tactical green
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Blocked segment (Red dashed)
    if (result.blockedPoints.length >= 1) {
      ctx.beginPath();
      const lastVis = result.visiblePoints[result.visiblePoints.length - 1];
      const s0 = proj.gridToScreen(lastVis[0], lastVis[1], vp);
      ctx.moveTo(s0[0], s0[1]);
      for (let i = 0; i < result.blockedPoints.length; i++) {
        const s = proj.gridToScreen(result.blockedPoints[i][0], result.blockedPoints[i][1], vp);
        ctx.lineTo(s[0], s[1]);
      }
      ctx.strokeStyle = '#FF4D5E'; // Tactical alert red
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Obstruction warning marker
    if (result.blockedAt) {
      const s = proj.gridToScreen(result.blockedAt[0], result.blockedAt[1], vp);
      ctx.fillStyle = '#FF4D5E';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s[0], s[1], 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Warning text badge
      ctx.font = 'bold 10px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = '#FF4D5E';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('OBSTRUCTION', s[0], s[1] - 8);
    }

    // Start & End points
    const sStart = proj.gridToScreen(result.start[0], result.start[1], vp);
    const sEnd = proj.gridToScreen(result.end[0], result.end[1], vp);

    // Observer circle (MW Tactical Amber)
    ctx.fillStyle = '#E5A93C';
    ctx.strokeStyle = '#080A0D';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sStart[0], sStart[1], 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Target circle (NVG Green / Thermal Red)
    ctx.fillStyle = result.hasObstruction ? '#EF4444' : '#22C55E';
    ctx.beginPath();
    ctx.arc(sEnd[0], sEnd[1], 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}
