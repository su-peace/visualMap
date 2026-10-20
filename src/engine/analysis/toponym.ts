import { TerrainConfig, ThemeMode, Toponym, ViewportTransform } from '../../types';
import { CartoProjection } from '../carto/projection';

/**
 * C-ANA-04: Automated Military Toponym Generator
 * Scans local terrain features (peaks, valleys, saddles, shores) and generates tactical labels.
 */
export class ToponymGenerator {
  private static readonly PEAK_NAMES = [
    '702高地', '鹰嘴崖', '望海尖', '黑风岭', '狼牙峰', '铁岭顶', '白云障', '雷达尖', '大黑山', '将军石'
  ];

  private static readonly PASS_NAMES = [
    '鬼见愁隘口', '双岔峪', '风门岭', '白石关', '一线天', '青龙峡', '断桥口'
  ];

  private static readonly WATER_NAMES = [
    '双岔湾', '大青洲', '月亮沙洲', '黑水河口', '铁甲港', '芦苇滩'
  ];

  private static readonly SETTLEMENT_NAMES = [
    '大洼集', '红星农场', '西窑村', '马家营', '七里桥', '东港镇', '黄草铺', '前赵屯'
  ];

  public static generateToponyms(
    heightfield: Float32Array,
    width: number,
    height: number,
    config: TerrainConfig
  ): Toponym[] {
    const toponyms: Toponym[] = [];
    const seaLevel = config.seaLevel || 0.18;
    const maxElev = config.heightScale || 1200;

    const sampleZ = (x: number, y: number) => {
      const normH = heightfield[y * width + x];
      if (normH < seaLevel) return 0;
      return Math.round(((normH - seaLevel) / (1.0 - seaLevel)) * maxElev);
    };

    // Grid search for peaks (local maxima in 100x100 blocks)
    const blockSize = 140;
    let peakIndex = 0;
    let passIndex = 0;
    let settlementIndex = 0;
    let waterIndex = 0;

    for (let by = blockSize / 2; by < height - blockSize / 2; by += blockSize) {
      for (let bx = blockSize / 2; bx < width - blockSize / 2; bx += blockSize) {
        let maxVal = -1;
        let maxPos: [number, number] = [bx, by];
        let minVal = 999999;
        let minPos: [number, number] = [bx, by];

        for (let dy = -blockSize / 3; dy <= blockSize / 3; dy += 8) {
          for (let dx = -blockSize / 3; dx <= blockSize / 3; dx += 8) {
            const x = Math.floor(bx + dx);
            const y = Math.floor(by + dy);
            const z = sampleZ(x, y);

            if (z > maxVal) {
              maxVal = z;
              maxPos = [x, y];
            }
            if (z < minVal) {
              minVal = z;
              minPos = [x, y];
            }
          }
        }

        // If prominent peak
        if (maxVal > maxElev * 0.55 && toponyms.length < 15) {
          // If altitude is very specific, generate "702高地" style
          const name =
            peakIndex % 2 === 0
              ? `${maxVal}高地`
              : this.PEAK_NAMES[peakIndex % this.PEAK_NAMES.length];
          toponyms.push({
            id: `peak-${peakIndex++}`,
            name,
            x: maxPos[0],
            y: maxPos[1],
            elevation: maxVal,
            type: 'peak',
          });
        }

        // If gentle lowland plain, settlement
        if (minVal > 15 && minVal < maxElev * 0.25 && settlementIndex < 6) {
          toponyms.push({
            id: `settle-${settlementIndex++}`,
            name: this.SETTLEMENT_NAMES[settlementIndex % this.SETTLEMENT_NAMES.length],
            x: minPos[0],
            y: minPos[1],
            elevation: minVal,
            type: 'settlement',
          });
        }
      }
    }

    return toponyms;
  }

  /**
   * Renders toponym labels on canvas
   */
  public static renderToponyms(
    ctx: CanvasRenderingContext2D,
    toponyms: Toponym[],
    vp: ViewportTransform,
    proj: CartoProjection,
    theme: ThemeMode
  ): void {
    if (toponyms.length === 0 || vp.zoom < 0.45) return;

    ctx.save();
    const isDark = theme === 'dark';
    const cWidth = ctx.canvas.width;
    const cHeight = ctx.canvas.height;

    // Progressive LOD Hierarchy based on zoom:
    // - Tier 1: Macro View (0.45 <= zoom < 0.70): Strategic Major Peaks only (elevation >= 750m)
    // - Tier 2: Tactical View (0.70 <= zoom < 1.20): All Peaks + Principal Settlements
    // - Tier 3: Close Inspection (zoom >= 1.20): Full terrain annotation (passes, small hamlets, micro relief)

    for (const top of toponyms) {
      // 1. Progressive Zoom LOD Filter
      if (vp.zoom < 0.70) {
        if (top.type !== 'peak' || top.elevation < 750) continue;
      } else if (vp.zoom < 1.20) {
        if (top.type !== 'peak' && top.type !== 'settlement') continue;
      }

      // 2. View Frustum Culling (eliminate offscreen label layout computation)
      const [sx, sy] = proj.gridToScreen(top.x, top.y, vp);
      if (sx < -80 || sx > cWidth + 80 || sy < -40 || sy > cHeight + 40) {
        continue;
      }

      // 3. Render Icon & Point
      ctx.beginPath();
      if (top.type === 'peak') {
        // Triangle for peak
        ctx.moveTo(sx, sy - 5);
        ctx.lineTo(sx + 4, sy + 3);
        ctx.lineTo(sx - 4, sy + 3);
        ctx.closePath();
        ctx.fillStyle = isDark ? '#FFB547' : '#D97706';
        ctx.fill();

        // Label with background knockout
        ctx.font = 'bold 11px "HarmonyOS Sans SC", "PingFang SC", sans-serif';
        const labelText = `▲ ${top.name}`;
        const tm = ctx.measureText(labelText);
        ctx.fillStyle = isDark ? 'rgba(10, 16, 24, 0.78)' : 'rgba(255, 255, 255, 0.88)';
        ctx.fillRect(sx - tm.width / 2 - 3, sy + 5, tm.width + 6, 14);

        ctx.fillStyle = isDark ? '#FFD84D' : '#92400E';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(labelText, sx, sy + 6);
      } else if (top.type === 'settlement') {
        // Small town circle
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? '#8FA6BA' : '#475569';
        ctx.fill();

        ctx.font = '10px "HarmonyOS Sans SC", "PingFang SC", sans-serif';
        const labelText = `◎ ${top.name}`;
        const tm = ctx.measureText(labelText);
        ctx.fillStyle = isDark ? 'rgba(10, 16, 24, 0.78)' : 'rgba(255, 255, 255, 0.88)';
        ctx.fillRect(sx - tm.width / 2 - 3, sy + 4, tm.width + 6, 13);

        ctx.fillStyle = isDark ? '#E6F1FA' : '#1E293B';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(labelText, sx, sy + 5);
      } else {
        // Passes and other micro terrain features (Tier 3)
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? '#38BDF8' : '#0284C7';
        ctx.fill();

        ctx.font = '9px "JetBrains Mono", Consolas, monospace';
        const labelText = `⌂ ${top.name}`;
        const tm = ctx.measureText(labelText);
        ctx.fillStyle = isDark ? 'rgba(10, 16, 24, 0.75)' : 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(sx - tm.width / 2 - 2, sy + 4, tm.width + 4, 12);

        ctx.fillStyle = isDark ? '#94A3B8' : '#475569';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(labelText, sx, sy + 5);
      }
    }

    ctx.restore();
  }
}
