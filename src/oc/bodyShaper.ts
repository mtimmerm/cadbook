import {
  BodyID,
  ID3D,
  Pen2D,
  Point3D,
  RecordingPen2D,
  ROOT2BY2,
  Shaper3D,
  Sketch,
  SketchToProfilePen,
  XForm3D,
} from '../geom/index.js';
import { OCWirePen } from './wirePen.js';
import {
  BRepAlgoAPI_Fuse,
  BRepBuilderAPI_Transform,
  BRepPrimAPI_MakePrism,
  BRepPrimAPI_MakeRevol,
  gp_Ax1,
  gp_Dir,
  gp_Pnt,
  gp_Trsf,
  gp_Vec,
  Message_ProgressRange,
  OpenCascadeInstance,
  TopoDS_Builder,
  TopoDS_Compound,
  TopoDS_Face,
  TopoDS_Shape,
} from 'opencascade.js/dist/opencascade.full.js';

let g_bodyCounter = 1;
const RADSPERDEGREE = Math.PI / 180;

export interface ShaperProps {
  /**
   * When paths need to be automatically closed, if the end point is farther than this
   * from the start point, then a line will be added instead of moving the end point.
   *
   * Otherwise, if both `closeSnapDistance` and `closeSnapProp` allow it, then the path end point
   * will be moved to exactly match the start point.
   */
  closeSnapDistance: number;
  /**
   * When paths need to be automatically closed, if
   * `|start_point - end_point| >= `closeSnapProp * |last_segment_length|` , then a line will
   * be drawn instead of moving the last segment point.
   *
   * Otherwise, if both `closeSnapDistance` and `closeSnapProp` allow it, then the path end point
   * will be moved to exactly match the start point.
   */
  closeSnapProp: number;
  /**
   * The maximum distance, in model units, that the tessellated mesh can deviate from the true
   * geometry.
   */
  meshLinearTolerance: number;
  /**
   * The maximum angle, in degrees, between the normals of adjacent triangles used to approximate
   * curved surfaces.
   */
  meshAngularTolerance: number;
}

export class OCBodyShaper implements Shaper3D {
  private oc: OpenCascadeInstance;
  private shapes: Map<BodyID, TopoDS_Shape>;
  private meshes: Set<BodyID>;
  private props: ShaperProps;

  constructor(oc: OpenCascadeInstance, props: ShaperProps) {
    this.oc = oc;
    this.shapes = new Map<BodyID, TopoDS_Shape>();
    this.meshes = new Set<BodyID>();
    this.props = props;
  }

  delete(): void {
    for (const shape of this.shapes.values()) {
      shape.delete();
    }
    this.shapes.clear();
  }

  getShape(id: BodyID): TopoDS_Shape | undefined {
    return this.shapes.get(id);
  }

  getMesh(id: BodyID): TopoDS_Shape | undefined {
    const shape = this.shapes.get(id);
    if (!shape) {
      return undefined;
    }
    if (!this.meshes.has(id)) {
      const algo = new this.oc.BRepMesh_IncrementalMesh_2(
        shape,
        this.props.meshLinearTolerance,
        false,
        this.props.meshAngularTolerance * RADSPERDEGREE,
        false
      );
      const progress = new this.oc.Message_ProgressRange_1(); // Use the appropriate constructor, usually _1 for the default
      algo.Perform(progress);
      if (!algo.IsDone()) {
        throw new Error('Meshing failed or was not done.');
        // You might check meshAlgo.GetStatusFlags() for more details
      }
      this.meshes.add(id);
    }
    return shape;
  }

  detachShapes(ids: BodyID[]): TopoDS_Shape[] {
    const ret = ids.map((id) => this.shapes.get(id)!).filter(Boolean);
    ids.forEach((id) => {
      this.shapes.delete(id);
      this.meshes.delete(id);
    });
    return ret;
  }

