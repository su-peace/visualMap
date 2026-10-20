import { Point } from '../../types';
import { ContourSegment } from './marchingSquares';

export interface ContourLabel {
  text: string;
  x: number;
  y: number;
  angle: number;
  width: number;
  height: number;
}

export interface ContourLine {
  points: Point[];
  isovalue: number;
  elevation: number;
  isIndex: boolean; // True for index/major contour (bold)
  isClosed: boolean;
  labels?: ContourLabel[];
}

interface AdjNode {
  point: Point;
  n0: number;
  p0: Point;
  u0: boolean;
  n1: number;
  p1: Point;
  u1: boolean;
}

/**
 * C-CONTOUR-02: Contour Stitcher, RDP Simplification & Chaikin Corner-Cutting Smoother
 * High-performance graph stitching with 32-bit integer spatial hashing,
 * micro-loop noise filtering, and Ramer-Douglas-Peucker reduction.
 */
export class ContourProcessor {
  private static readonly SCALE = 10; // 0.1px quantization for spatial hashing

  private static pointKey(p: Point): number {
    const qx = Math.round(p[0] * ContourProcessor.SCALE) & 0xffff;
    const qy = Math.round(p[1] * ContourProcessor.SCALE) & 0xffff;
    return (qy << 16) | qx;
  }

  /**
   * Stitches raw segments into connected polylines with high performance
   */
  public static stitchSegments(
    segments: ContourSegment[],
    isovalue: number,
    elevation: number,
    isIndex: boolean
  ): ContourLine[] {
    if (segments.length === 0) return [];

    // Fast integer-keyed adjacency graph
    const adj = new Map<number, AdjNode>();

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const k1 = ContourProcessor.pointKey(seg.p1);
      const k2 = ContourProcessor.pointKey(seg.p2);
      if (k1 === k2) continue;

      let node1 = adj.get(k1);
      if (!node1) {
        adj.set(k1, { point: seg.p1, n0: k2, p0: seg.p2, u0: false, n1: -1, p1: [0, 0], u1: false });
      } else if (node1.n1 === -1 && node1.n0 !== k2) {
        node1.n1 = k2;
        node1.p1 = seg.p2;
        node1.u1 = false;
      }

      let node2 = adj.get(k2);
      if (!node2) {
        adj.set(k2, { point: seg.p2, n0: k1, p0: seg.p1, u0: false, n1: -1, p1: [0, 0], u1: false });
      } else if (node2.n1 === -1 && node2.n0 !== k1) {
        node2.n1 = k1;
        node2.p1 = seg.p1;
        node2.u1 = false;
      }
    }

    const markEdge = (uNode: AdjNode, vKey: number, uKey: number) => {
      if (uNode.n0 === vKey) uNode.u0 = true;
      else if (uNode.n1 === vKey) uNode.u1 = true;
      const vNode = adj.get(vKey);
      if (vNode) {
        if (vNode.n0 === uKey) vNode.u0 = true;
        else if (vNode.n1 === uKey) vNode.u1 = true;
      }
    };

    const polylines: ContourLine[] = [];

    // Prioritize open-ended lines (degree 1) first, then closed cycles
    const openKeys: number[] = [];
    const allKeys: number[] = [];
    for (const [k, node] of adj.entries()) {
      allKeys.push(k);
      if (node.n1 === -1) {
        openKeys.push(k);
      }
    }

    const traverse = (startKey: number) => {
      const startNode = adj.get(startKey);
      if (!startNode) return;

      const neighborKeys: number[] = [];
      const neighborPoints: Point[] = [];
      if (startNode.n0 !== -1 && !startNode.u0) {
        neighborKeys.push(startNode.n0);
        neighborPoints.push(startNode.p0);
      }
      if (startNode.n1 !== -1 && !startNode.u1) {
        neighborKeys.push(startNode.n1);
        neighborPoints.push(startNode.p1);
      }

      for (let i = 0; i < neighborKeys.length; i++) {
        const nextKey = neighborKeys[i];
        if (startNode.n0 === nextKey && startNode.u0) continue;
        if (startNode.n1 === nextKey && startNode.u1) continue;

        markEdge(startNode, nextKey, startKey);
        const poly: Point[] = [startNode.point, neighborPoints[i]];

        let prevKey = startKey;
        let currKey = nextKey;

        while (true) {
          const currNode = adj.get(currKey);
          if (!currNode) break;

          let targetKey = -1;
          let targetP: Point | null = null;
          if (currNode.n0 !== -1 && currNode.n0 !== prevKey && !currNode.u0) {
            targetKey = currNode.n0;
            targetP = currNode.p0;
          } else if (currNode.n1 !== -1 && currNode.n1 !== prevKey && !currNode.u1) {
            targetKey = currNode.n1;
            targetP = currNode.p1;
          }

          if (targetKey === -1 || !targetP) break;

          markEdge(currNode, targetKey, currKey);
          poly.push(targetP);
          prevKey = currKey;
          currKey = targetKey;
        }

        if (poly.length >= 2) {
          const first = poly[0];
          const last = poly[poly.length - 1];
          const dist = Math.hypot(first[0] - last[0], first[1] - last[1]);
          const isClosed = dist < 0.2;

          // Filter out tiny micro-loops (noise artifacts)
          if (isClosed && poly.length < 6) {
            continue;
          }

          // 1. Ramer-Douglas-Peucker simplification
          const simplified = ContourProcessor.simplifyRDP(poly, 0.36); // tolerance 0.6px
          if (simplified.length < 2) continue;

          // 2. Chaikin smoothing (1 iteration produces smooth organic curves without vertex explosion)
          const smoothed = ContourProcessor.chaikinSmooth(simplified, isClosed, 1);

          // 3. Precompute elevation labels for index contours
          let labels: ContourLabel[] | undefined;
          if (isIndex && smoothed.length >= 16) {
            labels = ContourProcessor.generateLabels(smoothed, elevation);
          }

          polylines.push({
            points: smoothed,
            isovalue,
            elevation,
            isIndex,
            isClosed,
            labels,
          });
        }
      }
    };

