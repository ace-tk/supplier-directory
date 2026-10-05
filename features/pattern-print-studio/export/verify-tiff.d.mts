export interface TiffRational {
  numerator: number;
  denominator: number;
  value: number;
  at: number;
}
export interface TiffTags {
  bigTiff: boolean;
  littleEndian: boolean;
  width: number;
  height: number;
  bitsPerSample: number[];
  compression: number;
  photometric: number;
  samplesPerPixel: number;
  xResolution?: TiffRational;
  yResolution?: TiffRational;
  resolutionUnit: number;
  description?: string;
  icc: Buffer | null;
}
export interface TiffExpectation {
  widthIn: number;
  heightIn: number;
  dpi: number;
  transparent?: boolean;
  mirror?: boolean;
  /** An un-mirrored export of the same thing, to check the mirror option against. */
  reference?: string;
}
export interface TiffCheck {
  name: string;
  ok: boolean;
  detail: string;
}
export function readTiffTags(file: string): Promise<TiffTags>;
export function isSrgbProfile(icc: Buffer | null): boolean;
export function setTiffResolution(file: string, dpi: number): Promise<void>;
export function verifyTiff(file: string, expect: TiffExpectation): Promise<{ ok: boolean; checks: TiffCheck[]; tags: TiffTags }>;
