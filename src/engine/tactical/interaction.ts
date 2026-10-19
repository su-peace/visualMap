import { MilitaryUnit, Point, TacticalGraphic, ViewportTransform } from '../../types';
import { CartoProjection } from '../carto/projection';

/**
 * C-MIL-04: Hit Testing & Interaction Math for Units and Tactical Graphics
 */
export class InteractionHelper {
  /**
   * Distance from point (px, py) to line segment (x1, y1)-(x2, y2)
   */
  public static distToSegment(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  /**
   * Ray casting algorithm for point-in-polygon test
   */
  public static isPointInPolygon(px: number, py: number, polygon: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersect =
        yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Hit test a military unit on screen
   */
  public static hitTestUnit(
    unit: MilitaryUnit,
    screenX: number,
    screenY: number,
    vp: ViewportTransform,
    proj: CartoProjection
  ): boolean {
    const [sx, sy] = proj.gridToScreen(unit.x, unit.y, vp);
    const radius = 22; // px hit tolerance
    return Math.hypot(screenX - sx, screenY - sy) <= radius;
  }

  /**
   * Hit test a tactical graphic on screen
   */
  public static hitTestGraphic(
    g: TacticalGraphic,
    screenX: number,
    screenY: number,
    vp: ViewportTransform,
    proj: CartoProjection,
    thresholdPx: number = 8
  ): boolean {
    if (g.points.length === 0) return false;
    const screenPts = g.points.map((p) => proj.gridToScreen(p[0], p[1], vp));

    if (g.type === 'assembly_area') {
      if (this.isPointInPolygon(screenX, screenY, screenPts)) return true;
    }

    // Polyline edge distance test
    for (let i = 0; i < screenPts.length - 1; i++) {
      const p1 = screenPts[i];
      const p2 = screenPts[i + 1];
      const d = this.distToSegment(screenX, screenY, p1[0], p1[1], p2[0], p2[1]);
      if (d <= thresholdPx) return true;
    }

    if (g.type === 'radar_sector' || g.type === 'fire_fan') {
      const center = screenPts[0];
      const rPx = (g.radius || 150) * vp.zoom;
      const d = Math.hypot(screenX - center[0], screenY - center[1]);
      if (d <= rPx) {
        let angle = (Math.atan2(screenY - center[1], screenX - center[0]) * 180) / Math.PI;
        if (angle < 0) angle += 360;
        const start = g.startAngle || 300;
        const end = g.endAngle || 60;
        if (start < end) {
          if (angle >= start && angle <= end) return true;
        } else {
          if (angle >= start || angle <= end) return true;
        }
      }
    }

    return false;
  }
}
