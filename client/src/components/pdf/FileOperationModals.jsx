import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaCheck, FaFileAlt } from 'react-icons/fa';
import toast from 'react-hot-toast';
import ProtectedDownload from '../auth/ProtectedDownload.jsx';
import { useProfile } from '../../context/ProfileContext.jsx';
import { tools } from '../../tools.js';
import '../../styles/fileOperationModals.css';

const relatedToolSlugsBySource = {
  'word-to-pdf': ['edit-pdf', 'compress-files', 'pdf-to-document'],
  'powerpoint-to-pdf': ['edit-pdf', 'compress-files', 'pdf-to-powerpoint'],
  'excel-to-pdf': ['edit-pdf', 'compress-files', 'pdf-to-excel'],
  'pdf-to-document': ['compress-files', 'word-to-pdf'],
  'merge-pdf': ['compress-files', 'add-page-numbers', 'protect-pdf'],
  'organize-pdf': ['compress-files', 'add-page-numbers', 'protect-pdf'],
  'split-pdf': ['organize-pdf', 'compress-files', 'add-page-numbers'],
  'remove-pages': ['organize-pdf', 'compress-files', 'add-page-numbers'],
  'extract-pages': ['organize-pdf', 'compress-files', 'add-page-numbers'],
  'compress-files': ['edit-pdf', 'protect-pdf', 'add-watermark', 'word-to-pdf', 'excel-to-pdf', 'powerpoint-to-pdf'],
  'compress-image': ['convert-to-pdf'],
  'convert-to-pdf': ['organize-pdf', 'compress-files', 'add-page-numbers'],
  'scan-to-pdf': ['organize-pdf', 'compress-files', 'add-page-numbers'],
  'text-to-pdf': ['edit-pdf', 'compress-files', 'add-watermark'],
  'text-to-document': ['compress-files', 'word-to-pdf'],
  'repair-pdf': ['edit-pdf', 'compress-files', 'protect-pdf'],
  'rotate-pdf': ['organize-pdf', 'compress-files', 'add-page-numbers'],
  'crop-pdf': ['edit-pdf', 'compress-files', 'add-watermark'],
  'edit-pdf': ['add-watermark', 'add-page-numbers', 'protect-pdf'],
  'add-watermark': ['add-page-numbers', 'compress-files', 'protect-pdf'],
  'add-image-to-pdf': ['protect-pdf', 'compress-files', 'add-watermark'],
  'add-page-numbers': ['add-watermark', 'compress-files', 'protect-pdf'],
  'sign-pdf': ['protect-pdf', 'compress-files', 'add-watermark'],
  'protect-pdf': ['add-watermark', 'redact-pdf', 'sign-pdf'],
  'unlock-pdf': ['edit-pdf', 'protect-pdf', 'compress-files'],
  'redact-pdf': ['protect-pdf', 'compress-files', 'sign-pdf'],
  'pdf-forms': ['protect-pdf', 'sign-pdf', 'compress-files'],
  'pdf-to-excel': ['compress-files', 'excel-to-pdf'],
  'pdf-to-powerpoint': ['compress-files', 'powerpoint-to-pdf'],
  'pdf-to-pdfa': ['compress-files', 'protect-pdf', 'edit-pdf'],
  'ocr-pdf': ['edit-pdf', 'compress-files', 'pdf-to-document'],
  'html-to-pdf': ['edit-pdf', 'compress-files', 'add-watermark']
};

const fallbackMimeTypes = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

