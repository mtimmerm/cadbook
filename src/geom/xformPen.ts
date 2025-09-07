import { ROOT2BY2 } from './constants.js';
import { conicArcParams } from './geomUtils.js';
import { Pen2D, Pen3D, XForm2D, XForm3D } from './types.js';

export class XFormPen3D implements Pen3D {
  private xform: XForm3D;
  private pen: Pen3D;

  constructor(xform: XForm3D, pen: Pen3D) {
    if (pen instanceof XFormPen3D) {
      this.xform = pen.xform.mapXForm(xform);
      this.pen = pen.pen;
    } else {
      this.xform = xform;
      this.pen = pen;
    }
  }
  move(x: number, y: number, z: number): void {
    const [newX, newY, newZ] = this.xform.mapPoint(x, y, z);
    this.pen.move(newX, newY, newZ);
  }
  line(x: number, y: number, z: number): void {
    const [newX, newY, newZ] = this.xform.mapPoint(x, y, z);
    this.pen.line(newX, newY, newZ);
  }
  conic(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    w: number
  ): void {
    const [newX1, newY1, newZ1] = this.xform.mapPoint(x1, y1, z1);
    const [newX2, newY2, newZ2] = this.xform.mapPoint(x2, y2, z2);
    this.pen.conic(newX1, newY1, newZ1, newX2, newY2, newZ2, w);
  }
}

export class XFormPen2D implements Pen2D {
  private xform: XForm2D;
  private pen: Pen2D;
  private arcConvsersion: number | undefined;
  private tx: number = 0;
  private ty: number = 0;

  constructor(xform: XForm2D, pen: Pen2D) {
    if (pen instanceof XFormPen2D) {
      this.xform = pen.xform.mapXForm(xform);
      this.pen = pen.pen;
    } else {
      this.xform = xform;
      this.pen = pen;
    }
  }

  move(x: number, y: number, tag?: string | null | undefined): void {
    const [newX, newY] = this.xform.mapPoint(x, y);
    this.pen.move(newX, newY, tag);
    this.tx = x;
    this.ty = y;
  }

  line(x: number, y: number): void {
    const [newX, newY] = this.xform.mapPoint(x, y);
    this.pen.line(newX, newY);
    this.tx = x;
    this.ty = y;
  }

  conic(x1: number, y1: number, x2: number, y2: number, w: number): void {
    const [newX1, newY1] = this.xform.mapPoint(x1, y1);
    const [newX2, newY2] = this.xform.mapPoint(x2, y2);
    this.pen.conic(newX1, newY1, newX2, newY2, w);
    this.tx = x2;
    this.ty = y2;
  }

  arc(x: number, y: number, turnDegrees: number): void {
    if (turnDegrees >= -0.00001 && turnDegrees <= 0.00001) {
      this.line(x, y);
      return;
    }
    if (this.arcConvsersion == undefined) {
      if (this.xform.isSquare()) {
        const xfs = this.xform.stationary();
        const [mxx, mxy] = xfs.mapPoint(1, 0);
        const [myx, myy] = xfs.mapPoint(0, 1);
        this.arcConvsersion = Math.sign(mxx * myy - myx * mxy);
      } else {
        this.arcConvsersion = 0;
      }
    }
    if (this.arcConvsersion) {
      const [newX, newY] = this.xform.mapPoint(x, y);
      this.pen.arc(newX, newY, this.arcConvsersion * turnDegrees);
      this.tx = x;
      this.ty = y;
    } else {
      const mx = (x - this.tx) * 0.5;
      const my = (y - this.ty) * 0.5;
      const [deflection, w] = conicArcParams(turnDegrees);
      this.conic(
        this.tx + mx - my * deflection,
        this.ty + my + mx * deflection,
        x,
        y,
        w
      );
    }
  }

  circle(x: number, y: number, d: number, tag?: string | undefined) {
    if (this.arcConvsersion == undefined) {
      if (this.xform.isSquare()) {
        const xfs = this.xform.stationary();
        const [mxx, mxy] = xfs.mapPoint(1, 0);
        const [myx, myy] = xfs.mapPoint(0, 1);
        this.arcConvsersion = Math.sign(mxx * myy - myx * mxy);
      } else {
        this.arcConvsersion = 0;
      }
    }
    if (this.arcConvsersion) {
      // transform is square -- can make a new circle
      const [dx, dy] = this.xform.stationary().mapPoint(d, 0);
      const [newX, newY] = this.xform.mapPoint(x, y);
      this.pen.circle(newX, newY, Math.sqrt(dx * dx + dy * dy), tag);
    } else {
      const r = d * 0.5;
      this.move(x + r, y, tag);
      this.conic(x + r, y + r, x, y + r, ROOT2BY2);
      this.conic(x - r, y + r, x - r, y, ROOT2BY2);
      this.conic(x - r, y - r, x, y - r, ROOT2BY2);
      this.conic(x + r, y - r, x + r, y, ROOT2BY2);
    }
  }
}

export class SketchToProfilePen implements Pen2D {
  readonly target: Pen3D;
  private tx: number = 0;
  private ty: number = 0;
  constructor(target: Pen3D) {
    this.target = target;
  }
  move(x: number, y: number, tag?: string | null | undefined): void {
    this.target.move(x, y, 0);
    this.tx = x;
    this.ty = y;
  }
  line(x: number, y: number): void {
    this.target.line(x, y, 0);
    this.tx = x;
    this.ty = y;
  }
  arc(x: number, y: number, turnDegrees: number): void {
    const mx = (x - this.tx) * 0.5;
    const my = (y - this.ty) * 0.5;
    const [deflection, w] = conicArcParams(turnDegrees);
    this.target.conic(
      this.tx + mx - my * deflection,
      this.ty + my + mx * deflection,
      0,
      x,
      y,
      0,
      w
    );
    this.tx = x;
    this.ty = y;
  }
  conic(x1: number, y1: number, x2: number, y2: number, w: number): void {
    this.target.conic(x1, y1, 0, x2, y2, 0, w);
    this.tx = x2;
    this.ty = y2;
  }
  circle(x: number, y: number, r: number, tag?: string | undefined) {
    this.move(x + r, y, tag);
    this.conic(x + r, y + r, x, y + r, ROOT2BY2);
    this.conic(x - r, y + r, x - r, y, ROOT2BY2);
    this.conic(x - r, y - r, x, y - r, ROOT2BY2);
    this.conic(x + r, y - r, x + r, y, ROOT2BY2);
  }
}
