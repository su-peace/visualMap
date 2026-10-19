import { TacticalGraphic, ThemeMode, ViewportTransform } from '../../types';
import { CartoProjection } from '../carto/projection';
import { MilitarySymbolRenderer } from './symbols';

/**
 * C-MIL-03: Tactical Graphics & Operational Geometry Engine
 * Renders main attack arrows, frontlines, operational zones, and radar sectors.
 */
export class TacticalGraphicsRenderer {
  public static render(
    ctx: CanvasRenderingContext2D,
    graphics: TacticalGraphic[],
    vp: ViewportTransform,
    proj: CartoProjection,
    theme: ThemeMode,
    timestamp: number = 0
  ): void {
    if (graphics.length === 0) return;

    for (const g of graphics) {
      if (g.points.length === 0) continue;

      ctx.save();
      const colors = MilitarySymbolRenderer.getAffiliationColors(g.affiliation, theme);

      // Convert world points to screen points
      const screenPts = g.points.map((p) => proj.gridToScreen(p[0], p[1], vp));

      switch (g.type) {
        case 'attack_arrow':
          this.renderAttackArrow(ctx, screenPts, colors.stroke, colors.fill, false);
          break;
        case 'support_arrow':
          this.renderAttackArrow(ctx, screenPts, colors.stroke, colors.fill, true);
          break;
        case 'front_line':
          this.renderFrontLine(ctx, screenPts, colors.stroke);
          break;
        case 'blocking_line':
          this.renderBlockingLine(ctx, screenPts, colors.stroke);
          break;
        case 'assembly_area':
          this.renderAssemblyArea(ctx, screenPts, colors.stroke, colors.fill, g.label);
          break;
        case 'radar_sector':
        case 'fire_fan':
          this.renderRadarSector(ctx, screenPts[0], g, vp, colors.stroke, colors.fill, timestamp);
          break;
      }

      // If graphic is selected, draw control handles
      if (g.selected) {
        ctx.fillStyle = theme === 'dark' ? '#3FD0FF' : '#0284C7';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        for (const pt of screenPts) {
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  /**
   * Main / Supporting Attack Arrow
   */
  private static renderAttackArrow(
    ctx: CanvasRenderingContext2D,
    pts: [number, number][],
    strokeColor: string,
    fillColor: string,
    isDashed: boolean
  ): void {
    if (pts.length < 2) return;

    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];

    const dx = pEnd[0] - pStart[0];
    const dy = pEnd[1] - pStart[1];
    const len = Math.hypot(dx, dy);
    if (len < 10) return;

    const angle = Math.atan2(dy, dx);
    const headLen = Math.min(36, len * 0.4);
    const arrowWidth = Math.min(24, len * 0.3);
    const stemWidth = arrowWidth * 0.45;

    ctx.save();
    ctx.translate(pStart[0], pStart[1]);
    ctx.rotate(angle);

    ctx.beginPath();
    // Tail swallow notch
    ctx.moveTo(0, stemWidth * 0.5);
    ctx.lineTo(len - headLen, stemWidth * 0.8);
    // Arrow head shoulder
    ctx.lineTo(len - headLen, arrowWidth * 0.9);
    // Arrow apex
    ctx.lineTo(len, 0);
    // Arrow head opposite shoulder
    ctx.lineTo(len - headLen, -arrowWidth * 0.9);
    ctx.lineTo(len - headLen, -stemWidth * 0.8);
    ctx.lineTo(0, -stemWidth * 0.5);
    // Swallow notch indent
    ctx.lineTo(len * 0.12, 0);
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.globalAlpha = 0.75;
    ctx.fill();

    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.2;
    if (isDashed) {
      ctx.setLineDash([8, 5]);
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Front Line with unilateral defensive teeth
   */
  private static renderFrontLine(
    ctx: CanvasRenderingContext2D,
    pts: [number, number][],
    strokeColor: string
  ): void {
    if (pts.length < 2) return;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.stroke();

    // Draw sawtooth defensive teeth along segments
    const toothSpacing = 20;
    const toothHeight = 8;
    ctx.beginPath();
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const segLen = Math.hypot(dx, dy);
      if (segLen < 1) continue;

      const nx = -dy / segLen;
      const ny = dx / segLen;
      const steps = Math.floor(segLen / toothSpacing);

      for (let s = 0; s < steps; s++) {
        const t1 = (s * toothSpacing) / segLen;
        const t2 = ((s + 0.5) * toothSpacing) / segLen;
        const t3 = ((s + 1.0) * toothSpacing) / segLen;

        const bx1 = p1[0] + dx * t1;
        const by1 = p1[1] + dy * t1;
        const peakX = p1[0] + dx * t2 + nx * toothHeight;
        const peakY = p1[1] + dy * t2 + ny * toothHeight;
        const bx3 = p1[0] + dx * t3;
        const by3 = p1[1] + dy * t3;

        ctx.moveTo(bx1, by1);
        ctx.lineTo(peakX, peakY);
        ctx.lineTo(bx3, by3);
      }
    }
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  /**
   * Blocking line with double cross bars
   */
  private static renderBlockingLine(
    ctx: CanvasRenderingContext2D,
    pts: [number, number][],
    strokeColor: string
  ): void {
    if (pts.length < 2) return;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.stroke();

    // Bars perpendicular to segments
    const barSpacing = 24;
    const barHeight = 7;
    ctx.beginPath();
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const segLen = Math.hypot(dx, dy);
      if (segLen < 1) continue;

      const nx = -dy / segLen;
      const ny = dx / segLen;
      const steps = Math.floor(segLen / barSpacing);

      for (let s = 1; s <= steps; s++) {
        const t = (s * barSpacing - barSpacing * 0.5) / segLen;
        const cx = p1[0] + dx * t;
        const cy = p1[1] + dy * t;
        ctx.moveTo(cx - nx * barHeight, cy - ny * barHeight);
        ctx.lineTo(cx + nx * barHeight, cy + ny * barHeight);
      }
    }
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  /**
   * Operational Area / Assembly Zone Polygon
   */
  private static renderAssemblyArea(
    ctx: CanvasRenderingContext2D,
    pts: [number, number][],
    strokeColor: string,
    fillColor: string,
    label: string
  ): void {
    if (pts.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.globalAlpha = 0.22;
    ctx.fill();

    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Centroid for label
    let cx = 0;
    let cy = 0;
    for (const p of pts) {
      cx += p[0];
      cy += p[1];
    }
    cx /= pts.length;
    cy /= pts.length;

    if (label) {
      ctx.font = 'bold 11px "Rajdhani", Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = strokeColor;
      ctx.fillText(label, cx, cy);
    }
  }

  /**
   * Radar Sector & Weapon Engagement Fan
   */
  private static renderRadarSector(
    ctx: CanvasRenderingContext2D,
    center: [number, number],
    g: TacticalGraphic,
    vp: ViewportTransform,
    strokeColor: string,
    fillColor: string,
    timestamp: number
  ): void {
    const radiusPx = (g.radius || 150) * vp.zoom;
    const startA = ((g.startAngle || 300) * Math.PI) / 180;
    const endA = ((g.endAngle || 60) * Math.PI) / 180;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(center[0], center[1]);
    ctx.arc(center[0], center[1], radiusPx, startA, endA);
    ctx.closePath();

    // Radial gradient fill
    const grad = ctx.createRadialGradient(center[0], center[1], 5, center[0], center[1], radiusPx);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.35;
    ctx.fill();

    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Rotating radar beam animation if radar_sector
    if (g.type === 'radar_sector') {
      const sweepPeriod = 4000; // 4 seconds per sweep
      const sweepPhase = (timestamp % sweepPeriod) / sweepPeriod;
      const sweepAngle = startA + (endA - startA) * sweepPhase;

      ctx.beginPath();
      ctx.moveTo(center[0], center[1]);
      ctx.lineTo(center[0] + Math.cos(sweepAngle) * radiusPx, center[1] + Math.sin(sweepAngle) * radiusPx);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    ctx.restore();
  }
}
