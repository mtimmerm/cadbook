import { DEGREE } from "./geom/constants.js";
import { Pen2D, PolarPen2D } from "./geom/types.js";

/**
 * A PolarPen2D is like a Pen2D, but every point has an additional `theta`
 * coordinate, and is rotated by theta degrees around the origin in the +x to +y
 * (ccw) direction.
 */
class PolarPenImpl2D implements PolarPen2D {
  private readonly pen: Pen2D;

  constructor(pen: Pen2D) {
    this.pen = pen;
  }

  move(theta: number, x: number, y: number, tag?: string | null | undefined) : void {
    const rads = theta * DEGREE;
    const s = Math.sin(rads);
    const c = Math.cos(rads);
    this.pen.move(x*c-y*s, y*c+x*s, tag);
  }

  line(theta: number, x: number, y: number): void {
    const rads = theta * DEGREE;
    const s = Math.sin(rads);
    const c = Math.cos(rads);
    this.pen.line(x*c-y*s, y*c+x*s);
  }

  arc(theta: number, x: number, y: number, turnDegrees: number): void {
    const rads = theta * DEGREE;
    const s = Math.sin(rads);
    const c = Math.cos(rads);
    this.pen.arc(x*c-y*s, y*c+x*s, turnDegrees);
  }

  conic(theta1: number, x1: number, y1: number, theta2: number, x2: number, y2: number, w: number): void {
    const rads1 = theta1 * DEGREE;
    const s1 = Math.sin(rads1);
    const c1 = Math.cos(rads1);
    const rads2 = theta2 * DEGREE;
    const s2 = Math.sin(rads2);
    const c2 = Math.cos(rads2);
    this.pen.conic(x1*c1-y1*s1, y1*c1+x1*s1,  x2*c2-y2*s2, y2*c2+x2*s2, w);
  }

  circle(theta: number, x: number, y: number, d: number, tag?: string | undefined): void {
    const rads = theta * DEGREE;
    const s = Math.sin(rads);
    const c = Math.cos(rads);
    this.pen.circle(x*c-y*s, y*c+x*s, d, tag);
  }
}

export function polar2D(pen: Pen2D) : PolarPen2D {
  return new PolarPenImpl2D(pen);
}
