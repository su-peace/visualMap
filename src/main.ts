import {
  Affiliation,
  Echelon,
  GraphicType,
  MilitaryUnit,
  Point,
  ProjectData,
  TacticalGraphic,
  TerrainConfig,
  ThemeMode,
  Toponym,
  UnitStatus,
  UnitType,
  ViewportTransform,
} from './types';
import { PRNG } from './engine/math/prng';
import { TerrainGenerator } from './engine/terrain/generator';
import { HillshadeRenderer } from './engine/renderer/shading';
import { TileCache } from './engine/renderer/tileCache';
import { MarchingSquares } from './engine/contour/marchingSquares';
import { ContourLine, ContourProcessor } from './engine/contour/chaikin';
import { CompiledContours, ContourRenderer } from './engine/contour/renderer';
import { CartoProjection } from './engine/carto/projection';
import { MGRSGridRenderer } from './engine/carto/mgrsGrid';
import { CartoAccessories } from './engine/carto/accessories';
import { TerrainProbe } from './engine/carto/probe';
import { MilitarySymbolRenderer } from './engine/tactical/symbols';
import { TacticalGraphicsRenderer } from './engine/tactical/graphics';
import { InteractionHelper } from './engine/tactical/interaction';
import {
  AddGraphicCommand,
  AddUnitCommand,
  CommandManager,
  DeleteUnitsCommand,
  MoveUnitCommand,
} from './engine/tactical/commands';
import { ProjectSerializer } from './engine/storage/project';
import { DraftStorage } from './engine/storage/indexedDb';
import { CartoExporter } from './engine/export/cartoExport';
import { LOSAnalyzer } from './engine/analysis/los';
import { ViewshedAnalyzer } from './engine/analysis/viewshed';
import { ElevationProfileAnalyzer } from './engine/analysis/profile';
import { ToponymGenerator } from './engine/analysis/toponym';

/**
 * VISUALMAP / TACVIEW Engine Main Application Controller
 */
class VisualMapApp {
  // Canvases & Contexts (Layered Multi-Canvas Architecture)
  private terrainCanvas: HTMLCanvasElement;
  private contourCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;
  private hudCanvas: HTMLCanvasElement;
  private terrainCtx: CanvasRenderingContext2D;
  private contourCtx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;
  private hudCtx: CanvasRenderingContext2D;
  private profileCanvas: HTMLCanvasElement;
  private profileCtx: CanvasRenderingContext2D;

  // Cached Telemetry DOM Elements for zero-reflow updates
  private elLatLon: HTMLElement | null = null;
  private elMGRS: HTMLElement | null = null;
  private elElev: HTMLElement | null = null;
  private elSlope: HTMLElement | null = null;
  private elType: HTMLElement | null = null;
  private elGridPos: HTMLElement | null = null;
  private elZoom: HTMLElement | null = null;
  private elSeed: HTMLElement | null = null;

  // Render loop coalescing flags (RAF)
  private renderScheduled: boolean = false;
  private hudScheduled: boolean = false;

  // Subsystems
  private tileCache: TileCache;
  private proj: CartoProjection;
  private commandMgr: CommandManager;

  // State
  private theme: ThemeMode = 'dark';
  private terrainConfig: TerrainConfig = {
    seed: 1337,
    width: 1024,
    height: 1024,
    scale: 220,
    octaves: 6,
    persistence: 0.48,
    lacunarity: 2.0,
    shapeType: 'island',
    seaLevel: 0.18,
    heightScale: 1200,
    contourInterval: 25,
  };

  private heightfield: Float32Array | null = null;
  private contours: ContourLine[] = [];
  private compiledContours: CompiledContours | null = null;
  private toponyms: Toponym[] = [];
  private units: MilitaryUnit[] = [];
  private graphics: TacticalGraphic[] = [];

  // Viewport camera
  private vp: ViewportTransform = {
    panX: 100,
    panY: 50,
    zoom: 0.85,
    rotation: 0,
  };

  // Interaction State
  private activeMode: 'select' | 'pan' | 'unit' | 'graphic' | 'analysis' = 'select';
  private activeGraphicType: GraphicType = 'attack_arrow';
  private activeAnalysisType: 'los' | 'viewshed' | 'profile' = 'los';
  private mousePos: Point = [0, 0];
  private isMouseDown: boolean = false;
  private isPanning: boolean = false;
  private isSpacePressed: boolean = false;
  private panStart: Point = [0, 0];
  private initialVpPan: Point = [0, 0];

  // Dragging Unit
  private draggingUnit: MilitaryUnit | null = null;
  private dragUnitStartPos: Point = [0, 0];

  // Drawing Graphic Points
  private graphicTempPoints: Point[] = [];

  // Analysis Results
  private activeLOS: any = null;
  private activeViewshed: any = null;
  private activeViewshedCenter: Point | null = null;
  private analysisTempPoints: Point[] = [];

  // Layers Visibility
  private layers = {
    terrain: true,
    contours: true,
    grid: true,
    units: true,
    graphics: true,
    toponyms: true,
  };

  // Mission Start Time
  private missionStartTime: number = Date.now() - 2 * 3600 * 1000 - 14 * 60 * 1000 - 33 * 1000;

