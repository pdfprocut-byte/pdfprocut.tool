import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaEye, FaTimes } from 'react-icons/fa';
import '../../styles/filePreview.css';

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const officeExtensions = new Set(['doc', 'docx', 'docm', 'dotx', 'dotm', 'xls', 'xlsx', 'xlsm', 'xltx', 'xltm', 'ppt', 'pptx', 'pptm', 'ppsx', 'ppsm', 'potx', 'potm']);

function fileExtension(file) {
  return file.name.split('.').pop()?.toLowerCase() || '';
}

function formatSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function FilePreviewButton({ file }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState({ type: '', url: '', text: '', loading: false, error: '' });

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    let objectUrl = '';
    const loadPreview = async () => {
      const extension = fileExtension(file);
      const isPdf = file.type === 'application/pdf' || extension === 'pdf';
      const isImage = file.type.startsWith('image/');
      if (isPdf || isImage) {
        objectUrl = URL.createObjectURL(file);
        setPreview({ type: isPdf ? 'pdf' : 'image', url: objectUrl, text: '', loading: false, error: '' });
        return;
      }
      if (file.type === 'text/plain' || extension === 'txt') {
        try {
          const text = await file.text();
          if (active) setPreview({ type: 'text', url: '', text, loading: false, error: '' });
        } catch {
          if (active) setPreview({ type: '', url: '', text: '', loading: false, error: 'This text file could not be opened.' });
        }
        return;
      }
      if (officeExtensions.has(extension)) {
        setPreview({ type: '', url: '', text: '', loading: true, error: '' });
        try {
          const body = new FormData();
          body.append('files', file);
          const response = await fetch(`${apiBase}/pdf/office-to-pdf`, { method: 'POST', body, credentials: 'include' });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || 'Could not prepare an office document preview.');
          }
          const blob = await response.blob();
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          setPreview({ type: 'pdf', url: objectUrl, text: '', loading: false, error: '' });
        } catch (error) {
          if (active) setPreview({ type: '', url: '', text: '', loading: false, error: error.message || 'Could not prepare an office document preview.' });
        }
        return;
      }
      setPreview({ type: '', url: '', text: '', loading: false, error: 'Preview is not available for this file type.' });
    };
    loadPreview();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, open]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return <>
    <button type="button" className="uploaded-file-view" onClick={() => setOpen(true)} aria-label={`View ${file.name}`}><FaEye/> View</button>
    {open && createPortal(<div className="file-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="file-preview-dialog" role="dialog" aria-modal="true" aria-label={`Preview ${file.name}`}>
        <header className="file-preview-header">
          <div><span>FILE PREVIEW</span><h2 title={file.name}>{file.name}</h2><small>{formatSize(file.size)}</small></div>
          <button type="button" className="file-preview-close" onClick={() => setOpen(false)} aria-label="Close preview"><FaTimes/></button>
        </header>
        <div className="file-preview-content">
          {preview.loading && <div className="file-preview-state"><span className="file-preview-spinner"/> Preparing preview…</div>}
          {preview.error && <p className="file-preview-error" role="alert">{preview.error}</p>}
          {preview.type === 'pdf' && <iframe className="file-preview-frame" src={preview.url} title={`PDF preview: ${file.name}`}/>}
          {preview.type === 'image' && <img className="file-preview-image" src={preview.url} alt={`Preview of ${file.name}`}/>}
          {preview.type === 'text' && <pre className="file-preview-text">{preview.text || 'This text file is empty.'}</pre>}
        </div>
      </section>
    </div>, document.body)}
  </>;
}

export default function UploadedFileList({ files = [] }) {
  const items = Array.isArray(files) ? files.filter(Boolean) : [files].filter(Boolean);
  if (!items.length) return null;
  return <div className="uploaded-file-list">
    {items.map((file, index) => <div className="uploaded-file-row" key={`${file.name}-${file.lastModified}-${index}`}>
      <div className="uploaded-file-meta"><strong title={file.name}>{file.name}</strong><span>{formatSize(file.size)}</span></div>
      <FilePreviewButton file={file}/>
    </div>)}
  </div>;
}
