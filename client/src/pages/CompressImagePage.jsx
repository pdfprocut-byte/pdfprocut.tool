import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import FileUploader from '../components/pdf/FileUploader.jsx';
import { DownloadResultModal, OperationProgressModal } from '../components/pdf/FileOperationModals.jsx';
import { createDownloadName } from '../utils/downloadName.js';
import UploadedFileList from '../components/pdf/UploadedFileList.jsx';
import { useBrowserDraft } from '../lib/browserDraft.js';
import '../styles/imageCompression.css';

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const targetOptions = [
  ['0.09765625', '100 KB'], ['0.25', '250 KB'], ['0.5', '500 KB'], ['1', '1 MB'],
  ['2', '2 MB'], ['5', '5 MB'], ['10', '10 MB'], ['20', '20 MB'], ['custom', 'Custom size']
];
const unitToMb = { KB: 1 / 1024, MB: 1 };
const formatSize = (bytes) => bytes >= 1024 ** 3
  ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
  : bytes >= 1024 ** 2
    ? `${(bytes / 1024 ** 2).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(0)} KB`;

async function normalizeImageForServer(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this image.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Your browser could not prepare this image.')), 'image/jpeg', 0.98);
    });
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function submitImage(file, targetSizeMb, quality, dimensions) {
  const body = new FormData();
  body.append('files', file);
  body.append('targetSizeMb', String(targetSizeMb));
  body.append('quality', quality);
  body.append('width', String(dimensions.width));
  body.append('height', String(dimensions.height));
  const response = await fetch(`${apiBase}/image/compress`, { method: 'POST', body, credentials: 'include' });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const failure = new Error(error.error || 'Could not compress this image');
    failure.status = response.status;
    throw failure;
  }
  return response;
}