  extrude(
    plane: XForm3D,
    sketch: Sketch,
    start: Point3D,
    end: Point3D
  ): BodyID {
    let wirePen: OCWirePen | undefined = undefined;
    let face: TopoDS_Face | undefined = undefined;
    let dir: gp_Vec | undefined = undefined;
    let prism: BRepPrimAPI_MakePrism | undefined = undefined;
    try {
      const startXForm = ID3D.translate(start[0], start[1], start[2]);
      wirePen = new OCWirePen(this.oc, true);
      const pen2d: Pen2D = new SketchToProfilePen(
        startXForm.mapXForm(plane).mapPen(wirePen)
      );
      const ccwPen = new MakeCCWPen(
        pen2d,
        this.props.closeSnapDistance,
        this.props.closeSnapProp
      );
      sketch(ccwPen);
      ccwPen.flush();
      face = wirePen.makeFace();
      dir = new this.oc.gp_Vec_4(
        end[0] - start[0],
        end[1] - start[1],
        end[2] - start[2]
      );
      if (face.IsNull()) {
        throw new Error('Face is null, cannot extrude');
      }
      prism = new this.oc.BRepPrimAPI_MakePrism_1(face!, dir, false, true);
      const id = `b${g_bodyCounter++}`;
      this.shapes.set(id, prism.Shape());
      this.meshes.delete(id);
      return id;
    } finally {
      prism?.delete();
      dir?.delete();
      wirePen?.delete();
      face?.delete();
    }
  }
  extrudeAll(
    plane: XForm3D,
    sketch: Sketch,
    start: Point3D,
    end: Point3D
  ): BodyID[] {
    let wirePen: OCWirePen | undefined = undefined;
    let face: TopoDS_Face | undefined = undefined;
    let dir: gp_Vec | undefined = undefined;
    let prism: BRepPrimAPI_MakePrism | undefined = undefined;
    const ret: BodyID[] = [];
    try {
      const startXForm = ID3D.translate(start[0], start[1], start[2]);
      wirePen = new OCWirePen(this.oc, false);
      const pen2d: Pen2D = new SketchToProfilePen(
        startXForm.mapXForm(plane).mapPen(wirePen)
      );
      const ccwPen = new MakeCCWPen(
        pen2d,
        this.props.closeSnapDistance,
        this.props.closeSnapProp
      );
      sketch(ccwPen);
      ccwPen.flush();
      dir = new this.oc.gp_Vec_4(
        end[0] - start[0],
        end[1] - start[1],
        end[2] - start[2]
      );
      const count = wirePen.wireCount();
      for (let i = 0; i < count; i++) {
        face = wirePen.makePathFace(i);
        if (face.IsNull()) {
          throw new Error('Face is null, cannot extrude');
        }
        prism = new this.oc.BRepPrimAPI_MakePrism_1(face!, dir, false, true);
        const id = `b${g_bodyCounter++}`;
        this.shapes.set(id, prism.Shape());
        this.meshes.delete(id);
        ret.push(id);
        face?.delete();
        face = undefined;
        prism?.delete();
        prism = undefined;
      }
    } finally {
      prism?.delete();
      dir?.delete();
      wirePen?.delete();
      face?.delete();
    }
    return ret;
  }

  revolve(
    plane: XForm3D,
    sketch: Sketch,
    position: Point3D,
    angleDegrees: number
  ): BodyID {
    let wirePen: OCWirePen | undefined = undefined;
    let face: TopoDS_Face | undefined = undefined;
    let axPt: gp_Pnt | undefined = undefined;
    let axDir: gp_Dir | undefined = undefined;
    let axis: gp_Ax1 | undefined = undefined;
    let revol: BRepPrimAPI_MakeRevol | undefined = undefined;
    try {
      wirePen = new OCWirePen(this.oc, true);
      const pen2d: Pen2D = new SketchToProfilePen(wirePen);
      const ccwPen = new MakeCCWPen(
        pen2d,
        this.props.closeSnapDistance,
        this.props.closeSnapProp
      );
      sketch(ccwPen);
      ccwPen.flush();
      face = wirePen.makeFace();
      if (face.IsNull()) {
        throw new Error('Face is null, cannot extrude');
      }
      axPt = new this.oc.gp_Pnt_3(0, 0, 0);
      axDir = new this.oc.gp_Dir_4(0, 1, 0);
      axis = new this.oc.gp_Ax1_2(axPt, axDir);
      if (angleDegrees >= 360 || angleDegrees <= -360) {
        revol = new this.oc.BRepPrimAPI_MakeRevol_2(face!, axis, false);
      } else {
        revol = new this.oc.BRepPrimAPI_MakeRevol_1(
          face!,
          axis,
          angleDegrees * RADSPERDEGREE,
          false
        );
      }
      const id = `b${g_bodyCounter++}`;
      this.shapes.set(id, revol.Shape());
      this.meshes.delete(id);
      const startXForm = ID3D.translate(position[0], position[1], position[2]);
      const totalXForm = startXForm.mapXForm(plane);
      this.moveAndScale(totalXForm, id);
      return id;
    } finally {
      revol?.delete();
      axis?.delete();
      axDir?.delete();
      axPt?.delete();
      wirePen?.delete();
      face?.delete();
    }
  }

