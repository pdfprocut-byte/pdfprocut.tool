import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import FileUploader from '../components/pdf/FileUploader.jsx';
import { DownloadResultModal, OperationProgressModal } from '../components/pdf/FileOperationModals.jsx';
import { createDownloadName } from '../utils/downloadName.js';
import UploadedFileList from '../components/pdf/UploadedFileList.jsx';
import { useBrowserDraft } from '../lib/browserDraft.js';
import '../styles/compressionWarnings.css';

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const PdfPagePreview = lazy(() => import('../components/pdf/PdfPagePreview.jsx'));
const targetOptions = [
  ['0.009765625', '10 KB'], ['0.01953125', '20 KB'], ['0.029296875', '30 KB'], ['0.048828125', '50 KB'], ['0.09765625', '100 KB'], ['0.1953125', '200 KB'], ['0.25', '250 KB'], ['0.5', '500 KB'], ['1', '1 MB'], ['2', '2 MB'],
  ['5', '5 MB'], ['10', '10 MB'], ['20', '20 MB'], ['24', '24 MB'], ['custom', 'Custom size']
];
const unitToMb = { KB: 1 / 1024, MB: 1 };
const formatSize = (bytes) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const formatCompressionError = (message) => String(message).replace(/([\d,]+)\s+bytes?/gi, (_match, value) => formatSize(Number(value.replaceAll(',', ''))));

