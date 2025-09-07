import { ToothCutter } from './ToothCutter.js';
import {
  applyInternalToothFillet,
  applyMaxToothFillet,
} from './InitialMaxFilletPen.js';
import { makeRack, RackProps } from './rack.js';
import { PathFunc, Pen } from './types.js';
import { XForm } from './XFormPen.js';
import { RecordingPen } from './RecordingPen.js';
import { LastPointCapturePen } from './LastPointCapturePen.js';
import { DEGREE, Pen2D, Sketch } from '../geom/index.js';

export type GearPairSizeType = 'mod' | 'diaPitch' | 'centerDist';

export interface GearPairProps {
  readonly clearanceModPercent?: number | undefined;
  readonly backlashModPercent?: number | undefined;
  readonly balancePercent?: number | undefined;
  readonly pressureAngle?: number | undefined;
  readonly targetContactRatio?: number | undefined;
  readonly profileShiftPercent?: number | undefined;
  readonly gearTeeth: number;
  readonly pinionTeeth: number;
  readonly isInternalGear?: boolean | undefined;
  readonly isMaxFillet?: boolean | undefined;
  readonly faceToleranceModPercent?: number | undefined;
  readonly filletToleranceModPercent?: number | undefined;
  readonly sizeType: GearPairSizeType;
  readonly size: number;
}

export type { Pen, PathFunc } from './types.js';

export interface GearPairResult {
  gear: Sketch;
  pinion: Sketch;
  gearPitchDiameter: number;
  pinionPitchDiameter: number;
  gearArcsPerTooth: number;
  pinionArcsPerTooth: number;
}

class GearCutterPenAdapter implements Pen {
  private pen2d: Pen2D;
  constructor(pen2d: Pen2D) {
    this.pen2d = pen2d;
  }
  moveTo(x: number, y: number): void {
    this.pen2d.move(x, y);
  }
  arcTo(x: number, y: number, turn: number): void {
    if (turn > -0.0001 && turn < 0.0001) {
      this.pen2d.line(x, y);
    } else {
      this.pen2d.arc(x, y, turn / DEGREE);
    }
  }
}

export const DEFAULT_CLEARANCE_PERCENT = 15;
export const DEFAULT_BACKLASH_PERCENT = 0;
export const DEFAULT_BALANCE_PERCENT = 50;
export const DEFAUT_PRESSURE_ANGLE = 20;
export const DEFAULT_CONTACT_RATIO = 1.5;
export const DEFAULT_PROFILE_SHIFT_PERCENT = 0;
export const DEFAULT_IS_INTERNAL = false;
export const DEFAULT_MAX_FILLET = false;
export const DEFAULT_FACE_TOL = 0.05;
export const DEFAULT_FILLET_TOL = 0.5;
export const DEFAULT_SIZE_MEASUREMENT = 'mod';

