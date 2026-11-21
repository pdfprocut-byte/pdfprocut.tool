import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import WatermarkPreviewCanvas from './WatermarkPreviewCanvas.jsx';

GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfPagePreview({ file, selectedPages, onToggle, interactive = true, deletedPages = [], onDeletePage, renderPreview = true, onPagesReady, onPreviewError, watermarkPreview, pageNumbersPreview }) {
  const [pages, setPages] = useState([]);
  const [error, setError] = useState('');
  const rendered = useRef([]);

  useEffect(() => {
    let active = true;
    const render = async () => {
      setPages([]); setError(''); rendered.current = [];
      if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) return;
      try {
        const bytes = await file.arrayBuffer();
        const pdfDocument = await getDocument({ data: bytes }).promise;
        const previews = [];
        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
          const page = await pdfDocument.getPage(pageNumber);
          const scale = 0.35;
          const viewport = page.getViewport({ scale });
          const canvas = window.document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          previews.push({ number: pageNumber, totalPages: pdfDocument.numPages, image: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, scale });
        }
        await pdfDocument.destroy();
        if (active) {
          if (renderPreview) setPages(previews);
          onPagesReady?.(previews);
        }
      } catch (err) {
        if (active) {
          const message = 'This PDF could not be previewed. It may be encrypted or damaged.';
          setError(message);
          onPreviewError?.(message);
        }
      }
    };
    render();
    return () => { active = false; };
  }, [file]);

  if (!renderPreview) return null;

  if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) return null;
  if (error) return <p className="text-danger mt-3">{error}</p>;
  if (!pages.length) return <p className="text-secondary mt-3">Loading PDF pages…</p>;
  return <section className="page-preview"><div className="d-flex justify-content-between align-items-center"><h2>{interactive ? 'Pages' : 'Page previews'}</h2><small>{onDeletePage ? `${pages.length} pages · Remove pages you don't need` : interactive ? 'Click a page to select it' : `${pages.length} pages`}</small></div><div className="page-grid">{pages.map(page => {
    const deleted = deletedPages.includes(page.number);
    return <div className="page-thumb-wrap" key={page.number}>
      <button type="button" disabled={!interactive} className={`page-thumb ${selectedPages.includes(page.number) ? 'selected' : ''} ${deleted ? 'deleted' : ''}`} onClick={() => onToggle?.(page.number)}>{watermarkPreview || pageNumbersPreview ? <WatermarkPreviewCanvas page={page} options={watermarkPreview || pageNumbersPreview}/> : <img src={page.image} alt={`Page ${page.number}`}/>}<span>Page {page.number}{deleted ? ' · Removed' : ''}</span></button>
      {onDeletePage && <button type="button" className="page-delete-button" aria-label={`${deleted ? 'Restore' : 'Remove'} page ${page.number}`} onClick={() => onDeletePage(page.number)}>{deleted ? 'Restore' : 'Remove'}</button>}
    </div>;
  })}</div></section>;
}
