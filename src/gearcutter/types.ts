export type Point2D = [number, number];
export type PathFunc = (pen: Pen, doMove: boolean) => void;

export interface Pen {
  /**
   * Set the current point
   *
   * @param x New current X coordinate
   * @param y New current Y coordinate
   */
  moveTo(x: number, y: number): void;
  /**
   * Draw an arc or line
   *
   * @param x target X coordinate
   * @param y target Y coordinate
   * @param turn total rotation of direction along the arc/line, in the direction that
   *      turns the positive X axis toward the positive Y axis
   */
  arcTo(x: number, y: number, turn: number): void;
  /**
   * Clear all the moves and arcs that have been sent to the pen so far.
   *
   * THIS IS NOT SUPPORTED IN ALL IMPLEMENTATIONS
   */
  reset?(): void;
}

export type Unit = 'px' | 'mm' | 'in' | 'ptmm' | 'ptin';

/**
 * Represents a cutting path in polar coordinates.
 */
export interface CutCurve {
  /**
   * Get the radius of the cut at angle theta
   * @param theta Angle in radians at which to get the curve radius
   */
  getR(theta: number): number;

  /**
   * Get any thetas between minTheta and maxTheta at which discontinuities occur
   *
   * @param minTheta Exclusive lower bound
   * @param maxTheta Exclusive upper bound
   */
  getDiscontinuityThetas(minTheta: number, maxTheta: number): number[];

  /**
   * Draw a segment of the cut
   */
  drawSegment(
    pen: Pen,
    thetaFrom: number,
    thetaTo: number,
    doInitialMove: boolean
  ): void;
}

/**
 * A segment of a cutting path in polar coords:
 *
 * [starting angle, ending angle (greater), curve, rotate curve around axis by this amount]
 *
 * Angles are in *teeth*
 */
export type PolarCutSegment = [number, number, CutCurve, number];

/**
 * A simple on a cutting path in polar coords:
 *
 * [angle, curve, rotate curve around axis by this amount]
 */
export type PolarPathSample = [number, CutCurve, number];
