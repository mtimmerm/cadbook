import {
  HVec2D,
  HVec3D,
  Pen2D,
  Pen3D,
  Point2D,
  Point3D,
  Shaper3D,
  XForm2D,
  XForm3D,
} from './types.js';
import { XFormShaper } from './xformShaper.js';

export class CompoundXForm implements XForm3D {
  private readonly xforms: XForm3D[];
  private stationaryMemo: CompoundXForm | undefined;

  constructor(...xforms: XForm3D[]) {
    this.xforms = [];
    for (const xf of xforms) {
      if (xf instanceof CompoundXForm) {
        this.xforms.push(...xf.xforms);
      } else {
        this.xforms.push(xf);
      }
    }
  }

  isSquare(): boolean {
    return !this.xforms.some((xf) => !xf.isSquare());
  }

  stationary(): XForm3D {
    if (!this.stationaryMemo) {
      this.stationaryMemo = new CompoundXForm();
      this.stationaryMemo.stationaryMemo = this.stationaryMemo;
      for (const xf of this.xforms) {
        this.stationaryMemo.xforms.push(xf.stationary());
      }
    }
    return this.stationaryMemo;
  }

  postApply(xform: XForm3D): CompoundXForm {
    return new CompoundXForm(this, xform);
  }

  preApply(xform: XForm3D): CompoundXForm {
    return new CompoundXForm(xform, this);
  }

  mapPoint(x: number, y: number, z: number): Point3D {
    let p: Point3D = [x, y, z];
    for (const xform of this.xforms) {
      p = xform.mapPoint(p[0], p[1], p[2]);
    }
    return p;
  }

  mapHPoint(x: number, y: number, z: number, w: number): HVec3D {
    let result: HVec3D = [x, y, z, w];
    for (const xform of this.xforms) {
      result = xform.mapHPoint(result[0], result[1], result[2], result[3]);
    }
    return result;
  }

  mapPen(pen: Pen3D): Pen3D {
    let mappedPen = pen;
    for (const xform of this.xforms) {
      mappedPen = xform.mapPen(mappedPen);
    }
    return mappedPen;
  }

  mapShaper(shaper: Shaper3D): Shaper3D {
    return new XFormShaper(this, shaper);
  }

  mapXForm(xform: XForm3D): XForm3D {
    let mappedXForm = xform;
    for (const xf of this.xforms) {
      mappedXForm = xf.mapXForm(mappedXForm);
    }
    return mappedXForm;
  }

  mapProfile(profile: (pen: Pen3D) => void): (pen: Pen3D) => void {
    return (pen: Pen3D) => {
      const mappedPen = this.mapPen(pen);
      profile(mappedPen);
    };
  }
}

export class CompoundXForm2D implements XForm2D {
  private readonly xforms: XForm2D[];
  private isSquareMemo: boolean | undefined;
  private stationaryMemo: CompoundXForm2D | undefined;

  constructor(...xforms: XForm2D[]) {
    this.xforms = [];
    for (const xf of xforms) {
      if (xf instanceof CompoundXForm2D) {
        this.xforms.push(...xf.xforms);
      } else {
        this.xforms.push(xf);
      }
    }
  }

  stationary(): XForm2D {
    if (!this.stationaryMemo) {
      this.stationaryMemo = new CompoundXForm2D();
      this.stationaryMemo.stationaryMemo = this.stationaryMemo;
      for (const xf of this.xforms) {
        this.stationaryMemo.xforms.push(xf.stationary());
      }
    }
    return this.stationaryMemo;
  }

  postApply(xform: XForm2D): CompoundXForm2D {
    return new CompoundXForm2D(this, xform);
  }

  preApply(xform: XForm2D): CompoundXForm2D {
    return new CompoundXForm2D(xform, this);
  }

  mapPoint(x: number, y: number): Point2D {
    let p: Point2D = [x, y];
    for (const xform of this.xforms) {
      p = xform.mapPoint(p[0], p[1]);
    }
    return p;
  }

  mapHPoint(x: number, y: number, w: number): HVec2D {
    let result: HVec2D = [x, y, w];
    for (const xform of this.xforms) {
      result = xform.mapHPoint(result[0], result[1], result[2]);
    }
    return result;
  }

  mapPen(pen: Pen2D): Pen2D {
    let mappedPen = pen;
    for (const xform of this.xforms) {
      mappedPen = xform.mapPen(mappedPen);
    }
    return mappedPen;
  }

  mapXForm(xform: XForm2D): XForm2D {
    let mappedXForm = xform;
    for (const xf of this.xforms) {
      mappedXForm = xf.mapXForm(mappedXForm);
    }
    return mappedXForm;
  }

  mapSketch(sketch: (pen: Pen2D) => void): (pen: Pen2D) => void {
    return (pen: Pen2D) => {
      const mappedPen = this.mapPen(pen);
      sketch(mappedPen);
    };
  }

  isSquare(): boolean {
    if (this.isSquareMemo == undefined) {
      this.isSquareMemo = true;
      for (const xf of this.xforms) {
        if (!xf.isSquare()) {
          this.isSquareMemo = false;
          break;
        }
      }
    }
    return this.isSquareMemo;
  }
}
