function asciiBytes(value) {
  return new TextEncoder().encode(value);
}

function joinBytes(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Your browser could not create this image.')), type, quality);
  });
}

function addJpegDpi(blob, dpi) {
  return blob.arrayBuffer().then((buffer) => {
    const source = new Uint8Array(buffer);
    if (source[0] !== 0xff || source[1] !== 0xd8) return blob;
    const segment = new Uint8Array(18);
    segment.set([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01]);
    const density = Math.max(1, Math.min(65535, Math.round(dpi)));
    segment[12] = (density >> 8) & 255; segment[13] = density & 255;
    segment[14] = (density >> 8) & 255; segment[15] = density & 255;
    segment[16] = 0; segment[17] = 0;
    const output = new Uint8Array(source.length + segment.length);
    output.set(source.subarray(0, 2), 0); output.set(segment, 2); output.set(source.subarray(2), 20);
    return new Blob([output], { type: 'image/jpeg' });
  });
}

export async function createPassportPrintSheet(photoBlob, photoWidth, photoHeight, copies, printWidthMm = 35, printHeightMm = 45) {
  let jpeg = photoBlob;
  if (photoBlob.type !== 'image/jpeg') {
    const bitmap = await createImageBitmap(photoBlob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare the passport print sheet.');
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0);
      jpeg = await canvasBlob(canvas, 'image/jpeg', 1);
    } finally {
      bitmap.close(); canvas.width = 0; canvas.height = 0;
    }
  }
  jpeg = await addJpegDpi(jpeg, 300);
  const imageBytes = new Uint8Array(await jpeg.arrayBuffer());
  const pageWidth = 595.28; const pageHeight = 841.89;
  const photoWidthPt = (printWidthMm / 25.4) * 72; const photoHeightPt = (printHeightMm / 25.4) * 72;
  const gap = 6; const margin = 20;
  const columns = Math.max(1, Math.floor((pageWidth - margin * 2 + gap) / (photoWidthPt + gap)));
  const maxRows = Math.max(1, Math.floor((pageHeight - margin * 2 + gap) / (photoHeightPt + gap)));
  if (columns * maxRows < copies) throw new Error(`Only ${columns * maxRows} photos at ${printWidthMm} × ${printHeightMm} mm fit on one A4 sheet. Reduce the copy count or print dimensions.`);
  const rows = Math.ceil(copies / columns);
  const gridHeight = rows * photoHeightPt + (rows - 1) * gap;
  const top = (pageHeight - gridHeight) / 2;
  const commands = [];
  for (let index = 0; index < copies; index += 1) {
    const column = index % columns; const row = Math.floor(index / columns);
    const photosInRow = Math.min(columns, copies - row * columns);
    const rowWidth = photosInRow * photoWidthPt + (photosInRow - 1) * gap;
    const x = (pageWidth - rowWidth) / 2 + column * (photoWidthPt + gap);
    const y = pageHeight - top - photoHeightPt - row * (photoHeightPt + gap);
    commands.push(`q ${photoWidthPt.toFixed(3)} 0 0 ${photoHeightPt.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm /Photo Do Q`);
  }
  const contentBytes = asciiBytes(`${commands.join('\n')}\n`);
  const objectBodies = [
    asciiBytes('<< /Type /Catalog /Pages 2 0 R >>'),
    asciiBytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    asciiBytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Photo 4 0 R >> >> /Contents 5 0 R >>'),
    joinBytes([asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${photoWidth} /Height ${photoHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`), imageBytes, asciiBytes('\nendstream')]),
    joinBytes([asciiBytes(`<< /Length ${contentBytes.length} >>\nstream\n`), contentBytes, asciiBytes('endstream')])
  ];
  const chunks = [asciiBytes('%PDF-1.4\n%PDFproCut print sheet\n')];
  const offsets = [0];
  for (let index = 0; index < objectBodies.length; index += 1) {
    offsets.push(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    chunks.push(asciiBytes(`${index + 1} 0 obj\n`), objectBodies[index], asciiBytes('\nendobj\n'));
  }
  const xrefOffset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const xref = ['xref\n0 6\n0000000000 65535 f \n', ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)];
  chunks.push(asciiBytes(`${xref.join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return new Blob([joinBytes(chunks)], { type: 'application/pdf' });
}
