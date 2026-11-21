export function decodeTextFile(buffer) {
  const bytes = ArrayBuffer.isView(buffer) ? buffer : new Uint8Array(buffer);
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
    : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be'
      : 'utf-8';
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Save the text file as UTF-8 or UTF-16 with a byte order mark, then try again.');
  }
}

const rightToLeftLetter = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}\p{Script=Samaritan}\p{Script=Mandaic}]/u;

export function textDirection(text) {
  const letter = text.match(/\p{Letter}/u)?.[0];
  return letter && rightToLeftLetter.test(letter) ? 'rtl' : 'ltr';
}
