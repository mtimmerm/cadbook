import {
  OpenCascadeInstance,
  TopoDS_Shape,
} from 'opencascade.js/dist/opencascade.full.js';
import { BodyID, Part } from '../geom/types.js';
import { OCBodyShaper, ShaperProps } from '../oc/bodyShaper.js';
import { ID3D } from '../geom/matrix.js';

export interface Memoizer {
  part(key: string, part: Part): Part;
}

export class OCMemoizer implements Memoizer {
  private readonly oc: OpenCascadeInstance;
  private readonly shaperProps: ShaperProps;
  private readonly partCache: Map<string, [Part, Part]>;

  constructor(oc: OpenCascadeInstance, shaperProps: ShaperProps) {
    this.oc = oc;
    this.shaperProps = shaperProps;
    this.partCache = new Map();
  }

  part(key: string, part: Part): Part {
    let entry: [Part, Part] | undefined = this.partCache.get(key);
    if (!entry || entry[0] !== part) {
      const shaper = new OCBodyShaper(this.oc, this.shaperProps);
      const ids = part(shaper);
      const bodies = shaper.detachShapes(ids);
      entry = [part, this.makeCachedPart(part, bodies)];
      this.partCache.set(key, entry);
    }
    return entry[1];
  }

  private makeCachedPart(part: Part, bodies: TopoDS_Shape[]): Part {
    const newPart: Part = (shaper) => {
      let ret: BodyID[] = [];
      for (const body of bodies) {
        const newId = shaper.instance(ID3D, body);
        if (!newId) {
          break;
        }
        ret.push(newId);
      }
      if (ret.length === bodies.length) {
        return ret;
      }
      return part(shaper);
    };
    return newPart;
  }
}
