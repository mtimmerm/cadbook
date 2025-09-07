//import {OC} from './src/oc/index.js';
//const OC = await ocinit();

import {
  OpenCascadeInstance,
  TopoDS_Shape,
} from 'opencascade.js/dist/opencascade.full.js';

export function exportMeshToSTL(
  oc: OpenCascadeInstance,
  meshedShape: TopoDS_Shape,
  binary: boolean
): Buffer {
  oc.StlAPI.Write(meshedShape, './file.stl', !binary);
  const stlFile = oc.FS.readFile('./file.stl', { encoding: 'binary' });
  oc.FS.unlink('./file.stl'); // Clean up the file after reading
  return Buffer.from(stlFile);
}
