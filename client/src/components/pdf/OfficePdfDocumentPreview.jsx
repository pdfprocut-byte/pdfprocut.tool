import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export default function OfficePdfDocumentPreview({ file, zoom = 100, onPageCount }) {
  const hostRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let loadingTask;
    setLoading(true);
    setError('');
    const renderDocument = async () => {
      try {
        const data = await file.arrayBuffer();
        if (!active) return;
        loadingTask = getDocument({ data });
        const document = await loadingTask.promise;
        if (!active) { await document.destroy(); return; }
        onPageCount?.(document.numPages);
        const firstPage = await document.getPage(1);
        const pageSize = firstPage.getViewport({ scale: 1 });
        const fitScale = Math.min((window.innerWidth - 96) / pageSize.width, (window.innerHeight - 178) / pageSize.height);
        const scale = fitScale * (zoom / 100);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const fragment = window.document.createDocumentFragment();

        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          if (!active) break;
          const page = pageNumber === 1 ? firstPage : await document.getPage(pageNumber);
          const viewport = page.getViewport({ scale });
          const sheet = window.document.createElement('section');
          sheet.className = 'office-pdf-preview-page';
          const label = window.document.createElement('span');
          label.className = 'office-pdf-preview-page-label';
          label.textContent = `Page ${pageNumber} of ${document.numPages}`;
          const canvas = window.document.createElement('canvas');
          canvas.className = 'office-pdf-preview-canvas';
          canvas.width = Math.ceil(viewport.width * pixelRatio);
          canvas.height = Math.ceil(viewport.height * pixelRatio);
          canvas.style.width = `${Math.ceil(viewport.width)}px`;
          canvas.style.height = `${Math.ceil(viewport.height)}px`;
          const context = canvas.getContext('2d', { alpha: false });
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          sheet.append(label, canvas);
          fragment.append(sheet);
          await page.render({ canvasContext: context, viewport }).promise;
        }
        if (active) {
          hostRef.current?.replaceChildren(fragment);
          setLoading(false);
        }
        await document.destroy();
      } catch (renderError) {
        if (active) {
          setError(renderError.message || 'Could not render the original Word layout.');
          setLoading(false);
        }
      }
    };
    renderDocument();
    return () => {
      active = false;
      loadingTask?.destroy();
    };
  }, [file, zoom, onPageCount]);

  return <div className="office-pdf-preview">
    {loading && <div className="office-pdf-preview-message">Preparing original document layout…</div>}
    {error && <div className="office-pdf-preview-message is-error">{error}</div>}
    <div ref={hostRef} className="office-pdf-preview-pages" aria-label="Original Word document pages"/>
  </div>;
}
