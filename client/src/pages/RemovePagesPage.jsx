import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import FileUploader from '../components/pdf/FileUploader.jsx';
import UploadedFileList from '../components/pdf/UploadedFileList.jsx';
import PdfPagePreview from '../components/pdf/PdfPagePreview.jsx';
import { DownloadResultModal, OperationProgressModal } from '../components/pdf/FileOperationModals.jsx';
import '../styles/merge.css';
import { createDownloadName } from '../utils/downloadName.js';
import { useBrowserDraft } from '../lib/browserDraft.js';

export default function RemovePagesPage({ tool }) {
  const [file, setFile] = useState(null);
  const [selectedPages, setSelectedPages] = useState([]);
  const [pagesInput, setPagesInput] = useState('');
  const [rangeError, setRangeError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const draft = { state: { selectedPages, pagesInput }, files: file ? [file] : [], signature: null };
  const { ready: draftReady, status: draftStatus } = useBrowserDraft(`tool:${tool.slug}`, draft, (saved) => {
    setFile(saved.files[0] || null);
    setSelectedPages(saved.state?.selectedPages || []);
    setPagesInput(saved.state?.pagesInput || '');
  });

  const togglePage = (page) => {
    const next = (selectedPages.includes(page)
      ? selectedPages.filter((number) => number !== page)
      : [...selectedPages, page]
    ).sort((a, b) => a - b);
    setSelectedPages(next);
    setPagesInput(next.join(','));
    setRangeError('');
  };

  const updatePagesInput = (value) => {
    setPagesInput(value);
    if (!value.trim()) {
      setSelectedPages([]);
      setRangeError('');
      return;
    }

    const pages = new Set();
    for (const part of value.split(',')) {
      const match = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
      if (!match) {
        setSelectedPages([]);
        setRangeError('Enter page numbers like 1-3,5.');
        return;
      }
      const first = Number(match[1]);
      const last = Number(match[2] || first);
      if (first < 1 || last < first || last - first > 1000) {
        setSelectedPages([]);
        setRangeError('Enter a valid page range.');
        return;
      }
      for (let page = first; page <= last; page++) pages.add(page);
    }
    setSelectedPages([...pages].sort((a, b) => a - b));
    setRangeError('');
  };

  const removePages = async () => {
    if (!file) return toast.error('Select a PDF first');
    if (rangeError) return toast.error(rangeError);
    if (!selectedPages.length) return toast.error('Choose at least one page to remove');
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append('files', file);
      body.append('pages', selectedPages.join(','));
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/pdf/${tool.endpoint}`, { method: 'POST', body, credentials: 'include' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw Error(error.error || 'Could not remove the selected pages');
      }
      setResult(URL.createObjectURL(await response.blob()));
      toast.success('Selected pages removed');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (!draftReady) return <main className="container py-5 tool-page"><p className="small text-secondary">Restoring your saved work…</p></main>;

  return <main className="container py-5 tool-page">
    <Link to="/tools" className="back">← All tools</Link>
    <h2>{tool.name}</h2>
    <p className="lead">Select pages to remove, or use the Remove button below each page.</p>
    {draftStatus && <p className={`small ${draftStatus === 'Autosave unavailable' ? 'text-warning' : 'text-success'}`} role="status">{draftStatus}</p>}
    <FileUploader tool={tool} onFiles={(files) => { setFile(files[0] || null); setSelectedPages([]); setPagesInput(''); setRangeError(''); setResult(null); }}/>
    {file && <UploadedFileList files={file}/>}
    {file && <PdfPagePreview file={file} selectedPages={selectedPages} onToggle={togglePage} deletedPages={selectedPages} onDeletePage={togglePage}/>}
    {file && <label className="mt-3">Selected pages to remove<input className="form-control" placeholder="Click pages or enter 1-3,5" value={pagesInput} onChange={(event) => updatePagesInput(event.target.value)} aria-invalid={Boolean(rangeError)}/>{rangeError && <small className="text-danger">{rangeError}</small>}</label>}
    {file && <button className="btn btn-primary mt-4" onClick={removePages} disabled={busy || !selectedPages.length}>{busy ? 'Processing…' : 'Remove selected pages'}</button>}
    <OperationProgressModal show={busy} title="PDF Pro Cut is removing pages" description="Please wait while your PDF is updated."/>
    <DownloadResultModal href={result} fileName={file ? createDownloadName(file, 'pdf') : ''} toolSlug={tool.slug} title="PDF Pro Cut updated your PDF" downloadLabel="Download PDF" onClose={() => setResult(null)}/>
  </main>;
}
