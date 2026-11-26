import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import FileUploader from '../components/pdf/FileUploader.jsx';
import { DownloadResultModal, OperationProgressModal } from '../components/pdf/FileOperationModals.jsx';
import { createDownloadName } from '../utils/downloadName.js';
import UploadedFileList from '../components/pdf/UploadedFileList.jsx';
import { useBrowserDraft } from '../lib/browserDraft.js';

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const targetOptions = [
  ['0.0009765625', '1 KB'], ['0.048828125', '50 KB'], ['0.09765625', '100 KB'], ['0.1953125', '200 KB'], ['0.25', '250 KB'], ['0.5', '500 KB'], ['1', '1 MB'], ['2', '2 MB'],
  ['5', '5 MB'], ['10', '10 MB'], ['20', '20 MB'], ['24', '24 MB'], ['custom', 'Custom size']
];
const unitToMb = { KB: 1 / 1024, MB: 1 };
const formatSize = (bytes) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export default function CompressFilesPage({ tool }) {
  const [file, setFile] = useState(null);
  const [targetChoice, setTargetChoice] = useState('0.09765625');
  const [customTarget, setCustomTarget] = useState('1.5');
  const [customTargetUnit, setCustomTargetUnit] = useState('MB');
  const [quality, setQuality] = useState('clear');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const draft = { state: { targetChoice, customTarget, customTargetUnit, quality }, files: file ? [file] : [], signature: null };
  const { ready: draftReady, status: draftStatus } = useBrowserDraft(`tool:${tool.slug}`, draft, (saved) => {
    setFile(saved.files[0] || null);
    if (saved.state?.targetChoice) setTargetChoice(saved.state.targetChoice);
    if (saved.state?.customTarget) setCustomTarget(saved.state.customTarget);
    if (saved.state?.customTargetUnit === 'KB' || saved.state?.customTargetUnit === 'MB') setCustomTargetUnit(saved.state.customTargetUnit);
    if (saved.state?.quality) setQuality(saved.state.quality);
  });

  useEffect(() => () => {
    if (result?.url) URL.revokeObjectURL(result.url);
  }, [result]);

  const targetSizeMb = targetChoice === 'custom' ? Number(customTarget) * unitToMb[customTargetUnit] : Number(targetChoice);
  const changeCustomTargetUnit = (nextUnit) => {
    const value = Number(customTarget);
    if (Number.isFinite(value) && value > 0) {
      const converted = value * unitToMb[customTargetUnit] / unitToMb[nextUnit];
      setCustomTarget(String(Number(converted.toPrecision(7))));
    }
    setCustomTargetUnit(nextUnit);
  };

  const compress = async () => {
    if (!file) return toast.error('Select a file first');
    if (!Number.isFinite(targetSizeMb) || targetSizeMb < 1 / 1024 || targetSizeMb > 25) return toast.error('Choose a target between 1 KB and 25 MB');
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append('files', file);
      body.append('targetSizeMb', String(targetSizeMb));
      body.append('quality', quality);
      const response = await fetch(`${apiBase}/pdf/compress`, { method: 'POST', body, credentials: 'include' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Could not compress this file');
      }
      const blob = await response.blob();
      const extension = file.name.split('.').pop().toLowerCase();
      setResult({
        url: URL.createObjectURL(blob),
        name: createDownloadName(file, extension),
        originalSize: file.size,
        outputSize: blob.size,
        targetBytes: Number(response.headers.get('X-Target-Size')) || Math.round(targetSizeMb * 1024 * 1024),
        targetMet: response.headers.get('X-Target-Met') === 'true',
        targetPadded: response.headers.get('X-Target-Padded') === 'true',
        rasterized: response.headers.get('X-PDF-Rasterized') === 'true'
      });
      toast.success('Compressed file is ready');
    } catch (error) {
      toast.error(error.message || 'Could not compress this file');
    } finally {
      setBusy(false);
    }
  };

  if (!draftReady) return <main className="container py-5 tool-page"><p className="small text-secondary">Restoring your saved work…</p></main>;

  return <main className="container py-5 tool-page">
    <Link to="/tools" className="back">← All tools</Link>
    <h2>{tool.name}</h2>
    <p className="lead">Choose the exact output size for a PDF or a modern Word, Excel, or PowerPoint file.</p>
    {tool.gov?.kind === 'pdf-compress' && <p className="government-tool-local-note" role="note">This document is sent to the PDF Pro Cut server for compression. Confirm the current application limit and review the compressed file before submitting it.</p>}
    {draftStatus && <p className={`small ${draftStatus === 'Autosave unavailable' ? 'text-warning' : 'text-success'}`} role="status">{draftStatus}</p>}
    <div className="alert alert-warning" role="note">Compression preserves clarity first, then lowers image quality further if needed. Format-safe padding is added when the compressed file is smaller than your selected size. If the file cannot be reduced enough or the format cannot be padded safely, the actual size is reported. PDF pages may become images, so text may no longer be selectable. The original stays unchanged.</div>
    <FileUploader tool={tool} onFiles={(newFiles) => { setFile(newFiles[0] || null); setResult(null); }}/>
    {file && <UploadedFileList files={file}/>}
    <label className="mt-3">Exact output size<select className="form-select" value={targetChoice} onChange={(event) => setTargetChoice(event.target.value)}>
        {targetOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </label>
    <label className="mt-3">Compression quality<select className="form-select" value={quality} onChange={(event) => setQuality(event.target.value)}>
        <option value="clear">High clarity first</option>
        <option value="balanced">Balanced</option>
        <option value="smallest">Smallest size (lower clarity)</option>
      </select>
    </label>
    {targetChoice === 'custom' && <div className="mt-3">
      <label htmlFor="document-compression-target">Custom exact output size</label>
      <div className="input-group">
        <input id="document-compression-target" className="form-control" type="number" min={customTargetUnit === 'KB' ? 1 : 1 / 1024} max={customTargetUnit === 'KB' ? 25600 : 25} step={customTargetUnit === 'KB' ? 1 : 0.01} value={customTarget} onChange={(event) => setCustomTarget(event.target.value)}/>
        <select className="form-select" aria-label="Custom target size unit" value={customTargetUnit} onChange={(event) => changeCustomTargetUnit(event.target.value)}>
          <option value="KB">KB</option><option value="MB">MB</option>
        </select>
      </div>
      <small className="text-secondary">Choose an exact output size from 1 KB to 25 MB.</small>
    </div>}
    <button className="btn btn-primary mt-4" type="button" onClick={compress} disabled={busy || !file}>
      {busy ? 'Compressing…' : 'Compress file'}
    </button>
    <OperationProgressModal show={busy} title="PDF Pro Cut is compressing your file" description="Please wait while the file size is reduced."/>
    <DownloadResultModal href={result?.url} fileName={result?.name} toolSlug={tool.slug} title="PDF Pro Cut compressed your file" downloadLabel="Download compressed file" onClose={() => setResult(null)}>
      {result && <>
        <p className={result.targetMet ? 'text-success' : 'text-warning'}>
          {result.targetMet ? `Exact output size reached: ${result.outputSize.toLocaleString()} bytes (${formatSize(result.outputSize)}).` : `Could not reach the exact selected size of ${result.targetBytes.toLocaleString()} bytes. Best result: ${result.outputSize.toLocaleString()} bytes (${formatSize(result.outputSize)}).`}
          {' '}Original: {formatSize(result.originalSize)}.
        </p>
        {result.targetPadded && <p className="small text-secondary">Format-safe metadata padding reached the selected byte size without changing the document content.</p>}
        {result.rasterized && <p className="small text-warning">This PDF was rasterized to reduce its size; its text may no longer be selectable or searchable.</p>}
        {result.outputSize >= result.originalSize && !result.targetMet && <p className="small text-secondary">No smaller version could be produced at this quality. Try Balanced or Smallest.</p>}
      </>}
    </DownloadResultModal>
    <p className="small text-secondary mt-3">Supports PDF and modern Word, Excel, and PowerPoint files up to 25 MB. Legacy DOC, XLS, and PPT files are not supported.</p>
  </main>;
}
