import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import ProtectedDownload from '../components/auth/ProtectedDownload.jsx';
import { governmentImagePresets, governmentPresetByTool, governmentToolGuidanceByTool, socialPostPresets, socialProfilePresets, socialStoryPresets } from '../../../shared/imagePresets.mjs';
import '../styles/governmentImageTools.css';

const maxPixels = 30_000_000;
const maxPixelEditingPixels = 12_000_000;
const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

function getLocalDateValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatPhotoDate(dateValue) {
  const match = dateValue?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

async function addPhotoNameDateFooter(blob, name, dateValue, targetBytes = null) {
  const bitmap = await createImageBitmap(blob);
  const footerHeight = Math.max(20, Math.round(bitmap.height * 0.12));
  const outputHeight = bitmap.height;
  if (bitmap.width * outputHeight > maxPixels) {
    bitmap.close();
    throw new Error('Adding the name and date would exceed the 30-megapixel output limit. Reduce the photo dimensions first.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = outputHeight;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare the name and date footer.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const imageAreaHeight = Math.max(1, outputHeight - footerHeight);
    const imageScale = Math.min(canvas.width / bitmap.width, imageAreaHeight / bitmap.height);
    const imageWidth = bitmap.width * imageScale;
    const imageHeight = bitmap.height * imageScale;
    context.drawImage(bitmap, (canvas.width - imageWidth) / 2, (imageAreaHeight - imageHeight) / 2, imageWidth, imageHeight);
    context.fillStyle = '#111';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const fontSize = Math.max(6, Math.min(footerHeight * 0.34, bitmap.width * 0.07));
    context.font = `700 ${fontSize}px Arial, sans-serif`;
    context.fillText(name.trim().toLocaleUpperCase(), bitmap.width / 2, imageAreaHeight + footerHeight * 0.31, Math.max(1, bitmap.width - 6));
    context.font = `700 ${Math.max(7, fontSize * 0.9)}px Arial, sans-serif`;
    context.fillText(formatPhotoDate(dateValue), bitmap.width / 2, imageAreaHeight + footerHeight * 0.75, Math.max(1, bitmap.width - 6));
    const type = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const qualities = targetBytes && type === 'image/jpeg' ? [0.94, 0.84, 0.74, 0.64, 0.54, 0.44, 0.34] : [0.92];
    let outputBlob = null;
    let targetMet = !targetBytes;
    for (const quality of qualities) {
      const candidate = await canvasBlob(canvas, type, quality);
      if (!outputBlob || candidate.size < outputBlob.size) outputBlob = candidate;
      if (!targetBytes || candidate.size <= targetBytes) {
        outputBlob = candidate;
        targetMet = true;
        break;
      }
    }
    return { blob: outputBlob, width: bitmap.width, height: outputHeight, targetMet };
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Your browser could not create this image.')), type, quality);
  });
}

async function findContentBounds(imageData, width, height, threshold = 245) {
  const { data } = imageData;
  let left = width; let top = height; let right = -1; let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3];
      const white = data[offset] >= threshold && data[offset + 1] >= threshold && data[offset + 2] >= threshold;
      if (alpha > 20 && !white) {
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    if (y > 0 && y % 64 === 0) await yieldToBrowser();
  }
  if (right < left || bottom < top) return { x: 0, y: 0, width, height };
  const pad = Math.max(2, Math.round(Math.max(right - left + 1, bottom - top + 1) * 0.025));
  left = Math.max(0, left - pad); top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad); bottom = Math.min(height - 1, bottom + pad);
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

function sampleCornerBackground(data, width, height) {
  const patchSize = Math.min(8, width, height);
  const corners = [[0, 0], [width - patchSize, 0], [0, height - patchSize], [width - patchSize, height - patchSize]];
  const colors = corners.map(([startX, startY]) => {
    let red = 0; let green = 0; let blue = 0; let count = 0;
    for (let y = startY; y < startY + patchSize; y += 1) {
      for (let x = startX; x < startX + patchSize; x += 1) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] < 32) continue;
        red += data[offset]; green += data[offset + 1]; blue += data[offset + 2]; count += 1;
      }
    }
    return count ? [red / count, green / count, blue / count] : [255, 255, 255];
  });
  return colors.reduce((best, candidate) => {
    const distance = colors.reduce((sum, color) => sum + Math.hypot(color[0] - candidate[0], color[1] - candidate[1], color[2] - candidate[2]), 0);
    return distance < best.distance ? { color: candidate, distance } : best;
  }, { color: colors[0], distance: Infinity }).color;
}

