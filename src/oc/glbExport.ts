//import {OC} from './src/oc/index.js';
//const OC = await ocinit();

import {
  OpenCascadeInstance,
  Quantity_Color,
  Quantity_TypeOfColor,
  RWMesh,
  RWMesh_CoordinateSystem,
  TDocStd_Document,
  TopoDS_Shape,
  XCAFDoc_ColorType,
} from 'opencascade.js/dist/opencascade.full.js';

const exportDocToGLB = (
  oc: OpenCascadeInstance,
  doc: TDocStd_Document
): Buffer => {
  const cafWriter = new oc.RWGltf_CafWriter(
    new oc.TCollection_AsciiString_2('./file.glb'),
    true
  );
  const coordConverter = cafWriter.ChangeCoordinateSystemConverter();
  coordConverter.SetInputCoordinateSystem_2(
    oc.RWMesh_CoordinateSystem
      .RWMesh_CoordinateSystem_Zup as RWMesh_CoordinateSystem
  );
  cafWriter.Perform_2(
    new oc.Handle_TDocStd_Document_2(doc),
    new oc.TColStd_IndexedDataMapOfStringString_1(),
    new oc.Message_ProgressRange_1()
  );

  // Read the GLB file from the virtual file system
  const glbFile = oc.FS.readFile('./file.glb', { encoding: 'binary' });
  oc.FS.unlink('./file.glb'); // Clean up the file after reading
  return Buffer.from(glbFile);
};

// Takes TopoDS_Shape, add to document, create GLB file from it and returns a ObjectURL
export function exportShapesToGLB(
  oc: OpenCascadeInstance,
  meshedShapes: TopoDS_Shape[]
): Buffer {
  // Create a document add our shapes
  const doc = new oc.TDocStd_Document(new oc.TCollection_ExtendedString_1());
  const shapeTool = oc.XCAFDoc_DocumentTool.ShapeTool(doc.Main()).get();
  const colorTool = oc.XCAFDoc_DocumentTool.ColorTool(doc.Main()).get();
  const RGB: Quantity_TypeOfColor = oc.Quantity_TypeOfColor
    .Quantity_TOC_RGB as Quantity_TypeOfColor;
  const shapeColor = new oc.Quantity_Color_3(0.8, 0.8, 0.8, RGB);
  for (const s of meshedShapes) {
    const label = shapeTool.NewShape();
    shapeTool.SetShape(label, s);
    colorTool.SetColor_2(
      label,
      shapeColor,
      oc.XCAFDoc_ColorType.XCAFDoc_ColorGen as XCAFDoc_ColorType
    );
  }
  // Return our visualized document
  return exportDocToGLB(oc, doc);
}
