import { ProjectData } from '../../types';
import { CartoAccessories } from '../carto/accessories';
import { CartoProjection } from '../carto/projection';
import { ContourLine } from '../contour/chaikin';
import { ContourRenderer } from '../contour/renderer';
import { TacticalGraphicsRenderer } from '../tactical/graphics';
import { MilitarySymbolRenderer } from '../tactical/symbols';

/**
 * C-DATA-03: Hi-Res Cartographic Exporter (2K/4K)
 * Composites complete military paper/dark map with neatlines, marginalia, and legends.
 */
export class CartoExporter {
  public static async exportHighResPNG(
    project: ProjectData,
    cachedTerrainCanvas: HTMLCanvasElement,
    contours: ContourLine[],
    exportWidth: number = 2560,
    exportHeight: number = 1440
  ): Promise<void> {
    const canvas = document.createElement('canvas');
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const theme = project.theme;
    const isDark = theme === 'dark';

    // 1. Margin & Map area calculation
    const margin = 50; // border neatline margin
    const mapX = margin;
    const mapY = margin + 30; // top banner room
    const mapW = exportWidth - margin * 2;
    const mapH = exportHeight - margin * 2 - 40; // bottom margin

    // Background fill
    ctx.fillStyle = isDark ? '#05080D' : '#E2E7ED';
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    // Map sheet inner background
    ctx.fillStyle = isDark ? '#0A1018' : '#F7F5EB';
    ctx.fillRect(mapX, mapY, mapW, mapH);

    // 2. Draw Terrain Raster onto map frame
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();

    ctx.drawImage(cachedTerrainCanvas, 0, 0, cachedTerrainCanvas.width, cachedTerrainCanvas.height, mapX, mapY, mapW, mapH);

    // Map scale factors from grid coords (1024x1024) to map frame
    const scaleX = mapW / cachedTerrainCanvas.width;
    const scaleY = mapH / cachedTerrainCanvas.height;

    // 3. Draw Contours
    ctx.save();
    ctx.translate(mapX, mapY);
    ctx.scale(scaleX, scaleY);
    ContourRenderer.render(ctx, contours, theme, scaleX);
    ctx.restore();

    // 4. Draw Tactical Graphics
    const vpExport = { panX: mapX, panY: mapY, zoom: scaleX, rotation: 0 };
    const proj = new CartoProjection(cachedTerrainCanvas.width, cachedTerrainCanvas.height);
    TacticalGraphicsRenderer.render(ctx, project.graphics, vpExport, proj, theme, 0);

    // 5. Draw Military Units
    for (const unit of project.units) {
      const sx = mapX + unit.x * scaleX;
      const sy = mapY + unit.y * scaleY;
      MilitarySymbolRenderer.renderUnit(ctx, unit, sx, sy, theme, 1.2);
    }

    ctx.restore(); // Undo map clipping

    // 6. Draw Standard Military Border Neatlines
    ctx.strokeStyle = isDark ? '#E5A93C' : '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    // Outer double border
    ctx.lineWidth = 1;
    ctx.strokeStyle = isDark ? 'rgba(229, 169, 60, 0.45)' : 'rgba(15, 23, 42, 0.4)';
    ctx.strokeRect(mapX - 6, mapY - 6, mapW + 12, mapH + 12);

    // 7. Top Banner & Marginalia
    ctx.font = 'bold 16px "Chakra Petch", "Rajdhani", Inter, sans-serif';
    ctx.fillStyle = isDark ? '#F1F5F9' : '#0F172A';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const opName = project.name || 'OPERATION IRON VEIL';
    ctx.fillText(`TACTICAL SITUATION MAP — ${opName.toUpperCase()}`, mapX, 16);

    // Security Classification Badge
    ctx.font = 'bold 12px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = '#EF4444';
    ctx.textAlign = 'right';
    ctx.fillText('TOP SECRET // NOFORN // EXERCISE PHANTOM DART', exportWidth - mapX, 18);

    // 8. Scale & Compass & Legend
    CartoAccessories.renderCompass(ctx, exportWidth - mapX - 50, mapY + 60, vpExport, theme);
    CartoAccessories.renderScaleBar(ctx, exportWidth / 2 - 80, exportHeight - margin - 20, vpExport, theme);
    CartoAccessories.renderElevationLegend(ctx, mapX + 16, mapY + 16, project.terrainConfig, theme);

    // 9. Bottom Footer Metadata
    ctx.font = '10px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = isDark ? '#8FA6BA' : '#475569';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z';
    ctx.fillText(`DATUM: WGS84 / MGRS 100M | PROJECTION: UTM ZONE 51N | TIMESTAMP: ${dateStr}`, mapX, exportHeight - 14);

    // 10. Download image
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${project.operationCode || 'TACMAP'}_${exportWidth}x${exportHeight}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