export default function CompressFilesPage({ tool }) {
  const [file, setFile] = useState(null);
  const [targetChoice, setTargetChoice] = useState('0.09765625');
  const [customTarget, setCustomTarget] = useState('1.5');
  const [customTargetUnit, setCustomTargetUnit] = useState('MB');
  const [quality, setQuality] = useState('clear');
  const [allowRasterization, setAllowRasterization] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const draft = { state: { targetChoice, customTarget, customTargetUnit, quality, allowRasterization }, files: file ? [file] : [], signature: null };
  const { ready: draftReady, status: draftStatus } = useBrowserDraft(`tool:${tool.slug}`, draft, (saved) => {
    setFile(saved.files[0] || null);
    if (saved.state?.targetChoice) setTargetChoice(saved.state.targetChoice);
    if (saved.state?.customTarget) setCustomTarget(saved.state.customTarget);
    if (saved.state?.customTargetUnit === 'KB' || saved.state?.customTargetUnit === 'MB') setCustomTargetUnit(saved.state.customTargetUnit);
    if (saved.state?.quality) setQuality(saved.state.quality);
    const savedRasterization = saved.state?.allowRasterization ?? saved.state?.allowImageOnlyOptimization;
    if (savedRasterization !== undefined) setAllowRasterization(savedRasterization);
  });

  useEffect(() => () => {
    if (result?.url) URL.revokeObjectURL(result.url);
  }, [result]);

  const targetSizeMb = targetChoice === 'custom' ? Number(customTarget) * unitToMb[customTargetUnit] : Number(targetChoice);
  const isPdf = Boolean(file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')));
  const changeCustomTargetUnit = (nextUnit) => {
    const value = Number(customTarget);
    if (Number.isFinite(value) && value > 0) {
      const converted = value * unitToMb[customTargetUnit] / unitToMb[nextUnit];
      setCustomTarget(String(Number(converted.toPrecision(7))));
    }
    setCustomTargetUnit(nextUnit);
  };

  const compress = async () => {
    setErrorMessage('');
    if (!file) return setErrorMessage('Select a file first.');
    if (!Number.isFinite(targetSizeMb) || targetSizeMb < 1 / 1024 || targetSizeMb > 25) return setErrorMessage('Choose a maximum size between 1 KB and 25 MB.');
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append('files', file);
      body.append('targetSizeMb', String(targetSizeMb));
      body.append('quality', quality);
      body.append('allowRasterization', String(isPdf && allowRasterization));
      const response = await fetch(`${apiBase}/pdf/compress`, { method: 'POST', body, credentials: 'include' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Could not compress this file');
      }
      const blob = await response.blob();
      const extension = file.name.split('.').pop().toLowerCase();
      const resultName = createDownloadName(file, extension);
      setResult({
        url: URL.createObjectURL(blob),
        name: resultName,
        originalSize: file.size,
        outputSize: blob.size,
        targetMet: response.headers.get('X-Target-Met') === 'true',
        rasterized: response.headers.get('X-PDF-Rasterized') === 'true',
        previewFile: isPdf ? new File([blob], resultName, { type: 'application/pdf' }) : null,
        compressionPercent: file.size ? ((file.size - blob.size) / file.size) * 100 : 0
      });
      toast.success('Compressed file is ready');
    } catch (error) {
      setErrorMessage(formatCompressionError(error.message || 'Could not compress this file.'));
    } finally {
      setBusy(false);
    }
  };

  if (!draftReady) return <main className="container py-5 tool-page"><p className="small text-secondary">Restoring your saved work…</p></main>;

  return <main className="container py-5 tool-page">
    <Link to="/tools" className="back">← All tools</Link>
    <h1>{tool.name}</h1>
    <p className="lead">Choose a maximum file size for a PDF or a modern Word, Excel, or PowerPoint file.</p>
    {tool.gov?.kind === 'pdf-compress' && <p className="government-tool-local-note" role="note">This document is sent to the PDF Pro Cut server for compression. Confirm the current application limit and review the compressed file before submitting it.</p>}
    {draftStatus && <p className={`small ${draftStatus === 'Autosave unavailable' ? 'text-warning' : 'text-success'}`} role="status">{draftStatus}</p>}
    <div className="alert alert-warning" role="note">Compression keeps the original unchanged and reports the actual output size. PDF optimization preserves selectable text and page dimensions by default, so some PDFs may not shrink enough to meet a very small limit.</div>
    <FileUploader tool={tool} onFiles={(newFiles) => { setFile(newFiles[0] || null); setResult(null); setErrorMessage(''); }}/>
    {file && <UploadedFileList files={file}/>}
    {file && isPdf && <section className="compression-preview-panel" aria-label="Original PDF preview"><h3>Original PDF preview</h3><Suspense fallback={<p role="status">Loading PDF preview…</p>}><PdfPagePreview file={file} selectedPages={[]} interactive={false}/></Suspense></section>}
    {isPdf && <label className="compression-image-only-option"><input type="checkbox" checked={allowRasterization} onChange={(event) => { setAllowRasterization(event.target.checked); setErrorMessage(''); }}/> Allow image-based compression to reduce the PDF further</label>}
    {isPdf && allowRasterization && <p className="small text-secondary">Pages are saved as images. Text will no longer be selectable or searchable, and links, fields, comments, and other interactive content may not be preserved. PDFs with digital signatures, rotated pages, or cropped page bounds are not supported.</p>}
    <label className="mt-3">Maximum output size<select className="form-select" value={targetChoice} onChange={(event) => { setTargetChoice(event.target.value); setErrorMessage(''); }}>
        {targetOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
      <small className="text-secondary">This is a maximum, not an exact target. A file already below it stays unchanged.</small>
    </label>
    {(!isPdf || allowRasterization) && <label className="mt-3">Compression quality<select className="form-select" value={quality} onChange={(event) => { setQuality(event.target.value); setErrorMessage(''); }}>
        <option value="clear">High clarity first</option>
        <option value="balanced">Balanced</option>
        <option value="smallest">Smallest size (lower clarity)</option>
      </select>
    </label>}
    {targetChoice === 'custom' && <div className="mt-3">
      <label htmlFor="document-compression-target">Custom maximum size</label>
      <div className="input-group">
        <input id="document-compression-target" className="form-control" type="number" min={customTargetUnit === 'KB' ? 1 : 1 / 1024} max={customTargetUnit === 'KB' ? 25600 : 25} step={customTargetUnit === 'KB' ? 1 : 0.01} value={customTarget} onChange={(event) => { setCustomTarget(event.target.value); setErrorMessage(''); }}/>
        <select className="form-select" aria-label="Custom target size unit" value={customTargetUnit} onChange={(event) => { changeCustomTargetUnit(event.target.value); setErrorMessage(''); }}>
          <option value="KB">KB</option><option value="MB">MB</option>
        </select>
      </div>
      <small className="text-secondary">Choose a maximum from 1 KB to 25 MB.</small>
    </div>}
    {errorMessage && <div className="compression-error-panel" role="alert">
      <div className="compression-error-heading">
        <strong>Warning</strong>
        <button type="button" aria-label="Dismiss warning" onClick={() => setErrorMessage('')}>×</button>
      </div>
      <p>{errorMessage}</p>
    </div>}
    <button className="btn btn-primary mt-4" type="button" onClick={compress} disabled={busy || !file}>
      {busy ? 'Compressing…' : 'Compress file'}
    </button>
    {result?.previewFile && <section className="compression-preview-panel" aria-label="Compressed PDF preview"><h3>Compressed PDF preview</h3><Suspense fallback={<p role="status">Loading PDF preview…</p>}><PdfPagePreview file={result.previewFile} selectedPages={[]} interactive={false}/></Suspense></section>}
    <OperationProgressModal show={busy} title="PDF Pro Cut is compressing your file" description="Please wait while the file size is reduced."/>
    <DownloadResultModal href={result?.url} fileName={result?.name} toolSlug={tool.slug} title="PDF Pro Cut compressed your file" downloadLabel="Download compressed file" onClose={() => setResult(null)}>
      {result && <>
        <p className={result.targetMet ? 'text-success' : 'text-warning'}>
          {result.targetMet ? `Maximum met: ${formatSize(result.outputSize)}.` : `Maximum not met. Best result: ${formatSize(result.outputSize)}.`}
          {' '}Original: {formatSize(result.originalSize)}; {Math.abs(result.compressionPercent).toFixed(1)}% {result.compressionPercent >= 0 ? 'smaller' : 'larger'} output.
        </p>
        {result.rasterized && <p className="small text-warning">This PDF was saved as page images. Text is no longer selectable or searchable.</p>}
        {result.outputSize >= result.originalSize && !result.targetMet && <p className="small text-secondary">No smaller version could be produced at this quality. Try Balanced or Smallest.</p>}
      </>}
    </DownloadResultModal>
    <p className="small text-secondary mt-3">Supports PDF and modern Word, Excel, and PowerPoint files up to 25 MB. Legacy DOC, XLS, and PPT files are not supported.</p>
  </main>;
}
