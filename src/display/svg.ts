import {
  centerDistanceFactor,
  conicWeightToCubic,
  conicWeightToCubicError,
  radiusFromDistance,
} from '../geom/geomUtils.js';
import { Matrix2D } from '../geom/matrix.js';
import { Pen2D, Sketch } from '../geom/types.js';

const DEFAULT_SVG_SCALE = 96.0 / 25.4;

export interface SvgDrawProps {
  /**
   * Value for the SVG `fill` attribute.
   *
   * If this is undefined, then the path will not be filled or closed.
   */
  readonly fill?: string | undefined;
  /**
   * Value for the SVG `stroke` attribute.
   *
   * If this is undefined, then the path will not be stroked;
   */
  readonly stroke?: string | undefined;
  /**
   * SVG stroke width, before scale is applied.  If this is undefined,
   * it defaults to 1.
   */
  readonly strokeWidth?: number | undefined;
}

export interface SvgRenderProps {
  /**
   * size of `viewBox` border around input sketches (after scaling).
   *
   * Default is 1
   */
  border?: number | undefined;
  /**
   * multiplier for input coordinates.  Negative scale flips the y axis.
   * If not specified, 96/25.4 is used, which will be millimeters with y axis up
   * for most consumers.
   */
  scale?: number | undefined;
  /**
   * Tolerance for conic -> bezier approximation, before scale is applied
   */
  conicTolerance?: number | undefined;
  /**
   * How to draw paths in a sketch
   */
  pathStyle: SvgDrawProps;
  /**
   * Path style overrides for tagged paths, by tag
   */
  tagStyles?: Record<string, SvgDrawProps> | undefined;
}

export class SvgRecorder {
  private readonly buf: string[];
  private readonly props: SvgRenderProps;
  private bounds: [number, number, number, number] | null;

  constructor(props: SvgRenderProps) {
    this.buf = [
      '<?xml version="1.0" encoding="UTF-8"?>\n',
      '<svg>', // this will be replaced with the real start tag
    ];
    this.bounds = null;
    this.props = props;
  }

  getSvgText(): string {
    const oldlen = this.buf.length;
    let [minx, miny, width, height] = this.bounds || [0, 0, 0, 0];
    const border = this.props.border ?? 1;
    minx = Math.floor(minx - border);
    miny = Math.floor(miny - border);
    width = Math.ceil(width + border) - minx;
    height = Math.ceil(height + border) - miny;
    this.buf[1] = `<svg viewBox="${minx} ${miny} ${width} ${height}" style="background: white; width: 100%; max-height: 300px;" preserveAspectRatio="meet" version="1.1" xmlns="http://www.w3.org/2000/svg">\n`;
    this.buf.push('</svg>\n');
    const svg = this.buf.join('');
    this.buf.length = oldlen;
    return svg;
  }

  draw(sketch: Sketch) {
    const pen = new SvgPen(this.props, this.buf);
    const scale = this.props.scale ?? DEFAULT_SVG_SCALE;
    const xf = new Matrix2D([Math.abs(scale), 0, 0], [0, -scale, 0], [0, 0, 1]);
    const xfpen = xf.mapPen(pen);
    sketch(xfpen);
    this.mergeBounds(pen.finish());
  }

  private mergeBounds(bounds: [number, number, number, number] | null) {
    if (!this.bounds) {
      this.bounds = bounds;
    } else if (bounds) {
      for (let i = 0; i < 2; ++i) {
        this.bounds[i] = Math.min(this.bounds[i], bounds[i]);
        this.bounds[i + 2] = Math.max(this.bounds[i + 2], bounds[i + 2]);
      }
    }
  }
}

class SvgPen implements Pen2D {
  private readonly buf: string[];
  readonly svgProps: SvgRenderProps;
  private closePath: boolean;
  private havePoint = false;
  private havePath = false;
  private pendingStyle: SvgDrawProps | null;
  private openStyle: SvgDrawProps | null;
  private lastx = 0;
  private lasty = 0;
  private minx = 0;
  private miny = 0;
  private maxx = 0;
  private maxy = 0;
  private conicTolerance: number;

