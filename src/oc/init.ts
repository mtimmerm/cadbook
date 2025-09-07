// Import the CadBook library
import ocinit from 'opencascade.js/dist/node.js';
import { OpenCascadeInstance } from 'opencascade.js/dist/opencascade.full.js';

export const OCPromise: Promise<OpenCascadeInstance> =
  ocinit() as Promise<OpenCascadeInstance>;
