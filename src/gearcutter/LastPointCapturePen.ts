import { Pen } from './types.js';

/**
 * A simple pen that captures the last point sent to it
 */
export class LastPointCapturePen implements Pen {
  x: number | undefined;
  y: number | undefined;
  moveTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
  arcTo(x: number, y: number, _turn: number): void {
    this.x = x;
    this.y = y;
  }
  transferMove(target: Pen) {
    if (this.x != undefined && this.y != undefined) {
      target.moveTo(this.x, this.y);
      return true;
    }
    return false;
  }
}