export default function CompressImagePage({ tool }) {
  const [file, setFile] = useState(null);
  const [targetChoice, setTargetChoice] = useState('0.09765625');
  const [customTarget, setCustomTarget] = useState('1.5');
  const [targetUnit, setTargetUnit] = useState('MB');
  const [quality, setQuality] = useState('clear');
  const [dimensions, setDimensions] = useState({ width: '', height: '' });
  const [originalDimensions, setOriginalDimensions] = useState(null);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const draft = { state: { targetChoice, customTarget, targetUnit, quality, dimensions, maintainAspectRatio }, files: file ? [file] : [], signature: null };
  const { ready: draftReady, status: draftStatus } = useBrowserDraft(`tool:${tool.slug}`, draft, (saved) => {
    setFile(saved.files[0] || null);
    if (saved.state?.targetChoice) setTargetChoice(saved.state.targetChoice);
    if (saved.state?.customTarget) setCustomTarget(saved.state.customTarget);
    if (saved.state?.targetUnit === 'GB') {
      const savedTargetMb = Number(saved.state?.customTarget) * 1024;
      if (Number.isFinite(savedTargetMb) && savedTargetMb > 0) {
        setCustomTarget(String(Math.min(25, Math.max(1 / 1024, savedTargetMb))));
      }
      setTargetUnit('MB');
    } else if (saved.state?.targetUnit === 'KB' || saved.state?.targetUnit === 'MB') {
      setTargetUnit(saved.state.targetUnit);
    }
    if (saved.state?.quality) setQuality(saved.state.quality);
    if (saved.state?.dimensions) setDimensions(saved.state.dimensions);
    if (saved.state?.maintainAspectRatio !== undefined) setMaintainAspectRatio(saved.state.maintainAspectRatio);
  });

  useEffect(() => {
    if (!file) {
      setOriginalDimensions(null);
      return undefined;
    }
    let active = true;
    createImageBitmap(file).then((bitmap) => {
      const measured = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (!active) return;
      setOriginalDimensions(measured);
      setDimensions((current) => current.width && current.height ? current : { width: String(measured.width), height: String(measured.height) });
    }).catch(() => { if (active) setOriginalDimensions(null); });
    return () => { active = false; };
  }, [file]);

  useEffect(() => () => {
    if (result?.url) URL.revokeObjectURL(result.url);
  }, [result]);

  const targetSizeMb = targetChoice === 'custom' ? Number(customTarget) * unitToMb[targetUnit] : Number(targetChoice);
  const customTargetMin = targetUnit === 'KB' ? 1 : targetUnit === 'MB' ? 1 / 1024 : 1 / (1024 * 1024);
  const customTargetMax = targetUnit === 'KB' ? 25 * 1024 : 25;
  const changeTargetUnit = (nextUnit) => {
    const value = Number(customTarget);
    if (Number.isFinite(value) && value > 0) {
      const sizeMb = value * unitToMb[targetUnit];
      const converted = sizeMb / unitToMb[nextUnit];
      setCustomTarget(String(Number(converted.toPrecision(6))));
    }
    setTargetUnit(nextUnit);
  };
  const selectFile = (newFiles) => {
    setFile(newFiles[0] || null);
    setDimensions({ width: '', height: '' });
    setOriginalDimensions(null);
    setResult(null);
  };
  const updateDimension = (axis, value) => {
    setDimensions((current) => {
      const next = { ...current, [axis]: value };
      if (!maintainAspectRatio) return next;
      if (!value) return { width: '', height: '' };
      const numeric = Number(value);
      if (!originalDimensions || !Number.isInteger(numeric) || numeric < 1) return next;
      if (axis === 'width') next.height = String(Math.max(1, Math.round(numeric * originalDimensions.height / originalDimensions.width)));
      else next.width = String(Math.max(1, Math.round(numeric * originalDimensions.width / originalDimensions.height)));
      return next;
    });
  };
  const toggleAspectRatio = (checked) => {
    setMaintainAspectRatio(checked);
    if (checked && originalDimensions && Number(dimensions.width) > 0) {
      setDimensions({
        width: dimensions.width,
        height: String(Math.max(1, Math.round(Number(dimensions.width) * originalDimensions.height / originalDimensions.width)))
      });
    }
  };
  const resetDimensions = () => {
    if (!originalDimensions) return;
    setDimensions({ width: String(originalDimensions.width), height: String(originalDimensions.height) });
  };

  const compress = async () => {
    if (!file) return toast.error('Select a JPG or PNG image first');
    if (!Number.isFinite(targetSizeMb) || targetSizeMb < 1 / 1024 || targetSizeMb > 25) return toast.error('Enter a maximum file size between 1 KB and 25 MB');
    const width = Number(dimensions.width);
    const height = Number(dimensions.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 40_000_000) {
      return toast.error('Enter valid dimensions with a maximum of 40 megapixels total');
    }
    setBusy(true);
    setResult(null);
    try {
      let response;
      try {
        response = await submitImage(file, targetSizeMb, quality, { width, height });
      } catch (error) {
        if (error.status !== 415 || !/Could not decode this JPG or PNG image/i.test(error.message)) throw error;
        const normalizedFile = await normalizeImageForServer(file);
        response = await submitImage(normalizedFile, targetSizeMb, quality, { width, height });
      }
      const blob = await response.blob();
      const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      setResult({
        url: URL.createObjectURL(blob),
        name: createDownloadName(file, extension),
        originalSize: file.size,
        outputSize: blob.size,
        outputWidth: Number(response.headers.get('X-Output-Width')) || width,
        outputHeight: Number(response.headers.get('X-Output-Height')) || height,
        targetMet: response.headers.get('X-Target-Met') === 'true',
        quality
      });
      toast.success('Compressed image is ready');
    } catch (error) {
      toast.error(error.message || 'Could not compress this image');
    } finally {
      setBusy(false);
    }
  };

  if (!draftReady) return <main className="container py-5 tool-page"><p className="small text-secondary">Restoring your saved work…</p></main>;

  return <main className="container py-5 tool-page">
    <Link to="/tools" className="back">← All tools</Link>
    <h2>{tool.name}</h2>
    <p className="lead">Resize a JPG or PNG image and keep it within a selected maximum file size.</p>
    {draftStatus && <p className={`small ${draftStatus === 'Autosave unavailable' ? 'text-warning' : 'text-success'}`} role="status">{draftStatus}</p>}
    <div className="alert alert-info" role="note">The compressor chooses the clearest result it can fit under your maximum. If the image cannot fit without more quality loss, the tool reports that instead of enlarging the file. A PNG larger than the target may be saved as JPEG, so transparent areas become white.</div>
    <FileUploader tool={tool} onFiles={selectFile}/>
    {file && <UploadedFileList files={file}/>}
    {file && <section className="image-compress-dimensions" aria-labelledby="image-compress-dimensions-title">
      <div className="image-compress-section-heading">
        <div><h3 id="image-compress-dimensions-title">Image dimensions</h3><p>{originalDimensions ? `Original: ${originalDimensions.width} × ${originalDimensions.height} px` : 'Set the output width and height in pixels.'}</p></div>
        <button className="image-compress-reset" type="button" onClick={resetDimensions} disabled={!originalDimensions}>Reset</button>
      </div>
      <div className="image-compress-dimension-fields">
        <label>Width (px)<input className="form-control" type="number" min="1" max="40000" step="1" value={dimensions.width} onChange={(event) => updateDimension('width', event.target.value)}/></label>
        <label>Height (px)<input className="form-control" type="number" min="1" max="40000" step="1" value={dimensions.height} onChange={(event) => updateDimension('height', event.target.value)}/></label>
      </div>
      <label className="image-compress-aspect-toggle"><input type="checkbox" checked={maintainAspectRatio} onChange={(event) => toggleAspectRatio(event.target.checked)}/> Maintain aspect ratio</label>
      <small className="image-compress-dimension-hint">Maximum output dimensions: 40 megapixels total.</small>
    </section>}
    <label className="mt-3">Maximum output size<select className="form-select" value={targetChoice} onChange={(event) => setTargetChoice(event.target.value)}>
        {targetOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </label>
    {targetChoice === 'custom' && <div className="image-compress-custom-target mt-3">
      <label htmlFor="image-compress-target-value">Custom maximum size</label>
      <div className="input-group">
        <input id="image-compress-target-value" className="form-control" type="number" min={customTargetMin} max={customTargetMax} step="any" value={customTarget} onChange={(event) => setCustomTarget(event.target.value)}/>
        <select className="form-select" aria-label="Custom target unit" value={targetUnit} onChange={(event) => changeTargetUnit(event.target.value)}>
          <option value="KB">KB</option><option value="MB">MB</option>
        </select>
      </div>
      <small>Enter a maximum from 1 KB to 25 MB.</small>
    </div>}
    <label className="mt-3">Image clarity<select className="form-select" value={quality} onChange={(event) => setQuality(event.target.value)}>
        <option value="clear">High clarity (recommended)</option>
        <option value="balanced">Balanced</option>
        <option value="smallest">Smallest size (lower clarity)</option>
      </select>
    </label>
    <button className="btn btn-primary mt-4" type="button" onClick={compress} disabled={busy || !file}>
      {busy ? 'Compressing image…' : 'Compress image'}
    </button>
    <OperationProgressModal show={busy} title="PDF Pro Cut is compressing your image" description="Please wait while the image size is reduced."/>
    <DownloadResultModal href={result?.url} fileName={result?.name} toolSlug={tool.slug} title="PDF Pro Cut compressed your image" downloadLabel="Download compressed image" onClose={() => setResult(null)}>
      {result && <>
        <p className={result.targetMet ? 'text-success' : 'text-warning'}>
          {result.targetMet ? `Maximum met: ${result.outputSize.toLocaleString()} bytes (${formatSize(result.outputSize)}).` : `Maximum not met. Best result: ${result.outputSize.toLocaleString()} bytes (${formatSize(result.outputSize)}).`}
          {' '}Original: {formatSize(result.originalSize)}. Output: {result.outputWidth} × {result.outputHeight} px.
        </p>
      </>}
    </DownloadResultModal>
  </main>;
}
