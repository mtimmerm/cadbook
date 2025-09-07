import { Pen3D } from '../geom/index.js';
import {
  BRepBuilderAPI_MakeEdge,
  Geom_BSplineCurve,
  Geom_Line,
  gp_Dir,
  gp_Lin,
  gp_Pnt,
  Handle_Geom_Curve,
  OpenCascadeInstance,
  TColgp_Array1OfPnt,
  TColStd_Array1OfInteger,
  TColStd_Array1OfReal,
  TopoDS_Edge,
  TopoDS_Face,
  TopoDS_Wire,
} from 'opencascade.js/dist/opencascade.full.js';

export class OCWirePen implements Pen3D {
  private oc: OpenCascadeInstance;
  private tx: number;
  private ty: number;
  private tz: number;
  private havePoint: boolean;
  private haveWire: boolean;
  private wireEdges: TopoDS_Edge[][] = [];
  private makeHoles: boolean;
  constructor(oc: OpenCascadeInstance, makeHoles: boolean) {
    this.oc = oc;
    this.tx = this.ty = this.tz = 0;
    this.havePoint = false;
    this.haveWire = false;
    this.wireEdges = [];
    this.makeHoles = makeHoles;
  }

  wireCount(): number {
    return this.wireEdges.length;
  }

  delete(): void {
    for (const wire of this.wireEdges) {
      for (const edge of wire) {
        edge.delete();
      }
    }
    this.wireEdges.length = 0;
    this.havePoint = this.haveWire = false;
    this.tx = this.ty = this.tz = 0;
  }

  makeFace(): TopoDS_Face {
    if (this.wireEdges.length === 0) {
      throw new Error('No wires to make a face');
    }
    let wire = this.makeWire(0);
    const faceBuilder = new this.oc.BRepBuilderAPI_MakeFace_15(wire, false);
    wire.delete();
    if (this.makeHoles) {
      for (let i = 1; i < this.wireEdges.length; ++i) {
        wire = this.makeWireReverse(i);
        if (wire.IsNull()) {
          wire.delete();
          throw new Error('Wire is null, cannot make face');
        }
        faceBuilder.Add(wire);
        wire.delete();
      }
    }
    const face = faceBuilder.Face();
    if (!faceBuilder.IsDone()) {
      throw new Error('Face builder did not execute');
    }
    return face;
  }

  makePathFace(index: number): TopoDS_Face {
    let wire = this.makeWire(index);
    const faceBuilder = new this.oc.BRepBuilderAPI_MakeFace_15(wire, false);
    wire.delete();
    const face = faceBuilder.Face();
    if (!faceBuilder.IsDone()) {
      throw new Error('Face builder did not execute');
    }
    return face;
  }

  private shouldReverseNext(): boolean {
    if (!this.makeHoles) {
      return false;
    }
    return this.haveWire
      ? this.wireEdges.length > 1
      : this.wireEdges.length > 0;
  }

  private makeWire(index: number): TopoDS_Wire {
    if (index >= this.wireEdges.length) {
      throw new Error(`Wire index ${index} out of bounds`);
    }
    const wire = new this.oc.BRepBuilderAPI_MakeWire_1();
    for (const edge of this.wireEdges[index]) {
      wire.Add_1(edge);
    }
    const ret = wire.Wire();
    wire.delete();
    return ret;
  }

  private makeWireReverse(index: number): TopoDS_Wire {
    if (index >= this.wireEdges.length) {
      throw new Error(`Wire index ${index} out of bounds`);
    }
    const wire = new this.oc.BRepBuilderAPI_MakeWire_1();
    for (let i = this.wireEdges[index].length - 1; i >= 0; --i) {
      const edge = this.wireEdges[index][i];
      wire.Add_1(edge);
    }
    const ret = wire.Wire();
    wire.delete();
    return ret;
  }

  private addEdge(edge: TopoDS_Edge): void {
    if (!this.haveWire) {
      this.wireEdges.push([]);
      this.haveWire = true;
    }
    this.wireEdges[this.wireEdges.length - 1].push(edge);
  }

  move(x: number, y: number, z: number): void {
    this.tx = x;
    this.ty = y;
    this.tz = z;
    this.havePoint = true;
    this.haveWire = false;
  }

