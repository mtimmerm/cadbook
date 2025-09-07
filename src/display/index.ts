import { Part, Sketch } from '../geom/index.js';
import { OCPromise, ShaperProps } from '../oc/index.js';
import { displayPart, PartExportFormat } from './displayPart.js';
import { Memoizer, OCMemoizer } from './memoizer.js';
import { SvgRecorder, SvgRenderProps } from './svg.js';
import * as tslab from 'tslab';

export { SvgRenderProps } from './svg.js';
export { Memoizer } from './memoizer.js';
export type { PartExportFormat } from './displayPart.js';

export interface CadDisplay {
  /**
   * Display and optionally export a 3D part in the notebook cell output.
   *
   * @param part The part to display
   * @param exportFormats A mapping from export format to download filename for the exports you want.
   */
  part(
    part: Part,
    exportFormats?: Partial<Record<PartExportFormat, string>>
  ): void;
  sketch(sketch: Sketch): void;
}

export async function getDisplay(
  svgProps: SvgRenderProps,
  shaperProps: ShaperProps
): Promise<CadDisplay> {
  const oc = await OCPromise;
  return {
    part: (part: Part, exports) => displayPart(oc, shaperProps, part, exports),
    sketch: (sketch: Sketch) => {
      const recorder = new SvgRecorder(svgProps);
      recorder.draw(sketch);
      const text = recorder.getSvgText();
      tslab.display.html(`<div>${text}</div>`);
    },
  };
}

export async function getMemoizer(shaperProps: ShaperProps): Promise<Memoizer> {
  const oc = await OCPromise;
  return new OCMemoizer(oc, shaperProps);
}
