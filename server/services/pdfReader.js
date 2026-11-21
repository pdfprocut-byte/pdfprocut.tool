import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const pdfjsDirectory = dirname(require.resolve('pdfjs-dist/package.json'));

export function readPdf(buffer) {
  return getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    cMapUrl: join(pdfjsDirectory, 'cmaps') + sep,
    standardFontDataUrl: join(pdfjsDirectory, 'standard_fonts') + sep
  }).promise;
}
