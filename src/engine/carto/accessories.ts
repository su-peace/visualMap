import { TerrainConfig, ThemeMode, ViewportTransform } from '../../types';
import { PaletteManager } from '../renderer/palette';

/**
 * C-GRID-03: Cartographic Accessories
 * Graphic Scale Bar, Tactical Compass, and Elevation Legend.
 */
export class CartoAccessories {
  /**
   * Renders graphic step scale bar in lower-center area
   */
  public static renderScaleBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    vp: ViewportTransform,
    theme: ThemeMode
  ): void {
    ctx.save();

    const isDark = theme === 'dark';
    const textColor = isDark ? '#F1F5F9' : '#0F172A';
    const barPrimary = isDark ? '#E5A93C' : '#B45309';
    const barSecondary = isDark ? '#1B212B' : '#CBD5E1';
    const bgBox = isDark ? 'rgba(14, 18, 24, 0.92)' : 'rgba(255, 255, 255, 0.88)';
    const borderColor = isDark ? 'rgba(148, 163, 184, 0.28)' : 'rgba(40, 70, 100, 0.25)';

    // 1024 units = 10,000m (10km). 1 unit = ~9.765m.
    // Screen pixel distance = world_units * zoom
    // 1 meter = (1024 / 10000) * zoom = 0.1024 * zoom pixels.
    const pixelsPerMeter = 0.1024 * vp.zoom;

    // Pick suitable step length (e.g. 500m, 1km, 2km, 5km)
    let targetMeters = 1000;
    const candidates = [100, 200, 500, 1000, 2000, 5000, 10000];
    for (const c of candidates) {
      const px = c * pixelsPerMeter;
      if (px >= 60 && px <= 160) {
        targetMeters = c;
        break;
      }
    }

    const totalWidthPx = targetMeters * pixelsPerMeter;
    const segs = 4;
    const segWidthPx = totalWidthPx / segs;
    const barHeight = 5;

    // Container background
    const padX = 12;
    const padY = 8;
    const boxW = totalWidthPx + padX * 2;
    const boxH = 34;

    ctx.fillStyle = bgBox;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.fillRect(x - padX, y - 18, boxW, boxH);
    ctx.strokeRect(x - padX, y - 18, boxW, boxH);

    // Checkerboard scale segments
    for (let i = 0; i < segs; i++) {
      ctx.fillStyle = i % 2 === 0 ? barPrimary : barSecondary;
      ctx.fillRect(x + i * segWidthPx, y, segWidthPx, barHeight);
    }
    ctx.strokeStyle = isDark ? '#E5A93C' : '#0F172A';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, totalWidthPx, barHeight);

    // Text labels
    ctx.font = '10px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // 0
    ctx.fillText('0', x, y - 2);

    // Mid
    const midMeters = targetMeters / 2;
    const midLabel = midMeters >= 1000 ? `${midMeters / 1000}km` : `${midMeters}m`;
    ctx.fillText(midLabel, x + totalWidthPx / 2, y - 2);

    // End
    const endLabel = targetMeters >= 1000 ? `${targetMeters / 1000}km` : `${targetMeters}m`;
    ctx.fillText(endLabel, x + totalWidthPx, y - 2);

    ctx.restore();
  }

  /**
   * Renders tactical compass with North arrow, magnetic declination (MN),
   * true north (TN) indicator, and interactive tactical hover state.
   */
  public static renderCompass(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    vp: ViewportTransform,
    theme: ThemeMode,
    isHovered: boolean = false,
    radiusOverride?: number
  ): void {
    ctx.save();

    const isDark = theme === 'dark';
    const bgCircle = isDark ? 'rgba(14, 18, 24, 0.94)' : 'rgba(255, 255, 255, 0.94)';
    const rimColor = isHovered
      ? (isDark ? '#E5A93C' : '#B45309')
      : (isDark ? 'rgba(148, 163, 184, 0.38)' : 'rgba(40, 70, 100, 0.35)');
    const northColor = '#EF4444';
    const southColor = isDark ? '#475569' : '#94A3B8';
    const textColor = isDark ? '#F1F5F9' : '#0F172A';
    const accentColor = isDark ? '#E5A93C' : '#B45309';

    const radius = radiusOverride || 24;

    // Hover glow and tactical reticle ring
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = isDark ? 'rgba(229, 169, 60, 0.45)' : 'rgba(180, 83, 9, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = bgCircle;
    ctx.fill();
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = isHovered ? 2 : 1.5;
    ctx.stroke();

    // Rotating dial
    ctx.save();
    ctx.translate(cx, cy);
    const rot = vp.rotation || 0;
    ctx.rotate(rot);

    // Degree markings
    ctx.strokeStyle = isDark ? 'rgba(120, 170, 210, 0.45)' : 'rgba(40, 70, 100, 0.45)';
    for (let i = 0; i < 12; i++) {
      ctx.rotate((30 * Math.PI) / 180);
      const isCardinal = i % 3 === 2; // Every 90 deg
      ctx.lineWidth = isCardinal ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(0, -radius + (isCardinal ? 6 : 3.5));
      ctx.lineTo(0, -radius);
      ctx.stroke();
    }

    // Magnetic North (MN) declination line (~6.5° W declination)
    const declinationRad = (-6.5 * Math.PI) / 180;
    ctx.save();
    ctx.rotate(declinationRad);
    ctx.strokeStyle = isDark ? '#38BDF8' : '#0284C7';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, -radius + 7);
    ctx.lineTo(0, -2);
    ctx.stroke();
    ctx.restore();

    // North Needle (True North - Red)
    ctx.beginPath();
    ctx.moveTo(0, -radius + 6);
    ctx.lineTo(3.5, 0);
    ctx.lineTo(0, -2);
    ctx.closePath();
    ctx.fillStyle = northColor;
    ctx.fill();

    // South Needle
    ctx.beginPath();
    ctx.moveTo(0, radius - 6);
    ctx.lineTo(-3.5, 0);
    ctx.lineTo(0, 2);
    ctx.closePath();
    ctx.fillStyle = southColor;
    ctx.fill();

    // Center pivot
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = textColor;
    ctx.fill();

    ctx.restore();

    // "N" label at top
    ctx.font = 'bold 9px "Rajdhani", Inter, sans-serif';
    ctx.fillStyle = northColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('N', cx, cy - radius - 2);

    // Heading or Action Readout at bottom
    ctx.font = '700 8px "JetBrains Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (isHovered) {
      ctx.fillStyle = accentColor;
      ctx.fillText('RESET N', cx, cy + radius + 4);
    } else {
      const headingDeg = Math.round((-rot * 180 / Math.PI + 360) % 360);
      ctx.fillStyle = isDark ? '#94A3B8' : '#475569';
      ctx.fillText(`${headingDeg.toString().padStart(3, '0')}° TN`, cx, cy + radius + 4);
    }

    ctx.restore();
  }

  /**
   * Renders elevation legend color gradient bar
   */
  public static renderElevationLegend(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    config: TerrainConfig,
    theme: ThemeMode
  ): void {
    ctx.save();

    const isDark = theme === 'dark';
    const textColor = isDark ? '#8FA6BA' : '#475569';
    const bgBox = isDark ? 'rgba(10, 16, 24, 0.75)' : 'rgba(255, 255, 255, 0.85)';
    const borderColor = isDark ? 'rgba(120, 170, 210, 0.25)' : 'rgba(40, 70, 100, 0.25)';

    const barW = 12;
    const barH = 100;

    // Background container
    ctx.fillStyle = bgBox;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.fillRect(x - 8, y - 18, 92, barH + 32);
    ctx.strokeRect(x - 8, y - 18, 92, barH + 32);

    // Title
    ctx.font = 'bold 9px "Rajdhani", Inter, sans-serif';
    ctx.fillStyle = isDark ? '#E6F1FA' : '#0F172A';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('ELEVATION (m)', x, y - 8);

    // Gradient bar
    const lut = PaletteManager.getLut(theme);
    for (let i = 0; i < barH; i++) {
      const t = 1.0 - i / barH; // Top is peak, bottom is sea
      const lutIdx = Math.floor(t * 255.0) * 4;
      ctx.fillStyle = `rgb(${lut[lutIdx]}, ${lut[lutIdx + 1]}, ${lut[lutIdx + 2]})`;
      ctx.fillRect(x, y + i, barW, 1);
    }
    ctx.strokeStyle = isDark ? '#506478' : '#94A3B8';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barW, barH);

    // Ticks & labels
    ctx.font = '9px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const maxElev = config.heightScale || 1200;
    const seaElev = 0;

    // Top: Peak
    ctx.fillText(`${maxElev}`, x + barW + 6, y + 2);
    // Mid: 50%
    ctx.fillText(`${Math.round(maxElev * 0.5)}`, x + barW + 6, y + barH * 0.5);
    // Sea level line
    const seaY = y + barH * (1.0 - (config.seaLevel || 0.18));
    ctx.fillText(`${seaElev}`, x + barW + 6, seaY);

    ctx.restore();
  }
}