  constructor() {
    this.terrainCanvas = document.getElementById('terrainCanvas') as HTMLCanvasElement;
    this.contourCanvas = document.getElementById('contourCanvas') as HTMLCanvasElement;
    this.overlayCanvas = document.getElementById('overlayCanvas') as HTMLCanvasElement;
    this.hudCanvas = document.getElementById('hudCanvas') as HTMLCanvasElement;
    this.terrainCtx = this.terrainCanvas.getContext('2d')!;
    this.contourCtx = this.contourCanvas.getContext('2d')!;
    this.overlayCtx = this.overlayCanvas.getContext('2d')!;
    this.hudCtx = this.hudCanvas.getContext('2d')!;
    this.profileCanvas = document.getElementById('profileCanvas') as HTMLCanvasElement;
    this.profileCtx = this.profileCanvas.getContext('2d')!;

    this.elLatLon = document.getElementById('probeLatLon');
    this.elMGRS = document.getElementById('probeMGRS');
    this.elElev = document.getElementById('probeElev');
    this.elSlope = document.getElementById('probeSlope');
    this.elType = document.getElementById('probeType');
    this.elGridPos = document.getElementById('probeGridPos');
    this.elZoom = document.getElementById('zoomVal');
    this.elSeed = document.getElementById('mapSeedVal');

    (window as any).app = this;

    this.tileCache = new TileCache(1024, 1024);
    this.proj = new CartoProjection(1024, 1024);
    this.commandMgr = new CommandManager(() => {
      this.updateStatsAndInspector();
      this.requestRender();
    });

    this.initViewport();
    this.initDefaultEntities();
    this.bindEvents();
    this.startClocks();
    this.generateTerrain();
  }

  private initViewport(): void {
    const resize = () => {
      const container = document.getElementById('viewportContainer')!;
      const w = container.clientWidth;
      const h = container.clientHeight;

      this.terrainCanvas.width = w;
      this.terrainCanvas.height = h;
      this.contourCanvas.width = w;
      this.contourCanvas.height = h;
      this.overlayCanvas.width = w;
      this.overlayCanvas.height = h;
      this.hudCanvas.width = w;
      this.hudCanvas.height = h;

      this.requestRender();
    };

    window.addEventListener('resize', resize);
    resize();

    // Center the map in viewport initially
    const w = this.terrainCanvas.width;
    const h = this.terrainCanvas.height;
    this.vp.zoom = Math.min(w, h) / 1150;
    this.vp.panX = (w - this.terrainConfig.width * this.vp.zoom) / 2;
    this.vp.panY = (h - this.terrainConfig.height * this.vp.zoom) / 2;
  }

  /**
   * Initializes initial mock tactical units and graphics
   */
  private initDefaultEntities(): void {
    this.units = [
      // Friendly Forces (Blue)
      {
        id: 'u-friend-1',
        affiliation: 'friend',
        unitType: 'armor',
        echelon: 'battalion',
        name: '1-66 ARMOR',
        x: 320,
        y: 680,
        rotation: 0,
        speed: 25,
        heading: 42,
        status: 'nominal',
        readiness: 0.95,
      },
      {
        id: 'u-friend-2',
        affiliation: 'friend',
        unitType: 'mech',
        echelon: 'company',
        name: 'B CO / 1-22 INF',
        x: 420,
        y: 640,
        rotation: 0,
        speed: 18,
        heading: 30,
        status: 'nominal',
        readiness: 0.88,
      },
      {
        id: 'u-friend-3',
        affiliation: 'friend',
        unitType: 'artillery',
        echelon: 'battalion',
        name: '2-17 FA BTRY',
        x: 260,
        y: 780,
        rotation: 0,
        status: 'nominal',
        readiness: 1.0,
      },
      {
        id: 'u-friend-4',
        affiliation: 'friend',
        unitType: 'hq',
        echelon: 'brigade',
        name: '3rd BDE TOC',
        x: 210,
        y: 840,
        rotation: 0,
        status: 'nominal',
        readiness: 1.0,
      },
      // Hostile Forces (Red)
      {
        id: 'u-hostile-1',
        affiliation: 'hostile',
        unitType: 'armor',
        echelon: 'company',
        name: 'RED TANK CO',
        x: 580,
        y: 340,
        rotation: 0,
        speed: 12,
        heading: 210,
        status: 'nominal',
        readiness: 0.92,
      },
      {
        id: 'u-hostile-2',
        affiliation: 'hostile',
        unitType: 'recon',
        echelon: 'squad',
        name: 'SCOUT-1',
        x: 480,
        y: 450,
        rotation: 0,
        speed: 35,
        heading: 195,
        status: 'damaged',
        readiness: 0.65,
      },
      {
        id: 'u-hostile-3',
        affiliation: 'hostile',
        unitType: 'infantry',
        echelon: 'battalion',
        name: '201 MOTOR-RIFLE',
        x: 690,
        y: 310,
        rotation: 0,
        status: 'nominal',
        readiness: 0.85,
      },
    ];

    this.graphics = [
      // Main Attack Arrow
      {
        id: 'g-1',
        type: 'attack_arrow',
        affiliation: 'friend',
        points: [[340, 660], [490, 480]],
        label: 'AXIS FALCON',
      },
      // Front Line
      {
        id: 'g-2',
        type: 'front_line',
        affiliation: 'hostile',
        points: [[360, 420], [530, 410], [670, 440]],
        label: 'FEBA PL ORANGE',
      },
      // Radar Sector
      {
        id: 'g-3',
        type: 'radar_sector',
        affiliation: 'friend',
        points: [[210, 840]],
        radius: 260,
        startAngle: 300,
        endAngle: 40,
        label: 'SENTINEL-1',
      },
      // Assembly Area
      {
        id: 'g-4',
        type: 'assembly_area',
        affiliation: 'friend',
        points: [[220, 720], [380, 710], [390, 830], [240, 850]],
        label: 'AA LIBERTY',
      },
    ];
  }