  constructor(props: SvgRenderProps, buf: string[]) {
    this.buf = buf;
    this.svgProps = props;
    this.openStyle = null;
    this.pendingStyle = null;
    this.closePath = false;
    this.conicTolerance = this.svgProps.conicTolerance ?? 0.05;
  }
  finish(): [number, number, number, number] | null {
    if (this.havePath) {
      this.buf.push(this.closePath ? ' Z"/>\n' : '"/>\n');
      this.havePath = false;
    }
    if (this.openStyle) {
      this.buf.push('</g>');
      this.openStyle = null;
    }
    return [this.minx, this.miny, this.maxx, this.maxy];
  }
  move(x: number, y: number, tag?: string | null | undefined): void {
    if (this.havePath) {
      this.buf.push(this.closePath ? ' Z"/>\n' : '"/>\n');
      this.havePath = false;
    }
    this.lastx = x;
    this.lasty = y;
    this.havePoint = true;
    if (tag && this.svgProps.tagStyles) {
      this.pendingStyle =
        this.svgProps.tagStyles[tag] ?? this.svgProps.pathStyle ?? {};
    } else {
      this.pendingStyle = this.svgProps.pathStyle ?? {};
    }
    this.closePath = !!this.pendingStyle.fill;
  }

  private startGroup() {
    const style = this.pendingStyle ?? this.svgProps.pathStyle ?? {};
    if (this.openStyle !== style) {
      if (this.openStyle) {
        this.buf.push('</g>');
      } else {
        // starting the first path
        this.minx = this.maxx = this.lastx;
        this.miny = this.maxy = this.lasty;
      }
      const fill = style.fill || 'none';
      const stroke = style.stroke || 'none';
      const strokeWidth =
        (style.strokeWidth ?? 1) *
        Math.abs(this.svgProps.scale ?? DEFAULT_SVG_SCALE);
      this.buf.push(
        `<g fill="${fill}" stroke-width="${strokeWidth}" stroke="${stroke}">\n`
      );
      this.openStyle = style;
    }
  }

  private startSegment(segType: string) {
    if (this.havePath) {
      return;
    }
    if (!this.havePoint) {
      throw new Error(`${segType} before move in SVG`);
    }
    this.startGroup();
    this.buf.push(`    <path d=" M ${this.lastx} ${this.lasty}`);
    this.havePath = true;
    this.minx = Math.min(this.minx, this.lastx);
    this.maxx = Math.max(this.maxx, this.lastx);
    this.miny = Math.min(this.miny, this.lasty);
    this.maxy = Math.max(this.maxy, this.lasty);
  }
  line(x: number, y: number) {
    this.startSegment('line');
    this.minx = Math.min(this.minx, x);
    this.maxx = Math.max(this.maxx, x);
    this.miny = Math.min(this.miny, y);
    this.maxy = Math.max(this.maxy, y);
    this.buf.push(` L ${x} ${y}`);
    this.lastx = x;
    this.lasty = y;
  }

