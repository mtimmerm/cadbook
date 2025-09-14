import { Matrix3D, Part } from '../geom/index.js';
import {
  exportShapesToGLB,
  OCBodyShaper,
  OpenCascadeInstance,
  ShaperProps,
} from '../oc/index.js';
import * as tslab from 'tslab';
import { exportMeshToSTL } from '../oc/stlExport.js';
import { FileServer } from './fileServer.js';

export type PartExportFormat = 'STLA' | 'STLB' | 'GLB';

/**
 * Display and optionally export a 3D part in the notebook cell output.
 * @param oc
 * @param fileServer
 * @param props
 * @param part
 * @param exportFormats
 */
export function displayPart(
  oc: OpenCascadeInstance,
  fileServer: FileServer,
  props: ShaperProps,
  part: Part,
  exportFormats?: Partial<Record<PartExportFormat, string>>
): void {
  const shaper = new OCBodyShaper(oc, props);
  const ids = part(shaper);
  const compoundId = shaper.compound(ids);
  const mesh = shaper.getMesh(compoundId);
  if (!mesh) {
    throw new Error('No mesh generated');
  }

  const glbData = exportShapesToGLB(oc, [mesh]);
  
  const glbUrl = fileServer.storeFile(glbData, 'model/gltf-binary');
  
  const contentParts: string[] = [
    `<div>
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"></script>
<model-viewer src="${glbUrl}" auto-rotate camera-controls style="width: 100%; height: 300px;" environment-image="legacy" exposure="0.5"></model-viewer>
</div>`,
  ];
  for (const [format, filename] of Object.entries(exportFormats || {})) {
    let mime = 'application/octet-stream';
    let data: Buffer | undefined;
    let url: string | undefined;
    switch (format) {
      case 'GLB':
        data = glbData;
        mime = 'model/gltf-binary';
        url = glbUrl;
        break;

      case 'STLA':
        data = exportMeshToSTL(oc, mesh, false);
        mime = 'model/stl';
        break;

      case 'STLB':
        data = exportMeshToSTL(oc, mesh, true);
        mime = 'model/stl';
        break;
    }
    if (!data) {
      continue;
    }
    if (!url) {
      url = fileServer.storeFile(data, mime, filename);
    }
    contentParts.push(
      `<div><a href="${url}" download="${filename}" type="${mime}">${filename}</a></div>`
    );
  }
  tslab.display.html(contentParts.join('\n'));
}