  /**
   * Generates or regenerates terrain heightfield, hillshading, contours, and toponyms
   */
  public generateTerrain(): void {
    const { width, height, seaLevel } = this.terrainConfig;

    // 1. Generate Heightfield
    this.heightfield = TerrainGenerator.generate(this.terrainConfig);

    // 2. Compute Hillshade and update TileCache
    const imgData = HillshadeRenderer.render(
      this.heightfield,
      width,
      height,
      this.theme,
      seaLevel
    );
    this.tileCache.update(imgData);

    // 3. Extract Contours & Precompile Path2D
    this.extractContours();

    // 4. Generate Toponyms
    this.toponyms = ToponymGenerator.generateToponyms(
      this.heightfield,
      width,
      height,
      this.terrainConfig
    );

    // Update bottom seed
    if (this.elSeed) this.elSeed.textContent = `${this.terrainConfig.seed}`;

    this.updateStatsAndInspector();
    this.requestRender();
  }

  /**
   * Marching Squares & Chaikin smoothing with Path2D Compilation
   */
  private extractContours(): void {
    if (!this.heightfield) return;
    const { width, height, seaLevel, heightScale, contourInterval } = this.terrainConfig;

    this.contours = [];
    const interMeters = contourInterval || 25;
    const indexMeters = interMeters * 5; // e.g. 100m for index

    const numLevels = Math.floor(heightScale / interMeters);

    for (let i = 1; i <= numLevels; i++) {
      const elev = i * interMeters;
      const isIndex = elev % indexMeters === 0;

      // Convert elevation (meters) to normalized height [0, 1]
      const normH = seaLevel + (elev / heightScale) * (1.0 - seaLevel);
      if (normH <= 0 || normH >= 1.0) continue;

      const segs = MarchingSquares.extractSegments(this.heightfield, width, height, normH, 2);
      const lines = ContourProcessor.stitchSegments(segs, normH, elev, isIndex);
      for (let j = 0; j < lines.length; j++) {
        this.contours.push(lines[j]);
      }
    }

    // Precompile contour polylines into reusable native GPU Path2D geometry
    this.compiledContours = ContourRenderer.compilePaths(this.contours);
  }

