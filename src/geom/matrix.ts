import { CompoundXForm, CompoundXForm2D } from './compoundXForm.js';
import { DEGREE, ROOT2BY2 } from './constants.js';
import {
  HVec2D,
  HVec3D,
  Pen2D,
  Pen3D,
  Point2D,
  Point3D,
  Profile,
  Shaper3D,
  Sketch,
  XForm2D,
  XForm3D,
} from './types.js';
import { XFormPen2D, XFormPen3D } from './xformPen.js';
import { XFormShaper } from './xformShaper.js';

export class Matrix3D implements XForm3D {
  private xCol: HVec3D;
  private yCol: HVec3D;
  private zCol: HVec3D;
  private wCol: HVec3D;
  private isSquareMemo: boolean | undefined;
  private stationaryMemo: XForm3D | undefined;

  constructor(
    xCol?: HVec3D | undefined,
    yCol?: HVec3D | undefined,
    zCol?: HVec3D | undefined,
    wCol?: HVec3D | undefined
  ) {
    this.xCol = xCol ? [...xCol] : [1, 0, 0, 0];
    this.yCol = yCol ? [...yCol] : [0, 1, 0, 0];
    this.zCol = zCol ? [...zCol] : [0, 0, 1, 0];
    this.wCol = wCol ? [...wCol] : [0, 0, 0, 1];
    if (this.wCol[0] === 56) {
      throw new Error('x');
    }
  }
  isSquare(): boolean {
    if (this.isSquareMemo == undefined) {
      if (this.xCol[3] || this.yCol[3] || this.zCol[3] || this.wCol[3] !== 1) {
        this.isSquareMemo = false;
        return false;
      }
      const cols = [this.xCol, this.yCol, this.zCol];
      const mags = cols.map(([x, y, z]) => x * x + y * y + z * z).sort();
      if (!mags[0]) {
        this.isSquareMemo = false;
        return false;
      }
      if (mags[2] > mags[0] * 1.00000001) {
        this.isSquareMemo = false;
        return false;
      }
      this.isSquareMemo = true;
      for (const sel of [
        [0, 1],
        [0, 2],
        [1, 2],
      ]) {
        const v1 = cols[sel[0]];
        const v2 = cols[sel[1]];
        const c = (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / mags[2];
        if (c > 0.0001) {
          this.isSquareMemo = false;
          break;
        }
      }
    }
    return this.isSquareMemo;
  }
  stationary(): XForm3D {
    if (this.stationaryMemo) {
      return this.stationaryMemo;
    }
    if (!this.wCol[0] && !this.wCol[1] && !this.wCol[2]) {
      return this;
    }
    this.stationaryMemo = new Matrix3D(this.xCol, this.yCol, this.zCol, [
      0,
      0,
      0,
      this.wCol[3],
    ]);
    return this.stationaryMemo;
  }
  mapPen(pen: Pen3D): Pen3D {
    return new XFormPen3D(this, pen);
  }
  mapShaper(shaper: Shaper3D): Shaper3D {
    return new XFormShaper(this, shaper);
  }
  mapXForm(xform: XForm3D): XForm3D {
    if (xform instanceof Matrix3D) {
      return this.preBasis(xform.xCol, xform.yCol, xform.zCol, xform.wCol);
    }
    const ret = new CompoundXForm(this, xform);
    return ret;
  }

  mapPoint(x: number, y: number, z: number): Point3D {
    const p = transformHPoint(
      this.xCol,
      this.yCol,
      this.zCol,
      this.wCol,
      x,
      y,
      z,
      1
    ) as number[];
    const w = p.pop()!;
    p[0] /= w;
    p[1] /= w;
    p[2] /= w;
    return p as Point3D;
  }

  mapHPoint(x: number, y: number, z: number, w: number): HVec3D {
    return transformHPoint(
      this.xCol,
      this.yCol,
      this.zCol,
      this.wCol,
      x,
      y,
      z,
      w
    );
  }

  mapProfile(profile: Profile): Profile {
    return (pen: Pen3D) => {
      const mappedPen = this.mapPen(pen);
      profile(mappedPen);
    };
  }

  preBasis(xCol: HVec3D, yCol: HVec3D, zCol: HVec3D, wCol: HVec3D): Matrix3D {
    const xc = this.xCol;
    const yc = this.yCol;
    const zc = this.zCol;
    const wc = this.wCol;
    return new Matrix3D(
      transformHPoint(xc, yc, zc, wc, xCol[0], xCol[1], xCol[2], xCol[3]),
      transformHPoint(xc, yc, zc, wc, yCol[0], yCol[1], yCol[2], yCol[3]),
      transformHPoint(xc, yc, zc, wc, zCol[0], zCol[1], zCol[2], zCol[3]),
      transformHPoint(xc, yc, zc, wc, wCol[0], wCol[1], wCol[2], wCol[3])
    );
  }

  translate(tx: number, ty: number, tz: number): Matrix3D {
    return new Matrix3D(
      this.xCol,
      this.yCol,
      this.zCol,
      this.mapHPoint(tx, ty, tz, 1)
    );
  }

  /**
   * Pre-rotate the top view (around the z axis) by the given number of degrees.
   *
   * Positive rotations move the +X axis toward +Y.
   *
   * @param degrees degrees to rotate
   * @returns this
   */
  rotateTop(degrees: number): Matrix3D {
    let eighths = degrees / 45;
    let s: number;
    let c: number;
    if (degrees === 0) {
      return this;
    }
    if (eighths === Math.floor(eighths)) {
      if (eighths < 0) {
        eighths = 8 - (-eighths & 7);
      }
      eighths &= 7;
      s = ((0x00012221 >> (eighths * 4)) & 7) - 1;
      c = ((0x21000122 >> (eighths * 4)) & 7) - 1;
      if (eighths & 1) {
        s *= ROOT2BY2;
        c *= ROOT2BY2;
      }
    } else {
      s = Math.sin(degrees * DEGREE);
      c = Math.cos(degrees * DEGREE);
    }
    const postxc = this.xCol;
    const postyc = this.yCol;
    return new Matrix3D(
      [
        postxc[0] * c + postyc[0] * s,
        postxc[1] * c + postyc[1] * s,
        postxc[2] * c + postyc[2] * s,
        postxc[3] * c + postyc[3] * s,
      ],
      [
        postyc[0] * c - postxc[0] * s,
        postyc[1] * c - postxc[1] * s,
        postyc[2] * c - postxc[2] * s,
        postyc[3] * c - postxc[3] * s,
      ],
      this.zCol,
      this.wCol
    );
  }
}

function transformHPoint(
  xCol: HVec3D,
  yCol: HVec3D,
  zCol: HVec3D,
  wCol: HVec3D,
  x: number,
  y: number,
  z: number,
  w: number
): HVec3D {
  return [
    xCol[0] * x + yCol[0] * y + zCol[0] * z + wCol[0] * w,
    xCol[1] * x + yCol[1] * y + zCol[1] * z + wCol[1] * w,
    xCol[2] * x + yCol[2] * y + zCol[2] * z + wCol[2] * w,
    xCol[3] * x + yCol[3] * y + zCol[3] * z + wCol[3] * w,
  ];
}

export class Matrix2D implements XForm2D {
  private readonly xCol: HVec2D;
  private readonly yCol: HVec2D;
  private readonly wCol: HVec2D;
  private stationaryMemo: XForm2D | undefined;

