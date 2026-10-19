export type Point = [number, number];

export type Affiliation = 'friend' | 'hostile' | 'neutral' | 'unknown';

export type UnitType = 
  | 'infantry' 
  | 'armor' 
  | 'mech' 
  | 'artillery' 
  | 'airdefense' 
  | 'recon' 
  | 'aviation' 
  | 'hq';

export type Echelon = 
  | 'team' 
  | 'squad' 
  | 'platoon' 
  | 'company' 
  | 'battalion' 
  | 'regiment' 
  | 'brigade' 
  | 'division';

export type UnitStatus = 'nominal' | 'damaged' | 'destroyed';

export interface MilitaryUnit {
  id: string;
  affiliation: Affiliation;
  unitType: UnitType;
  echelon: Echelon;
  name: string;
  designation?: string;
  x: number; // Grid world coordinate
  y: number; // Grid world coordinate
  rotation: number; // in degrees
  speed?: number; // km/h
  heading?: number; // 0-360 deg
  status: UnitStatus;
  readiness: number; // 0.0 - 1.0 (combat readiness)
  lkpTime?: number; // Last Known Position timestamp (for hostile fog)
  selected?: boolean;
}

export type GraphicType = 
  | 'attack_arrow' 
  | 'support_arrow' 
  | 'front_line' 
  | 'blocking_line' 
  | 'assembly_area' 
  | 'radar_sector' 
  | 'fire_fan';

export interface TacticalGraphic {
  id: string;
  type: GraphicType;
  affiliation: Affiliation;
  points: Point[]; // Grid world coordinates
  label: string;
  radius?: number; // for sectors
  startAngle?: number;
  endAngle?: number;
  selected?: boolean;
}

export type TerrainShapeType = 'island' | 'basin' | 'ridge' | 'terraces' | 'natural';

export interface TerrainConfig {
  seed: number;
  width: number;
  height: number;
  scale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  shapeType: TerrainShapeType;
  seaLevel: number; // Normalized 0.0 ~ 1.0
  heightScale: number; // meters for peak (e.g., 1200m)
  contourInterval: number; // e.g., 20m for intermediate, 100m for index
}

export type ThemeMode = 'dark' | 'light';

export interface ViewportTransform {
  panX: number;
  panY: number;
  zoom: number;
  rotation: number;
}

export interface ProbeInfo {
  screenX: number;
  screenY: number;
  gridX: number;
  gridY: number;
  lat: number;
  lon: number;
  latDMS: string;
  lonDMS: string;
  mgrs: string;
  elevation: number; // in meters
  normalizedHeight: number;
  slopeDeg: number;
  terrainType: string;
}

export interface LOSResult {
  start: Point;
  end: Point;
  visiblePoints: Point[];
  blockedPoints: Point[];
  blockedAt?: Point;
  hasObstruction: boolean;
  minClearance: number;
}

export interface ElevationProfileSample {
  distance: number; // meters from start
  elevation: number; // meters
  t: number; // 0 to 1
  point: Point;
}

export interface Toponym {
  id: string;
  name: string;
  x: number;
  y: number;
  elevation: number;
  type: 'peak' | 'pass' | 'water' | 'settlement' | 'ridge';
}

export interface ProjectData {
  version: string;
  name: string;
  operationCode: string;
  timestamp: string;
  terrainConfig: TerrainConfig;
  theme: ThemeMode;
  units: MilitaryUnit[];
  graphics: TacticalGraphic[];
  toponyms: Toponym[];
  viewport: ViewportTransform;
}