  private moveAndScale(xform: XForm3D, bodyId: BodyID): void {
    if (!xform.isSquare()) {
      throw new Error('Can only moveAndScale with square transforms');
    }
    let shapeTransform: BRepBuilderAPI_Transform | undefined;
    let trsf: gp_Trsf | undefined;
    const body = this.shapes.get(bodyId);
    if (!body) {
      return;
    }
    try {
      trsf = new this.oc.gp_Trsf_1();
      const xfs = xform.stationary();
      const xcol = xfs.mapPoint(1, 0, 0);
      const ycol = xfs.mapPoint(0, 1, 0);
      const zcol = xfs.mapPoint(0, 0, 1);
      const tcol = xform.mapPoint(0, 0, 0);
      trsf.SetValues(
        xcol[0],
        ycol[0],
        zcol[0],
        tcol[0],
        xcol[1],
        ycol[1],
        zcol[1],
        tcol[1],
        xcol[2],
        ycol[2],
        zcol[2],
        tcol[2]
      );
      shapeTransform = new this.oc.BRepBuilderAPI_Transform_2(
        body,
        trsf,
        false
      );
      if (!shapeTransform) {
        throw new Error(`Shape instancing transform didn't complete`);
      }
      this.shapes.set(bodyId, shapeTransform.Shape());
      this.meshes.delete(bodyId);
    } finally {
      shapeTransform?.delete();
      trsf?.delete;
    }
  }

  instance(xform: XForm3D, body: TopoDS_Shape): BodyID | undefined {
    if (!xform.isSquare()) {
      return undefined;
    }
    let shapeTransform: BRepBuilderAPI_Transform | undefined;
    let trsf: gp_Trsf | undefined;
    try {
      trsf = new this.oc.gp_Trsf_1();
      const xfs = xform.stationary();
      const xcol = xfs.mapPoint(1, 0, 0);
      const ycol = xfs.mapPoint(0, 1, 0);
      const zcol = xfs.mapPoint(0, 0, 1);
      const tcol = xform.mapPoint(0, 0, 0);
      trsf.SetValues(
        xcol[0],
        ycol[0],
        zcol[0],
        tcol[0],
        xcol[1],
        ycol[1],
        zcol[1],
        tcol[1],
        xcol[2],
        ycol[2],
        zcol[2],
        tcol[2]
      );
      shapeTransform = new this.oc.BRepBuilderAPI_Transform_2(body, trsf, true);
      if (!shapeTransform) {
        throw new Error(`Shape instancing transform didn't complete`);
      }
      const id = `b${g_bodyCounter++}`;
      this.shapes.set(id, shapeTransform.Shape());
      this.meshes.delete(id);
      return id;
    } finally {
      shapeTransform?.delete();
      trsf?.delete;
    }
  }

