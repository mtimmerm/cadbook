import type { TopoDS_Shape } from 'opencascade.js/dist/opencascade.full.js';

export type Point2D = [number, number];
export type Vec2D = [number, number];
export type HVec2D = [number, number, number];

export interface Pen2D {
  /**
   * Start a new path at the given point
   * @param x
   * @param y
   * @param tag
   */
  move(x: number, y: number, tag?: string | null | undefined): void;

  /**
   * Draw a line
   *
   * @param x target X coordinate
   * @param y target Y coordinate
   */
  line(x: number, y: number): void;

  /**
   * Draw an arc or line
   *
   * @param x target X coordinate
   * @param y target Y coordinate
   * @param turnDegrees total rotation in degrees of direction along the arc/line, in the direction that
   *      turns the positive X axis toward the positive Y axis
   */
  arc(x: number, y: number, turnDegrees: number): void;

  /**
   * Draw a quadratic rational Bezier curve (produces a conic arc)
   *
   * Interpolation formula is ( P0*t^2 + P1*w*2*t*(1-t) + P2*(1-t)^2 ) / ( t^2 + w*2*t*(1-t) + (1-t)^2 )
   *
   * @param x1 Control point x
   * @param y1 Control point y
   * @param x2 Final point x
   * @param y2 Final point 1
   * @param w Control point homogenous weight (other points have weight 1).  1 => parabolic, >1 => hyperbllic,
   *          < 1 => Elliptical.  Use `conicArcParams` to create a circular arc when calling `arc` isn't appropriate.
   */
  conic(x1: number, y1: number, x2: number, y2: number, w: number): void;

  /**
   * Draw a full circle.  This will end the current path (if any) and draws a full closed
   * circular path.
   */
  circle(x: number, y: number, d: number, tag?: string | undefined): void;
}

/**
 * A PolarPen2D is like a Pen2D, but every point has an additional `theta`
 * coordinate, and is rotated by theta degrees around the origin in the +x to +y
 * (ccw) direction.
 */
export interface PolarPen2D {
  /**
   * Start a new path at the given point
   */
  move(
    theta: number,
    x: number,
    y: number,
    tag?: string | null | undefined
  ): void;

  /**
   * Draw a line
   */
  line(theta: number, x: number, y: number): void;

  /**
   * Draw an arc or line
   *
   * @param theta target CCW rotation around origin, in degrees
   * @param x target X coordinate
   * @param y target Y coordinate
   * @param turnDegrees total rotation in degrees of direction along the arc/line, in the direction that
   *      turns the positive X axis toward the positive Y axis
   */
  arc(theta: number, x: number, y: number, turnDegrees: number): void;

  /**
   * Draw a quadratic rational Bezier curve (produces a conic arc)
   *
   * Interpolation formula is ( P0*t^2 + P1*w*2*t*(1-t) + P2*(1-t)^2 ) / ( t^2 + w*2*t*(1-t) + (1-t)^2 )
   *
   * @param theta1 Control point rotation around origin, in degrees
   * @param x1 Control point x
   * @param y1 Control point y
   * @param theta2 Final point rotation around origin, in degrees
   * @param x2 Final point x
   * @param y2 Final point 1
   * @param w Control point homogenous weight (other points have weight 1).  1 => parabolic, >1 => hyperbllic,
   *          < 1 => Elliptical.  Use `conicArcParams` to create a circular arc when calling `arc` isn't appropriate.
   */
  conic(
    theta1: number,
    x1: number,
    y1: number,
    theta2: number,
    x2: number,
    y2: number,
    w: number
  ): void;

  /**
   * Draw a full circle.  This will end the current path (if any) and draws a full closed
   * circular path.
   */
  circle(
    theta: number,
    x: number,
    y: number,
    d: number,
    tag?: string | undefined
  ): void;
}

export type Sketch = (pen: Pen2D) => void;

export type Point3D = [number, number, number];
export type Vec3D = [number, number, number];
export type HVec3D = [number, number, number, number];

export interface Pen3D {
  move(x: number, y: number, z: number): void;
  line(x: number, y: number, z: number): void;
  conic(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    w: number
  ): void;
}

export type Profile = (pen: Pen3D) => void;

export type BodyID = string;

export interface Shaper3D {
  /**
   * Extrude a body from a sketch.  The first outline in the sketch
   * is the main part, and the other outlines are holes that are cut out of it.
   *
   * @param plane A transform that maps (x,y,0) sketch coordinates into the correct orientation
   * @param sketch The sketch
   * @param start The extrusion start point of the transformed sketch origin
   * @param end The extrusion end point of the transformed sketch origin
   */
  extrude(plane: XForm3D, sketch: Sketch, start: Point3D, end: Point3D): BodyID;
  /**
   * Extrude multiple bodies from a sketch.  Each outline in the sketch produces a body.
   *
   * @param plane A transform that maps (x,y,0) sketch coordinates into the correct orientation
   * @param sketch The sketch
   * @param start The extrusion start point of the transformed sketch origin
   * @param end The extrusion end point of the transformed sketch origin
   */
  extrudeAll(
    plane: XForm3D,
    sketch: Sketch,
    start: Point3D,
    end: Point3D
  ): BodyID[];

  /**
   * Create a shape by revolving a cross section.  The first outline in the sketch is the main part,
   * and the other outlines are holes that are cut out of it.
   *
   * First the cross section is revolved around the sketch Y axis to create a part.  Then the part is
   * transformed to orient according to the given plane, and finally the origin is moved to the specified
   * position.
   *
   * @param plane
   * @param sketch
   * @param position
   * @param angleDegrees
   */
  revolve(
    plane: XForm3D,
    sketch: Sketch,
    position: Point3D,
    angleDegrees: number
  ): BodyID;

  instance(xform: XForm3D, body: TopoDS_Shape): BodyID | undefined;
  join(targetId: string, toolId: string | string[]): void;
  cut(targetId: string, toolId: string | string[]): void;
}

export type Part = (shaper: Shaper3D) => BodyID[];

export interface XForm2D {
  isSquare(): boolean;
  stationary(): XForm2D;
  mapPoint(x: number, y: number): Point2D;
  mapHPoint(x: number, y: number, w: number): HVec2D;
  mapPen(pen: Pen2D): Pen2D;
  mapXForm(xform: XForm2D): XForm2D;
  mapSketch(profile: Sketch): Sketch;
}

export interface XForm3D {
  isSquare(): boolean;
  stationary(): XForm3D;
  mapPoint(x: number, y: number, z: number): Point3D;
  mapHPoint(x: number, y: number, z: number, w: number): HVec3D;
  mapPen(pen: Pen3D): Pen3D;
  mapShaper(shaper: Shaper3D): Shaper3D;
  mapXForm(xform: XForm3D): XForm3D;
  mapProfile(profile: Profile): Profile;
}