  line(x: number, y: number, z: number): void {
    if (!this.havePoint) {
      throw new Error('Drwaing line without a start point');
    }
    if (x === this.tx && y === this.ty && z === this.tz) {
      return;
    }
    let p0: gp_Pnt | undefined = undefined;
    let p1: gp_Pnt | undefined = undefined;
    let dir: gp_Dir | undefined = undefined;
    let lineBuilder: Geom_Line | undefined = undefined;
    let line: gp_Lin | undefined = undefined;
    let edgeBuilder: BRepBuilderAPI_MakeEdge | undefined = undefined;
    try {
      if (this.shouldReverseNext()) {
        p1 = new this.oc.gp_Pnt_3(this.tx, this.ty, this.tz);
        p0 = new this.oc.gp_Pnt_3(x, y, z);
        dir = new this.oc.gp_Dir_4(this.tx - x, this.ty - y, this.tz - z);
      } else {
        p0 = new this.oc.gp_Pnt_3(this.tx, this.ty, this.tz);
        p1 = new this.oc.gp_Pnt_3(x, y, z);
        dir = new this.oc.gp_Dir_4(x - this.tx, y - this.ty, z - this.tz);
      }
      lineBuilder = new this.oc.Geom_Line_3(p0, dir);
      line = lineBuilder.Lin();
      edgeBuilder = new this.oc.BRepBuilderAPI_MakeEdge_6(line, p0, p1);
      this.addEdge(edgeBuilder.Edge());
    } finally {
      edgeBuilder?.delete();
      line?.delete();
      lineBuilder?.delete();
      dir?.delete();
      p1?.delete();
      p0?.delete();
    }
    this.tx = x;
    this.ty = y;
    this.tz = z;
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
    if (!this.havePoint) {
      throw new Error('Drwaing conic without a start point');
    }
    if (x2 === this.tx && y2 === this.ty && z2 === this.tz) {
      return;
    }
    let p0: gp_Pnt | undefined = undefined;
    let p1: gp_Pnt | undefined = undefined;
    let p2: gp_Pnt | undefined = undefined;
    let poles: TColgp_Array1OfPnt | undefined = undefined;
    let weights: TColStd_Array1OfReal | undefined = undefined;
    let knots: TColStd_Array1OfReal | undefined = undefined;
    let mults: TColStd_Array1OfInteger | undefined = undefined;
    let curveBuilder: Geom_BSplineCurve | undefined = undefined;
    let curve: Handle_Geom_Curve | undefined = undefined;
    let edgeBuilder: BRepBuilderAPI_MakeEdge | undefined = undefined;
    try {
      if (this.shouldReverseNext()) {
        p2 = new this.oc.gp_Pnt_3(this.tx, this.ty, this.tz);
        p1 = new this.oc.gp_Pnt_3(x1, y1, z1);
        p0 = new this.oc.gp_Pnt_3(x2, y2, z2);
      } else {
        p0 = new this.oc.gp_Pnt_3(this.tx, this.ty, this.tz);
        p1 = new this.oc.gp_Pnt_3(x1, y1, z1);
        p2 = new this.oc.gp_Pnt_3(x2, y2, z2);
      }
      poles = new this.oc.TColgp_Array1OfPnt_2(1, 3);
      poles.SetValue(1, p0);
      poles.SetValue(2, p1);
      poles.SetValue(3, p2);
      weights = new this.oc.TColStd_Array1OfReal_2(1, 3);
      weights.SetValue(1, 1.0);
      weights.SetValue(2, w);
      weights.SetValue(3, 1.0);
      knots = new this.oc.TColStd_Array1OfReal_2(1, 2);
      knots.SetValue(1, 0.0);
      knots.SetValue(2, 1.0);
      mults = new this.oc.TColStd_Array1OfInteger_2(1, 2);
      mults.SetValue(1, 3);
      mults.SetValue(2, 3);
      curveBuilder = new this.oc.Geom_BSplineCurve_2(
        poles,
        weights,
        knots,
        mults,
        2,
        false,
        true
      );
      curve = new this.oc.Handle_Geom_Curve_2(curveBuilder);
      edgeBuilder = new this.oc.BRepBuilderAPI_MakeEdge_26(curve, p0, p2);
      this.addEdge(edgeBuilder.Edge());
    } finally {
      edgeBuilder?.delete();
      curve?.delete();
      // Don't delete this one.  It makes the edge invalid
      // curveBuilder?.delete();
      mults?.delete();
      knots?.delete();
      weights?.delete();
      poles?.delete();
      p2?.delete();
      p1?.delete();
      p0?.delete();
    }
    this.tx = x2;
    this.ty = y2;
    this.tz = z2;
  }
}