  join(targetId: BodyID, toolId: BodyID | BodyID[]): void {
    if (Array.isArray(toolId)) {
      for (const t of toolId) {
        this.join(targetId, t);
      }
      return;
    }
    let target = this.shapes.get(targetId);
    if (!target) {
      throw new Error(`Invalid target shape ID ${targetId}`);
    }
    const tool = this.shapes.get(toolId);
    if (!tool) {
      throw new Error(`Invalid tool shape ID ${toolId}`);
    }
    let algo: BRepAlgoAPI_Fuse | undefined = undefined;
    let mpr: Message_ProgressRange | undefined = undefined;
    try {
      mpr = new this.oc.Message_ProgressRange_1();
      algo = new this.oc.BRepAlgoAPI_Fuse_3(target, tool, mpr);
      if (!algo.IsDone()) {
        throw new Error('Fuse operation did not complete');
      }
      const newTarget = algo.Shape();
      target.delete();
      //      const bb = new this.oc.Bnd_Box_1();
      //      this.oc.BRepBndLib.Add(newTarget, bb, false);
      //      bb.Dump();
      this.shapes.set(targetId, newTarget);
      this.meshes.delete(targetId);
    } finally {
      algo?.delete();
      mpr?.delete();
    }
  }

  cut(targetId: BodyID, toolId: BodyID | BodyID[]): void {
    if (Array.isArray(toolId)) {
      for (const t of toolId) {
        this.cut(targetId, t);
      }
      return;
    }
    let target = this.shapes.get(targetId);
    if (!target) {
      throw new Error(`Invalid target shape ID ${targetId}`);
    }
    const tool = this.shapes.get(toolId);
    if (!tool) {
      throw new Error(`Invalid tool shape ID ${toolId}`);
    }
    let algo: BRepAlgoAPI_Fuse | undefined = undefined;
    let mpr: Message_ProgressRange | undefined = undefined;
    try {
      mpr = new this.oc.Message_ProgressRange_1();
      algo = new this.oc.BRepAlgoAPI_Cut_3(target, tool, mpr);
      if (!algo.IsDone()) {
        throw new Error('Fuse operation did not complete');
      }
      const newTarget = algo.Shape();
      target.delete();
      this.shapes.set(targetId, newTarget);
      this.meshes.delete(targetId);
    } finally {
      algo?.delete();
      mpr?.delete();
    }
  }

  compound(ids: BodyID[]): BodyID {
    if (ids.length === 1) {
      return ids[0];
    }
    let builder: TopoDS_Builder | undefined;
    let compound: TopoDS_Compound | undefined;
    try {
      builder = new this.oc.TopoDS_Builder();
      compound = new this.oc.TopoDS_Compound();
      builder.MakeCompound(compound);
      for (const id of ids) {
        const shape = this.shapes.get(id);
        if (shape) {
          builder.Add(compound, shape);
        }
      }
      const id = `b${g_bodyCounter++}`;
      this.shapes.set(id, compound);
      compound = undefined; // prevent double delete
      this.meshes.delete(id);
      return id;
    } finally {
      builder?.delete();
      compound?.delete();
    }
  }
}

class MakeCCWPen implements Pen2D {
  private target: Pen2D;
  private recorder: RecordingPen2D;
  private snapDistance: number;
  private snapProp: number;

  constructor(target: Pen2D, snapDistance: number, snapProp: number) {
    this.target = target;
    this.recorder = new RecordingPen2D();
    this.snapDistance = snapDistance;
    this.snapProp = snapProp;
  }
  flush() {
    if (this.recorder.pathCount() > 0) {
      this.recorder.closePath(0, this.snapDistance, this.snapProp);
      if (this.recorder.getPathSignedAreaApprox(0) < 0) {
        this.recorder.replayPathReversed(this.target, 0);
      } else {
        this.recorder.replayPath(this.target, 0);
      }
      this.recorder.clear();
    }
  }
  move(x: number, y: number, tag?: string | null | undefined): void {
    this.flush();
    this.recorder.move(x, y, tag);
  }
  line(x: number, y: number): void {
    this.recorder.line(x, y);
  }
  arc(x: number, y: number, turnDegrees: number): void {
    this.recorder.arc(x, y, turnDegrees);
  }
  conic(x1: number, y1: number, x2: number, y2: number, w: number): void {
    this.recorder.conic(x1, y1, x2, y2, w);
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