  constructor(
    xCol?: HVec2D | undefined,
    yCol?: HVec2D | undefined,
    wCol?: HVec2D | undefined
  ) {
    this.xCol = xCol ? [...xCol] : [1, 0, 0];
    this.yCol = yCol ? [...yCol] : [0, 1, 0];
    this.wCol = wCol ? [...wCol] : [0, 0, 1];
  }
  stationary(): XForm2D {
    if (this.stationaryMemo) {
      return this.stationaryMemo;
    }
    if (!this.wCol[0] && !this.wCol[1]) {
      return this;
    }
    this.stationaryMemo = new Matrix2D(this.xCol, this.yCol, [
      0,
      0,
      this.wCol[2],
    ]);
    return this.stationaryMemo;
  }
  mapPen(pen: Pen2D): Pen2D {
    return new XFormPen2D(this, pen);
  }
  mapXForm(xform: XForm2D): XForm2D {
    if (xform instanceof Matrix2D) {
      return this.preBasis(xform.xCol, xform.yCol, xform.wCol);
    }
    const ret = new CompoundXForm2D();
    ret.postApply(this);
    ret.postApply(xform);
    return ret;
  }

  mapPoint(x: number, y: number): Point2D {
    const p = transformHPoint2D(
      this.xCol,
      this.yCol,
      this.wCol,
      x,
      y,
      1
    ) as number[];
    const w = p.pop()!;
    p[0] /= w;
    p[1] /= w;
    return p as Point2D;
  }

