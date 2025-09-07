import type { TopoDS_Shape } from 'opencascade.js/dist/opencascade.full.js';
import { BodyID, Point3D, Shaper3D, Sketch, XForm3D } from './types.js';

export class XFormShaper implements Shaper3D {
  private xform: XForm3D;
  private target: Shaper3D;

  constructor(xform: XForm3D, target: Shaper3D) {
    this.xform = xform;
    this.target = target;
  }
  extrude(
    plane: XForm3D,
    sketch: Sketch,
    start: Point3D,
    end: Point3D
  ): BodyID {
    return this.target.extrude(
      this.xform.stationary().mapXForm(plane),
      sketch,
      this.xform.mapPoint(start[0], start[1], start[2]),
      this.xform.mapPoint(end[0], end[1], end[2])
    );
  }
  extrudeAll(
    plane: XForm3D,
    sketch: Sketch,
    start: Point3D,
    end: Point3D
  ): BodyID[] {
    return this.target.extrudeAll(
      this.xform.stationary().mapXForm(plane),
      sketch,
      this.xform.mapPoint(start[0], start[1], start[2]),
      this.xform.mapPoint(end[0], end[1], end[2])
    );
  }
  revolve(
    plane: XForm3D,
    sketch: Sketch,
    position: Point3D,
    angleDegrees: number
  ): BodyID {
    return this.target.revolve(
      this.xform.stationary().mapXForm(plane),
      sketch,
      this.xform.mapPoint(position[0], position[1], position[2]),
      angleDegrees
    );
  }

  instance(xform: XForm3D, body: TopoDS_Shape): BodyID | undefined {
    return this.target.instance(this.xform.mapXForm(xform), body);
  }
  join(targetId: string, toolId: string | string[]): void {
    this.target.join(targetId, toolId);
  }
  cut(targetId: string, toolId: string | string[]): void {
    this.target.cut(targetId, toolId);
  }
}
