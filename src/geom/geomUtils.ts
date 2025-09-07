import { DEGREE } from './constants.js';

/**
 * Calculate the conic parameters for a circular arc.
 *
 * @param turn turn angle in degrees, from +X toward +Y
 * @returns [deflection, w].  Let V be the vector from P1 to the P1-P3 midpoint.  Rotate it
 *      by 90 degrees from +X toward +Y and multiply it by `deflection` to get the vector
 *      from P1 to P2.  The `w` parameter is the midpoint weight of the conic.
 */
export function conicArcParams(turnDegrees: number): [number, number] {
  const halfTurn = turnDegrees * DEGREE * 0.5;
  return [-Math.tan(halfTurn), Math.cos(halfTurn)];
}

/**
 * Convert a conic arc to a cubic Bezier approximation with the same
 * maximum deviation from the line.
 *
 * Let the given conic arc be a quadratic rational b-spline with have control points
 * Ps, Pm, Pe with weights (1, w, 1)
 *
 * Let the target Bezier have control points Ps, f(Pm)+(1-f)Ps, f(Pm)+(1-f)Pe, Pe.
 *
 * Calculate the value of f such that both curves have the same maximum deviation
 * from the PsPe line.
 *
 * The Bezier control points cross (f=1) at w=3
 *
 * @param w the rational b-spline weight of the conic midpoint
 */
export function conicWeightToCubic(w: number) {
  // For simplicity, this discussion assumes Ps=0, Pm=1, Pe=0
  // Coordinate of the conic arc:
  // y = 2wt(1-t) / ( t^2 + (1-t)^2 + 2wt(1-t) )
  // This is maximized at t=0.5, where
  // y = w / (w+1)
  // Coordinate of the Bezier:
  // y = 3f( t(1-t)^2 + t^2(1-t) ) = 3f( t - t^2 )
  // This is also maximized at t=0.5, where
  // y = 3f/4
  // Solve 3f/4 = w/(w+1)
  return (4 * w) / (3 * (w + 1));
  // w=1 (parabola) => f=2/3.  Checks out.
}

/**
 * Calculate the maximum error of the `conicWeightToCubic` approximation.
 *
 * Multiply the result by the distance of the middle control point from the start->end line
 *
 * This is 0 when w=0 (line) or w=1 (parabola).
 *
 * The max between 0 and 1 is about 0.025 at w ~ 0.4.
 *
 * The error increases quickly over w=1 toward an asymptote at about 0.443
 *
 * @param w the rational b-spline weight of the conic midpoint
 */
export function conicWeightToCubicError(w: number) {
  // borrowing from the above, with f = 4w/3(w+1),
  // the error at any point is
  // e = 2wt(1-t) / ( t^2 + (1-t)^2 + 2wt(1-t) ) - 4w(t-t^2)/(w+1)
  // This is maximixed when t=1/6, where
  // e = (20w - 20w^2)/(9(w+1)(5w+13))
  // The max is about 0.025 at w ~ 0.4
  if (w < 0.01) {
    // linear approximation when we get close to dividing by 0
    return w * 0.167;
  }
  return Math.abs((20 * w - 20 * w * w) / (9 * (w + 1) * (5 * w + 13)));
}

export function vecLength(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get the circle radius from the straight-line distance and turn angle.
 *
 * Radius has the same sign as the turn angle.
 *
 * CHECK TO MAKE SURE THE TURN IS SIGNIFICANT FIRST
 *
 * @param distance straight line distance
 * @param turn amount turned in rads in +x toward +y direction
 */
export function radiusFromDistance(
  distance: number,
  turnDegrees: number
): number {
  return (distance * 0.5) / Math.sin(turnDegrees * DEGREE * 0.5);
}

/**
 * Distance from the line to the circle center, in line lengths.
 *
 * Sign is the same as the turn angle, so the center is at:
 *
 * ` cx = midx - dy * cdfac; cy = midy + dx * cdfac; `
 *
 * ... where `(midx,midy)` is the midpoint of the line.
 *
 * CHECK TO MAKE SURE THE TURN IS SIGNIFICANT FIRST
 */
export function centerDistanceFactor(turnDegrees: number): number {
  return 0.5 / Math.tan(turnDegrees * DEGREE * 0.5);
}

/**
 * Maximum distance from the line to the arc, in line lengths.
 *
 * Sign is OPPOSITE the turn angle, so the arc midpoint is at:
 *
 * ` x = midx - dy * bfac; cy = midy + dx * bfac; `
 *
 * ... where `(midx,midy)` is the midpoint of the line.
 */
export function bulgeFactor(turnDegrees: number): number {
  return Math.tan(turnDegrees * DEGREE * 0.25) * -0.5;
}

/**
 * Get arc length / chord length for a given turn angle
 */
export function arcLengthFactor(turnDegrees: number): number {
  // arc / chord = r*theta / 2*r*sin(theta/2)
  // = theta*0.5 / sin(theta*0.5)
  const turn = turnDegrees * DEGREE;
  return (turn * 0.5) / Math.sin(turn * 0.5);
}

/**
 * Calculate 1-cos(theta) in a way that is stable for small angles.
 * @param theta
 */
export function versine(theta: number): number {
  let x = Math.sin(theta * 0.5);
  return 2.0 * x * x;
}
