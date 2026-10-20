import { TerrainConfig, ThemeMode, Toponym } from '../../types';
import { TerrainGenerator } from '../terrain/generator';
import { HillshadeRenderer } from '../renderer/shading';
import { MarchingSquares } from '../contour/marchingSquares';
import { ContourLine, ContourProcessor } from '../contour/chaikin';
import { ToponymGenerator } from '../analysis/toponym';

export interface TerrainWorkerRequest {
  taskId: number;
  config: TerrainConfig;
  theme: ThemeMode;
}

export interface TerrainWorkerPhase1 {
  type: 'phase1';
  taskId: number;
  heightfield: Float32Array;
  shadingBuffer: Uint8ClampedArray;
  indexContours: ContourLine[];
  toponyms: Toponym[];
}

export interface TerrainWorkerPhase2 {
  type: 'phase2';
  taskId: number;
  intermediateContours: ContourLine[];
}

export type TerrainWorkerResponse = TerrainWorkerPhase1 | TerrainWorkerPhase2;

self.onmessage = (e: MessageEvent<TerrainWorkerRequest>) => {
  const { taskId, config, theme } = e.data;
  const { width, height, seaLevel, heightScale, contourInterval } = config;

  // 1. Generate Heightfield
  const heightfield = TerrainGenerator.generate(config);

  // 2. Generate Hillshade Raw Shading Buffer (32-bit composited)
  const shadingBuffer = HillshadeRenderer.renderRaw(
    heightfield,
    width,
    height,
    theme,
    seaLevel
  );

  // 3. Extract Index Contours
  const interMeters = contourInterval || 25;
  const indexMeters = interMeters * 5;
  const numLevels = Math.floor(heightScale / interMeters);

  const indexContours: ContourLine[] = [];
  const intermediateLevels: number[] = [];

  for (let i = 1; i <= numLevels; i++) {
    const elev = i * interMeters;
    const isIndex = elev % indexMeters === 0;
    if (isIndex) {
      const normH = seaLevel + (elev / heightScale) * (1.0 - seaLevel);
      if (normH > 0 && normH < 1.0) {
        const segs = MarchingSquares.extractSegments(heightfield, width, height, normH, 2);
        const lines = ContourProcessor.stitchSegments(segs, normH, elev, true);
        for (let j = 0; j < lines.length; j++) {
          indexContours.push(lines[j]);
        }
      }
    } else {
      intermediateLevels.push(i);
    }
  }

  // 4. Generate Toponyms
  const toponyms = ToponymGenerator.generateToponyms(
    heightfield,
    width,
    height,
    config
  );

  // Post Phase 1: Transferable ArrayBuffer for zero-copy IPC
  const heightfieldCopy = new Float32Array(heightfield);
  const phase1Msg: TerrainWorkerPhase1 = {
    type: 'phase1',
    taskId,
    heightfield: heightfieldCopy,
    shadingBuffer,
    indexContours,
    toponyms,
  };

  (postMessage as any)(phase1Msg, [heightfieldCopy.buffer, shadingBuffer.buffer]);

  // Phase 2: Compute Intermediate Contours
  const intermediateContours: ContourLine[] = [];
  for (let idx = 0; idx < intermediateLevels.length; idx++) {
    const i = intermediateLevels[idx];
    const elev = i * interMeters;
    const normH = seaLevel + (elev / heightScale) * (1.0 - seaLevel);
    if (normH <= 0 || normH >= 1.0) continue;

    const segs = MarchingSquares.extractSegments(heightfield, width, height, normH, 2);
    const lines = ContourProcessor.stitchSegments(segs, normH, elev, false);
    for (let j = 0; j < lines.length; j++) {
      intermediateContours.push(lines[j]);
    }
  }

  const phase2Msg: TerrainWorkerPhase2 = {
    type: 'phase2',
    taskId,
    intermediateContours,
  };

  self.postMessage(phase2Msg);
};