    for (let i = 0; i < openKeys.length; i++) {
      traverse(openKeys[i]);
    }
    for (let i = 0; i < allKeys.length; i++) {
      traverse(allKeys[i]);
    }

    return polylines;
  }

  /**
   * Ramer-Douglas-Peucker Polyline Simplification
   */
  public static simplifyRDP(points: Point[], sqTolerance: number = 0.36): Point[] {
    if (points.length <= 2) return points;

    let maxSqDist = 0;
    let index = -1;
    const [x0, y0] = points[0];
    const [x1, y1] = points[points.length - 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const segLenSq = dx * dx + dy * dy;

    for (let i = 1; i < points.length - 1; i++) {
      const [px, py] = points[i];
      let sqDist: number;
      if (segLenSq === 0) {
        sqDist = (px - x0) * (px - x0) + (py - y0) * (py - y0);
      } else {
        const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / segLenSq));
        const projX = x0 + t * dx;
        const projY = y0 + t * dy;
        sqDist = (px - projX) * (px - projX) + (py - projY) * (py - projY);
      }
      if (sqDist > maxSqDist) {
        maxSqDist = sqDist;
        index = i;
      }
    }

    if (maxSqDist > sqTolerance) {
      const rec1 = ContourProcessor.simplifyRDP(points.slice(0, index + 1), sqTolerance);
      const rec2 = ContourProcessor.simplifyRDP(points.slice(index), sqTolerance);
      return rec1.slice(0, rec1.length - 1).concat(rec2);
    } else {
      return [points[0], points[points.length - 1]];
    }
  }

  /**
   * Precomputes elevation labels on index contours
   */
  private static generateLabels(pts: Point[], elevation: number): ContourLabel[] {
    const labels: ContourLabel[] = [];
    const step = Math.floor(pts.length / 2);
    const sampleIndices = [step];
    if (pts.length > 50) {
      sampleIndices.push(Math.floor(pts.length * 0.8));
    }

    const text = `${Math.round(elevation)}`;
    const estWidth = text.length * 6.5 + 6;
    const estHeight = 12;

    for (const idx of sampleIndices) {
      if (idx <= 1 || idx >= pts.length - 2) continue;

      const prev = pts[idx - 2];
      const next = pts[idx + 2];
      const curr = pts[idx];

      const dx = next[0] - prev[0];
      const dy = next[1] - prev[1];
      const segLen = Math.hypot(dx, dy);
      if (segLen < 2) continue;

      let angle = Math.atan2(dy, dx);
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
        angle += Math.PI;
      }

      labels.push({
        text,
        x: curr[0],
        y: curr[1],
        angle,
        width: estWidth,
        height: estHeight,
      });
    }

    return labels;
  }

  /**
   * Applies Chaikin's corner-cutting subdivision
   */
  public static chaikinSmooth(points: Point[], isClosed: boolean, iterations: number = 1): Point[] {
    if (points.length < 3) return points;

    let current = points;

    for (let iter = 0; iter < iterations; iter++) {
      const smoothed: Point[] = [];
      const n = current.length;

      if (!isClosed) {
        smoothed.push(current[0]);
        for (let i = 0; i < n - 1; i++) {
          const p0 = current[i];
          const p1 = current[i + 1];

          smoothed.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
          smoothed.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
        }
        smoothed.push(current[n - 1]);
      } else {
        for (let i = 0; i < n; i++) {
          const p0 = current[i];
          const p1 = current[(i + 1) % n];

          smoothed.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
          smoothed.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
        }
        smoothed.push(smoothed[0]);
      }

      current = smoothed;
    }

    return current;
  }
}
