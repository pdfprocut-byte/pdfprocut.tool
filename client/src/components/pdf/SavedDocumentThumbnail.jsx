import { useEffect, useRef, useState } from 'react';
import { FaFileAlt, FaFilePdf } from 'react-icons/fa';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useProfile } from '../../context/ProfileContext.jsx';

GlobalWorkerOptions.workerSrc = workerUrl;

export default function SavedDocumentThumbnail({ document }) {
  const container = useRef(null);
  const [visible, setVisible] = useState(false);
  const [preview, setPreview] = useState({ kind: 'loading', src: '' });
  const { downloadDocument } = useProfile();
  const extension = document.name.split('.').pop()?.toLowerCase() || '';
  const isPdf = document.type === 'application/pdf' || extension === 'pdf';
  const isImage = document.type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension);

  useEffect(() => {
    if (!container.current || visible) return undefined;
    if (!('IntersectionObserver' in window)) { setVisible(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '160px' });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    let objectUrl = '';
    let pdfDocument;
    setPreview({ kind: 'loading', src: '' });
    const render = async () => {
      try {
        const blob = await downloadDocument(document.id);
        if (!active) return;
        if (isImage) {
          objectUrl = URL.createObjectURL(blob);
          setPreview({ kind: 'image', src: objectUrl });
          return;
        }
        if (isPdf) {
          const loadingTask = getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false });
          pdfDocument = await loadingTask.promise;
          if (!active) return;
          const page = await pdfDocument.getPage(1);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(0.42, 88 / base.width, 112 / base.height);
          const viewport = page.getViewport({ scale });
          const canvas = window.document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          page.cleanup();
          if (active) setPreview({ kind: 'page', src: canvas.toDataURL('image/png') });
          canvas.width = 0;
          canvas.height = 0;
          await pdfDocument.destroy();
          pdfDocument = null;
          return;
        }
        setPreview({ kind: 'file', src: '' });
      } catch {
        if (active) setPreview({ kind: 'file', src: '' });
      }
    };
    render();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (pdfDocument) void pdfDocument.destroy();
    };
  }, [visible, document.id, isImage, isPdf, downloadDocument]);

  return <div className={`profile-document-thumbnail${preview.kind === 'page' || preview.kind === 'image' ? ' has-preview' : ''}`} ref={container} aria-label={`${document.name} preview`}>
    {preview.kind === 'image' || preview.kind === 'page'
      ? <img src={preview.src} alt={`${document.name} first page`} loading="lazy"/>
      : preview.kind === 'loading'
        ? <span className="profile-thumbnail-skeleton" aria-hidden="true"/>
        : <span className="profile-thumbnail-file" aria-hidden="true">{isPdf ? <FaFilePdf/> : <FaFileAlt/>}<small>{extension.slice(0, 4) || 'FILE'}</small></span>}
    {isPdf && <span className="profile-thumbnail-page-label">PAGE 1</span>}
  </div>;
}