  arc(x: number, y: number, turnDegrees: number): void {
    this.startSegment('arc');
    this.minx = Math.min(this.minx, x);
    this.maxx = Math.max(this.maxx, x);
    this.miny = Math.min(this.miny, y);
    this.maxy = Math.max(this.maxy, y);
    if (Math.abs(turnDegrees) < 0.01) {
      this.buf.push(` L ${x} ${y}`);
    } else {
      // SVG arcTo command is
      // A r r 0 0 side x1 x1
      // where r is circle radius
      // side is 0
      const side = turnDegrees > 0 ? 1 : 0;
      const dx = x - this.lastx;
      const dy = y - this.lasty;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const r = Math.abs(radiusFromDistance(dist, turnDegrees));
      const tanfac = centerDistanceFactor(turnDegrees);
      const cx = x - dx * 0.5 - dy * tanfac;
      const cy = y - dy * 0.5 + dx * tanfac;
      if (cx > Math.min(this.lastx, x) && cx < Math.max(this.lastx, x)) {
        if (cy > (y + this.lasty) * 0.5) {
          this.miny = Math.min(this.miny, cy - r);
        } else {
          this.maxy = Math.max(this.maxy, cy + r);
        }
      }
      if (cy > Math.min(this.lasty, y) && cy < Math.max(this.lasty, y)) {
        if (cx > (x + this.lastx) * 0.5) {
          this.minx = Math.min(this.minx, cx - r);
        } else {
          this.maxx = Math.max(this.maxx, cx + r);
        }
      }
      this.buf.push(` A ${r} ${r} ${0} ${0} ${side} ${x} ${y}`);
    }
    this.lastx = x;
    this.lasty = y;
  }

  conic(x1: number, y1: number, x2: number, y2: number, w: number): void {
    this.startSegment('conic');
    this.minx = Math.min(this.minx, x2);
    this.maxx = Math.max(this.maxx, x2);
    this.miny = Math.min(this.miny, y2);
    this.maxy = Math.max(this.maxy, y2);

    const dx = x2 - this.lastx;
    const dy = y2 - this.lasty;
    const mag2 = dx * dy + dy * dy;
    const mag = Math.sqrt(mag2);
    if (mag < this.conicTolerance) {
      this.line(x2, y2);
      return;
    }
    const crossMag =
      Math.abs(dx * (y1 - this.lasty) + dy * (this.lastx - x1)) / mag;
    const errFactor = conicWeightToCubicError(w);
    if (crossMag * errFactor > this.conicTolerance * this.conicTolerance) {
      // Split
      const mf = w / (w + 1);
      const mx = ((this.lastx + x2) * 0.5 + x1 * w) / (w + 1);
      const my = ((this.lasty + y2) * 0.5 + y1 * w) / (w + 1);
      const ax = (this.lastx + x1 * w) / (w + 1);
      const ay = (this.lasty + y1 * w) / (w + 1);
      const bx = (x2 + x1 * w) / (w + 1);
      const by = (y2 + y1 * w) / (w + 1);
      // w' = t^2 + (1-t)^2 + 2t(1-t)w
      // at -.25 and 0.75, w=0.625 + 0.375w;
      // at 0.5, w = (w+1)/2
      // factor to make mid w 1 = 2/(w+1)
      // multiply .25/.75 values to the sqrt,
      // so new mid2 = (0.625 + 0.375w) * sqrt(2/(w+1))
      // It gets a lot closer to 1
      const abw = (0.625 + 0.375 * w) * Math.sqrt(2 / (w + 1));
      this.conic(ax, ay, mx, my, abw);
      this.conic(bx, by, x2, y2, abw);
    } else {
      // Bezier approx
      const mf = conicWeightToCubic(w);
      const pf = 1 - mf;
      const ax = x1 * mf + this.lastx * pf;
      const ay = y1 * mf + this.lasty * pf;
      const bx = x1 * mf + x2 * pf;
      const by = y1 * mf + y2 * pf;
      this.buf.push(` C ${ax} ${ay} ${bx} ${by} ${x2} ${y2}`);
      this.lastx = x2;
      this.lasty = y2;
    }
  }

  circle(x: number, y: number, d: number, tag?: string | undefined): void {
    const r = d * 0.5;
    this.move(x, y, tag);
    this.startGroup();
    this.buf.push(`    <circle cx="${x}" cy="${y}" r="${r}"/>\n`);
    this.havePath = false;
    this.havePoint = false;
    this.minx = Math.min(this.minx, x - r);
    this.miny = Math.min(this.miny, y - r);
    this.maxx = Math.max(this.maxx, x + r);
    this.maxy = Math.max(this.maxy, y + r);
  }
}
