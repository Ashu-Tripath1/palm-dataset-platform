// Type declaration for piexifjs (no @types/piexifjs available)
declare module 'piexifjs' {
  interface ExifDict {
    [ifdName: string]: { [tagCode: number]: unknown };
  }

  export function load(data: string): ExifDict;
  export function dump(exifObj: ExifDict): string;
  export function insert(exif: string, jpeg: string): string;
  export function remove(jpeg: string): string;
  export function transplant(exif: string, image: string): string;

  const piexif: {
    load: typeof load;
    dump: typeof dump;
    insert: typeof insert;
    remove: typeof remove;
    transplant: typeof transplant;
    ImageIFD: Record<string, number>;
    ExifIFD: Record<string, number>;
    GPSIFD: Record<string, number>;
    InteropIFD: Record<string, number>;
    Zeroth: string;
    Exif: string;
    GPS: string;
    Interop: string;
    First: string;
  };

  export default piexif;
}
