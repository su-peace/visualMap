import { Point, ThemeMode } from '../../types';
import { ContourLabel, ContourLine } from './chaikin';

export interface CompiledContours {
  interPath: Path2D;
  indexPath: Path2D;
  labels: ContourLabel[];
}

/**
 * C-CONTOUR-03 & C-CONTOUR-04: High-Performance Contour Hierarchy & Elevation Label Renderer
 * Compiles polylines into native Path2D objects for 60 FPS GPU-accelerated stroke rendering.
 */
export class ContourRenderer {
  /**
   * Compiles contour polylines into reusable native Path2D geometry and extracts labels
   */
  public static compilePaths(contours: ContourLine[]): CompiledContours {
    const interPath = new Path2D();
    const indexPath = new Path2D();
    const labels: ContourLabel[] = [];

    for (let c = 0; c < contours.length; c++) {
      const contour = contours[c];
      const pts = contour.points;
      if (pts.length < 2) continue;

      const p = contour.isIndex ? indexPath : interPath;
      p.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        p.lineTo(pts[i][0], pts[i][1]);
      }
      if (contour.isClosed) {
        p.closePath();
      }

      if (contour.labels) {
        for (let l = 0; l < contour.labels.length; l++) {
          labels.push(contour.labels[l]);
        }
      }
    }

    return { interPath, indexPath, labels };
  }

  public static render(
    ctx: CanvasRenderingContext2D,
    contours: ContourLine[],
    theme: ThemeMode,
    scale: number = 1.0,
    compiled?: CompiledContours | null,
    viewBounds?: { minX: number; minY: number; maxX: number; maxY: number }
  ): void {
    if (contours.length === 0) return;

    ctx.save();

    // Style tokens based on theme (Modern Warfare Mil-Spec)
    const isDark = theme === 'dark';
    const indexStroke = isDark
      ? 'rgba(229, 169, 60, 0.70)'
      : 'rgba(133, 77, 39, 0.88)';
    const interStroke = isDark
      ? 'rgba(148, 163, 184, 0.28)'
      : 'rgba(133, 77, 39, 0.35)';
    const labelBg = isDark
      ? 'rgba(14, 18, 24, 0.94)'
      : 'rgba(247, 245, 235, 0.92)';
    const labelColor = isDark ? '#E5A93C' : '#4A2A18';

    // 1. Ultra-fast Path2D native rendering with Progressive Level of Detail (LOD)
    if (compiled) {
      // Progressive LOD Phase 1: Draw intermediate contours
      // When zoomed out (scale < 0.55), omit intermediate contours completely to eliminate GPU stroke lag.
      // Between 0.55 and 0.85, smoothly fade in the lines with alpha interpolation.
      if (scale >= 0.55) {
        const interAlpha = scale >= 0.85 ? 1.0 : (scale - 0.55) / 0.30;
        ctx.save();
        ctx.globalAlpha = interAlpha;
        ctx.beginPath();
        ctx.strokeStyle = interStroke;
        ctx.lineWidth = Math.max(0.75, 0.8 / scale);
        ctx.stroke(compiled.interPath);
        ctx.restore();
      }

      // Progressive LOD Phase 2: Draw index contours (Always drawn as structural backbone)
      ctx.beginPath();
      ctx.strokeStyle = indexStroke;
      ctx.lineWidth = Math.max(1.5, 1.8 / scale);
      ctx.stroke(compiled.indexPath);

      // Progressive LOD Phase 3: Dynamic elevation labels on index contours with viewport & density decimation
      // Only render labels when zoom >= 0.65 to prevent clutter
      if (compiled.labels.length > 0 && scale >= 0.65) {
        const fontSize = Math.max(9, Math.round(11 / scale));
        ctx.font = `bold ${fontSize}px "JetBrains Mono", Consolas, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const b = viewBounds;
        // Label step decimation: at low zoom (0.65-1.1), render every 2nd label to prevent crowding
        const labelStep = scale < 1.1 ? 2 : 1;

        for (let i = 0; i < compiled.labels.length; i += labelStep) {
          const lbl = compiled.labels[i];
          if (b && (lbl.x < b.minX || lbl.x > b.maxX || lbl.y < b.minY || lbl.y > b.maxY)) {
            continue;
          }

          ctx.save();
          ctx.translate(lbl.x, lbl.y);
          ctx.rotate(lbl.angle);

          const padding = 3 / scale;
          const bgW = lbl.width + padding * 2;
          const bgH = fontSize + padding;

          ctx.fillStyle = labelBg;
          ctx.fillRect(-bgW / 2, -bgH / 2, bgW, bgH);

          ctx.fillStyle = labelColor;
          ctx.fillText(lbl.text, 0, 0);

          ctx.restore();
        }
      }

      ctx.restore();
      return;
    }

    // Fallback: direct stroke for uncompiled contours (e.g. 4K print export)
    // Phase 1: Draw intermediate contours
    ctx.beginPath();
    ctx.strokeStyle = interStroke;
    ctx.lineWidth = Math.max(0.75, 0.8 / scale);

    for (let c = 0; c < contours.length; c++) {
      const contour = contours[c];
      if (contour.isIndex) continue;
      const pts = contour.points;
      if (pts.length < 2) continue;

      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
    }
    ctx.stroke();

    // Phase 2: Draw index contours
    ctx.beginPath();
    ctx.strokeStyle = indexStroke;
    ctx.lineWidth = Math.max(1.5, 1.8 / scale);

    for (let c = 0; c < contours.length; c++) {
      const contour = contours[c];
      if (!contour.isIndex) continue;
      const pts = contour.points;
      if (pts.length < 2) continue;

      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
    }
    ctx.stroke();

    // Phase 3: Labels
    const fontSize = Math.max(9, Math.round(11 / scale));
    ctx.font = `bold ${fontSize}px "JetBrains Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let c = 0; c < contours.length; c++) {
      const contour = contours[c];
      if (!contour.isIndex || !contour.labels) continue;

      for (let i = 0; i < contour.labels.length; i++) {
        const lbl = contour.labels[i];
        ctx.save();
        ctx.translate(lbl.x, lbl.y);
        ctx.rotate(lbl.angle);

        const padding = 3 / scale;
        const bgW = lbl.width + padding * 2;
        const bgH = fontSize + padding;

        ctx.fillStyle = labelBg;
        ctx.fillRect(-bgW / 2, -bgH / 2, bgW, bgH);

        ctx.fillStyle = labelColor;
        ctx.fillText(lbl.text, 0, 0);

        ctx.restore();
      }
    }

    ctx.restore();
  }
}
