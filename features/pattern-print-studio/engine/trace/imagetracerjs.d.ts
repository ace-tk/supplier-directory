// Minimal types for the parts of imagetracerjs (Unlicense / public domain)
// that the studio uses. The package ships no type declarations.
declare module "imagetracerjs" {
  export interface TracerColor {
    r: number;
    g: number;
    b: number;
    a: number;
  }
  export interface TracerImage {
    width: number;
    height: number;
    data: Uint8ClampedArray | number[];
  }
  export interface TracerSegment {
    type: "L" | "Q";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x3?: number;
    y3?: number;
  }
  export interface TracerPath {
    segments: TracerSegment[];
    holechildren: number[];
    isholepath: boolean;
  }
  export interface TracerOptions {
    ltres: number;
    qtres: number;
    pathomit: number;
    rightangleenhance: boolean;
    colorsampling: number;
    numberofcolors: number;
    mincolorratio: number;
    colorquantcycles: number;
    blurradius: number;
    blurdelta: number;
    linefilter: boolean;
    pal?: TracerColor[];
  }
  export interface IndexedImage {
    array: number[][];
    palette: TracerColor[];
  }
  export interface ImageTracer {
    checkoptions(options: Partial<TracerOptions>): TracerOptions;
    colorquantization(image: TracerImage, options: TracerOptions): IndexedImage;
    layeringstep(indexed: IndexedImage, colorIndex: number): number[][];
    pathscan(layer: number[][], pathomit: number): unknown;
    internodes(paths: unknown, options: TracerOptions): unknown;
    batchtracepaths(internodePaths: unknown, ltres: number, qtres: number): TracerPath[];
    blur(image: TracerImage, radius: number, delta: number): TracerImage;
  }
  const tracer: ImageTracer;
  export default tracer;
}
