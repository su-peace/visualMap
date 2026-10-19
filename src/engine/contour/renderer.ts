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

    // Style tokens based on theme
    const isDark = theme === 'dark';
    const indexStroke = isDark
      ? 'rgba(92, 225, 255, 0.82)'
      : 'rgba(122, 75, 42, 0.85)';
    const interStroke = isDark
      ? 'rgba(92, 225, 255, 0.32)'
      : 'rgba(122, 75, 42, 0.38)';
    const labelBg = isDark
      ? 'rgba(10, 16, 24, 0.90)'
      : 'rgba(247, 245, 235, 0.92)';
    const labelColor = isDark ? '#E6F1FA' : '#4A2A18';

    // 1. Ultra-fast Path2D native rendering
    if (compiled) {
      // Phase 1: Draw intermediate contours
      ctx.beginPath();
      ctx.strokeStyle = interStroke;
      ctx.lineWidth = Math.max(0.75, 0.8 / scale);
      ctx.stroke(compiled.interPath);

      // Phase 2: Draw index contours
      ctx.beginPath();
      ctx.strokeStyle = indexStroke;
      ctx.lineWidth = Math.max(1.5, 1.8 / scale);
      ctx.stroke(compiled.indexPath);

      // Phase 3: Dynamic elevation labels on index contours with viewport culling
      if (compiled.labels.length > 0) {
        const fontSize = Math.max(9, Math.round(11 / scale));
        ctx.font = `bold ${fontSize}px "JetBrains Mono", Consolas, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const b = viewBounds;

        for (let i = 0; i < compiled.labels.length; i++) {
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