  mapHPoint(x: number, y: number, w: number): HVec2D {
    return transformHPoint2D(this.xCol, this.yCol, this.wCol, x, y, w);
  }

  mapSketch(sketch: Sketch): Sketch {
    return (pen: Pen2D) => {
      const mappedPen = this.mapPen(pen);
      sketch(mappedPen);
    };
  }

  preBasis(xCol: HVec2D, yCol: HVec2D, wCol: HVec2D): Matrix2D {
    const xc = this.xCol;
    const yc = this.yCol;
    const wc = this.wCol;
    return new Matrix2D(
      transformHPoint2D(xc, yc, wc, xCol[0], xCol[1], xCol[2]),
      transformHPoint2D(xc, yc, wc, yCol[0], yCol[1], yCol[2]),
      transformHPoint2D(xc, yc, wc, wCol[0], wCol[1], wCol[2])
    );
  }

  /**
   * Pre-rotate by the given number of degrees.
   *
   * Positive rotations move the +X axis toward +Y.
   *
   * @param degrees degrees to rotate
   * @returns this
   */
  rotate(degrees: number): Matrix2D {
    let eighths = degrees / 45;
    let s: number;
    let c: number;
    if (degrees === 0) {
      return this;
    }
    if (eighths === Math.floor(eighths)) {
      if (eighths < 0) {
        eighths = 8 - (-eighths & 7);
      }
      eighths &= 7;
      s = ((0x00012221 >> (eighths * 4)) & 7) - 1;
      c = ((0x21000122 >> (eighths * 4)) & 7) - 1;
      if (eighths & 1) {
        s *= ROOT2BY2;
        c *= ROOT2BY2;
      }
    } else {
      s = Math.sin(degrees * DEGREE);
      c = Math.cos(degrees * DEGREE);
    }
    const postxc = this.xCol;
    const postyc = this.yCol;
    return new Matrix2D(
      [
        postxc[0] * c + postyc[0] * s,
        postxc[1] * c + postyc[1] * s,
        postxc[2] * c + postyc[2] * s,
      ],
      [
        postyc[0] * c - postxc[0] * s,
        postyc[1] * c - postxc[1] * s,
        postyc[2] * c - postxc[2] * s,
      ],
      this.wCol
    );
  }

  isSquare(): boolean {
    const [xx, xy, xw] = this.xCol;
    const [yx, yy, yw] = this.yCol;
    if (xw !== yw) {
      return false;
    }
    if (xx * yx !== -xy * yy) {
      return false;
    }
    return Math.abs(xx) === Math.abs(yy) && Math.abs(yx) === Math.abs(xy);
  }

  translate(tx: number, ty: number): Matrix2D {
    return new Matrix2D(this.xCol, this.yCol, this.mapHPoint(tx, ty, 1));
  }
}

function transformHPoint2D(
  xCol: HVec2D,
  yCol: HVec2D,
  wCol: HVec2D,
  x: number,
  y: number,
  w: number
): HVec2D {
  return [
    xCol[0] * x + yCol[0] * y + wCol[0] * w,
    xCol[1] * x + yCol[1] * y + wCol[1] * w,
    xCol[2] * x + yCol[2] * y + wCol[2] * w,
  ];
}

/**
 * The 2D identity matrix
 */
export const ID2D = new Matrix2D();

/**
 * The 3D identity matrix
 */
export const ID3D = new Matrix3D();

/**
 * "Top view" for sketches, maps x->x, y->y, z->z
 * (in a sketch, +z is towards the viewer, but z is always 0)
 */
export const TOPVIEW = new Matrix3D(
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1]
);

/**
 * "Front view" for sketchers, maps x->x, y->z, z->-y
 * (in a sketch, +z is towards the viewer, but z is always 0)
 */
export const FRONTVIEW = new Matrix3D(
  [1, 0, 0, 0],
  [0, 0, 1, 0],
  [0, -1, 0, 0],
  [0, 0, 0, 1]
);

/**
 * "Left view" for sketchers, maps x->-y, y->z, z->-x
 * (in a sketch, +z is towards the viewer, but z is always 0)
 */
export const LEFTVIEW = new Matrix3D(
  [0, -1, 0, 0],
  [0, 0, 1, 0],
  [-1, 0, 0, 0],
  [0, 0, 0, 1]
);

/**
 * "Right view" for sketchers, maps x->y, y->z, z->x
 * (in a sketch, +z is towards the viewer, but z is always 0)
 */
export const RIGHTVIEW = new Matrix3D(
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [1, 0, 0, 0],
  [0, 0, 0, 1]
);
