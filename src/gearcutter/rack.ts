import { PathFunc } from './types.js';

/**
 * Properties defining a rack the can be used to cut gears
 */
export interface RackProps {
  /** target (max) contact ratio */
  readonly contactRatio: number;
  /** pressure angle in degrees */
  readonly pressureAngle: number;
  /** profile shift upwards, in module% */
  readonly profileShift: number;
  /** 50 => up and down teeth are balanced.  0 => upward teeth are points */
  readonly balancePercent: number;
  /** amount to thicken upward teeth/narrow downward teeth by, in module% */
  readonly balanceAbsPercent: number;
  /** additional amount to extend upward teeth, in module% */
  readonly topClrPercent: number;
  /** additional amount to extend downward teeth, in module% */
  readonly botClrPercent: number;
}
export function makeRack(props: RackProps): PathFunc {
  const {
    contactRatio,
    pressureAngle,
    profileShift,
    balancePercent,
    topClrPercent: topReliefPercent,
    botClrPercent: botReliefPercent,
    balanceAbsPercent,
  } = props;

  const sinPA = Math.sin((pressureAngle * Math.PI) / 180.0);
  const cosPA = Math.cos((pressureAngle * Math.PI) / 180.0);
  const tanPA = sinPA / cosPA;
  const ah = contactRatio * sinPA * cosPA;
  const cy = profileShift / (100 * Math.PI);
  let miny = cy - ah / 2;
  let maxy = cy + ah / 2;
  const bkw = balanceAbsPercent / (200 * Math.PI);
  const freew = 0.5 - ah * tanPA;
  const cx = -0.25 - (freew * (balancePercent - 50)) / 100;
  maxy += topReliefPercent / (100 * Math.PI);
  miny -= botReliefPercent / (100 * Math.PI);
  const topx = (maxy - cy) * tanPA + cx;
  const botx = (miny - cy) * tanPA + cx;
  return (pen, doMove) => {
    if (doMove) {
      pen.moveTo(-1.0 - botx + bkw, miny);
    }
    pen.arcTo(botx - bkw, miny, 0);
    pen.arcTo(topx - bkw, maxy, 0);
    pen.arcTo(-topx + bkw, maxy, 0);
    pen.arcTo(-botx + bkw, miny, 0);
  };
}
