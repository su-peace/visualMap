import { ProbeInfo, TerrainConfig, ThemeMode, ViewportTransform } from '../../types';
import { CartoProjection } from './projection';

/**
 * C-GRID-04: Crosshair and Realtime Terrain Probe
 * Samples heightfield, calculates slopes, and provides military HUD probe data.
 */
export class TerrainProbe {
  public static sample(
    screenX: number,
    screenY: number,
    heightfield: Float32Array | null,
    vp: ViewportTransform,
    proj: CartoProjection,
    config: TerrainConfig
  ): ProbeInfo | null {
    const [gx, gy] = proj.screenToGrid(screenX, screenY, vp);

    if (gx < 0 || gx >= proj.gridWidth || gy < 0 || gy >= proj.gridHeight) {
      return null;
    }

    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const idx = iy * proj.gridWidth + ix;

    let normHeight = 0;
    let slopeDeg = 0;

    if (heightfield && idx >= 0 && idx < heightfield.length) {
      normHeight = heightfield[idx];

      // Slope estimation via central differences
      const xPrev = Math.max(0, ix - 1);
      const xNext = Math.min(proj.gridWidth - 1, ix + 1);
      const yPrev = Math.max(0, iy - 1);
      const yNext = Math.min(proj.gridHeight - 1, iy + 1);

      const hL = heightfield[iy * proj.gridWidth + xPrev];
      const hR = heightfield[iy * proj.gridWidth + xNext];
      const hT = heightfield[yPrev * proj.gridWidth + ix];
      const hB = heightfield[yNext * proj.gridWidth + ix];

      const dzdx = ((hR - hL) / 2.0) * (config.heightScale / 10.0);
      const dzdy = ((hB - hT) / 2.0) * (config.heightScale / 10.0);
      const grad = Math.sqrt(dzdx * dzdx + dzdy * dzdy);
      slopeDeg = Math.round((Math.atan(grad) * 180.0) / Math.PI);
    }

    // Elevation calculation (negative if below sea level)
    const seaLevel = config.seaLevel || 0.18;
    const maxElev = config.heightScale || 1200;
    let elevation = 0;
    if (normHeight < seaLevel) {
      elevation = Math.round(((normHeight - seaLevel) / seaLevel) * 80); // e.g. -40m water depth
    } else {
      elevation = Math.round(((normHeight - seaLevel) / (1.0 - seaLevel)) * maxElev);
    }

    // Geomorphic classification
    let terrainType = '平原低地';
    if (normHeight < seaLevel * 0.7) {
      terrainType = '深水海域';
    } else if (normHeight < seaLevel) {
      terrainType = '浅水滩涂';
    } else if (normHeight < 0.35) {
      terrainType = '滨海平原 / 农田';
    } else if (normHeight < 0.55) {
      terrainType = '起伏丘陵 / 灌木';
    } else if (normHeight < 0.75) {
      terrainType = '中高山地 / 林区';
    } else if (normHeight < 0.90) {
      terrainType = '高山陡崖 / 裸岩';
    } else {
      terrainType = '绝顶主峰 / 积岩';
    }

    const [lat, lon] = proj.gridToGeo(gx, gy);
    const latDMS = CartoProjection.formatDMS(lat, true);
    const lonDMS = CartoProjection.formatDMS(lon, false);
    const mgrs = proj.gridToMGRS(gx, gy);

    return {
      screenX,
      screenY,
      gridX: Math.round(gx),
      gridY: Math.round(gy),
      lat: Number(lat.toFixed(5)),
      lon: Number(lon.toFixed(5)),
      latDMS,
      lonDMS,
      mgrs,
      elevation,
      normalizedHeight: normHeight,
      slopeDeg,
      terrainType,
    };
  }

  /**
   * Renders subtle tactical crosshair at screen cursor
   */
  public static renderCrosshair(
    ctx: CanvasRenderingContext2D,
    probe: ProbeInfo,
    theme: ThemeMode
  ): void {
    ctx.save();

    const isDark = theme === 'dark';
    const strokeColor = isDark ? 'rgba(63, 208, 255, 0.75)' : 'rgba(2, 132, 199, 0.85)';
    const textColor = isDark ? '#E6F1FA' : '#0F172A';
    const badgeBg = isDark ? 'rgba(10, 16, 24, 0.88)' : 'rgba(255, 255, 255, 0.90)';
    const borderColor = isDark ? 'rgba(63, 208, 255, 0.4)' : 'rgba(2, 132, 199, 0.4)';

    const { screenX, screenY } = probe;
    const size = 10;
    const gap = 3;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;

    // Crosshair hairs with center gap
    ctx.beginPath();
    // Left
    ctx.moveTo(screenX - size - gap, screenY);
    ctx.lineTo(screenX - gap, screenY);
    // Right
    ctx.moveTo(screenX + gap, screenY);
    ctx.lineTo(screenX + size + gap, screenY);
    // Top
    ctx.moveTo(screenX, screenY - size - gap);
    ctx.lineTo(screenX, screenY - gap);
    // Bottom
    ctx.moveTo(screenX, screenY + gap);
    ctx.lineTo(screenX, screenY + size + gap);
    ctx.stroke();

    // Small floating badge with elevation & coordinate preview
    const badgeX = screenX + 14;
    const badgeY = screenY + 14;
    const badgeW = 95;
    const badgeH = 26;

    ctx.fillStyle = badgeBg;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

    ctx.font = 'bold 9px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = isDark ? '#E5A93C' : '#B45309';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`ELV: ${probe.elevation}m`, badgeX + 5, badgeY + 4);

    ctx.font = '8px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = textColor;
    ctx.fillText(`${probe.gridX}, ${probe.gridY} | ${probe.slopeDeg}°`, badgeX + 5, badgeY + 15);

    ctx.restore();
  }
}