export function OperationProgressModal({ show, title = 'PDF Pro Cut is processing your file', description = 'Please wait while your file is prepared.' }) {
  const [progress, setProgress] = useState(4);

  useEffect(() => {
    if (!show) {
      setProgress(4);
      return undefined;
    }
    const timer = window.setInterval(() => setProgress((value) => Math.min(90, value + 2)), 500);
    return () => window.clearInterval(timer);
  }, [show]);

  if (!show) return null;
  return createPortal(<div className="file-operation-backdrop" role="presentation">
    <section className="file-operation-progress-modal" role="dialog" aria-modal="true" aria-labelledby="file-operation-progress-title" aria-describedby="file-operation-progress-description">
      <div className="file-operation-progress-visual" aria-hidden="true">
        <span className="file-operation-progress-orbit"/>
        <span className="file-operation-progress-orbit file-operation-progress-orbit-inner"/>
        <span className="file-operation-progress-file"><FaFileAlt/></span>
        <span className="file-operation-progress-spark">✦</span>
      </div>
      <span className="file-operation-progress-brand">PDF PRO CUT <i/> DOCUMENT WORKSPACE</span>
      <h3 id="file-operation-progress-title">{title}</h3>
      <p className="file-operation-progress-description" id="file-operation-progress-description">{description}</p>
      <div className="file-operation-progress-track" role="progressbar" aria-label="Estimated progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
        <span style={{ width: `${progress}%` }}/>
      </div>
      <div className="file-operation-progress-status"><span><i/> Preparing your file</span><strong>{progress}%</strong></div>
      <div className="file-operation-progress-footnote">Please keep this window open while your file is being prepared.</div>
    </section>
  </div>, document.body);
}

