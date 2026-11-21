import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import FileUploader from '../components/pdf/FileUploader.jsx';
import { DownloadResultModal, OperationProgressModal } from '../components/pdf/FileOperationModals.jsx';
import PdfPagePreview from '../components/pdf/PdfPagePreview.jsx';
import '../styles/merge.css';
import { createMergeDownloadName } from '../utils/downloadName.js';
import { useBrowserDraft } from '../lib/browserDraft.js';

export default function MergePdfPage({ tool }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [pageOrder, setPageOrder] = useState([]);
  const [draggedPageKey, setDraggedPageKey] = useState(null);
  const [positionDrafts, setPositionDrafts] = useState({});
  const draft = { state: { items: items.map(({ id, rotation, deletedPages }) => ({ id, rotation, deletedPages })), pageOrder, positionDrafts }, files: items.map((item) => item.file), signature: null };
  const { ready: draftReady, status: draftStatus } = useBrowserDraft(`tool:${tool.slug}`, draft, (saved) => {
    const savedItems = saved.state?.items || [];
    setItems((saved.files || []).map((file, index) => ({
      id: savedItems[index]?.id || `${file.name}-${file.lastModified}-${index}`,
      file,
      rotation: savedItems[index]?.rotation || '0',
      deletedPages: savedItems[index]?.deletedPages || [],
      previewPages: null,
      previewError: ''
    })));
    setPageOrder(saved.state?.pageOrder || []);
    setPositionDrafts(saved.state?.positionDrafts || {});
  });

  useEffect(() => { setResult(null); }, [items, pageOrder]);

  const addFiles = (selectedFiles) => {
    const incoming = Array.from(selectedFiles);
    const pdfFiles = incoming.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length !== incoming.length) toast.error('Choose PDF files only');
    const available = Math.max(0, 20 - items.length);
    if (pdfFiles.length > available) toast.error('You can merge up to 20 PDFs at a time');
    const accepted = pdfFiles.slice(0, available);
    if (!accepted.length) return;
    setPageOrder([]);
    setItems((current) => [...current, ...accepted.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      rotation: '0',
      deletedPages: [],
      previewPages: null,
      previewError: '',
    }))]);
  };

  const updateItem = (id, changes) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  const togglePageRemoval = (id, page) => setItems((current) => current.map((item) => {
    if (item.id !== id) return item;
    const deletedPages = item.deletedPages.includes(page) ? item.deletedPages.filter((number) => number !== page) : [...item.deletedPages, page].sort((a, b) => a - b);
    return { ...item, deletedPages };
  }));

  const defaultPageOrder = items.flatMap((item) => (item.previewPages || []).map((page) => ({ itemId: item.id, pageNumber: page.number })));
  const orderedPages = pageOrder.length ? pageOrder : defaultPageOrder;
  const activePages = orderedPages.filter((page) => !items.find((item) => item.id === page.itemId)?.deletedPages.includes(page.pageNumber));
  const pageKey = ({ itemId, pageNumber }) => `${itemId}::${pageNumber}`;
  const isDeleted = (page) => Boolean(items.find((item) => item.id === page.itemId)?.deletedPages.includes(page.pageNumber));

  const reorderPage = (page, targetActiveIndex) => {
    if (isDeleted(page)) return;
    const current = pageOrder.length ? pageOrder : defaultPageOrder;
    const fromIndex = current.findIndex((entry) => entry.itemId === page.itemId && entry.pageNumber === page.pageNumber);
    if (fromIndex < 0) return;
    const next = [...current];
    const [moved] = next.splice(fromIndex, 1);
    const includedAfterRemoval = next.filter((entry) => !isDeleted(entry));
    const target = Math.max(0, Math.min(includedAfterRemoval.length, targetActiveIndex));
    const targetPage = includedAfterRemoval[target];
    const insertAt = targetPage ? next.findIndex((entry) => entry.itemId === targetPage.itemId && entry.pageNumber === targetPage.pageNumber) : next.length;
    next.splice(insertAt < 0 ? next.length : insertAt, 0, moved);
    setPageOrder(next);
    setPositionDrafts({});
  };

  const applyPagePosition = (page, key, value) => {
    const position = Number(value);
    if (Number.isInteger(position) && position >= 1) reorderPage(page, position - 1);
    setPositionDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
  };

  const removeFile = (id) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setPageOrder((current) => current.filter((page) => page.itemId !== id));
  };

  const merge = async () => {
    if (items.length < (tool.organize ? 1 : 2)) return toast.error(tool.organize ? 'Add a PDF to organize' : 'Add at least two PDFs to merge');
    if (items.some((item) => !item.previewPages && !item.previewError)) return toast.error('Wait for all PDF pages to load');
    if (items.some((item) => item.previewError)) return toast.error('Remove PDFs that could not be previewed before merging');
    if (!activePages.length) return toast.error('Keep at least one page to merge');
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      items.forEach(({ file }) => body.append('files', file));
      body.append('mergeOptions', JSON.stringify(items.map(({ rotation, deletedPages }) => ({ rotation, deletedPages }))));
      body.append('pageOrder', JSON.stringify(orderedPages.map(({ itemId, pageNumber }) => ({ fileIndex: items.findIndex((item) => item.id === itemId), pageNumber }))));
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/pdf/${tool.endpoint}`, { method: 'POST', body, credentials: 'include' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw Error(error.error || 'Could not merge these PDFs');
      }
      setResult(URL.createObjectURL(await response.blob()));
      toast.success('Your merged PDF is ready');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const downloadName = createMergeDownloadName(items.map((item) => item.file));
  const allPreviewsReady = items.every((item) => item.previewPages || item.previewError);
  const hasPreviewError = items.some((item) => item.previewError);

  if (!draftReady) return <main className="container py-5 tool-page merge-tool-page"><p className="small text-secondary">Restoring your saved work…</p></main>;

  return <main className="container py-5 tool-page merge-tool-page">
    <Link to="/tools" className="back">← All tools</Link>
    <h2>{tool.name}</h2>
    <p className="lead">Upload PDFs, review every page on the left, and set the final page order.</p>
    {draftStatus && <p className={`small ${draftStatus === 'Autosave unavailable' ? 'text-warning' : 'text-success'}`} role="status">{draftStatus}</p>}
    <div className="merge-workspace">
      <section className="merge-page-board" aria-label="Merged page order">
        <div className="merge-list-heading"><div><h2>Pages in merged PDF</h2><small>Drag pages or change their page number.</small></div><span className="merge-page-count">{activePages.length} included</span></div>
        {items.length === 0 && <p className="merge-empty">Add PDFs to see all their pages here.</p>}
        {items.length > 0 && !allPreviewsReady && <p className="merge-loading">Loading PDF pages…</p>}
        {hasPreviewError && <p className="text-danger">Remove any PDF that could not be previewed before merging.</p>}
        <div className="merge-page-grid">
          {orderedPages.map((page, index) => {
            const item = items.find((entry) => entry.id === page.itemId);
            const preview = item?.previewPages?.find((entry) => entry.number === page.pageNumber);
            if (!item || !preview) return null;
            const deleted = item.deletedPages.includes(page.pageNumber);
            const key = pageKey(page);
            const activeIndex = activePages.findIndex((entry) => pageKey(entry) === key);
            return <article key={key} className={`merge-page-card ${deleted ? 'deleted' : ''} ${draggedPageKey === key ? 'dragging' : ''}`} draggable onDragStart={() => setDraggedPageKey(key)} onDragEnd={() => setDraggedPageKey(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
              event.preventDefault();
              if (draggedPageKey) {
                const source = orderedPages.find((entry) => pageKey(entry) === draggedPageKey);
                let targetIndex = orderedPages.slice(0, index).filter((entry) => !isDeleted(entry)).length;
                const sourceIndex = activePages.findIndex((entry) => pageKey(entry) === draggedPageKey);
                if (sourceIndex >= 0 && sourceIndex < targetIndex) targetIndex -= 1;
                if (source) reorderPage(source, targetIndex);
              }
              setDraggedPageKey(null);
            }}>
              <img src={preview.image} alt={`${item.file.name}, page ${page.pageNumber}`}/>
              <div className="merge-page-source"><strong>{item.file.name}</strong><span>Source page {page.pageNumber}{deleted ? ' · Deleted' : ''}</span></div>
              <label className="merge-page-position">Page number in merged PDF<input className="form-control" type="number" step="1" min="1" max={activePages.length} disabled={deleted} aria-label={`Merged page number for ${item.file.name}, source page ${page.pageNumber}`} value={deleted ? '' : positionDrafts[key] ?? activeIndex + 1} onChange={(event) => setPositionDrafts((current) => ({ ...current, [key]: event.target.value }))} onBlur={(event) => {
                if (event.currentTarget.dataset.enterPressed === 'true') {
                  delete event.currentTarget.dataset.enterPressed;
                  return;
                }
                if (positionDrafts[key] !== undefined) applyPagePosition(page, key, positionDrafts[key]);
              }} onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.dataset.enterPressed = 'true';
                  applyPagePosition(page, key, event.currentTarget.value);
                  event.currentTarget.blur();
                }
              }}/></label>
              <button type="button" className="page-delete-button" aria-label={`${deleted ? 'Restore' : 'Remove'} ${item.file.name} page ${page.pageNumber}`} onClick={() => togglePageRemoval(item.id, page.pageNumber)}>{deleted ? 'Restore page' : 'Remove page'}</button>
            </article>;
          })}
        </div>
      </section>

      <aside className="merge-sidebar">
        <section className="merge-upload-panel"><h2>{tool.organize ? 'Add a PDF to organize' : 'Add PDFs'}</h2><FileUploader tool={tool} onFiles={addFiles}/></section>
        {items.length > 0 && <section className="merge-list" aria-label="PDF merge settings">
          <div className="merge-list-heading"><h2>PDF settings <span>{items.length}</span></h2><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setItems([]); setPageOrder([]); }}>Clear all</button></div>
          {items.map((item, index) => <article key={item.id} className="merge-item">
            <PdfPagePreview key={item.id} file={item.file} selectedPages={[]} onToggle={() => {}} interactive={false} renderPreview={false} onPagesReady={(previewPages) => updateItem(item.id, { previewPages, previewError: '' })} onPreviewError={(previewError) => updateItem(item.id, { previewError })}/>
            <div className="merge-item-top"><div className="merge-file-info"><strong>{item.file.name}</strong><small>{(item.file.size / 1024 / 1024).toFixed(2)}{" " + 'MB · PDF' + " "}{index + 1}</small><small>{item.previewError ? 'Preview failed' : item.previewPages ? `${item.previewPages.length} pages loaded` : 'Loading page previews…'}</small></div><button type="button" className="merge-remove" aria-label={`Remove ${item.file.name}`} onClick={() => removeFile(item.id)}>Remove</button></div>
            <label className="merge-rotation">Rotate pages<select className="form-select" value={item.rotation} onChange={(event) => updateItem(item.id, { rotation: event.target.value })}><option value="0">No rotation</option><option value="90">90 degrees clockwise</option><option value="180">180 degrees</option><option value="270">270 degrees clockwise</option></select></label>
          </article>)}
        </section>}
        <p className="small text-secondary mt-3 mb-0">Download filename: {downloadName}</p>
        <button className="btn btn-primary mt-4" onClick={merge} disabled={busy || items.length < (tool.organize ? 1 : 2) || !allPreviewsReady || hasPreviewError || !activePages.length}>{busy ? (tool.organize ? 'Organizing…' : 'Merging…') : tool.organize ? 'Organize PDF' : 'Merge PDFs'}</button>
        <OperationProgressModal show={busy} title={tool.organize ? 'PDF Pro Cut is organizing your PDF' : 'PDF Pro Cut is merging your PDFs'} description="Please wait while your PDF is prepared."/>
        <DownloadResultModal href={result} fileName={downloadName} toolSlug={tool.slug} title={tool.organize ? 'PDF Pro Cut organized your PDF' : 'PDF Pro Cut merged your PDFs'} downloadLabel="Download PDF" onClose={() => setResult(null)}/>
      </aside>
    </div>
  </main>;
}
