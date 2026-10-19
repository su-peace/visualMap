import { Point, ViewportTransform } from '../../types';

/**
 * C-GRID-01: Spatial Coordinate Projection & Geo Adapter
 * Translates between Screen (px), Terrain Grid [col, row], and WGS84 Geo [lat, lon].
 */
export class CartoProjection {
  // Virtual geographic bounding box (e.g., Liaodong Peninsula coastal area)
  public static readonly LAT_MIN = 38.7000;
  public static readonly LAT_MAX = 38.8667;
  public static readonly LON_MIN = 121.5000;
  public static readonly LON_MAX = 121.7500;

  // Grid dimensions
  public gridWidth: number = 1024;
  public gridHeight: number = 1024;

  constructor(gridWidth: number = 1024, gridHeight: number = 1024) {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
  }

  /**
   * Converts Screen pixel coords to Grid world coords
   */
  public screenToGrid(screenX: number, screenY: number, vp: ViewportTransform): Point {
    const gx = (screenX - vp.panX) / vp.zoom;
    const gy = (screenY - vp.panY) / vp.zoom;
    return [gx, gy];
  }

  /**
   * Converts Grid world coords to Screen pixel coords
   */
  public gridToScreen(gx: number, gy: number, vp: ViewportTransform): Point {
    const sx = gx * vp.zoom + vp.panX;
    const sy = gy * vp.zoom + vp.panY;
    return [sx, sy];
  }

  /**
   * Converts Grid world coords to Virtual WGS84 [lat, lon]
   */
  public gridToGeo(gx: number, gy: number): [number, number] {
    const u = Math.max(0, Math.min(1, gx / this.gridWidth));
    const v = Math.max(0, Math.min(1, gy / this.gridHeight));

    // Latitude increases upwards (smaller gy), Longitude increases rightwards (larger gx)
    const lat = CartoProjection.LAT_MAX - v * (CartoProjection.LAT_MAX - CartoProjection.LAT_MIN);
    const lon = CartoProjection.LON_MIN + u * (CartoProjection.LON_MAX - CartoProjection.LON_MIN);
    return [lat, lon];
  }

  /**
   * Formats decimal degrees to DMS string (e.g. 38°45'22.4" N)
   */
  public static formatDMS(val: number, isLat: boolean): string {
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    const absVal = Math.abs(val);
    const deg = Math.floor(absVal);
    const minFloat = (absVal - deg) * 60.0;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60.0).toFixed(1);
    return `${deg}°${min.toString().padStart(2, '0')}'${sec.padStart(4, '0')}" ${dir}`;
  }

  /**
   * Generates a standard MGRS military grid coordinate string from grid pos
   */
  public gridToMGRS(gx: number, gy: number): string {
    const [lat, lon] = this.gridToGeo(gx, gy);
    // Virtual 100km square designation: 51S TH
    const easting = Math.floor((gx / this.gridWidth) * 100000);
    const northing = Math.floor(((this.gridHeight - gy) / this.gridHeight) * 100000);
    const eStr = easting.toString().padStart(5, '0');
    const nStr = northing.toString().padStart(5, '0');
    return `51S TH ${eStr.slice(0, 4)} ${nStr.slice(0, 4)}`;
  }
}
