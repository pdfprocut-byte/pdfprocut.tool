function concatBytes(parts, size) {
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function fillBytes(length, value = 0x20) {
  const output = new Uint8Array(length);
  output.fill(value);
  return output;
}

function padPdf(bytes, targetBytes) {
  return concatBytes([bytes, fillBytes(targetBytes - bytes.length)], targetBytes);
}

function padJpeg(bytes, targetBytes) {
  let endMarker = -1;
  for (let index = bytes.length - 2; index >= 0; index -= 1) {
    if (bytes[index] === 0xff && bytes[index + 1] === 0xd9) {
      endMarker = index;
      break;
    }
  }
  if (endMarker < 0) return null;

  let remaining = targetBytes - bytes.length;
  const parts = [bytes.slice(0, endMarker)];
  while (remaining >= 4) {
    const segmentSize = Math.min(remaining, 65_537);
    const payloadSize = segmentSize - 4;
    const segment = new Uint8Array(segmentSize);
    segment[0] = 0xff;
    segment[1] = 0xfe;
    segment[2] = ((payloadSize + 2) >> 8) & 255;
    segment[3] = (payloadSize + 2) & 255;
    segment.fill(0x20, 4);
    parts.push(segment);
    remaining -= segmentSize;
  }
  if (remaining) return null;
  parts.push(bytes.slice(endMarker));
  return concatBytes(parts, targetBytes);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function padPng(bytes, targetBytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 20 || signature.some((value, index) => bytes[index] !== value)) return null;

  let endChunk = -1;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
    const next = offset + 12 + length;
    if (next > bytes.length) return null;
    if (bytes[offset + 4] === 73 && bytes[offset + 5] === 69 && bytes[offset + 6] === 78 && bytes[offset + 7] === 68) {
      endChunk = offset;
      break;
    }
    offset = next;
  }
  if (endChunk < 0) return null;

  const paddingSize = targetBytes - bytes.length;
  if (paddingSize < 12) return null;

  const dataSize = paddingSize - 12;
  const chunk = new Uint8Array(paddingSize);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, dataSize, false);
  chunk.set([118, 112, 65, 103], 4); // Private ancillary, safe-to-copy chunk: vpAg.
  if (dataSize) chunk.fill(0x20, 8, 8 + dataSize);
  view.setUint32(paddingSize - 4, crc32(chunk.subarray(4, paddingSize - 4)), false);
  return concatBytes([bytes.slice(0, endChunk), chunk, bytes.slice(endChunk)], targetBytes);
}

function findZipEnd(bytes) {
  const start = Math.max(0, bytes.length - 65_557);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

function padZip(bytes, targetBytes) {
  const end = findZipEnd(bytes);
  if (end < 0) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  const oldArchiveCommentLength = view.getUint16(end + 20, true);
  if (entries === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) return null;
  if (end + 22 + oldArchiveCommentLength !== bytes.length || directoryOffset + directorySize > end) return null;

  let remaining = targetBytes - bytes.length;
  let cursor = directoryOffset;
  let addedDirectoryCommentBytes = 0;
  const directoryParts = [];
  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) return null;
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const commentStart = cursor + 46 + nameLength + extraLength;
    const entryEnd = commentStart + commentLength;
    if (entryEnd > end) return null;

    const added = Math.min(remaining, 0xffff - commentLength);
    const entry = bytes.slice(cursor, entryEnd);
    new DataView(entry.buffer).setUint16(32, commentLength + added, true);
    directoryParts.push(entry);
    if (added) directoryParts.push(fillBytes(added));
    remaining -= added;
    addedDirectoryCommentBytes += added;
    cursor = entryEnd;
  }

  if (cursor > directoryOffset + directorySize) return null;
  if (cursor < directoryOffset + directorySize) directoryParts.push(bytes.slice(cursor, directoryOffset + directorySize));

  const addedArchiveCommentBytes = Math.min(remaining, 0xffff - oldArchiveCommentLength);
  remaining -= addedArchiveCommentBytes;
  if (remaining !== 0) return null;

  const directory = concatBytes(directoryParts, directorySize + addedDirectoryCommentBytes);
  const endRecord = bytes.slice(end, end + 22);
  new DataView(endRecord.buffer).setUint32(12, directorySize + addedDirectoryCommentBytes, true);
  new DataView(endRecord.buffer).setUint16(20, oldArchiveCommentLength + addedArchiveCommentBytes, true);
  const oldArchiveComment = bytes.slice(end + 22);
  const parts = [bytes.slice(0, directoryOffset), directory, endRecord, oldArchiveComment];
  if (addedArchiveCommentBytes) parts.push(fillBytes(addedArchiveCommentBytes));
  return concatBytes(parts, targetBytes);
}

export function padFileToExactSize(input, mimeType, targetBytes) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!Number.isSafeInteger(targetBytes) || targetBytes < bytes.length) {
    return { bytes, exact: bytes.length === targetBytes, padded: false };
  }
  if (bytes.length === targetBytes) return { bytes, exact: true, padded: false };

  let padded = null;
  if (mimeType === 'application/pdf') padded = padPdf(bytes, targetBytes);
  else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') padded = padJpeg(bytes, targetBytes);
  else if (mimeType === 'image/png') padded = padPng(bytes, targetBytes);
  else if (mimeType.startsWith('application/vnd.') || bytes[0] === 0x50 && bytes[1] === 0x4b) padded = padZip(bytes, targetBytes);

  if (!padded || padded.length !== targetBytes) return { bytes, exact: false, padded: false };
  return { bytes: padded, exact: true, padded: true };
}