export function createGearPair(props: GearPairProps): GearPairResult {
  const clearancePercent =
    props.clearanceModPercent ?? DEFAULT_CLEARANCE_PERCENT;
  const backlashPercent = props.backlashModPercent ?? DEFAULT_BACKLASH_PERCENT;
  const pressureAngle = props.pressureAngle ?? DEFAUT_PRESSURE_ANGLE;
  const contactRatio = props.targetContactRatio ?? DEFAULT_CONTACT_RATIO;
  const profileShift =
    props.profileShiftPercent ?? DEFAULT_PROFILE_SHIFT_PERCENT;
  const gearTeeth = props.gearTeeth;
  const pinionTeeth = props.pinionTeeth;
  const isInternal = props.isInternalGear ?? DEFAULT_IS_INTERNAL;
  const maxFillet = props.isMaxFillet ?? DEFAULT_MAX_FILLET;
  const balancePercent = props.balancePercent ?? DEFAULT_BALANCE_PERCENT;
  const faceTolPercent = props.faceToleranceModPercent ?? DEFAULT_FACE_TOL;
  const filletTolPercent =
    props.filletToleranceModPercent ?? DEFAULT_FILLET_TOL;
  const sizeNumber = props.size;
  const sizeMeasurement = props.sizeType;

  if (gearTeeth < 4) {
    throw new Error("Can't have less than 4 gear teeth");
  }

  if (isInternal && gearTeeth <= pinionTeeth) {
    throw new Error('Pinion must have fewer teeth than internal gear');
  }

  const gearRadius = (gearTeeth * 0.5) / Math.PI;
  const pinionRadius = (pinionTeeth * 0.5) / Math.PI;

  let szLen: number;
  if (sizeMeasurement === 'diaPitch') {
    szLen = 1.0;
  } else if (sizeMeasurement === 'centerDist') {
    szLen = gearRadius + (isInternal ? -pinionRadius : pinionRadius);
  } else {
    szLen = 1.0 / Math.PI;
  }
  if (!isFinite(sizeNumber) || sizeNumber <= 0) {
    throw new Error(`Invalid size number ${sizeNumber}`);
  }
  const scale = sizeNumber / szLen;

  const rackProps: RackProps = {
    contactRatio,
    pressureAngle,
    profileShift,
    balancePercent,
    balanceAbsPercent: 0.0,
    topClrPercent: 0,
    botClrPercent: 0,
  };

  const pinionRack = makeRack({
    ...rackProps,
    botClrPercent: clearancePercent,
    balanceAbsPercent: backlashPercent * -0.5,
  });
  const gearRack = makeRack({
    ...rackProps,
    balancePercent: isInternal
      ? rackProps.balancePercent
      : 100 - rackProps.balancePercent,
    profileShift: isInternal ? profileShift : -profileShift,
    botClrPercent: isInternal ? 0 : clearancePercent,
    topClrPercent: isInternal ? clearancePercent : 0,
    balanceAbsPercent: backlashPercent * (isInternal ? 0.5 : -0.5),
  });

  const faceT = faceTolPercent / (100 * Math.PI);
  const filletT = filletTolPercent / (100 * Math.PI);

  const pinionCutter = new ToothCutter(
    pinionTeeth,
    pinionRadius,
    faceT,
    filletT
  );
  new XForm()
    .rotate(-90)
    .translate(0, pinionRadius)
    .processPath(pinionCutter, pinionRack, true);
  const pinionRecorder = new RecordingPen();
  pinionCutter.drawToothPath(pinionRecorder, true);
  // In recorded tooth path:
  // - the gear center is (0,0),
  // - the tooth is to the right, centered on the + x axis
  // - it is drawn from the -y to +y direction
  let pinionPath = pinionRecorder.path;
  if (maxFillet) {
    pinionPath = applyMaxToothFillet(pinionPath);
    pinionRecorder.reset();
    pinionPath(pinionRecorder, true);
  }
  const pinionArcsPerTooth = pinionRecorder.countSegments();

  const gearCutter = new ToothCutter(gearTeeth, gearRadius, faceT, filletT);
  new XForm()
    .rotate(-90)
    .translate(0, gearRadius)
    .processPath(gearCutter, gearRack, true);
  const gearRecorder = new RecordingPen();
  gearCutter.drawToothPath(gearRecorder, true);
  let gearPath = gearRecorder.path;
  if (maxFillet) {
    gearPath = isInternal
      ? applyInternalToothFillet(gearPath)
      : applyMaxToothFillet(gearPath);
    gearRecorder.reset();
    gearPath(gearRecorder, true);
  }
  const gearArcsPerTooth = gearRecorder.countSegments();
  return {
    gear: (pen) =>
      drawGearFromTooth(
        new GearCutterPenAdapter(pen),
        true,
        scale,
        gearPath,
        gearTeeth
      ),
    gearPitchDiameter: gearRadius * 2.0 * scale,
    pinion: (pen) =>
      drawGearFromTooth(
        new GearCutterPenAdapter(pen),
        true,
        scale,
        pinionPath,
        pinionTeeth
      ),
    pinionPitchDiameter: pinionRadius * 2.0 * scale,
    gearArcsPerTooth,
    pinionArcsPerTooth,
  };
}

function drawGearFromTooth(
  pen: Pen,
  doMove: boolean,
  scale: number,
  path: PathFunc,
  nTeeth: number
) {
  if (doMove) {
    const capture = new LastPointCapturePen();
    new XForm()
      .rotate(((nTeeth - 1) * 360) / nTeeth)
      .scale(scale)
      .processPath(capture, path, true);
    capture.transferMove(pen);
  }
  for (let i = 0; i < nTeeth; ++i) {
    new XForm()
      .rotate((i * 360) / nTeeth)
      .scale(scale)
      .processPath(pen, path, false);
  }
}
