import { ROOT2BY2 } from './constants.js';
import { conicArcParams } from './geomUtils.js';
import { Pen2D, Point2D } from './types.js';

type RecordedPoint = [number, number];
type RecordedArc = [number, number, number];
// x2,y2, x1,y1, w
type RecordedConic = [number, number, number, number, number];
type RecordedPath = Array<RecordedPoint | RecordedArc | RecordedConic>;

export class RecordingPen2D implements Pen2D {
  private paths: RecordedPath[];
  private tags: (string | null)[];
  constructor() {
    this.paths = [];
    this.tags = [];
  }

  clear() {
    this.paths.length = 0;
    this.tags.length = 0;
  }

  pathCount(): number {
    let count = this.paths.length;
    if (count > 0 && this.paths[count - 1].length < 2) {
      --count;
    }
    return count;
  }

  replay(pen: Pen2D) {
    const n = this.pathCount();
    for (let i = 0; i < n; ++i) {
      this.replayPath(pen, i);
    }
  }

  replayPath(pen: Pen2D, pathIndex: number): void {
    if (pathIndex < 0 || pathIndex >= this.paths.length) {
      throw new Error('Invalid path number in RecordingPen2D.replayPath');
    }
    const path = this.paths[pathIndex];
    if (path.length < 2) {
      throw new Error('Invalid path number in RecordingPen2D.replayPath');
    }
    const [mx, my] = path[0];
    pen.move(mx, my, this.tags[pathIndex]);
    for (let i = 1; i < path.length; ++i) {
      const seg = path[i];
      switch (seg.length) {
        case 2:
          pen.line(seg[0], seg[1]);
          break;
        case 3:
          pen.arc(seg[0], seg[1], seg[2]);
          break;
        case 5:
          pen.conic(seg[2], seg[3], seg[0], seg[1], seg[4]);
          break;
      }
    }
  }

  replayPathReversed(pen: Pen2D, pathIndex: number): void {
    if (pathIndex < 0 || pathIndex >= this.paths.length) {
      throw new Error('Invalid path number in RecordingPen2D.replayPath');
    }
    const path = this.paths[pathIndex];
    if (path.length < 2) {
      throw new Error('Invalid path number in RecordingPen2D.replayPath');
    }
    const [mx, my] = path[path.length - 1];
    pen.move(mx, my, this.tags[pathIndex]);
    for (let i = path.length - 1; i > 0; --i) {
      const seg = path[i];
      const [prex, prey] = path[i - 1];
      switch (seg.length) {
        case 2:
          pen.line(prex, prey);
          break;
        case 3:
          pen.arc(prex, prey, -seg[2]);
          break;
        case 5:
          pen.conic(seg[2], seg[3], prex, prey, seg[4]);
          break;
      }
    }
  }

  /**
   * Exactly close the given path.
   *
   * If the start point is already exactly equal to the end point, no changes are made.
   *
   * If the end point is within `snapDistance` of the start point AND the distance is less than
   * `snapProp` times the total start->end distance of the last segment, then the end point of the
   * last segment is moved to exactly meet the start point.
   *
   * Otherwise, a line is added between the end point and the start point.
   *
   * @param pathIndex
   * @param snapDistance
   * @param snapProp
   */
  closePath(pathIndex: number, snapDistance: number, snapProp: number): void {
    if (pathIndex < 0 || pathIndex >= this.paths.length) {
      return;
    }
    const path = this.paths[pathIndex];
    if (path.length < 2) {
      return;
    }
    const [sx, sy] = path[0];
    const endSeg = path[path.length - 1];
    const [tx, ty] = endSeg;
    if (sx === tx && sy === ty) {
      return;
    }
    const errx = sx - tx;
    const erry = sy - ty;
    const err2 = errx * errx + erry * erry;
    if (err2 > snapDistance * snapDistance) {
      path.push([sx, sy]);
      return;
    }
    const [x0, y0] = path[path.length - 2];
    const lx = tx - x0;
    const ly = tx - y0;
    const l2 = lx * lx + ly * ly;
    if (err2 >= snapProp * snapProp * l2) {
      path.push([sx, sy]);
      return;
    }
    // adjust
    endSeg[0] = sx;
    endSeg[1] = sy;
    if (endSeg.length >= 4) {
      (endSeg as RecordedConic)[2] += errx * 0.5;
      (endSeg as RecordedConic)[3] += erry * 0.5;
    }
  }

  // Get the signed area of the polygon formed by the path control ponts.
  // That's positive for CCW paths. i.e, +X,+Y,-X,-Y
  getPathSignedAreaApprox(pathIndex: number) {
    if (pathIndex < 0 || pathIndex >= this.paths.length) {
      throw new Error('Invalid path number in RecordingPen2D.replayPath');
    }
    const path = this.paths[pathIndex];
    if (path.length < 2) {
      throw new Error('Invalid path number in RecordingPen2D.replayPath');
    }
    const [mx, my] = path[0];
    let tx = mx;
    let ty = my;
    let A = 0;
    const pt = (x: number, y: number) => {
      A += (x + tx) * (y - ty);
      tx = x;
      ty = y;
    };
    for (let i = 1; i < path.length; ++i) {
      const seg = path[i];
      switch (seg.length) {
        case 2:
          pt(seg[0], seg[1]);
          break;
        case 3: {
          const [ex, ey] = seg;
          const dx = (ex - tx) * 0.5;
          const dy = (ey - ty) * 0.5;
          const [deflection] = conicArcParams(seg[2]);
          pt(tx + dx - dy * deflection, ty + dy + dx * deflection);
          pt(ex, ey);
          break;
        }
        case 5:
          pt(seg[2], seg[3]);
          pt(seg[0], seg[1]);
          break;
      }
    }
    pt(mx, my);
    return A * 0.5;
  }

  move(x: number, y: number, tag?: string | null | undefined): void {
    let path = this.paths.length
      ? this.paths[this.paths.length - 1]
      : undefined;
    if (path && path.length < 2) {
      path.length = 0;
      this.tags.pop();
    } else {
      path = [];
      this.paths.push(path);
    }
    this.tags.push(tag ?? null);
    path.push([x, y]);
  }

  line(x: number, y: number): void {
    if (!this.paths.length) {
      throw new Error('Pen .line without .move');
    }
    this.paths[this.paths.length - 1].push([x, y]);
  }
  arc(x: number, y: number, turnDegrees: number): void {
    if (!this.paths.length) {
      throw new Error('Pen .arc without .move');
    }
    this.paths[this.paths.length - 1].push([x, y, turnDegrees]);
  }
  conic(x1: number, y1: number, x2: number, y2: number, w: number): void {
    if (!this.paths.length) {
      throw new Error('Pen .conic without .move');
    }
    this.paths[this.paths.length - 1].push([x2, y2, x1, y1, w]);
  }
  circle(x: number, y: number, d: number, tag?: string | undefined) {
    const r = d * 0.5;
    this.move(x + r, y, tag);
    this.conic(x + r, y + r, x, y + r, ROOT2BY2);
    this.conic(x - r, y + r, x - r, y, ROOT2BY2);
    this.conic(x - r, y - r, x, y - r, ROOT2BY2);
    this.conic(x + r, y - r, x + r, y, ROOT2BY2);
  }
}