  /**
   * Theme switcher: Tactical Dark ↔ Military Paper Light Mode
   */
  public toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) themeIcon.textContent = this.theme === 'dark' ? '☀️' : '🌙';

    // Re-render hillshading with new theme palette LUT
    if (this.heightfield) {
      const imgData = HillshadeRenderer.render(
        this.heightfield,
        this.terrainConfig.width,
        this.terrainConfig.height,
        this.theme,
        this.terrainConfig.seaLevel
      );
      this.tileCache.update(imgData);
    }

    this.requestRender();
  }

  /**
   * Coalesced Render Request via requestAnimationFrame
   */
  public requestRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    requestAnimationFrame(() => {
      this.renderScheduled = false;
      this.renderTerrain();
      this.renderContours();
      this.renderOverlay();
      this.renderHud();
    });
  }

  /**
   * High-speed HUD Cursor and Probe update (0.02ms, zero full-scene redraw)
   */
  public requestHudRender(): void {
    if (this.hudScheduled || this.renderScheduled) return;
    this.hudScheduled = true;
    requestAnimationFrame(() => {
      this.hudScheduled = false;
      this.renderHud();
    });
  }

  /**
   * Render Layer 0: Shaded relief raster from TileCache
   */
  public renderTerrain(): void {
    const w = this.terrainCanvas.width;
    const h = this.terrainCanvas.height;
    this.terrainCtx.clearRect(0, 0, w, h);

    if (this.layers.terrain && this.tileCache.ready) {
      this.terrainCtx.save();
      this.terrainCtx.translate(this.vp.panX, this.vp.panY);
      this.terrainCtx.scale(this.vp.zoom, this.vp.zoom);
      this.tileCache.draw(
        this.terrainCtx,
        0,
        0,
        this.terrainConfig.width,
        this.terrainConfig.height
      );
      this.terrainCtx.restore();
    }
  }

  /**
   * Render Layer 1: Vector contours with Path2D & Viewport Culling
   */
  public renderContours(): void {
    const w = this.contourCanvas.width;
    const h = this.contourCanvas.height;
    this.contourCtx.clearRect(0, 0, w, h);

    if (this.layers.contours && this.contours.length > 0) {
      this.contourCtx.save();
      this.contourCtx.translate(this.vp.panX, this.vp.panY);
      this.contourCtx.scale(this.vp.zoom, this.vp.zoom);

      // Viewport bounds in world grid coordinates for label frustum culling
      const tl = this.proj.screenToGrid(0, 0, this.vp);
      const br = this.proj.screenToGrid(w, h, this.vp);
      const viewBounds = {
        minX: Math.min(tl[0], br[0]) - 50,
        minY: Math.min(tl[1], br[1]) - 50,
        maxX: Math.max(tl[0], br[0]) + 50,
        maxY: Math.max(tl[1], br[1]) + 50,
      };

      ContourRenderer.render(
        this.contourCtx,
        this.contours,
        this.theme,
        this.vp.zoom,
        this.compiledContours,
        viewBounds
      );
      this.contourCtx.restore();
    }
  }

  /**
   * Render Layer 2: Tactical overlay (MGRS grid, toponyms, graphics, units, accessories)
   */
  public renderOverlay(): void {
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;
    this.overlayCtx.clearRect(0, 0, w, h);

    // 1. Draw MGRS Grid
    if (this.layers.grid) {
      MGRSGridRenderer.render(this.overlayCtx, w, h, this.vp, this.proj, this.theme);
    }

    // 2. Draw Toponyms
    if (this.layers.toponyms) {
      ToponymGenerator.renderToponyms(this.overlayCtx, this.toponyms, this.vp, this.proj, this.theme);
    }

    // 3. Draw Tactical Graphics
    if (this.layers.graphics) {
      TacticalGraphicsRenderer.render(
        this.overlayCtx,
        this.graphics,
        this.vp,
        this.proj,
        this.theme,
        Date.now()
      );
    }

    // 4. Draw Military Units
    if (this.layers.units) {
      for (const unit of this.units) {
        const [sx, sy] = this.proj.gridToScreen(unit.x, unit.y, this.vp);
        MilitarySymbolRenderer.renderUnit(
          this.overlayCtx,
          unit,
          sx,
          sy,
          this.theme,
          this.vp.zoom
        );
      }
    }

    // 5. Draw Active Analysis (LOS, Viewshed)
    if (this.activeLOS) {
      LOSAnalyzer.renderLOS(this.overlayCtx, this.activeLOS, this.proj, this.vp);
    }
    if (this.activeViewshed && this.activeViewshedCenter) {
      ViewshedAnalyzer.renderViewshed(
        this.overlayCtx,
        this.activeViewshedCenter,
        180,
        this.activeViewshed,
        this.proj,
        this.vp
      );
    }

    // 6. Draw Accessories (Scale bar, Compass, Elevation legend)
    CartoAccessories.renderCompass(this.overlayCtx, 38, 345, this.vp, this.theme);
    CartoAccessories.renderScaleBar(this.overlayCtx, w / 2 - 80, h - 38, this.vp, this.theme);
    CartoAccessories.renderElevationLegend(this.overlayCtx, 16, h - 180, this.terrainConfig, this.theme);
  }

  /**
   * Render Layer 3: Interactive HUD (Crosshair, drawing in progress, telemetry)
   */
  public renderHud(): void {
    const w = this.hudCanvas.width;
    const h = this.hudCanvas.height;
    this.hudCtx.clearRect(0, 0, w, h);

    // 1. Draw Active Graphic Drawing In-Progress Line
    if (this.graphicTempPoints.length > 0) {
      this.hudCtx.save();
      this.hudCtx.strokeStyle = this.theme === 'dark' ? '#3FD0FF' : '#0284C7';
      this.hudCtx.lineWidth = 2;
      this.hudCtx.setLineDash([4, 4]);
      this.hudCtx.beginPath();
      const s0 = this.proj.gridToScreen(this.graphicTempPoints[0][0], this.graphicTempPoints[0][1], this.vp);
      this.hudCtx.moveTo(s0[0], s0[1]);
      for (let i = 1; i < this.graphicTempPoints.length; i++) {
        const s = this.proj.gridToScreen(this.graphicTempPoints[i][0], this.graphicTempPoints[i][1], this.vp);
        this.hudCtx.lineTo(s[0], s[1]);
      }
      this.hudCtx.lineTo(this.mousePos[0], this.mousePos[1]);
      this.hudCtx.stroke();
      this.hudCtx.restore();
    }

    // 2. Draw Probe Crosshair at mouse cursor
    const probe = TerrainProbe.sample(
      this.mousePos[0],
      this.mousePos[1],
      this.heightfield,
      this.vp,
      this.proj,
      this.terrainConfig
    );

    if (probe && this.activeMode !== 'pan') {
      TerrainProbe.renderCrosshair(this.hudCtx, probe, this.theme);
      this.updateBottomTelemetry(probe);
    }
  }

  private updateBottomTelemetry(probe: any): void {
    if (this.elLatLon) this.elLatLon.textContent = `${probe.latDMS}, ${probe.lonDMS}`;
    if (this.elMGRS) this.elMGRS.textContent = probe.mgrs;
    if (this.elElev) this.elElev.textContent = `${probe.elevation}m`;
    if (this.elSlope) this.elSlope.textContent = `${probe.slopeDeg}°`;
    if (this.elType) this.elType.textContent = probe.terrainType;
    if (this.elGridPos) this.elGridPos.textContent = `${probe.gridX}, ${probe.gridY}`;
    if (this.elZoom) this.elZoom.textContent = `${this.vp.zoom.toFixed(2)}x`;
  }

  /**
   * UI Event Bindings
   */
  private bindEvents(): void {
    const container = document.getElementById('viewportContainer')!;

    // Mouse Move (High-performance probe with decoupled HUD)
    container.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      this.mousePos = [mx, my];

      if (this.isPanning) {
        this.vp.panX = this.initialVpPan[0] + (mx - this.panStart[0]);
        this.vp.panY = this.initialVpPan[1] + (my - this.panStart[1]);
        this.requestRender();
        return;
      }

      if (this.draggingUnit) {
        const [gx, gy] = this.proj.screenToGrid(mx, my, this.vp);
        this.draggingUnit.x = Math.round(gx);
        this.draggingUnit.y = Math.round(gy);
        this.requestRender();
        return;
      }

      // Probing only needs HUD canvas update - 0.02ms, zero full-scene redraw!
      this.requestHudRender();
    });

    // Mouse Down
    container.addEventListener('mousedown', (e) => {
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      this.mousePos = [mx, my];

      // Pan with middle click, Space+click, or when 'pan' tool active
      if (e.button === 1 || this.isSpacePressed || this.activeMode === 'pan') {
        this.isPanning = true;
        this.panStart = [mx, my];
        this.initialVpPan = [this.vp.panX, this.vp.panY];
        return;
      }

      if (e.button === 0) {
        this.handleLeftClick(mx, my);
      }
    });

    // Mouse Up
    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
      }

      if (this.draggingUnit) {
        const u = this.draggingUnit;
        const oldPos = this.dragUnitStartPos;
        const newPos: Point = [u.x, u.y];
        if (oldPos[0] !== newPos[0] || oldPos[1] !== newPos[1]) {
          this.commandMgr.execute(new MoveUnitCommand(u, oldPos, newPos));
        }
        this.draggingUnit = null;
      }
    });

    // Mouse Wheel (Zoom towards cursor)
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.25, Math.min(6.0, this.vp.zoom * zoomFactor));

      // Zoom towards mouse position
      this.vp.panX = mx - (mx - this.vp.panX) * (newZoom / this.vp.zoom);
      this.vp.panY = my - (my - this.vp.panY) * (newZoom / this.vp.zoom);
      this.vp.zoom = newZoom;

      this.requestRender();
    }, { passive: false });

    // Compass click resets north orientation
    this.overlayCanvas.addEventListener('click', (e) => {
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = 38;
      const cy = 345;
      if (Math.hypot(mx - cx, my - cy) <= 26) {
        this.vp.rotation = 0;
        this.requestRender();
      }
    });

    // TopBar Buttons
    document.getElementById('btnThemeToggle')!.addEventListener('click', () => this.toggleTheme());
    document.getElementById('btnRandomizeTerrain')!.addEventListener('click', () => {
      this.terrainConfig.seed = Math.floor(Math.random() * 999999) + 1;
      this.generateTerrain();
    });

    document.getElementById('btnUndo')!.addEventListener('click', () => {
      this.commandMgr.undo();
      this.requestRender();
    });
    document.getElementById('btnRedo')!.addEventListener('click', () => {
      this.commandMgr.redo();
      this.requestRender();
    });

    document.getElementById('btnSaveProject')!.addEventListener('click', () => this.saveProject());
    document.getElementById('btnLoadProject')!.addEventListener('click', () => this.loadProject());
    document.getElementById('btnExport4K')!.addEventListener('click', () => this.export4KMap());

    // ToolRail Buttons
    this.bindToolRail();

    // Layers Toggles
    this.bindLayerSwitches();

    // Modal Events
    this.bindModal();

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.commandMgr.redo();
        else this.commandMgr.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.commandMgr.redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const selected = this.units.filter((u) => u.selected);
        if (selected.length > 0) {
          this.commandMgr.execute(new DeleteUnitsCommand(this.units, selected));
        }
      } else if (e.key === ' ') {
        this.isSpacePressed = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === ' ') {
        this.isSpacePressed = false;
      }
    });

    // Close Profile Drawer
    document.getElementById('btnCloseProfile')!.addEventListener('click', () => {
      document.getElementById('profileDrawer')!.classList.remove('open');
    });

    // Toggle Intel Panel
    document.getElementById('btnToggleIntel')!.addEventListener('click', () => {
      document.getElementById('intelPanel')!.classList.toggle('collapsed');
    });
  }

  private handleLeftClick(mx: number, my: number): void {
    const [gx, gy] = this.proj.screenToGrid(mx, my, this.vp);

    if (this.activeMode === 'select') {
      // 1. Hit test units
      let hitUnit: MilitaryUnit | null = null;
      for (const u of this.units) {
        if (InteractionHelper.hitTestUnit(u, mx, my, this.vp, this.proj)) {
          hitUnit = u;
          break;
        }
      }

      if (hitUnit) {
        for (const u of this.units) u.selected = false;
        hitUnit.selected = true;
        this.draggingUnit = hitUnit;
        this.dragUnitStartPos = [hitUnit.x, hitUnit.y];
        this.updateStatsAndInspector();
        this.requestRender();
        return;
      }

      // 2. Hit test graphics
      let hitGraphic: TacticalGraphic | null = null;
      for (const g of this.graphics) {
        if (InteractionHelper.hitTestGraphic(g, mx, my, this.vp, this.proj)) {
          hitGraphic = g;
          break;
        }
      }

      for (const u of this.units) u.selected = false;
      for (const g of this.graphics) g.selected = false;

      if (hitGraphic) {
        hitGraphic.selected = true;
      }

      this.updateStatsAndInspector();
      this.requestRender();
    } else if (this.activeMode === 'unit') {
      // Place unit
      const aff = (document.getElementById('unitAffiliationSelect') as HTMLSelectElement).value as Affiliation;
      const type = (document.getElementById('unitTypeSelect') as HTMLSelectElement).value as UnitType;
      const ech = (document.getElementById('unitEchelonSelect') as HTMLSelectElement).value as Echelon;

      const newUnit: MilitaryUnit = {
        id: `u-${Date.now()}`,
        affiliation: aff,
        unitType: type,
        echelon: ech,
        name: `${aff.toUpperCase().slice(0, 1)}-${type.toUpperCase()}`,
        x: Math.round(gx),
        y: Math.round(gy),
        rotation: 0,
        status: 'nominal',
        readiness: 1.0,
      };

      this.commandMgr.execute(new AddUnitCommand(this.units, newUnit));
      this.requestRender();
    } else if (this.activeMode === 'graphic') {
      // Collect points for graphic
      this.graphicTempPoints.push([Math.round(gx), Math.round(gy)]);

      // Check required points for completion
      let targetPts = 2;
      if (this.activeGraphicType === 'assembly_area') targetPts = 4;
      else if (this.activeGraphicType === 'front_line' || this.activeGraphicType === 'blocking_line') targetPts = 3;
      else if (this.activeGraphicType === 'radar_sector') targetPts = 1;

      if (this.graphicTempPoints.length >= targetPts) {
        const newGraphic: TacticalGraphic = {
          id: `g-${Date.now()}`,
          type: this.activeGraphicType,
          affiliation: 'friend',
          points: [...this.graphicTempPoints],
          label: this.activeGraphicType.toUpperCase().replace('_', ' '),
          radius: 200,
          startAngle: 300,
          endAngle: 60,
        };

        this.commandMgr.execute(new AddGraphicCommand(this.graphics, newGraphic));
        this.graphicTempPoints = [];
      }
      this.requestRender();
    } else if (this.activeMode === 'analysis') {
      this.analysisTempPoints.push([Math.round(gx), Math.round(gy)]);

      if (this.activeAnalysisType === 'los') {
        if (this.analysisTempPoints.length >= 2) {
          const start = this.analysisTempPoints[0];
          const end = this.analysisTempPoints[1];
          this.activeLOS = LOSAnalyzer.calculateLOS(
            start,
            end,
            this.heightfield!,
            this.terrainConfig.width,
            this.terrainConfig.height,
            this.terrainConfig
          );
          this.analysisTempPoints = [];
        }
      } else if (this.activeAnalysisType === 'viewshed') {
        const center = this.analysisTempPoints[0];
        this.activeViewshedCenter = center;
        this.activeViewshed = ViewshedAnalyzer.computeViewshedMask(
          center,
          180,
          this.heightfield!,
          this.terrainConfig.width,
          this.terrainConfig.height,
          this.terrainConfig
        );
        this.analysisTempPoints = [];
      } else if (this.activeAnalysisType === 'profile') {
        if (this.analysisTempPoints.length >= 2) {
          const start = this.analysisTempPoints[0];
          const end = this.analysisTempPoints[1];
          const profileData = ElevationProfileAnalyzer.sampleProfile(
            start,
            end,
            this.heightfield!,
            this.terrainConfig.width,
            this.terrainConfig.height,
            this.terrainConfig
          );
          ElevationProfileAnalyzer.renderChart(
            this.profileCtx,
            this.profileCanvas.width,
            this.profileCanvas.height,
            profileData,
            this.theme
          );
          document.getElementById('profileDrawer')!.classList.add('open');
          this.analysisTempPoints = [];
        }
      }

      this.requestRender();
    }
  }

  private bindToolRail(): void {
    const toolBtns = document.querySelectorAll('.tool-btn[data-mode]');
    const unitDrawer = document.getElementById('unitSubToolbar')!;
    const graphicDrawer = document.getElementById('graphicSubToolbar')!;
    const analysisDrawer = document.getElementById('analysisSubToolbar')!;

    const closeAllSubDrawers = () => {
      unitDrawer.classList.remove('open');
      graphicDrawer.classList.remove('open');
      analysisDrawer.classList.remove('open');
    };

    toolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        toolBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = btn.getAttribute('data-mode') as any;
        this.activeMode = mode;
        this.graphicTempPoints = [];
        this.analysisTempPoints = [];

        closeAllSubDrawers();

        if (mode === 'unit') {
          unitDrawer.classList.add('open');
        } else if (mode === 'graphic') {
          graphicDrawer.classList.add('open');
        } else if (mode === 'analysis') {
          analysisDrawer.classList.add('open');
        }

        this.requestRender();
      });
    });

    // Reset View Button
    document.getElementById('toolResetView')!.addEventListener('click', () => this.centerMap());

    // Graphics sub-item buttons
    graphicDrawer.querySelectorAll('.sub-item-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        graphicDrawer.querySelectorAll('.sub-item-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeGraphicType = btn.getAttribute('data-graphic') as GraphicType;
        this.graphicTempPoints = [];
      });
    });

    // Analysis sub-item buttons
    analysisDrawer.querySelectorAll('.sub-item-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        analysisDrawer.querySelectorAll('.sub-item-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeAnalysisType = btn.getAttribute('data-analysis') as any;
        this.analysisTempPoints = [];
      });
    });
  }

  private bindLayerSwitches(): void {
    const bind = (id: string, key: keyof typeof this.layers) => {
      const el = document.getElementById(id) as HTMLInputElement;
      if (el) {
        el.addEventListener('change', () => {
          this.layers[key] = el.checked;
          this.requestRender();
        });
      }
    };

    bind('layerTerrain', 'terrain');
    bind('layerContours', 'contours');
    bind('layerGrid', 'grid');
    bind('layerUnits', 'units');
    bind('layerGraphics', 'graphics');
    bind('layerToponyms', 'toponyms');
  }

  private bindModal(): void {
    const modal = document.getElementById('terrainModal')!;
    const openBtn = document.getElementById('btnTerrainConfig')!;
    const closeBtn = document.getElementById('btnCloseModal')!;
    const cancelBtn = document.getElementById('btnCancelModal')!;
    const applyBtn = document.getElementById('btnApplyTerrain')!;

    const open = () => modal.classList.add('open');
    const close = () => modal.classList.remove('open');

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);

    // Range slider value displays
    const syncVal = (id: string, valId: string, suffix: string = '') => {
      const slider = document.getElementById(id) as HTMLInputElement;
      const valEl = document.getElementById(valId)!;
      slider.addEventListener('input', () => {
        valEl.innerText = `${slider.value}${suffix}`;
      });
    };

    syncVal('cfgOctaves', 'valOctaves');
    syncVal('cfgScale', 'valScale');
    syncVal('cfgHeightScale', 'valHeightScale', 'm');
    syncVal('cfgContourInterval', 'valContourInterval', 'm');

    document.getElementById('btnGenSeed')!.addEventListener('click', () => {
      (document.getElementById('cfgSeed') as HTMLInputElement).value = `${Math.floor(Math.random() * 999999) + 1}`;
    });

    applyBtn.addEventListener('click', () => {
      this.terrainConfig.seed = parseInt((document.getElementById('cfgSeed') as HTMLInputElement).value, 10) || 1337;
      this.terrainConfig.shapeType = (document.getElementById('cfgShape') as HTMLSelectElement).value as any;
      this.terrainConfig.octaves = parseInt((document.getElementById('cfgOctaves') as HTMLInputElement).value, 10);
      this.terrainConfig.scale = parseInt((document.getElementById('cfgScale') as HTMLInputElement).value, 10);
      this.terrainConfig.heightScale = parseInt((document.getElementById('cfgHeightScale') as HTMLInputElement).value, 10);
      this.terrainConfig.contourInterval = parseInt((document.getElementById('cfgContourInterval') as HTMLInputElement).value, 10);

      close();
      this.generateTerrain();
    });
  }

  private centerMap(): void {
    const w = this.terrainCanvas.width;
    const h = this.terrainCanvas.height;
    this.vp.zoom = Math.min(w, h) / 1150;
    this.vp.panX = (w - this.terrainConfig.width * this.vp.zoom) / 2;
    this.vp.panY = (h - this.terrainConfig.height * this.vp.zoom) / 2;
    this.vp.rotation = 0;
    this.requestRender();
  }

  /**
   * Updates Intel balance stats and selected entity inspector form
   */
  private updateStatsAndInspector(): void {
    // 1. Force balance
    const friends = this.units.filter((u) => u.affiliation === 'friend');
    const hostiles = this.units.filter((u) => u.affiliation === 'hostile');

    document.getElementById('statFriendCount')!.innerText = `${friends.length}`;
    document.getElementById('statHostileCount')!.innerText = `${hostiles.length}`;

    const avgReady = (arr: MilitaryUnit[]) =>
      arr.length > 0
        ? Math.round((arr.reduce((acc, u) => acc + u.readiness, 0) / arr.length) * 100)
        : 100;

    document.getElementById('statFriendReady')!.innerText = `战备率 ${avgReady(friends)}%`;
    document.getElementById('statHostileReady')!.innerText = `战备率 ${avgReady(hostiles)}%`;
    document.getElementById('threatCount')!.innerText = `${hostiles.length} THREATS`;

    // 2. Inspector
    const inspector = document.getElementById('inspectorContent')!;
    const selectedUnit = this.units.find((u) => u.selected);
    const selectedGraphic = this.graphics.find((g) => g.selected);

    if (selectedUnit) {
      inspector.innerHTML = `
        <div class="form-group" style="margin-bottom: 6px;">
          <label class="form-label">部队番号 / 名称</label>
          <input type="text" class="form-input" id="editUnitName" value="${selectedUnit.name}" />
        </div>
        <div class="form-group" style="margin-bottom: 6px;">
          <label class="form-label">阵营归属</label>
          <select class="form-select" id="editUnitAff">
            <option value="friend" ${selectedUnit.affiliation === 'friend' ? 'selected' : ''}>友方 (Friend)</option>
            <option value="hostile" ${selectedUnit.affiliation === 'hostile' ? 'selected' : ''}>敌方 (Hostile)</option>
            <option value="neutral" ${selectedUnit.affiliation === 'neutral' ? 'selected' : ''}>中立 (Neutral)</option>
            <option value="unknown" ${selectedUnit.affiliation === 'unknown' ? 'selected' : ''}>未知 (Unknown)</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 6px;">
          <label class="form-label">作战状态</label>
          <select class="form-select" id="editUnitStatus">
            <option value="nominal" ${selectedUnit.status === 'nominal' ? 'selected' : ''}>战备完好 (Nominal)</option>
            <option value="damaged" ${selectedUnit.status === 'damaged' ? 'selected' : ''}>战损告警 (Damaged)</option>
            <option value="destroyed" ${selectedUnit.status === 'destroyed' ? 'selected' : ''}>击毁损毁 (Destroyed)</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
          <label class="form-label">战斗力完好率: <span id="readyValDisplay">${Math.round(selectedUnit.readiness * 100)}%</span></label>
          <input type="range" class="range-slider" id="editUnitReadiness" min="0" max="100" value="${Math.round(selectedUnit.readiness * 100)}" />
        </div>
        <button class="btn" id="btnDeleteSelected" style="width: 100%; justify-content: center; color: var(--status-danger); border-color: var(--status-danger);">
          ✕ 销毁/删除该单位
        </button>
      `;

      document.getElementById('editUnitName')!.addEventListener('input', (e) => {
        selectedUnit.name = (e.target as HTMLInputElement).value;
        this.requestRender();
      });

      document.getElementById('editUnitAff')!.addEventListener('change', (e) => {
        selectedUnit.affiliation = (e.target as HTMLSelectElement).value as Affiliation;
        this.updateStatsAndInspector();
        this.requestRender();
      });

      document.getElementById('editUnitStatus')!.addEventListener('change', (e) => {
        selectedUnit.status = (e.target as HTMLSelectElement).value as UnitStatus;
        this.requestRender();
      });

      document.getElementById('editUnitReadiness')!.addEventListener('input', (e) => {
        const val = parseInt((e.target as HTMLInputElement).value, 10);
        selectedUnit.readiness = val / 100.0;
        document.getElementById('readyValDisplay')!.innerText = `${val}%`;
        this.requestRender();
      });

      document.getElementById('btnDeleteSelected')!.addEventListener('click', () => {
        this.commandMgr.execute(new DeleteUnitsCommand(this.units, [selectedUnit]));
        this.updateStatsAndInspector();
        this.requestRender();
      });
    } else if (selectedGraphic) {
      inspector.innerHTML = `
        <div class="form-group" style="margin-bottom: 6px;">
          <label class="form-label">战术图元标注</label>
          <input type="text" class="form-input" id="editGraphicLabel" value="${selectedGraphic.label}" />
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
          <label class="form-label">阵营</label>
          <select class="form-select" id="editGraphicAff">
            <option value="friend" ${selectedGraphic.affiliation === 'friend' ? 'selected' : ''}>友方 (Friend)</option>
            <option value="hostile" ${selectedGraphic.affiliation === 'hostile' ? 'selected' : ''}>敌方 (Hostile)</option>
          </select>
        </div>
        <button class="btn" id="btnDeleteGraphic" style="width: 100%; justify-content: center; color: var(--status-danger); border-color: var(--status-danger);">
          ✕ 删除该战术图元
        </button>
      `;

      document.getElementById('editGraphicLabel')!.addEventListener('input', (e) => {
        selectedGraphic.label = (e.target as HTMLInputElement).value;
        this.requestRender();
      });

      document.getElementById('editGraphicAff')!.addEventListener('change', (e) => {
        selectedGraphic.affiliation = (e.target as HTMLSelectElement).value as Affiliation;
        this.requestRender();
      });

      document.getElementById('btnDeleteGraphic')!.addEventListener('click', () => {
        const idx = this.graphics.indexOf(selectedGraphic);
        if (idx !== -1) this.graphics.splice(idx, 1);
        this.updateStatsAndInspector();
        this.requestRender();
      });
    } else {
      inspector.innerHTML = `尚未选定任何单位或战术图元。请在地图上点击拾取。`;
    }
  }

  /**
   * UTC & Mission Clock ticker
   */
  private startClocks(): void {
    setInterval(() => {
      // 1. Zulu Clock
      const now = new Date();
      const zulu = now.toISOString().substring(11, 19) + 'Z';
      document.getElementById('clockZulu')!.innerText = zulu;

      // 2. Mission Elapsed Timer (MET)
      const diffSec = Math.floor((Date.now() - this.missionStartTime) / 1000);
      const h = Math.floor(diffSec / 3600);
      const m = Math.floor((diffSec % 3600) / 60);
      const s = diffSec % 60;
      const met = `T+${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      document.getElementById('missionTimer')!.innerText = met;

      // Redraw overlay only if animated radar is active (zero terrain/contour re-render)
      const hasRadar = this.graphics.some((g) => g.type === 'radar_sector');
      if (hasRadar) {
        this.renderOverlay();
      }
    }, 1000);
  }

  private saveProject(): void {
    const proj: ProjectData = {
      version: '1.0.0',
      name: 'OPERATION IRON VEIL',
      operationCode: 'IRON_VEIL',
      timestamp: new Date().toISOString(),
      terrainConfig: this.terrainConfig,
      theme: this.theme,
      units: this.units,
      graphics: this.graphics,
      toponyms: this.toponyms,
      viewport: this.vp,
    };
    ProjectSerializer.exportToFile(proj);
    DraftStorage.saveDraft(proj);
  }

  private async loadProject(): Promise<void> {
    try {
      const proj = await ProjectSerializer.importFromFile();
      this.terrainConfig = proj.terrainConfig;
      this.units = proj.units || [];
      this.graphics = proj.graphics || [];
      this.theme = proj.theme || 'dark';
      document.documentElement.setAttribute('data-theme', this.theme);
      this.generateTerrain();
    } catch (e) {
      console.warn('Failed to load project', e);
    }
  }

  private export4KMap(): void {
    const proj: ProjectData = {
      version: '1.0.0',
      name: 'OPERATION IRON VEIL',
      operationCode: 'TACMAP_4K',
      timestamp: new Date().toISOString(),
      terrainConfig: this.terrainConfig,
      theme: this.theme,
      units: this.units,
      graphics: this.graphics,
      toponyms: this.toponyms,
      viewport: this.vp,
    };
    CartoExporter.exportHighResPNG(
      proj,
      this.tileCache.getCanvas(),
      this.contours,
      3840,
      2160
    );
  }
}

// Bootstrap application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new VisualMapApp();
});
