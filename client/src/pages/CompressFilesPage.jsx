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
  ['0.09765625', '100 KB'], ['0.25', '250 KB'], ['0.5', '500 KB'], ['1', '1 MB'], ['2', '2 MB'],
  ['5', '5 MB'], ['10', '10 MB'], ['20', '20 MB'], ['24', '24 MB'], ['custom', 'Custom size']
];
const formatSize = (bytes) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export default function CompressFilesPage({ tool }) {
  const [file, setFile] = useState(null);
  const [targetChoice, setTargetChoice] = useState('0.09765625');
  const [customTarget, setCustomTarget] = useState('1.5');
  const [quality, setQuality] = useState('clear');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const draft = { state: { targetChoice, customTarget, quality }, files: file ? [file] : [], signature: null };
  const { ready: draftReady, status: draftStatus } = useBrowserDraft(`tool:${tool.slug}`, draft, (saved) => {
    setFile(saved.files[0] || null);
    if (saved.state?.targetChoice) setTargetChoice(saved.state.targetChoice);
    if (saved.state?.customTarget) setCustomTarget(saved.state.customTarget);
    if (saved.state?.quality) setQuality(saved.state.quality);
  });

  useEffect(() => () => {
    if (result?.url) URL.revokeObjectURL(result.url);
  }, [result]);

  const targetSizeMb = targetChoice === 'custom' ? Number(customTarget) : Number(targetChoice);

  const compress = async () => {
    if (!file) return toast.error('Select a file first');
    if (!Number.isFinite(targetSizeMb) || targetSizeMb < 0.05 || targetSizeMb > 25) return toast.error('Choose a target between 50 KB and 25 MB');
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
        targetMet: response.headers.get('X-Target-Met') === 'true',
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
    <p className="lead">Choose a maximum size for a PDF or a modern Word, Excel, or PowerPoint file.</p>
    {draftStatus && <p className={`small ${draftStatus === 'Autosave unavailable' ? 'text-warning' : 'text-success'}`} role="status">{draftStatus}</p>}
    <div className="alert alert-warning" role="note">The selected size is a maximum. Compression tries to preserve clarity first, then lowers image quality further if needed. PDF pages may become images, so text may no longer be selectable. The original stays unchanged.</div>
    <FileUploader tool={tool} onFiles={(newFiles) => { setFile(newFiles[0] || null); setResult(null); }}/>
    {file && <UploadedFileList files={file}/>}
    <label className="mt-3">Target maximum size<select className="form-select" value={targetChoice} onChange={(event) => setTargetChoice(event.target.value)}>
        {targetOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </label>
    <label className="mt-3">Compression quality<select className="form-select" value={quality} onChange={(event) => setQuality(event.target.value)}>
        <option value="clear">High clarity first</option>
        <option value="balanced">Balanced</option>
        <option value="smallest">Smallest size (lower clarity)</option>
      </select>
    </label>
    {targetChoice === 'custom' && <label className="mt-3">Custom target (MB)<input className="form-control" type="number" min="0.05" max="25" step="0.05" value={customTarget} onChange={(event) => setCustomTarget(event.target.value)}/>
    </label>}
    <button className="btn btn-primary mt-4" type="button" onClick={compress} disabled={busy || !file}>
      {busy ? 'Compressing…' : 'Compress file'}
    </button>
    <OperationProgressModal show={busy} title="PDF Pro Cut is compressing your file" description="Please wait while the file size is reduced."/>
    <DownloadResultModal href={result?.url} fileName={result?.name} toolSlug={tool.slug} title="PDF Pro Cut compressed your file" downloadLabel="Download compressed file" onClose={() => setResult(null)}>
      {result && <>
        <p className={result.targetMet ? 'text-success' : 'text-warning'}>
          {result.targetMet ? `Target reached: ${formatSize(result.outputSize)}.` : `Target not reached. Best result: ${formatSize(result.outputSize)}.`}
          {' '}Original: {formatSize(result.originalSize)}.
        </p>
        {result.rasterized && <p className="small text-warning">This PDF was rasterized to reduce its size; its text may no longer be selectable or searchable.</p>}
        {result.outputSize >= result.originalSize && !result.targetMet && <p className="small text-secondary">No smaller version could be produced at this quality. Try Balanced or Smallest.</p>}
        {result.outputSize >= result.originalSize && result.targetMet && <p className="small text-secondary">This file already meets your target, so its original size was kept.</p>}
      </>}
    </DownloadResultModal>
    <p className="small text-secondary mt-3">Supports PDF and modern Word, Excel, and PowerPoint files up to 25 MB. Legacy DOC, XLS, and PPT files are not supported.</p>
  </main>;
}