async function replaceSampledBackground(context, width, height, tolerance) {
  const image = context.getImageData(0, 0, width, height);
  const background = sampleCornerBackground(image.data, width, height);
  const cutoff = Number(tolerance);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const red = image.data[offset]; const green = image.data[offset + 1]; const blue = image.data[offset + 2];
      const distance = Math.hypot(red - background[0], green - background[1], blue - background[2]);
      if (distance >= cutoff) continue;
      const amount = Math.max(0, Math.min(1, distance / cutoff));
      image.data[offset] = Math.round(255 * (1 - amount) + red * amount);
      image.data[offset + 1] = Math.round(255 * (1 - amount) + green * amount);
      image.data[offset + 2] = Math.round(255 * (1 - amount) + blue * amount);
    }
    if (y > 0 && y % 64 === 0) await yieldToBrowser();
  }
  context.putImageData(image, 0, 0);
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

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function addPngDpi(blob, dpi) {
  const source = new Uint8Array(await blob.arrayBuffer());
  if (source.length < 33 || source[0] !== 137 || source[1] !== 80 || source[2] !== 78 || source[3] !== 71) return blob;
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4);
  const pixelsPerMeter = Math.max(1, Math.round(Number(dpi) / 0.0254));
  view.setUint32(8, pixelsPerMeter); view.setUint32(12, pixelsPerMeter); chunk[16] = 1;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  const output = new Uint8Array(source.length + chunk.length);
  output.set(source.subarray(0, 33), 0); output.set(chunk, 33); output.set(source.subarray(33), 54);
  return new Blob([output], { type: 'image/png' });
}

