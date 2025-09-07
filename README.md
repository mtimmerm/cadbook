# CadBook
Sketch-based, Typescript-powered CAD in Jupyter notebooks.

## Apologies

First off, let me apologize:

1. This is a CAD solution for Typescript coders.  There is no support for anyone else.

2. It still sucks.  I made this for me so I could design parts and easily tweak them iteratively.  It doesn't do everything you want.  I will only add features or improvements when I need them.  But... you're a coder, right?  I am happy to consider PRs.

3. There is no support.  I think you for any bug reports, but I'm not gonna be in a hurry to fix them.  There are only two reasons why this project is public OSS:

   1. There doesn't seem to be anything else like this out there right now -- sketch-based CAD via programming, with a *real* BREP CAD engine that you can use to make real parts.  Therefore I though that others might find it useful even with all these limitations.

   2. It would be nice if others would contribute.  I am happy to consider PRs.

4. It's not on NPM.  This project yet is not complete enough to push to NPM.

5. There are not docs yet.  Maybe someday.  See the `nema23.ipynb` example, though.  At this time, it uses every single feature, since I only added the features I needed for that.

Sincerely,

Matt

## How It Works

This is a Typescript library built for use with [tslab](https://github.com/yunabe/tslab).  Install that and make sure it works before you do anything else.

It provides a simple API to create "sketches".  A sketch is a function that takes a "pen" object, and uses it to draw shapes.

It provides a simple API to create "parts".  A part is a function that takes a "shaper" and uses it to create solid objects. You can create objects by extruding or revolving sketches, or by applying joining or intersecting existing object.

It uses the WASM version of OpenCascade to do the heavy 3D lifiting.  OpenCascade provides a boundary representation of objects that supports curved surfaces and can export meshes.

Visualization of parts is accomplished by using Google's [model-viewer](https://modelviewer.dev/) custom element in HTML output, to render GLB content produced by OpenCascade.

