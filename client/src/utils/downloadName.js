function cleanPart(value, fallback) {
  return String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/[.\s]+$/g, '')
    .trim()
    .slice(0, 100) || fallback;
}

function baseName(name) {
  const filename = String(name || '').replace(/\\/g, '/').split('/').pop();
  return cleanPart(filename.replace(/\.[^.]*$/, ''), 'file');
}

function buildDownloadName(originalName, extension, suffix) {
  const original = baseName(originalName);
  const safeSuffix = cleanPart(suffix, 'fileprocut');
  const safeExtension = String(extension || '').replace(/^\./, '').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'file';
  return `${original}-${safeSuffix}.${safeExtension}`;
}

export function createDownloadName(file, extension, suffix = 'fileprocut') {
  return buildDownloadName(file?.name, extension, suffix);
}

export function createMergeDownloadName(files, extension = 'pdf', suffix = 'fileprocut') {
  const inputFiles = Array.isArray(files) ? files : [];
  const firstName = baseName(inputFiles[0]?.name);
  const mergedName = inputFiles.length > 1 ? `${firstName}-and-${inputFiles.length - 1}-more` : firstName;
  return buildDownloadName(`${mergedName}.source`, extension, suffix);
}
