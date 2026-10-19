import { ElevationProfileSample, Point, TerrainConfig, ThemeMode } from '../../types';

/**
 * C-ANA-03: Terrain Elevation Cross-Section Profile Analyzer
 * Generates vertical slices of terrain along tactical transect lines.
 */
export class ElevationProfileAnalyzer {
  public static sampleProfile(
    start: Point,
    end: Point,
    heightfield: Float32Array,
    gridWidth: number,
    gridHeight: number,
    config: TerrainConfig,
    numSamples: number = 100
  ): {
    samples: ElevationProfileSample[];
    totalDistanceMeters: number;
    minElevation: number;
    maxElevation: number;
  } {
    const gridDist = Math.hypot(end[0] - start[0], end[1] - start[1]);
    // 1024 grid units = 10,000 meters. 1 grid unit = 9.7656 meters
    const totalDistanceMeters = Math.round(gridDist * 9.7656);

    const seaLevel = config.seaLevel || 0.18;
    const maxElev = config.heightScale || 1200;

    const sampleZ = (gx: number, gy: number): number => {
      const ix = Math.max(0, Math.min(gridWidth - 1, Math.floor(gx)));
      const iy = Math.max(0, Math.min(gridHeight - 1, Math.floor(gy)));
      const normH = heightfield[iy * gridWidth + ix];
      if (normH < seaLevel) {
        return Math.round(((normH - seaLevel) / seaLevel) * 80);
      }
      return Math.round(((normH - seaLevel) / (1.0 - seaLevel)) * maxElev);
    };

    const samples: ElevationProfileSample[] = [];
    let minElevation = Infinity;
    let maxElevation = -Infinity;

    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const gx = start[0] + (end[0] - start[0]) * t;
      const gy = start[1] + (end[1] - start[1]) * t;

      const z = sampleZ(gx, gy);
      const dist = Math.round(t * totalDistanceMeters);

      if (z < minElevation) minElevation = z;
      if (z > maxElevation) maxElevation = z;

      samples.push({
        distance: dist,
        elevation: z,
        t,
        point: [gx, gy],
      });
    }

    return {
      samples,
      totalDistanceMeters,
      minElevation,
      maxElevation,
    };
  }

  /**
   * Renders the cross-section profile into a canvas context (e.g., bottom drawer chart)
   */
  public static renderChart(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    data: {
      samples: ElevationProfileSample[];
      totalDistanceMeters: number;
      minElevation: number;
      maxElevation: number;
    },
    theme: ThemeMode
  ): void {
    ctx.clearRect(0, 0, width, height);

    const isDark = theme === 'dark';
    const textColor = isDark ? '#8FA6BA' : '#475569';
    const gridColor = isDark ? 'rgba(120, 170, 210, 0.15)' : 'rgba(40, 70, 100, 0.15)';
    const lineColor = isDark ? '#3FD0FF' : '#0284C7';
    const fillColor = isDark ? 'rgba(63, 208, 255, 0.22)' : 'rgba(2, 132, 199, 0.20)';

    const padLeft = 45;
    const padRight = 20;
    const padTop = 15;
    const padBottom = 25;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const minZ = Math.min(0, data.minElevation);
    const maxZ = Math.max(100, data.maxElevation + 50);
    const zRange = maxZ - minZ || 1;

    // Draw horizontal grid lines & Y labels
    ctx.font = '9px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const zVal = Math.round(minZ + (zRange * i) / ySteps);
      const y = padTop + chartH * (1.0 - i / ySteps);

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillText(`${zVal}m`, padLeft - 6, y);
    }

    if (data.samples.length < 2) return;

    // Build profile polygon
    ctx.beginPath();
    const firstX = padLeft;
    const firstY = padTop + chartH * (1.0 - (data.samples[0].elevation - minZ) / zRange);
    ctx.moveTo(firstX, firstY);

    for (let i = 1; i < data.samples.length; i++) {
      const s = data.samples[i];
      const x = padLeft + chartW * s.t;
      const y = padTop + chartH * (1.0 - (s.elevation - minZ) / zRange);
      ctx.lineTo(x, y);
    }

    // Fill under curve
    ctx.save();
    ctx.lineTo(padLeft + chartW, padTop + chartH);
    ctx.lineTo(padLeft, padTop + chartH);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.restore();

    // Stroke curve
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(firstX, firstY);
    for (let i = 1; i < data.samples.length; i++) {
      const s = data.samples[i];
      const x = padLeft + chartW * s.t;
      const y = padTop + chartH * (1.0 - (s.elevation - minZ) / zRange);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Distance X labels
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('0m', padLeft, height - padBottom + 6);
    ctx.fillText(
      `${Math.round(data.totalDistanceMeters / 2)}m`,
      padLeft + chartW / 2,
      height - padBottom + 6
    );
    ctx.fillText(`${data.totalDistanceMeters}m`, padLeft + chartW, height - padBottom + 6);
  }
}