export function DownloadResultModal({ href, fileName, toolSlug, title = 'PDF Pro Cut file is ready', downloadLabel = 'Download file', onClose, children }) {
  const [minimized, setMinimized] = useState(false);
  const [minimizing, setMinimizing] = useState(false);
  const [openingTool, setOpeningTool] = useState('');
  const timer = useRef(null);
  const navigate = useNavigate();
  const { recordOperation, setPendingToolFile } = useProfile();
  const extension = fileName?.split('.').pop()?.toLowerCase() || '';
  const sourceTool = tools.find((tool) => tool.slug === toolSlug);
  const acceptedMimeType = fallbackMimeTypes[extension];
  const suggestions = (relatedToolSlugsBySource[toolSlug] || [])
    .map((slug) => tools.find((tool) => tool.slug === slug))
    .filter((tool) => tool && String(tool.accept || '').toLowerCase().split(',').map((accept) => accept.trim()).some((accept) => accept === `.${extension}` || (acceptedMimeType && accept === acceptedMimeType)));

  useEffect(() => {
    setMinimized(false);
    setMinimizing(false);
    return () => {
      window.clearTimeout(timer.current);
      if (typeof href === 'string' && href.startsWith('blob:')) URL.revokeObjectURL(href);
    };
  }, [href]);

  useEffect(() => {
    if (!href) return;
    const operation = {
      token: href,
      tool: title.replace(/^(?:PDF Pro Cut|File Procut)\s*/i, '').trim() || 'File operation',
      outputName: fileName || 'Completed file'
    };
    fetch(href).then((response) => {
      if (!response.ok) throw new Error('Could not read the completed file for local storage.');
      return response.blob();
    }).then((blob) => recordOperation({ ...operation, blob })).catch(() => recordOperation(operation));
  }, [href, title, fileName, recordOperation]);

  const close = () => {
    window.clearTimeout(timer.current);
    setMinimizing(false);
    setMinimized(false);
    onClose?.();
  };

  const finishDownload = () => {
    window.clearTimeout(timer.current);
    onClose?.();
    toast.custom((toastItem) => <div className={`pdfcut-thankyou-toast${toastItem.visible ? ' is-visible' : ''}`} role="status" aria-live="polite">
      <span className="pdfcut-thankyou-icon"><FaCheck/></span>
      <span className="pdfcut-thankyou-copy"><strong>Thank you for choosing PDF Pro Cut!</strong><small>Your download has started.</small></span>
    </div>, { duration: 3000, position: 'top-center' });
  };

  const minimize = () => {
    if (minimizing) return;
    setMinimizing(true);
    timer.current = window.setTimeout(() => {
      setMinimized(true);
      setMinimizing(false);
    }, 280);
  };

  const openWithTool = async (tool) => {
    if (openingTool) return;
    setOpeningTool(tool.slug);
    try {
      const response = await fetch(href);
      if (!response.ok) throw new Error('Could not open the completed file. Please download it and try again.');
      const blob = await response.blob();
      const file = new File([blob], fileName || `fileprocut.${extension || 'file'}`, {
        type: blob.type || fallbackMimeTypes[extension] || 'application/octet-stream'
      });
      setPendingToolFile(file);
      onClose?.();
      navigate(`/tools/${tool.slug}`);
    } catch (error) {
      toast.error(error.message || 'Could not open the completed file in this tool.');
    } finally {
      setOpeningTool('');
    }
  };

  if (!href) return null;
  return createPortal(<>
    {!minimized && <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-50 p-3 file-operation-backdrop" role="presentation">
      <section className={`card shadow-lg w-100 position-relative file-operation-result-modal ${minimizing ? 'file-operation-modal-minimizing' : 'file-operation-modal-enter'}`} role="dialog" aria-modal="true" aria-labelledby="file-operation-result-title">
        <div className="position-absolute top-0 end-0 d-flex align-items-center gap-1 m-2">
          <button className="btn btn-link text-secondary text-decoration-none p-1 fs-4" style={{ lineHeight: 1 }} type="button" aria-label="Minimize download box" title="Minimize" onClick={minimize}><span aria-hidden="true">&minus;</span></button>
          <button className="btn btn-link text-danger text-decoration-none p-1 fs-3" style={{ lineHeight: 1 }} type="button" aria-label="Close download box" title="Close" onClick={close}><span aria-hidden="true">&times;</span></button>
        </div>
        <div className="card-body p-4">
          <div className="file-operation-result-heading">
            <span className="file-operation-success-icon" aria-hidden="true"><FaCheck/></span>
            <div className="min-w-0">
              <span className="file-operation-result-kicker">FILE READY</span>
              <h3 id="file-operation-result-title">{title}</h3>
              {fileName && <p className="file-operation-result-filename">{fileName}</p>}
            </div>
          </div>
          {children}
          {suggestions.length > 0 && <section className="file-operation-followups" aria-labelledby="file-operation-followups-title">
            <span className="file-operation-followups-label">NEXT STEPS</span>
            <h4 id="file-operation-followups-title">Recommended for {sourceTool?.name || 'this file'}</h4>
            <p>Suggestions match this operation and the completed file type.</p>
            <div className="file-operation-followup-grid">
              {suggestions.map((tool) => {
                const Icon = tool.icon;
                return <button className="file-operation-followup" type="button" key={tool.slug} disabled={Boolean(openingTool)} onClick={() => openWithTool(tool)}>
                  <span className="file-operation-followup-icon" aria-hidden="true"><Icon/></span>
                  <span className="file-operation-followup-copy"><strong>{tool.name}</strong><small>{tool.category}</small></span>
                  {openingTool === tool.slug && <span className="file-operation-followup-opening">Opening</span>}
                </button>;
              })}
            </div>
          </section>}
          <div className="d-flex flex-wrap gap-2 mt-3">
            <ProtectedDownload className="btn btn-success file-operation-download-button" href={href} download={fileName} onDownloaded={finishDownload}>{downloadLabel}</ProtectedDownload>
          </div>
        </div>
      </section>
    </div>}
    {minimized && <aside className="file-operation-minimized-tray" aria-label="Minimized file download">
      <button className="file-operation-minimized-open" type="button" onClick={() => setMinimized(false)} aria-label="Restore download box">
        <strong>PDF Pro Cut · File ready</strong>
        <span>{fileName || downloadLabel}</span>
      </button>
      <button className="btn btn-link text-danger text-decoration-none p-1 fs-4" type="button" aria-label="Close download box" title="Close" onClick={close}><span aria-hidden="true">&times;</span></button>
    </aside>}
  </>, document.body);
}
