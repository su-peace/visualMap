import { ThemeMode, ViewportTransform } from '../../types';
import { CartoProjection } from './projection';

/**
 * C-GRID-02: Military Grid Reference System (MGRS) & Kilometric Grid Overlay
 * Renders 1km primary and 100m secondary grids with border tick labels and LOD.
 */
export class MGRSGridRenderer {
  public static render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    vp: ViewportTransform,
    proj: CartoProjection,
    theme: ThemeMode
  ): void {
    ctx.save();

    const isDark = theme === 'dark';
    const mainGridColor = isDark
      ? 'rgba(148, 163, 184, 0.24)'
      : 'rgba(30, 45, 65, 0.22)';
    const subGridColor = isDark
      ? 'rgba(148, 163, 184, 0.10)'
      : 'rgba(30, 45, 65, 0.10)';
    const textColor = isDark ? '#94A3B8' : '#475569';
    const textBg = isDark ? 'rgba(14, 18, 24, 0.92)' : 'rgba(255, 255, 255, 0.88)';

    // Step in world grid units
    // Assume 1024 grid units = 10km (10,000m)
    // 1km = 102.4 units
    // 100m = 10.24 units
    const baseGridStep = 102.4; // ~1km
    const screenGridStep = baseGridStep * vp.zoom;

    // Viewport bounds in world coordinates
    const tl = proj.screenToGrid(0, 0, vp);
    const br = proj.screenToGrid(width, height, vp);

    const minX = Math.max(0, Math.floor(tl[0] / baseGridStep) * baseGridStep);
    const maxX = Math.min(proj.gridWidth, Math.ceil(br[0] / baseGridStep) * baseGridStep);
    const minY = Math.max(0, Math.floor(tl[1] / baseGridStep) * baseGridStep);
    const maxY = Math.min(proj.gridHeight, Math.ceil(br[1] / baseGridStep) * baseGridStep);

    // 1. Draw sub-grid (100m) if zoomed in enough (screenGridStep > 120px)
    if (screenGridStep > 120) {
      const subStep = baseGridStep / 10.0;
      const subAlpha = Math.min(1.0, (screenGridStep - 120) / 100);

      ctx.beginPath();
      ctx.strokeStyle = isDark
        ? `rgba(148, 163, 184, ${0.10 * subAlpha})`
        : `rgba(30, 45, 65, ${0.12 * subAlpha})`;
      ctx.lineWidth = 0.5;

      const subMinX = Math.max(0, Math.floor(tl[0] / subStep) * subStep);
      const subMaxX = Math.min(proj.gridWidth, Math.ceil(br[0] / subStep) * subStep);
      const subMinY = Math.max(0, Math.floor(tl[1] / subStep) * subStep);
      const subMaxY = Math.min(proj.gridHeight, Math.ceil(br[1] / subStep) * subStep);

      for (let x = subMinX; x <= subMaxX; x += subStep) {
        const s = proj.gridToScreen(x, 0, vp);
        ctx.moveTo(s[0], 0);
        ctx.lineTo(s[0], height);
      }
      for (let y = subMinY; y <= subMaxY; y += subStep) {
        const s = proj.gridToScreen(0, y, vp);
        ctx.moveTo(0, s[1]);
        ctx.lineTo(width, s[1]);
      }
      ctx.stroke();
    }

    // 2. Draw main 1km grid
    ctx.beginPath();
    ctx.strokeStyle = mainGridColor;
    ctx.lineWidth = 1.0;

    for (let x = minX; x <= maxX; x += baseGridStep) {
      const s = proj.gridToScreen(x, 0, vp);
      ctx.moveTo(s[0], 0);
      ctx.lineTo(s[0], height);
    }
    for (let y = minY; y <= maxY; y += baseGridStep) {
      const s = proj.gridToScreen(0, y, vp);
      ctx.moveTo(0, s[1]);
      ctx.lineTo(width, s[1]);
    }
    ctx.stroke();

    // 3. Grid labels along viewport borders
    ctx.font = '10px "JetBrains Mono", Consolas, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // X axis labels (Top and Bottom edges)
    for (let x = minX; x <= maxX; x += baseGridStep) {
      const s = proj.gridToScreen(x, 0, vp);
      if (s[0] < 40 || s[0] > width - 40) continue;

      const kmIdx = Math.round(x / baseGridStep);
      const label = (kmIdx + 80).toString().padStart(2, '0'); // e.g., 81, 82...

      // Top label
      ctx.fillStyle = textBg;
      ctx.fillRect(s[0] - 12, 42, 24, 14);
      ctx.fillStyle = textColor;
      ctx.fillText(label, s[0], 49);

      // Bottom label
      ctx.fillStyle = textBg;
      ctx.fillRect(s[0] - 12, height - 36, 24, 14);
      ctx.fillStyle = textColor;
      ctx.fillText(label, s[0], height - 29);
    }

    // Y axis labels (Left and Right edges)
    for (let y = minY; y <= maxY; y += baseGridStep) {
      const s = proj.gridToScreen(0, y, vp);
      if (s[1] < 60 || s[1] > height - 50) continue;

      const kmIdx = Math.round((proj.gridHeight - y) / baseGridStep);
      const label = (kmIdx + 40).toString().padStart(2, '0'); // e.g., 41, 42...

      // Left label
      ctx.fillStyle = textBg;
      ctx.fillRect(68, s[1] - 8, 22, 16);
      ctx.fillStyle = textColor;
      ctx.fillText(label, 79, s[1]);

      // Right label
      ctx.fillStyle = textBg;
      ctx.fillRect(width - 32, s[1] - 8, 22, 16);
      ctx.fillStyle = textColor;
      ctx.fillText(label, width - 21, s[1]);
    }

    // 4. Subtle Crosshairs at major intersections
    ctx.strokeStyle = isDark ? 'rgba(92, 225, 255, 0.4)' : 'rgba(10, 100, 180, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const crossSize = 4;
    for (let x = minX; x <= maxX; x += baseGridStep) {
      for (let y = minY; y <= maxY; y += baseGridStep) {
        const s = proj.gridToScreen(x, y, vp);
        if (s[0] >= 0 && s[0] <= width && s[1] >= 0 && s[1] <= height) {
          ctx.moveTo(s[0] - crossSize, s[1]);
          ctx.lineTo(s[0] + crossSize, s[1]);
          ctx.moveTo(s[0], s[1] - crossSize);
          ctx.lineTo(s[0], s[1] + crossSize);
        }
      }
    }
    ctx.stroke();

    ctx.restore();
  }
}
