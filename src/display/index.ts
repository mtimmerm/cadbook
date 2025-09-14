import { Part, Sketch } from '../geom/index.js';
import { OCPromise, ShaperProps } from '../oc/index.js';
import { displayPart, PartExportFormat } from './displayPart.js';
import { Memoizer, OCMemoizer } from './memoizer.js';
import { SvgRecorder, SvgRenderProps } from './svg.js';
import { getFileServer } from './fileServer.js';
import * as tslab from 'tslab';

export { SvgRenderProps } from './svg.js';
export { Memoizer } from './memoizer.js';
export type { PartExportFormat } from './displayPart.js';
export { FileServer, getFileServer, resetFileServer } from './fileServer.js';

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
  const fileServer = await getFileServer();
  return {
    part: (part: Part, exports) => displayPart(oc, fileServer, shaperProps, part, exports),
    sketch: (sketch: Sketch) => {
      const recorder = new SvgRecorder(svgProps);
      recorder.draw(sketch);
      const svgText = recorder.getSvgText();
      const svgBuffer = Buffer.from(svgText, 'utf8');
      const svgUrl = fileServer.storeFile(svgBuffer, 'image/svg+xml');
      tslab.display.html(`<div><img src="${svgUrl}" style="max-width: 100%; height: auto; max-height: 300px" /></div>`);
    },
  };
}

export async function getMemoizer(shaperProps: ShaperProps): Promise<Memoizer> {
  const oc = await OCPromise;
  return new OCMemoizer(oc, shaperProps);
}