async function prepareImage(file, options) {
  const bitmap = await createImageBitmap(file);
  let baseCanvas;
  try {
    const needsPixelProcessing = options.removeBackground || options.replaceBackground || options.trim;
    const pixelCount = bitmap.width * bitmap.height;
    if (pixelCount > maxPixels) throw new Error('This image is larger than 30 megapixels. Resize it before processing.');
    if (needsPixelProcessing && pixelCount > maxPixelEditingPixels) throw new Error('Background editing and signature trimming support images up to 12 megapixels. Resize a copy first, then try again.');
    let baseContext = null;
    if (needsPixelProcessing) {
      baseCanvas = document.createElement('canvas');
      baseCanvas.width = bitmap.width; baseCanvas.height = bitmap.height;
      baseContext = baseCanvas.getContext('2d', { willReadFrequently: true });
      if (!baseContext) throw new Error('Your browser could not open this image.');
      baseContext.drawImage(bitmap, 0, 0);
    }
    const source = baseCanvas || bitmap;

    if (options.removeBackground) {
      const pixels = baseContext.getImageData(0, 0, bitmap.width, bitmap.height);
      const threshold = Number(options.backgroundThreshold);
      for (let y = 0; y < bitmap.height; y += 1) {
        for (let x = 0; x < bitmap.width; x += 1) {
          const offset = (y * bitmap.width + x) * 4;
          const red = pixels.data[offset]; const green = pixels.data[offset + 1]; const blue = pixels.data[offset + 2];
          const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
          const lightness = Math.min(red, green, blue);
          if (lightness >= threshold && spread <= 48) pixels.data[offset + 3] = 0;
          else if (lightness >= threshold - 16 && spread <= 36) pixels.data[offset + 3] = Math.round(255 * (threshold - lightness + 16) / 16);
        }
        if (y > 0 && y % 64 === 0) await yieldToBrowser();
      }
      baseContext.putImageData(pixels, 0, 0);
    }
    if (options.replaceBackground) await replaceSampledBackground(baseContext, bitmap.width, bitmap.height, options.backgroundTolerance);

    let crop = { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    if (options.trim) crop = await findContentBounds(baseContext.getImageData(0, 0, bitmap.width, bitmap.height), bitmap.width, bitmap.height);
    const requestedWidth = Number(options.width) || crop.width;
    const requestedHeight = Number(options.height) || crop.height;
    if (!Number.isInteger(requestedWidth) || !Number.isInteger(requestedHeight) || requestedWidth < 1 || requestedHeight < 1 || requestedWidth * requestedHeight > maxPixels) {
      throw new Error('Enter positive image dimensions with no more than 30 megapixels total.');
    }
    if (options.fitMode === 'cover') {
      const targetRatio = requestedWidth / requestedHeight;
      const sourceRatio = crop.width / crop.height;
      if (sourceRatio > targetRatio) {
        const width = crop.height * targetRatio;
        crop = { ...crop, x: crop.x + (crop.width - width) / 2, width };
      } else if (sourceRatio < targetRatio) {
        const height = crop.width / targetRatio;
        crop = { ...crop, y: crop.y + (crop.height - height) / 2, height };
      }
    }

    const format = options.format === 'png' ? 'image/png' : 'image/jpeg';
    const canvas = document.createElement('canvas');
    let best = null;
    let bestWidth = requestedWidth;
    let bestHeight = requestedHeight;
    let targetMet = !options.targetBytes;
    try {
      for (let scaleStep = 0; scaleStep <= (options.targetBytes ? 14 : 0); scaleStep += 1) {
        const scale = 0.88 ** scaleStep;
        const width = Math.max(1, Math.round(requestedWidth * scale));
        const height = Math.max(1, Math.round(requestedHeight * scale));
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Your browser could not prepare the output image.');
        if (options.whiteBackground || format === 'image/jpeg') {
          context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height);
        }
        if (options.fitMode === 'contain') {
          const scale = Math.min(width / crop.width, height / crop.height);
          const drawWidth = crop.width * scale;
          const drawHeight = crop.height * scale;
          context.drawImage(source, crop.x, crop.y, crop.width, crop.height, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
        } else {
          context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
        }
        const qualitySteps = options.targetBytes && format === 'image/jpeg'
          ? scaleStep === 0 ? [0.94, 0.76, 0.56] : [Math.max(0.32, 0.56 - (scaleStep - 1) * 0.035)]
          : [0.92];
        for (const quality of qualitySteps) {
          const candidate = await canvasBlob(canvas, format, quality);
          if (!best || candidate.size < best.size) { best = candidate; bestWidth = width; bestHeight = height; }
          if (!options.targetBytes || candidate.size <= options.targetBytes) {
            best = candidate; bestWidth = width; bestHeight = height; targetMet = true; break;
          }
        }
        if (targetMet) break;
      }
    } finally {
      canvas.width = 0; canvas.height = 0;
    }

    if (options.dpi) best = format === 'image/png' ? await addPngDpi(best, options.dpi) : await addJpegDpi(best, options.dpi);
    return { blob: best, width: bestWidth, height: bestHeight, targetMet, originalWidth: bitmap.width, originalHeight: bitmap.height };
  } finally {
    bitmap.close();
    if (baseCanvas) { baseCanvas.width = 0; baseCanvas.height = 0; }
  }
}

function resolveGovernmentPreset(tool, slot) {
  if (tool.gov?.kind === 'pair') {
    return governmentImagePresets[slot === 'signature' ? 'keralaPscSignature' : 'keralaPscPhoto'];
  }
  const presetId = governmentPresetByTool[tool.slug];
  if (presetId) return governmentImagePresets[presetId];
  if (tool.gov?.subject === 'photo' || tool.gov?.subject === 'ID photo') return governmentImagePresets.genericPhoto;
  if (tool.gov?.subject === 'signature') return governmentImagePresets.genericSignature;
  return null;
}

function initialOutputDimensions(preset, originalWidth, originalHeight) {
  let width = preset?.width;
  let height = preset?.height;
  if (!width || !height) {
    width = originalWidth;
    height = originalHeight;
    if (preset?.minWidth && preset?.minHeight) {
      const minScale = Math.max(preset.minWidth / originalWidth, preset.minHeight / originalHeight);
      const maxScale = Math.min((preset.maxWidth || Infinity) / originalWidth, (preset.maxHeight || Infinity) / originalHeight);
      if (minScale <= maxScale) {
        width = Math.round(originalWidth * minScale);
        height = Math.round(originalHeight * minScale);
      }
    }
  }
  return {
    width: String(width),
    height: String(height),
    aspectRatio: width / height,
    originalWidth,
    originalHeight
  };
}

export default function GovernmentImageToolPage({ tool }) {
  const config = tool.gov || {};
  const pair = config.kind === 'pair';
  const socialProfileTool = config.kind === 'social-profile';
  const socialMediaTool = socialProfileTool || config.kind === 'social-post' || config.kind === 'social-story';
  const socialPresets = config.presetGroup === 'post' ? socialPostPresets : config.presetGroup === 'story' ? socialStoryPresets : socialProfilePresets;
  const slots = pair
    ? [{ key: 'photo', label: 'Photo' }, { key: 'signature', label: 'Signature' }]
    : [{ key: 'image', label: socialProfileTool ? 'Profile photo' : config.subject ? `${config.subject[0].toUpperCase()}${config.subject.slice(1)}` : 'Image' }];
  const hasNameDateOption = tool.category === 'Kerala PSC Tools' && (config.subject === 'photo' || config.kind === 'pair');
  const [socialPresetId, setSocialPresetId] = useState(config.defaultPreset || socialPresets[0]?.id || '');
  const selectedSocialPreset = socialPresets.find((preset) => preset.id === socialPresetId) || socialPresets[0];
  const presetForSlot = (slot) => socialMediaTool ? selectedSocialPreset : resolveGovernmentPreset(tool, slot);
  const initialPreset = presetForSlot(slots[0].key);
  const [files, setFiles] = useState({});
  const [previews, setPreviews] = useState({});
  const [dimensions, setDimensions] = useState({});
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [targetKb, setTargetKb] = useState(String(initialPreset?.defaultTargetKb ?? initialPreset?.maxKb ?? ''));
  const [dpi, setDpi] = useState(String(initialPreset?.dpi || '300'));
  const [whiteBackground, setWhiteBackground] = useState(initialPreset?.whiteBackground ?? config.kind === 'white-background');
  const [fitMode, setFitMode] = useState(initialPreset?.fitMode || (socialMediaTool ? 'cover' : 'contain'));
  const [trim, setTrim] = useState(Boolean(config.crop));
  const [backgroundThreshold, setBackgroundThreshold] = useState('238');
  const [backgroundTolerance, setBackgroundTolerance] = useState('48');
  const [format, setFormat] = useState(initialPreset?.format || (config.kind === 'remove-background' ? 'png' : 'jpeg'));
  const [addNameDate, setAddNameDate] = useState(hasNameDateOption);
  const [photoName, setPhotoName] = useState('');
  const [photoDate, setPhotoDate] = useState(getLocalDateValue);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const objectUrls = useRef(new Set());
  const removeBackground = config.kind === 'remove-background';
  const replaceBackground = config.kind === 'white-background';
  const compression = config.kind === 'compress';
  const dpiMode = config.kind === 'dpi';
  const hasCamera = config.kind === 'live-photo';
  const currentPreset = presetForSlot(slots[0].key);
  const currentGuidance = governmentToolGuidanceByTool[tool.slug];
  const officialSources = socialMediaTool
    ? selectedSocialPreset.sourceUrl ? [{ label: selectedSocialPreset.sourceLabel || `${selectedSocialPreset.label} image guidance`, url: selectedSocialPreset.sourceUrl }] : []
    : currentPreset?.sources || (currentPreset?.sourceUrl ? [{ label: currentPreset.sourceLabel || 'Official size guidance', url: currentPreset.sourceUrl }] : currentGuidance?.sources || []);
  const showSizeTarget = compression || Boolean(currentPreset?.maxKb);

  const makeObjectUrl = (blob) => {
    const url = URL.createObjectURL(blob);
    objectUrls.current.add(url);
    return url;
  };
  const clearResults = () => {
    results.forEach((result) => {
      URL.revokeObjectURL(result.url);
      objectUrls.current.delete(result.url);
    });
    setResults([]);
  };
  const selectFile = (slot, file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) return toast.error('Choose a JPG or PNG image.');
    clearResults();
    setFiles((current) => ({ ...current, [slot]: file }));
    const previewUrl = makeObjectUrl(file);
    setPreviews((current) => {
      if (current[slot]) {
        URL.revokeObjectURL(current[slot]);
        objectUrls.current.delete(current[slot]);
      }
      return { ...current, [slot]: previewUrl };
    });
    if (dpiMode) setFormat(file.type === 'image/png' ? 'png' : 'jpeg');
    createImageBitmap(file).then((bitmap) => {
      const preset = presetForSlot(slot);
      const outputDimensions = initialOutputDimensions(preset, bitmap.width, bitmap.height);
      setDimensions((current) => ({ ...current, [slot]: outputDimensions }));
      bitmap.close();
    }).catch(() => toast.error('This image could not be opened.'));
  };
  const updateDimension = (slot, axis, value) => {
    setDimensions((current) => {
      const prior = current[slot] || { width: '', height: '' };
      const next = { ...prior, [axis]: value };
      if (!value) return { ...current, [slot]: next };
      if (!maintainAspect) {
        const width = Number(next.width); const height = Number(next.height);
        if (Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0) next.aspectRatio = width / height;
        return { ...current, [slot]: next };
      }
      if (!prior.aspectRatio) return { ...current, [slot]: next };
      const numeric = Number(value);
      if (!Number.isInteger(numeric) || numeric < 1) return { ...current, [slot]: next };
      if (axis === 'width') next.height = String(Math.max(1, Math.round(numeric / prior.aspectRatio)));
      else next.width = String(Math.max(1, Math.round(numeric * prior.aspectRatio)));
      return { ...current, [slot]: next };
    });
  };

  const changeSocialPreset = (presetId) => {
    const preset = socialPresets.find((item) => item.id === presetId);
    if (!preset) return;
    clearResults();
    setSocialPresetId(presetId);
    setTargetKb(String(preset.defaultTargetKb ?? preset.maxKb ?? ''));
    setFormat(preset.format || 'jpeg');
    setFitMode(preset.fitMode || 'cover');
    setDimensions((current) => {
      const image = current.image;
      if (!image?.originalWidth || !image?.originalHeight) return current;
      return { ...current, image: { ...image, width: String(preset.width), height: String(preset.height), aspectRatio: preset.width / preset.height } };
    });
  };

  useEffect(() => {
    if (!cameraStream) return undefined;
    const video = videoRef.current;
    if (video) video.srcObject = cameraStream;
    return () => {
      cameraStream.getTracks().forEach((track) => track.stop());
      if (video?.srcObject === cameraStream) video.srcObject = null;
    };
  }, [cameraStream]);
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const startCamera = async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not available in this browser or page context.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      setCameraStream(stream);
    } catch (error) {
      setCameraError(error.message || 'Could not access the camera.');
    }
  };
  const stopCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
  };
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) return toast.error('Wait until the camera preview is ready.');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvasBlob(canvas, 'image/jpeg', 0.95).then((blob) => {
      selectFile(slots[0].key, new File([blob], 'live-photo.jpg', { type: 'image/jpeg' }));
      stopCamera();
      canvas.width = 0; canvas.height = 0;
    }).catch((error) => toast.error(error.message));
  };

  const process = async () => {
    if (slots.some(({ key }) => !files[key])) return toast.error(pair ? 'Choose both a photo and a signature.' : 'Choose a JPG or PNG image first.');
    if (hasNameDateOption && addNameDate && (!photoName.trim() || !photoDate)) return toast.error('Enter both the name and date to add them below the photo.');
    const requestedKb = Number(targetKb);
    const activePreset = presetForSlot(slots[0].key);
    const hasSizeTarget = compression || Boolean(activePreset?.maxKb);
    const maxTargetKb = activePreset?.maxKb || 15360;
    if (hasSizeTarget && targetKb && (!Number.isFinite(requestedKb) || requestedKb < (activePreset?.minKb || 1) || requestedKb > maxTargetKb)) {
      return toast.error(`Enter a file-size target between ${activePreset?.minKb || 1} KB and ${maxTargetKb} KB.`);
    }
    if (hasSizeTarget && !targetKb) return toast.error('Enter a file-size target from the current application requirements.');
    if (dpiMode && (!Number.isInteger(Number(dpi)) || Number(dpi) < 1 || Number(dpi) > 12000)) return toast.error('Enter a DPI value between 1 and 12,000.');
    clearResults();
    setBusy(true);
    try {
      const nextResults = [];
      for (const slot of slots) {
        const selectedDimensions = dimensions[slot.key] || {};
        const slotPreset = presetForSlot(slot.key);
        const outputWidth = Number(selectedDimensions.width);
        const outputHeight = Number(selectedDimensions.height);
        if (slotPreset?.minWidth && (outputWidth < slotPreset.minWidth || outputHeight < slotPreset.minHeight)) {
          throw new Error(`This preset needs at least ${slotPreset.minWidth} × ${slotPreset.minHeight} px. Check the current notice before using smaller custom dimensions.`);
        }
        if (slotPreset?.maxWidth && (outputWidth > slotPreset.maxWidth || outputHeight > slotPreset.maxHeight)) {
          throw new Error(`This preset allows at most ${slotPreset.maxWidth} × ${slotPreset.maxHeight} px. Check the current notice before using larger custom dimensions.`);
        }
        let output = await prepareImage(files[slot.key], {
          width: selectedDimensions.width,
          height: selectedDimensions.height,
          fitMode,
          whiteBackground,
          trim: trim && (pair ? slot.key === 'signature' : true),
          removeBackground,
          replaceBackground,
          backgroundThreshold,
          backgroundTolerance,
          format: removeBackground ? 'png' : format,
          dpi: slotPreset?.dpi || (dpiMode ? Number(dpi) : null),
          targetBytes: hasSizeTarget && targetKb ? Math.round(requestedKb * 1024) : null
        });
        if (hasNameDateOption && addNameDate && (!pair || slot.key === 'photo')) {
          const labeledOutput = await addPhotoNameDateFooter(output.blob, photoName, photoDate, showSizeTarget && targetKb ? Math.round(requestedKb * 1024) : null);
          output = { ...output, ...labeledOutput };
        }
        const extension = output.blob.type === 'image/png' ? 'png' : 'jpg';
        const baseName = files[slot.key].name.replace(/\.[^.]+$/, '') || 'image';
        nextResults.push({
          name: `${baseName}-${tool.slug}.${extension}`,
          url: makeObjectUrl(output.blob),
          slotLabel: slot.label,
          blob: output.blob,
          width: output.width,
          height: output.height,
          originalSize: files[slot.key].size,
          targetMet: output.targetMet,
          minimumSizeMet: !slotPreset?.minKb || output.blob.size >= slotPreset.minKb * 1024
        });
      }
      setResults(nextResults);
      const socialResultLabel = socialProfileTool ? 'profile photo' : 'image';
      toast.success(pair ? 'Photo and signature are ready.' : socialMediaTool ? `${selectedSocialPreset.label} ${socialResultLabel} is ready.` : 'Your image is ready to download.');
    } catch (error) {
      toast.error(error.message || 'Could not prepare this image.');
    } finally {
      setBusy(false);
    }
  };

  return <main className="container py-5 tool-page government-image-tool">
    <Link to="/tools" className="back">← All tools</Link>
    <h1>{tool.name}</h1>
    <p className="lead">{tool.description}</p>
    <div className="government-tool-local-note" role="note">
      <p>{socialMediaTool
        ? `${selectedSocialPreset.guidance}${socialProfileTool ? ' Profile photos are commonly shown as circles; check the preview after cropping.' : ''}`
        : currentPreset?.note || currentGuidance?.note || 'Image processing happens in this browser. Use the dimensions and file-size limits in the current application notice; there is no single standard for every service.'}</p>
      {officialSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}
      <p className="government-tool-privacy-note">Your image stays in this browser. Preset sizes, dimensions, frame handling, and output format can be changed before download.</p>
    </div>
    {(removeBackground || replaceBackground || config.crop) && <p className="small text-secondary">Background editing and automatic signature trimming support source images up to 12 megapixels. Resize a copy first if your image is larger.</p>}

    {socialMediaTool && <section className="government-tool-settings social-profile-settings" aria-labelledby="social-media-preset-title">
      <h2 id="social-media-preset-title">{socialProfileTool ? 'Profile photo size' : 'Default image size'}</h2>
      <label className="government-inline-field">{socialProfileTool ? 'Social platform' : 'Image preset'}<select className="form-select" value={socialPresetId} onChange={(event) => changeSocialPreset(event.target.value)}>
        {socialPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label} — {preset.width} × {preset.height} px</option>)}
      </select></label>
      <p className="small text-secondary mb-0">{selectedSocialPreset.shape} · {selectedSocialPreset.width} × {selectedSocialPreset.height} px · {selectedSocialPreset.aspectLabel || '1:1 aspect ratio'}</p>
    </section>}

    <div className="government-tool-inputs">
      {slots.map((slot) => {
        const size = dimensions[slot.key];
        return <section className="government-tool-slot" key={slot.key} aria-labelledby={`${slot.key}-title`}>
          <h2 id={`${slot.key}-title`}>{slot.label}</h2>
          <label className="government-file-label">Select {slot.label.toLowerCase()} (JPG or PNG)
            <input type="file" accept="image/jpeg,image/png" onChange={(event) => selectFile(slot.key, event.target.files?.[0])}/>
          </label>
          {previews[slot.key] && <figure className={`government-image-preview${socialProfileTool ? ' social-profile-preview-frame' : ''}`}>
            {hasNameDateOption && addNameDate && (!pair || slot.key === 'photo') ? <div className="government-photo-name-date-preview">
              <img src={previews[slot.key]} alt={`Selected ${slot.label.toLowerCase()} preview for ${tool.name}`}/>
              <div className="government-photo-name-date-strip"><strong>{photoName.trim().toLocaleUpperCase() || 'YOUR NAME'}</strong><span>{formatPhotoDate(photoDate) || 'DD/MM/YYYY'}</span></div>
            </div> : <img className={socialProfileTool ? 'social-profile-preview-image' : undefined} src={previews[slot.key]} alt={`Selected ${slot.label.toLowerCase()} preview for ${tool.name}`}/>}
            <figcaption>{files[slot.key]?.name} · {size?.originalWidth} × {size?.originalHeight} px</figcaption>
          </figure>}
          {size && <fieldset className="government-dimensions">
            <legend>Output dimensions</legend>
            <div className="government-dimension-fields">
              <label>Width (px)<input className="form-control" type="number" min="1" max="30000" value={size.width} placeholder={String(size.originalWidth || 'Original')} onChange={(event) => updateDimension(slot.key, 'width', event.target.value)}/></label>
              <label>Height (px)<input className="form-control" type="number" min="1" max="30000" value={size.height} placeholder={String(size.originalHeight || 'Original')} onChange={(event) => updateDimension(slot.key, 'height', event.target.value)}/></label>
            </div>
            <small>{size.width && size.height ? `${size.width} × ${size.height} px is loaded from the selected preset. Edit either value to customize it.` : 'The source dimensions are kept until you enter a custom size.'} Maximum output: 30 megapixels.</small>
          </fieldset>}
        </section>;
      })}
    </div>

    {hasCamera && <section className="government-camera" aria-labelledby="government-camera-title">
      <h2 id="government-camera-title">Live camera</h2>
      {!cameraStream ? <button className="btn btn-outline-primary" type="button" onClick={startCamera}>Open camera</button> : <>
        <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview"/>
        <div className="government-camera-actions"><button className="btn btn-primary" type="button" onClick={capturePhoto}>Capture photo</button><button className="btn btn-outline-secondary" type="button" onClick={stopCamera}>Close camera</button></div>
      </>}
      {cameraError && <p className="text-danger" role="alert">{cameraError}</p>}
      <p className="small text-secondary">Camera access requires your browser's permission and a secure page connection.</p>
    </section>}

    <section className="government-tool-settings" aria-labelledby="government-settings-title">
      <h2 id="government-settings-title">Image settings</h2>
      {!dpiMode && <label className="government-setting-check"><input type="checkbox" checked={maintainAspect} onChange={(event) => setMaintainAspect(event.target.checked)}/> Keep the selected aspect ratio when changing dimensions</label>}
      <label className="government-inline-field">Frame handling<select className="form-select" value={fitMode} onChange={(event) => setFitMode(event.target.value)}><option value="cover">Crop to fill the frame</option><option value="contain">Fit the whole image inside the frame</option></select><small>Crop to fill trims edges to match the selected ratio. Fit keeps the full image and may add white space.</small></label>
      {hasNameDateOption && <>
        <p className="small text-secondary">Kerala PSC OTR requires the applicant name and date of the photo at the bottom. Enter both to continue.</p>
        {addNameDate && <div className="government-name-date-fields">
          <label className="government-inline-field">Name<input className="form-control" type="text" maxLength="40" autoComplete="name" placeholder="Enter the applicant name" value={photoName} onChange={(event) => { clearResults(); setPhotoName(event.target.value); }}/></label>
          <label className="government-inline-field">Date<input className="form-control" type="date" value={photoDate} onChange={(event) => { clearResults(); setPhotoDate(event.target.value); }}/></label>
          <p className="small text-secondary">The name and date are fitted into the bottom band, so the output keeps the preset dimensions. The date is printed as DD/MM/YYYY.</p>
        </div>}
      </>}
      {config.kind !== 'white-background' && !removeBackground && <label className="government-setting-check"><input type="checkbox" checked={whiteBackground} onChange={(event) => setWhiteBackground(event.target.checked)}/> Place transparent areas on a white background</label>}
      {config.kind === 'white-background' && <>
        <p>Similar colors in the image corners are sampled and turned white. This works best with a plain, evenly lit background; inspect hair and clothing edges in the preview.</p>
        <label className="government-inline-field">Background color tolerance: {backgroundTolerance}<input className="form-range" type="range" min="15" max="110" step="1" value={backgroundTolerance} onChange={(event) => setBackgroundTolerance(event.target.value)}/></label>
      </>}
      {(config.crop || pair) && <label className="government-setting-check"><input type="checkbox" checked={trim} onChange={(event) => setTrim(event.target.checked)}/> Trim blank borders around the signature</label>}
      {showSizeTarget && <label className="government-inline-field">Maximum file size (KB)<input className="form-control" type="number" min={currentPreset?.minKb || 1} max={currentPreset?.maxKb || 15360} step="1" placeholder="Enter a maximum file size" value={targetKb} onChange={(event) => setTargetKb(event.target.value)}/><small>{currentPreset?.minKb ? `The source notice also requires at least ${currentPreset.minKb} KB. ` : ''}Compression targets this maximum; check the downloaded size because very small limits may not be achievable.</small></label>}
      {dpiMode && <label className="government-inline-field">Resolution metadata (DPI)<input className="form-control" type="number" min="1" max="12000" step="1" value={dpi} onChange={(event) => setDpi(event.target.value)}/><small>DPI changes print-size metadata; it does not add detail or increase the pixel dimensions.</small></label>}
      {removeBackground && <label className="government-inline-field">White-background removal threshold: {backgroundThreshold}<input className="form-range" type="range" min="205" max="252" step="1" value={backgroundThreshold} onChange={(event) => setBackgroundThreshold(event.target.value)}/><small>Works best with a plain, near-white background. Inspect fine signature strokes before using the PNG.</small></label>}
      {!removeBackground && <label className="government-inline-field">Output format<select className="form-select" value={format} onChange={(event) => setFormat(event.target.value)}><option value="jpeg">JPG</option><option value="png">PNG</option></select>{currentPreset?.format === 'jpeg' && !socialMediaTool && <small>The selected service guidance specifies JPG. Choose PNG only if the application accepts it.</small>}</label>}
    </section>

    <button className="btn btn-primary mt-4" type="button" onClick={process} disabled={busy || slots.some(({ key }) => !files[key])}>{busy ? 'Preparing image…' : pair ? 'Prepare photo and signature' : tool.name}</button>
    {results.length > 0 && <section className="government-results" aria-labelledby="government-results-title" aria-live="polite">
      <h2 id="government-results-title">Preview and download</h2>
      <div className="government-results-grid">{results.map((result) => <article className="government-result-card" key={result.name}>
        <img className={socialProfileTool ? 'social-profile-result-image' : undefined} src={result.url} alt={`Processed ${result.name} preview`}/>
        <p>{result.width} × {result.height} px · {(result.blob.size / 1024).toFixed(1)} KB</p>
        {showSizeTarget && <p className={result.targetMet && result.minimumSizeMet ? 'text-success' : 'text-warning'}>{!result.targetMet ? 'Maximum size target not reached; best available result shown.' : !result.minimumSizeMet ? `Below the ${currentPreset?.minKb} KB minimum; check the source notice.` : 'File-size target reached.'}</p>}
        <ProtectedDownload className="btn btn-primary" href={result.url} download={result.name}>Download {pair ? result.slotLabel.toLowerCase() : 'image'}</ProtectedDownload>
      </article>)}</div>
    </section>}
    <p className="government-tool-reminder">Before submitting, compare the downloaded image's dimensions, format, file size, background, and any other rules against the official application instructions.</p>
  </main>;
}
